import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { getPool, ensureSchema, isDbConfigured } from './db';
import { sendMail, isMailConfigured } from './mailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Behind Passenger/nginx/a reverse proxy (as on Namecheap cPanel), the real client IP is
// in X-Forwarded-For - trust the first hop so rate limiting keys off the actual visitor,
// not the proxy's own address.
app.set('trust proxy', 1);

// SSL/HTTPS is handled by cPanel/Apache reverse proxy, so we don't force it in Express

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: 'Admin portal is not configured (ADMIN_PASSWORD missing on server).' });
  }
  if (req.header('x-admin-password') !== adminPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  next();
}

// Rate limit for the public, unauthenticated submission endpoints (listing submissions,
// quote requests, claim requests) that are otherwise wide open to scripted spam.
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this network. Please try again later.' },
});

// Rate limit for admin authentication - applied to /api/admin/login AND every route
// protected by requireAdmin, since an attacker could otherwise skip the login endpoint
// entirely and brute-force the shared password by guessing the x-admin-password header
// directly against any admin route. Only failed attempts count against the limit
// (skipSuccessfulRequests), so normal admin usage is never throttled.
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many failed admin login attempts. Please try again later.' },
});

// Honeypot check: a hidden form field named `hp` that real users never see or fill in,
// but simple bots that auto-fill every input often do. If it's populated, we pretend the
// submission succeeded (so the bot doesn't learn to avoid the field) without actually
// writing anything to the database or sending any email.
function isHoneypotTripped(req: express.Request): boolean {
  return !!req.body?.hp;
}

// Best-effort heads-up email to the site admin so new items don't sit invisible until
// someone happens to open the Admin Portal. Never blocks or fails the caller's request.
function notifyAdmin(subject: string, text: string): void {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return;
  sendMail({ to, subject, text }).catch(() => {});
}

// Lazy Stripe initialization helper
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeInstance = new Stripe(key);
    }
  }
  return stripeInstance;
}

// Special raw body parser for Stripe webhook signature verification
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !webhookSecret) {
      console.warn('Stripe secret key or webhook secret missing on server');
      return res.status(400).json({ error: 'Stripe webhook is not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
      if (!sig) {
        return res.status(400).send('Missing Stripe signature header');
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Payment checkout session completed:', session.id, session.customer_details?.email);

        const listingId = session.metadata?.listingId;
        const db = getPool();
        if (listingId && db) {
          try {
            await ensureSchema();
            await db.query('UPDATE listings SET featured = TRUE, stripe_subscription_id = ? WHERE id = ?', [
              typeof session.subscription === 'string' ? session.subscription : null,
              listingId,
            ]);
            console.log('Marked listing as featured after successful payment:', listingId);
          } catch (err) {
            console.error('Failed to mark listing as featured after checkout:', err);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription cancelled:', subscription.id);

        const db = getPool();
        if (db) {
          try {
            await ensureSchema();
            await db.query('UPDATE listings SET featured = FALSE WHERE stripe_subscription_id = ?', [subscription.id]);
            console.log('Removed featured status after subscription cancellation:', subscription.id);
          } catch (err) {
            console.error('Failed to remove featured status after subscription cancellation:', err);
          }
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// JSON body parser for standard REST API endpoints
app.use(express.json());

// API route: Stripe status
app.get('/api/stripe/status', (req, res) => {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;

  res.json({
    configured: hasSecretKey,
    hasWebhookSecret,
    message: hasSecretKey
      ? 'Stripe secret key and webhook secret configured on server.'
      : 'Stripe secret key not set in environment.',
  });
});

// API route: Create Stripe Checkout Session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({
        error: 'STRIPE_SECRET_KEY is missing in backend environment variables.',
      });
    }

    const { listingTitle, listingId, returnUrl } = req.body;
    const origin = returnUrl || req.headers.origin || process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Featured Listing Promotion - ${listingTitle || 'ClearAnEstate Business'}`,
              description: 'ClearAnEstate Top Placement & Priority Directory Badge ($30/mo)',
            },
            unit_amount: 3000, // $30.00
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}?featured_success=true&listing_id=${listingId || ''}`,
      cancel_url: `${origin}?featured_cancel=true`,
      metadata: {
        listingId: listingId || '',
        listingTitle: listingTitle || '',
      },
    });

    res.json({ url: session.url, id: session.id });
  } catch (err: any) {
    console.error('Error creating Stripe checkout session:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// ---- Directory Listings API (MySQL-backed, falls back to 404 if not configured) ----

function rowToListing(row: any) {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    category: row.category,
    city: row.city,
    state: row.state,
    phone: row.phone || undefined,
    website: row.website,
    email: row.email || undefined,
    description: row.description,
    services: row.services ? JSON.parse(row.services) : [],
    featured: !!row.featured,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    yearsInBusiness: row.years_in_business ?? undefined,
    insured: !!row.insured,
    bonded: !!row.bonded,
    hours: row.hours || undefined,
    claimed: !!row.claimed,
    address: row.address || undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString().split('T')[0]
        : String(row.created_at).split('T')[0],
  };
}

function rowToPending(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    state: row.state,
    phone: row.phone || '',
    website: row.website,
    email: row.email,
    contactName: row.contact_name,
    description: row.description,
    services: row.services ? JSON.parse(row.services) : [],
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString().split('T')[0]
        : String(row.submitted_at).split('T')[0],
    status: row.status,
  };
}

// Status check so the frontend knows whether to use the API or fall back to local demo data.
app.get('/api/listings/status', (req, res) => {
  res.json({ configured: isDbConfigured() });
});

// Public: fetch live directory listings
app.get('/api/listings', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listings ORDER BY featured DESC, rating DESC');
    res.json((rows as any[]).map(rowToListing));
  } catch (err: any) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings.' });
  }
});

// Public: submit a new business for review
app.post('/api/listings/submit', submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  const { name, category, city, state, phone, website, email, contactName, description, services } = req.body;

  if (!name || !city || !state || !email) {
    return res.status(400).json({ error: 'Business Name, City, State, and Contact Email are required.' });
  }

  if (isHoneypotTripped(req)) {
    return res.status(201).json({
      id: 'p-' + Date.now(),
      name,
      category: category || 'Estate Cleanouts',
      city,
      state,
      phone: phone || '',
      website: website || 'https://example.com',
      email,
      contactName: contactName || 'Business Owner',
      description: description || '',
      services: Array.isArray(services) ? services : [],
      submittedAt: new Date().toISOString().split('T')[0],
      status: 'pending',
    });
  }

  try {
    await ensureSchema();
    const id = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const submittedAt = new Date().toISOString().split('T')[0];
    const servicesList = Array.isArray(services) && services.length > 0 ? services : ['Estate Cleanout', 'Property Clearing'];

    await db.query(
      `INSERT INTO pending_submissions
        (id, name, category, city, state, phone, website, email, contact_name, description, services, submitted_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        name,
        category || 'Estate Cleanouts',
        city,
        state.toUpperCase(),
        phone || '',
        website || 'https://example.com',
        email,
        contactName || 'Business Owner',
        description || `${name} provides professional ${category || 'estate cleanout'} services.`,
        JSON.stringify(servicesList),
        submittedAt,
      ]
    );

    const [rows] = await db.query('SELECT * FROM pending_submissions WHERE id = ?', [id]);
    notifyAdmin(
      `New Listing Submission: ${name}`,
      `${name} (${category || 'Estate Cleanouts'}) in ${city}, ${state.toUpperCase()} submitted a free listing.\n\nContact: ${contactName || 'Business Owner'} (${email})\n\nReview it in the Admin Portal's Pending Submissions tab.`
    );
    res.status(201).json(rowToPending((rows as any[])[0]));
  } catch (err: any) {
    console.error('Error submitting listing:', err);
    res.status(500).json({ error: 'Failed to submit listing.' });
  }
});

function rowToQuote(row: any) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingName: row.listing_name,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone || '',
    propertyType: row.property_type,
    projectScope: row.project_scope,
    timeline: row.timeline,
    notes: row.notes || '',
    submittedAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString().split('T')[0]
        : String(row.created_at).split('T')[0],
  };
}

// Public: request a quote from a listed business
app.post('/api/listings/quote', submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  const {
    listingId,
    listingName,
    listingEmail,
    requesterName,
    requesterEmail,
    requesterPhone,
    propertyType,
    projectScope,
    timeline,
    notes,
  } = req.body;

  if (!listingId || !listingName || !requesterName || !requesterEmail) {
    return res.status(400).json({ error: 'Missing required quote request fields.' });
  }

  if (isHoneypotTripped(req)) {
    return res.status(201).json({ ok: true, emailed: false });
  }

  try {
    await ensureSchema();
    const id = 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    let emailed = false;
    if (listingEmail) {
      emailed = await sendMail({
        to: listingEmail,
        replyTo: requesterEmail,
        subject: `New Cleanout Estimate Request via ClearAnEstate.com`,
        text: `You have a new estimate request from ${requesterName} (${requesterEmail}${requesterPhone ? ', ' + requesterPhone : ''}).\n\nProperty Type: ${propertyType}\nProject Scope: ${projectScope}\nTimeline: ${timeline}\n\nMessage:\n${notes || '(none provided)'}\n\nReply directly to this email to respond to ${requesterName}.`,
      });
    }

    await db.query(
      `INSERT INTO quote_requests
        (id, listing_id, listing_name, requester_name, requester_email, requester_phone, property_type, project_scope, timeline, notes, emailed_to_business)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        listingId,
        listingName,
        requesterName,
        requesterEmail,
        requesterPhone || '',
        propertyType || '',
        projectScope || '',
        timeline || '',
        notes || '',
        emailed,
      ]
    );

    notifyAdmin(
      `New Estimate Request for ${listingName}`,
      `${requesterName} (${requesterEmail}${requesterPhone ? ', ' + requesterPhone : ''}) requested an estimate from ${listingName}.\n\nProperty Type: ${propertyType}\nProject Scope: ${projectScope}\nTimeline: ${timeline}\n\n${emailed ? 'This was emailed directly to the business.' : 'The business has no email on file, so this was only saved to the database.'} View it in the Admin Portal's Quote Requests tab.`
    );

    res.status(201).json({ ok: true, emailed });
  } catch (err: any) {
    console.error('Error submitting quote request:', err);
    res.status(500).json({ error: 'Failed to submit quote request.' });
  }
});

function rowToClaim(row: any) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingName: row.listing_name,
    claimantName: row.claimant_name,
    claimantEmail: row.claimant_email,
    claimantPhone: row.claimant_phone || '',
    proofDetails: row.proof_details || '',
    status: row.status,
    submittedAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString().split('T')[0]
        : String(row.created_at).split('T')[0],
  };
}

function extractDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const withProtocol = value.includes('://') ? value : `https://${value}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// Public: claim ownership of a listing. If the claimant's email domain matches the
// listing's own website/email domain, we treat that as reasonable proof of ownership and
// approve immediately. Otherwise it's queued for manual admin review, same as new listings.
app.post('/api/listings/:id/claim', submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  const { claimantName, claimantEmail, claimantPhone, proofDetails } = req.body;

  if (!claimantName || !claimantEmail) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  if (isHoneypotTripped(req)) {
    return res.status(201).json({ status: 'pending' });
  }

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    const listing = (rows as any[])[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });

    const claimantDomain = extractDomain(claimantEmail.split('@')[1]);
    const listingDomain = extractDomain(listing.website) || extractDomain(listing.email?.split('@')[1]);
    const autoApproved = !!claimantDomain && !!listingDomain && claimantDomain === listingDomain;

    const id = 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const status = autoApproved ? 'approved' : 'pending';

    await db.query(
      `INSERT INTO claim_requests
        (id, listing_id, listing_name, claimant_name, claimant_email, claimant_phone, proof_details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, listing.name, claimantName, claimantEmail, claimantPhone || '', proofDetails || '', status]
    );

    if (autoApproved) {
      await db.query('UPDATE listings SET claimed = TRUE WHERE id = ?', [req.params.id]);
    } else {
      notifyAdmin(
        `Claim Request Needs Review: ${listing.name}`,
        `${claimantName} (${claimantEmail}${claimantPhone ? ', ' + claimantPhone : ''}) is claiming "${listing.name}" but their email domain didn't match the listing's website, so it needs manual review.\n\n${proofDetails ? 'Their note: ' + proofDetails : 'No verification note provided.'}\n\nReview it in the Admin Portal's Claim Requests tab.`
      );
    }

    res.status(201).json({ status });
  } catch (err: any) {
    console.error('Error submitting claim request:', err);
    res.status(500).json({ error: 'Failed to submit claim request.' });
  }
});

// Admin: verify password without needing a full data fetch
app.post('/api/admin/login', adminAuthLimiter, (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: 'Admin portal is not configured (ADMIN_PASSWORD missing on server).' });
  }
  if (req.body?.password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  res.json({ ok: true });
});

// Admin: list pending submissions
app.get('/api/admin/pending', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM pending_submissions ORDER BY created_at DESC');
    res.json((rows as any[]).map(rowToPending));
  } catch (err: any) {
    console.error('Error fetching pending submissions:', err);
    res.status(500).json({ error: 'Failed to fetch pending submissions.', details: err.message });
  }
});

// Admin: approve a pending submission -> publish to live listings
app.post('/api/admin/pending/:id/approve', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM pending_submissions WHERE id = ?', [req.params.id]);
    const target = (rows as any[])[0];
    if (!target) return res.status(404).json({ error: 'Submission not found.' });

    const newId = 'l-' + Date.now();
    const createdAt = new Date().toISOString().split('T')[0];
    const tagline = `Professional ${target.category} in ${target.city}, ${target.state}`;

    await db.query(
      `INSERT INTO listings
        (id, name, tagline, category, city, state, phone, website, email, description, services, featured, rating, review_count, insured, bonded, hours, claimed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 5.0, 1, true, true, ?, true, ?)`,
      [
        newId,
        target.name,
        tagline,
        target.category,
        target.city,
        target.state,
        target.phone,
        target.website,
        target.email,
        target.description,
        target.services,
        'Mon-Fri: 8:00 AM - 6:00 PM',
        createdAt,
      ]
    );

    await db.query('DELETE FROM pending_submissions WHERE id = ?', [req.params.id]);

    const [newRows] = await db.query('SELECT * FROM listings WHERE id = ?', [newId]);
    res.json(rowToListing((newRows as any[])[0]));
  } catch (err: any) {
    console.error('Error approving submission:', err);
    res.status(500).json({ error: 'Failed to approve submission.' });
  }
});

// Admin: reject a pending submission
app.post('/api/admin/pending/:id/reject', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    await db.query('DELETE FROM pending_submissions WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error rejecting submission:', err);
    res.status(500).json({ error: 'Failed to reject submission.' });
  }
});

// Admin: toggle featured status on a live listing
app.post('/api/admin/listings/:id/toggle-featured', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    await db.query('UPDATE listings SET featured = NOT featured WHERE id = ?', [req.params.id]);
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ error: 'Listing not found.' });
    res.json(rowToListing(row));
  } catch (err: any) {
    console.error('Error toggling featured status:', err);
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

// Admin: list quote requests
app.get('/api/admin/quotes', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM quote_requests ORDER BY created_at DESC');
    res.json((rows as any[]).map(rowToQuote));
  } catch (err: any) {
    console.error('Error fetching quote requests:', err);
    res.status(500).json({ error: 'Failed to fetch quote requests.' });
  }
});

// Admin: list claim requests
app.get('/api/admin/claims', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM claim_requests ORDER BY created_at DESC');
    res.json((rows as any[]).map(rowToClaim));
  } catch (err: any) {
    console.error('Error fetching claim requests:', err);
    res.status(500).json({ error: 'Failed to fetch claim requests.' });
  }
});

// Admin: approve a pending claim request
app.post('/api/admin/claims/:id/approve', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM claim_requests WHERE id = ?', [req.params.id]);
    const claim = (rows as any[])[0];
    if (!claim) return res.status(404).json({ error: 'Claim request not found.' });

    await db.query('UPDATE listings SET claimed = TRUE WHERE id = ?', [claim.listing_id]);
    await db.query("UPDATE claim_requests SET status = 'approved' WHERE id = ?", [req.params.id]);

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error approving claim request:', err);
    res.status(500).json({ error: 'Failed to approve claim request.' });
  }
});

// Admin: reject a pending claim request
app.post('/api/admin/claims/:id/reject', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    await db.query("UPDATE claim_requests SET status = 'rejected' WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error rejecting claim request:', err);
    res.status(500).json({ error: 'Failed to reject claim request.' });
  }
});

// Admin: delete a live listing
app.delete('/api/admin/listings/:id', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    await db.query('DELETE FROM listings WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error deleting listing:', err);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
