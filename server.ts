import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { getPool, ensureSchema, isDbConfigured } from './db';
import { sendMail, sendTestMail, isMailConfigured } from './mailer';
import { buildReports, sendReports, previousPeriod, periodLabel, isValidPeriod } from './reports';
import { verifyEditToken, editLinkUrl, EDIT_LINK_DAYS } from './ownerLinks';
import { UPLOAD_DIR, MAX_LOGOS, MAX_PHOTOS, PhotoKind, PhotoRow, photoUrl, decodeImage, savePhotoFile, deletePhotoFile, newPhotoId } from './photos';
import { listingPath } from './src/lib/slug';
import { badgeHtml } from './src/lib/badge';
import { GUIDES, guidePath, parseGuidePath } from './src/lib/guides';
import { landingPaths, parseLandingPath, citySlug, landingTitle, landingDescription } from './src/lib/locations';
import { pricingFor, dollars, CITY_CAP } from './src/lib/pricing';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Same public origin used for Stripe checkout redirects - reused here so sitemap/canonical
// URLs and robots.txt always point at the actual deployed domain.
const SITE_URL = (process.env.APP_URL || 'https://clearanestate.com').replace(/\/$/, '');

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

// Owner listing saves: the signed edit link already proves who they are, so this only
// stops runaway scripts while leaving room to save several times while editing.
const ownerEditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many saves in a short time. Please wait a few minutes and try again.' },
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
        const priceCents = Number(session.metadata?.priceCents) || null;
        const db = getPool();
        if (listingId && db) {
          try {
            await ensureSchema();
            // featured_at = now puts this business below everyone already featured in its
            // city, which is the "first paid, first position" promise on the advertise page.
            await db.query(
              'UPDATE listings SET featured = TRUE, featured_at = CURRENT_TIMESTAMP, featured_price_cents = ?, stripe_subscription_id = ?, featured_email = ? WHERE id = ?',
              [
                priceCents,
                typeof session.subscription === 'string' ? session.subscription : null,
                session.customer_details?.email || null,
                listingId,
              ]
            );
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
            await db.query('UPDATE listings SET featured = FALSE, featured_at = NULL WHERE stripe_subscription_id = ?', [subscription.id]);
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

// JSON body parser for standard REST API endpoints. Photo uploads carry an image, so
// that one route gets its own, larger limit instead.
const PHOTO_UPLOAD_PATH = '/api/owner/photos';
app.use((req, res, next) => (req.path === PHOTO_UPLOAD_PATH ? next() : express.json()(req, res, next)));

// Owner-uploaded photos. Only exact files are served (no directory listing, no SPA
// fallback), with nosniff so a file can never be treated as anything but an image.
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    fallthrough: false,
    index: false,
    maxAge: '30d',
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  })
);

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

    const db = getPool();
    if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

    const listingId = typeof req.body?.listingId === 'string' ? req.body.listingId : '';
    await ensureSchema();
    const [rows] = await db.query('SELECT id, name, city, state, featured FROM listings WHERE id = ?', [listingId]);
    const listing = (rows as any[])[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (listing.featured) return res.status(409).json({ error: 'This listing is already featured.' });

    const cityTaken = await cityFeaturedCount(listing.city, listing.state);
    if (cityTaken >= CITY_CAP) {
      return res.status(409).json({
        error: `All ${CITY_CAP} featured spots in ${listing.city}, ${listing.state} are taken. Email us to join the waitlist.`,
      });
    }

    // The price is always decided here, never by the browser. Stripe keeps charging the
    // amount on the subscription at renewal, which is what locks the price in.
    const { priceCents } = await currentPricing();

    // Redirect back to our own domain only - never to an origin supplied in the request.
    const origin = process.env.APP_URL ? SITE_URL : req.headers.origin || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Featured Listing - ${listing.name} (${listing.city}, ${listing.state})`,
              description: `Top placement on the ${listing.city} page, Featured badge, contact report. ${dollars(priceCents)}/year, price locked while subscribed.`,
            },
            unit_amount: priceCents,
            recurring: {
              interval: 'year',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/advertise?featured_success=true&listing_id=${encodeURIComponent(listing.id)}`,
      cancel_url: `${origin}/advertise?listing=${encodeURIComponent(listing.id)}`,
      metadata: {
        listingId: listing.id,
        listingTitle: listing.name,
        priceCents: String(priceCents),
      },
      subscription_data: {
        metadata: { listingId: listing.id, priceCents: String(priceCents) },
      },
    });

    res.json({ url: session.url, id: session.id });
  } catch (err: any) {
    console.error('Error creating Stripe checkout session:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// ---- Directory Listings API (MySQL-backed, falls back to 404 if not configured) ----

// mysql2 auto-deserializes native JSON columns into real arrays/objects, but if a row ever
// comes back with the value still as a raw string (e.g. a different driver/config), this
// handles both cases instead of double-parsing an already-parsed array.
function parseServices(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

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
    services: parseServices(row.services),
    featured: !!row.featured,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    yearsInBusiness: row.years_in_business ?? undefined,
    insured: !!row.insured,
    bonded: !!row.bonded,
    hours: row.hours || undefined,
    claimed: !!row.claimed,
    address: row.address || undefined,
    featuredAt: row.featured_at ? new Date(row.featured_at).toISOString() : undefined,
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
    services: parseServices(row.services),
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString().split('T')[0]
        : String(row.submitted_at).split('T')[0],
    status: row.status,
  };
}

// ---- Featured pricing ----

// Paid sign-ups currently active - this is what moves the price up a step every 10.
// Listings an admin featured by hand (no subscription) don't count.
async function currentPricing() {
  const db = getPool();
  if (!db) return pricingFor(0);
  await ensureSchema();
  const [[row]] = (await db.query(
    'SELECT COUNT(*) AS n FROM listings WHERE featured = TRUE AND stripe_subscription_id IS NOT NULL'
  )) as any;
  return pricingFor(Number(row?.n) || 0);
}

async function cityFeaturedCount(city: string, state: string): Promise<number> {
  const db = getPool();
  if (!db) return 0;
  const [[row]] = (await db.query(
    'SELECT COUNT(*) AS n FROM listings WHERE featured = TRUE AND city = ? AND state = ?',
    [city, state]
  )) as any;
  return Number(row?.n) || 0;
}

// Public: current price, how many sign-ups are left at it, and (for a given listing) how
// many of its city's featured spots are already taken.
app.get('/api/pricing', async (req, res) => {
  try {
    const pricing = await currentPricing();
    const db = getPool();
    let city: { name: string; state: string; taken: number } | null = null;
    let listingFeatured = false;

    const listingId = typeof req.query.listingId === 'string' ? req.query.listingId : '';
    if (db && listingId) {
      const [rows] = await db.query('SELECT city, state, featured FROM listings WHERE id = ?', [listingId]);
      const listing = (rows as any[])[0];
      if (listing) {
        city = { name: listing.city, state: listing.state, taken: await cityFeaturedCount(listing.city, listing.state) };
        listingFeatured = !!listing.featured;
      }
    }

    res.json({ ...pricing, cityCap: CITY_CAP, city, listingFeatured });
  } catch (err: any) {
    console.error('Error loading pricing:', err);
    res.status(500).json({ error: 'Failed to load pricing.' });
  }
});

// Public: last-30-day audience numbers for the advertise page. Cached for 10 minutes so a
// busy sales page doesn't run aggregate queries on every view.
let publicStatsCache: { at: number; data: any } | null = null;
app.get('/api/public-stats', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  if (publicStatsCache && Date.now() - publicStatsCache.at < 10 * 60 * 1000) {
    return res.json(publicStatsCache.data);
  }

  try {
    await ensureSchema();
    const [[events]] = (await db.query(
      `SELECT COUNT(DISTINCT visitor_hash, DATE(created_at)) AS visitors,
         SUM(event_type IN ('call', 'website')) AS contacts
       FROM listing_events WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)`
    )) as any;
    const [[quotes]] = (await db.query(
      'SELECT COUNT(*) AS n FROM quote_requests WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)'
    )) as any;
    const [[counts]] = (await db.query(
      `SELECT COUNT(*) AS listings, COUNT(DISTINCT city, state) AS cities FROM listings`
    )) as any;

    const data = {
      visitors30d: Number(events?.visitors) || 0,
      contacts30d: (Number(events?.contacts) || 0) + (Number(quotes?.n) || 0),
      listings: Number(counts?.listings) || 0,
      cities: Number(counts?.cities) || 0,
    };
    publicStatsCache = { at: Date.now(), data };
    res.json(data);
  } catch (err: any) {
    console.error('Error loading public stats:', err);
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

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
    const [rows] = await db.query('SELECT * FROM listings ORDER BY featured DESC, featured_at ASC, rating DESC');
    const [photoRows] = await db.query(
      "SELECT listing_id, kind, filename FROM listing_photos WHERE status = 'approved' ORDER BY created_at ASC"
    );
    const photos = new Map<string, { logoUrl?: string; photos: string[] }>();
    for (const p of photoRows as any[]) {
      const entry = photos.get(p.listing_id) || { photos: [] };
      if (p.kind === 'logo') entry.logoUrl = photoUrl(p.filename);
      else entry.photos.push(photoUrl(p.filename));
      photos.set(p.listing_id, entry);
    }
    res.json((rows as any[]).map((row) => ({ ...rowToListing(row), ...photos.get(row.id) })));
  } catch (err: any) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings.' });
  }
});

// Public: XML sitemap - lists the homepage plus every live listing's canonical URL, so
// Google can discover and index listing pages directly instead of relying on crawling
// through the client-rendered grid. Regenerated per-request (cheap query, short cache)
// rather than written to disk, since listings change independently of deploys.
app.get('/sitemap.xml', async (req, res) => {
  res.type('application/xml');
  res.set('Cache-Control', 'public, max-age=3600');

  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/advertise` },
    ...GUIDES.map((g) => ({ loc: `${SITE_URL}${guidePath(g.slug)}` })),
  ];

  const db = getPool();
  if (db) {
    try {
      await ensureSchema();
      const [rows] = await db.query('SELECT id, name, city, state, category, created_at FROM listings');
      for (const landing of landingPaths(rows as any[])) {
        urls.push({ loc: `${SITE_URL}${landing}` });
      }
      for (const row of rows as any[]) {
        urls.push({
          loc: `${SITE_URL}${listingPath(row)}`,
          lastmod: row.created_at instanceof Date
            ? row.created_at.toISOString().split('T')[0]
            : String(row.created_at).split('T')[0],
        });
      }
    } catch (err) {
      console.error('Error building sitemap:', err);
    }
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n` +
          (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
          `  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  res.send(body);
});

// Public: robots.txt - allow everything except the JSON API, and point crawlers at the sitemap.
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

// ---- First-party traffic tracking ----

const TRACK_EVENT_TYPES = new Set(['page_view', 'listing_view', 'call', 'website', 'directions']);
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i;

// Generous per-IP cap - real visitors fire a handful of events per page, so this only
// stops a script from flooding the table.
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req, res) => res.status(204).end(),
});

// Daily-rotating, one-way hash of IP + user agent: enough to count unique visitors per day
// without cookies, and the raw IP is never stored.
function visitorHash(req: express.Request): string {
  const day = new Date().toISOString().split('T')[0];
  return crypto
    .createHash('sha256')
    .update(`${day}|${process.env.ADMIN_PASSWORD || ''}|${req.ip}|${req.get('user-agent') || ''}`)
    .digest('hex')
    .slice(0, 16);
}

// Public: record a page view or contact click. Always answers 204 (even when ignored) so
// the browser's sendBeacon never retries and bots learn nothing.
app.post('/api/track', trackLimiter, async (req, res) => {
  res.status(204).end();

  const db = getPool();
  const type = String(req.body?.type || '');
  if (!db || !TRACK_EVENT_TYPES.has(type) || BOT_UA.test(req.get('user-agent') || '')) return;

  const listingId = typeof req.body?.listingId === 'string' ? req.body.listingId.slice(0, 64) : null;
  if (type !== 'page_view' && !listingId) return;
  const pagePath = typeof req.body?.path === 'string' ? req.body.path.slice(0, 255) : null;

  try {
    await ensureSchema();
    await db.query(
      'INSERT INTO listing_events (event_type, listing_id, page_path, visitor_hash) VALUES (?, ?, ?, ?)',
      [type, listingId, pagePath, visitorHash(req)]
    );
  } catch (err) {
    console.error('Error recording tracking event:', err);
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
    emailed: !!row.emailed_to_business,
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

// Tell the owner their claim went through, with the two next steps: get featured (if
// they aren't already) and add our badge to their website. Best-effort, never blocks.
async function emailClaimApproved(claimantName: string, claimantEmail: string, listingRow: any): Promise<void> {
  const listing = rowToListing(listingRow);
  const lines = [
    `Hi ${claimantName},`,
    '',
    `Your claim of "${listing.name}" on ClearAnEstate.com is approved. Your listing:`,
    `${SITE_URL}${listingPath(listing)}`,
  ];

  const editUrl = editLinkUrl(listing.id, claimantEmail);
  if (editUrl) {
    lines.push(
      '',
      'UPDATE YOUR LISTING',
      `Check your phone number, website, services and hours, and add a short description. This private link works for ${EDIT_LINK_DAYS} days (you can always ask for a new one from your listing page):`,
      editUrl
    );
  }

  if (!listing.featured) {
    const pricing = await currentPricing();
    const taken = await cityFeaturedCount(listing.city, listing.state);
    const left = Math.max(0, CITY_CAP - taken);
    lines.push(
      '',
      `GET TO THE TOP OF ${listing.city.toUpperCase()}'S PAGE`,
      `Featured listings show first, with Call, Website and Directions buttons on the card. ${dollars(pricing.priceCents)}/year, price locked while you stay. ${left} of ${CITY_CAP} featured spots are left in ${listing.city}.`,
      `${SITE_URL}/advertise?listing=${encodeURIComponent(listing.id)}`
    );
  }

  lines.push(
    '',
    'ADD OUR BADGE TO YOUR WEBSITE',
    'Paste this code into your website (footer or About page). It shows customers you are listed and links to your listing:',
    '',
    badgeHtml(listing),
    '',
    `Questions? Just reply to this email.`,
    '',
    'ClearAnEstate.com'
  );

  await sendMail({ to: claimantEmail, subject: `Your claim of ${listing.name} is approved`, text: lines.join('\n') });
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
      emailClaimApproved(claimantName, claimantEmail, { ...listing, claimed: true }).catch((err) =>
        console.error('Failed to email claim approval:', err)
      );
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

// Emails that may receive an edit link for a listing: an approved claim, the address the
// business paid with, or the listing's own email. Lower-cased.
async function trustedOwnerEmails(listingRow: any): Promise<Set<string>> {
  const db = getPool()!;
  const [claims] = await db.query("SELECT claimant_email FROM claim_requests WHERE listing_id = ? AND status = 'approved'", [listingRow.id]);
  const emails = [...(claims as any[]).map((c) => c.claimant_email), listingRow.featured_email, listingRow.email];
  return new Set(emails.filter(Boolean).map((e: string) => e.trim().toLowerCase()));
}

// An edit link only works while its email is still on file for the listing, so removing
// a claim (Admin > Live Listings) shuts off links already sent to that address.
const NO_LONGER_OWNER = 'This email is no longer on file for this listing, so this link no longer works. Contact us if you think that is a mistake.';

async function emailEditLink(listingRow: any, email: string): Promise<boolean> {
  const url = editLinkUrl(listingRow.id, email);
  if (!url) return false;
  return sendMail({
    to: email,
    subject: `Edit your ClearAnEstate listing: ${listingRow.name}`,
    text: [
      'Hi,',
      '',
      `Here's your private link to update "${listingRow.name}" on ClearAnEstate.com: phone, website, description, services and hours.`,
      '',
      url,
      '',
      `The link works for ${EDIT_LINK_DAYS} days. Don't forward it: anyone with it can edit your listing. You can always ask for a new one from your listing page.`,
      '',
      "Didn't ask for this? You can ignore this email.",
      '',
      'ClearAnEstate.com',
    ].join('\n'),
  });
}

// Public: email an edit link to a listing's owner. Always answers the same way, so it
// can't be used to find out which emails are on file.
app.post('/api/listings/:id/edit-link', submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (isHoneypotTripped(req)) return res.json({ ok: true });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    const row = (rows as any[])[0];
    if (row && (await trustedOwnerEmails(row)).has(email)) {
      emailEditLink(row, email).catch((err) => console.error('Failed to email edit link:', err));
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error sending edit link:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Owner edits: which fields an owner may change, and how each is cleaned up. Name,
// category and city aren't editable here because they decide the listing's URL and
// which city/state pages it appears on.
function cleanOwnerEdit(body: any): { values: Record<string, any>; error: string | null } {
  const text = (v: any, max: number) => String(v ?? '').trim().slice(0, max);
  let website = text(body.website, 255);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website) {
    try {
      new URL(website);
    } catch {
      return { values: {}, error: 'The website address doesn’t look right.' };
    }
  }
  const email = text(body.email, 255);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { values: {}, error: 'The email address doesn’t look right.' };
  const phone = text(body.phone, 30);
  if (phone && !/^[0-9+().\-\s xX]+$/.test(phone)) return { values: {}, error: 'The phone number can only contain digits, spaces and + ( ) - .' };

  const services = (Array.isArray(body.services) ? body.services : String(body.services ?? '').split(/\n|,/))
    .map((s: any) => String(s).trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 15);
  const years = body.yearsInBusiness === '' || body.yearsInBusiness == null ? null : Number(body.yearsInBusiness);
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 150)) {
    return { values: {}, error: 'Years in business should be a whole number.' };
  }

  return {
    error: null,
    values: {
      phone: phone || null,
      website,
      email: email || null,
      tagline: text(body.tagline, 160),
      description: text(body.description, 2000),
      services: JSON.stringify(services),
      hours: text(body.hours, 255) || null,
      address: text(body.address, 255) || null,
      years_in_business: years,
      insured: !!body.insured,
      bonded: !!body.bonded,
    },
  };
}

// Owner: load the listing behind an edit link.
app.get('/api/owner/listing', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });
  const access = verifyEditToken(String(req.query.token || ''));
  if (!access) return res.status(401).json({ error: 'This edit link is invalid or has expired. Ask for a new one from your listing page.' });
  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [access.listingId]);
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ error: 'This listing no longer exists.' });
    if (!(await trustedOwnerEmails(row)).has(access.email.toLowerCase())) return res.status(401).json({ error: NO_LONGER_OWNER });
    res.json({ listing: rowToListing(row), editorEmail: access.email, photos: await ownerPhotos(row.id) });
  } catch (err: any) {
    console.error('Error loading listing for owner:', err);
    res.status(500).json({ error: 'Failed to load your listing.' });
  }
});

// Owner: save changes from the edit page. Live immediately; the admin gets an email
// showing exactly what changed so anything odd can be put back.
app.post('/api/owner/listing', ownerEditLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });
  const access = verifyEditToken(String(req.body?.token || ''));
  if (!access) return res.status(401).json({ error: 'This edit link is invalid or has expired. Ask for a new one from your listing page.' });

  const { values, error } = cleanOwnerEdit(req.body?.listing || {});
  if (error) return res.status(400).json({ error });
  if (!values.website) return res.status(400).json({ error: 'Please enter your website address.' });

  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [access.listingId]);
    const before = (rows as any[])[0];
    if (!before) return res.status(404).json({ error: 'This listing no longer exists.' });
    if (!(await trustedOwnerEmails(before)).has(access.email.toLowerCase())) return res.status(401).json({ error: NO_LONGER_OWNER });

    const columns = Object.keys(values);
    await db.query(
      `UPDATE listings SET ${columns.map((c) => `${c} = ?`).join(', ')}, claimed = TRUE WHERE id = ?`,
      [...columns.map((c) => values[c]), access.listingId]
    );

    const show = (c: string, v: any) =>
      c === 'services' ? parseServices(v).join(', ') : c === 'insured' || c === 'bonded' ? (v ? 'yes' : 'no') : v ?? '';
    const changes = columns
      .filter((c) => String(show(c, before[c])) !== String(show(c, values[c])))
      .map((c) => `${c}:\n  was: ${show(c, before[c]) || '(empty)'}\n  now: ${show(c, values[c]) || '(empty)'}`);
    if (changes.length > 0) {
      notifyAdmin(
        `Listing edited by owner: ${before.name}`,
        `${access.email} updated "${before.name}" (${before.city}, ${before.state}):\n\n${changes.join('\n\n')}\n\n${SITE_URL}${listingPath(before)}`
      );
    }

    const [updated] = await db.query('SELECT * FROM listings WHERE id = ?', [access.listingId]);
    res.json({ listing: rowToListing((updated as any[])[0]), changed: changes.length });
  } catch (err: any) {
    console.error('Error saving owner edit:', err);
    res.status(500).json({ error: 'Failed to save your changes.' });
  }
});

// ---- Photos ----------------------------------------------------------------------------

// An owner's photos for their edit page: everything not rejected, plus rejected ones so
// they can see what wasn't approved (those files are already deleted, so no URL).
async function ownerPhotos(listingId: string) {
  const db = getPool()!;
  const [rows] = await db.query('SELECT * FROM listing_photos WHERE listing_id = ? ORDER BY created_at ASC', [listingId]);
  return (rows as PhotoRow[]).map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    url: p.status === 'rejected' ? null : photoUrl(p.filename),
  }));
}

// Resolves an owner's edit-link token to their listing, or sends the error response.
async function ownerListingFromToken(token: any, res: express.Response): Promise<{ row: any; email: string } | null> {
  const db = getPool();
  if (!db) {
    res.status(503).json({ error: 'Database is not configured on server.' });
    return null;
  }
  const access = verifyEditToken(String(token || ''));
  if (!access) {
    res.status(401).json({ error: 'This edit link is invalid or has expired. Ask for a new one from your listing page.' });
    return null;
  }
  await ensureSchema();
  const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [access.listingId]);
  const row = (rows as any[])[0];
  if (!row) {
    res.status(404).json({ error: 'This listing no longer exists.' });
    return null;
  }
  if (!(await trustedOwnerEmails(row)).has(access.email.toLowerCase())) {
    res.status(401).json({ error: NO_LONGER_OWNER });
    return null;
  }
  return { row, email: access.email };
}

// Owner: upload a logo or photo. It waits for admin approval before it shows anywhere.
app.post(PHOTO_UPLOAD_PATH, ownerEditLimiter, express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const owner = await ownerListingFromToken(req.body?.token, res);
    if (!owner) return;
    const kind: PhotoKind = req.body?.kind === 'logo' ? 'logo' : 'photo';

    const db = getPool()!;
    const [[{ n }]] = (await db.query(
      "SELECT COUNT(*) AS n FROM listing_photos WHERE listing_id = ? AND kind = ? AND status <> 'rejected'",
      [owner.row.id, kind]
    )) as any;
    const max = kind === 'logo' ? MAX_LOGOS : MAX_PHOTOS;
    if (Number(n) >= max) {
      return res.status(400).json({
        error: kind === 'logo' ? 'You already have a logo. Remove it first to upload a new one.' : `You can have up to ${MAX_PHOTOS} photos. Remove one to add another.`,
      });
    }

    const image = decodeImage(req.body?.image);
    if ('error' in image) return res.status(400).json({ error: image.error });

    const filename = savePhotoFile(owner.row.id, image.buffer, image.ext);
    await db.query(
      'INSERT INTO listing_photos (id, listing_id, kind, filename, status, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [newPhotoId(), owner.row.id, kind, filename, 'pending', owner.email]
    );
    notifyAdmin(
      `New ${kind} to review: ${owner.row.name}`,
      `${owner.email} uploaded a ${kind} for "${owner.row.name}" (${owner.row.city}, ${owner.row.state}).\n\n${SITE_URL}${photoUrl(filename)}\n\nApprove or reject it in the Admin Portal's Photos tab.`
    );
    res.status(201).json({ photos: await ownerPhotos(owner.row.id) });
  } catch (err: any) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ error: 'Failed to upload the image.' });
  }
});

// Owner: remove one of their own photos (pending or live).
app.post('/api/owner/photos/:photoId/delete', ownerEditLimiter, async (req, res) => {
  try {
    const owner = await ownerListingFromToken(req.body?.token, res);
    if (!owner) return;
    const db = getPool()!;
    const [rows] = await db.query('SELECT * FROM listing_photos WHERE id = ? AND listing_id = ?', [req.params.photoId, owner.row.id]);
    const photo = (rows as PhotoRow[])[0];
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    deletePhotoFile(photo.filename);
    await db.query('DELETE FROM listing_photos WHERE id = ?', [photo.id]);
    res.json({ photos: await ownerPhotos(owner.row.id) });
  } catch (err: any) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to remove the image.' });
  }
});

// Admin: photos waiting for review (or, with ?status=approved, the live ones).
app.get('/api/admin/photos', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });
  const status = req.query.status === 'approved' ? 'approved' : 'pending';
  try {
    await ensureSchema();
    const [rows] = await db.query(
      `SELECT p.*, l.name, l.city, l.state, l.featured FROM listing_photos p
       LEFT JOIN listings l ON l.id = p.listing_id
       WHERE p.status = ? ORDER BY p.created_at ${status === 'pending' ? 'ASC' : 'DESC'}`,
      [status]
    );
    res.json(
      (rows as any[]).map((p) => ({
        id: p.id,
        listingId: p.listing_id,
        listingName: p.name || '(deleted listing)',
        city: p.city || '',
        state: p.state || '',
        featured: !!p.featured,
        kind: p.kind,
        status: p.status,
        url: photoUrl(p.filename),
        uploadedBy: p.uploaded_by,
        createdAt: p.created_at,
      }))
    );
  } catch (err: any) {
    console.error('Error listing photos:', err);
    res.status(500).json({ error: 'Failed to load photos.' });
  }
});

// Admin: approve, reject (deletes the file) or remove a live photo.
app.post('/api/admin/photos/:id/:action', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });
  const { id, action } = req.params;
  if (!['approve', 'reject', 'remove'].includes(action)) return res.status(404).json({ error: 'Unknown action.' });
  try {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listing_photos WHERE id = ?', [id]);
    const photo = (rows as PhotoRow[])[0];
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });

    if (action === 'approve') {
      await db.query("UPDATE listing_photos SET status = 'approved' WHERE id = ?", [id]);
    } else if (action === 'reject') {
      deletePhotoFile(photo.filename);
      await db.query("UPDATE listing_photos SET status = 'rejected' WHERE id = ?", [id]);
    } else {
      deletePhotoFile(photo.filename);
      await db.query('DELETE FROM listing_photos WHERE id = ?', [id]);
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error updating photo:', err);
    res.status(500).json({ error: 'Failed to update the photo.' });
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
        JSON.stringify(parseServices(target.services)),
        'Mon-Fri: 8:00 AM - 6:00 PM',
        createdAt,
      ]
    );

    await db.query('DELETE FROM pending_submissions WHERE id = ?', [req.params.id]);

    const [newRows] = await db.query('SELECT * FROM listings WHERE id = ?', [newId]);
    res.json(rowToListing((newRows as any[])[0]));
  } catch (err: any) {
    console.error('Error approving submission:', err);
    res.status(500).json({ error: 'Failed to approve submission.', details: err.message });
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
    res.status(500).json({ error: 'Failed to reject submission.', details: err.message });
  }
});

// Admin: toggle featured status on a live listing
app.post('/api/admin/listings/:id/toggle-featured', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    // Hand-featured listings join the end of the sign-up order, same as paid ones.
    await db.query(
      // featured_at is assigned first, from the old value of featured, so this is correct
      // whether the server evaluates SET left to right (MySQL) or simultaneously (MariaDB option).
      'UPDATE listings SET featured_at = IF(featured, NULL, CURRENT_TIMESTAMP), featured = NOT featured WHERE id = ?',
      [req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ error: 'Listing not found.' });
    res.json(rowToListing(row));
  } catch (err: any) {
    console.error('Error toggling featured status:', err);
    res.status(500).json({ error: 'Failed to update listing.', details: err.message });
  }
});

// Admin: remove a claim (a mistaken or test claim, or a business that changed hands).
// The listing goes back to unclaimed and its approved claims are marked revoked, which
// also stops any edit links sent to those addresses.
app.post('/api/admin/listings/:id/unclaim', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    await db.query('UPDATE listings SET claimed = FALSE WHERE id = ?', [req.params.id]);
    await db.query("UPDATE claim_requests SET status = 'revoked' WHERE listing_id = ? AND status = 'approved'", [req.params.id]);
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ error: 'Listing not found.' });
    res.json(rowToListing(row));
  } catch (err: any) {
    console.error('Error removing claim:', err);
    res.status(500).json({ error: 'Failed to remove the claim.', details: err.message });
  }
});

// Admin: list every listing with a Stripe subscription on file (past or present Featured
// upgrades), pulling live status/renewal date from Stripe so the admin doesn't have to
// cross-reference the Stripe dashboard by hand. Read-only - never writes back to Stripe or
// the database. If a subscription can't be fetched (bad ID, Stripe not configured), that
// row is still returned with an `error` field instead of failing the whole list.
// Admin: traffic report for the last N days - totals, a per-day series, the listings that
// got the most contacts, and the most-viewed pages.
app.get('/api/admin/stats', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

  try {
    await ensureSchema();
    const since = 'created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)';

    const [[totals]] = (await db.query(
      `SELECT
         SUM(event_type = 'page_view') AS pageViews,
         COUNT(DISTINCT visitor_hash, DATE(created_at)) AS visitors,
         SUM(event_type = 'listing_view') AS listingViews,
         SUM(event_type = 'call') AS calls,
         SUM(event_type = 'website') AS websiteClicks,
         SUM(event_type = 'directions') AS directions
       FROM listing_events WHERE ${since}`,
      [days]
    )) as any;

    const [[quoteTotals]] = (await db.query(
      `SELECT COUNT(*) AS quotes FROM quote_requests WHERE ${since}`,
      [days]
    )) as any;

    const [daily] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
         COUNT(DISTINCT visitor_hash) AS visitors,
         SUM(event_type IN ('call', 'website')) AS contacts
       FROM listing_events WHERE ${since}
       GROUP BY day ORDER BY day`,
      [days]
    );

    const [topListings] = await db.query(
      `SELECT e.listing_id AS listingId, l.name, l.city, l.state, l.featured,
         SUM(e.event_type = 'listing_view') AS views,
         SUM(e.event_type = 'call') AS calls,
         SUM(e.event_type = 'website') AS websiteClicks,
         SUM(e.event_type = 'directions') AS directions
       FROM listing_events e LEFT JOIN listings l ON l.id = e.listing_id
       WHERE e.listing_id IS NOT NULL AND e.${since}
       GROUP BY e.listing_id, l.name, l.city, l.state, l.featured
       ORDER BY (SUM(e.event_type = 'call') + SUM(e.event_type = 'website')) DESC, views DESC
       LIMIT 25`,
      [days]
    );

    const [topPages] = await db.query(
      `SELECT page_path AS path, COUNT(*) AS views
       FROM listing_events WHERE event_type = 'page_view' AND ${since}
       GROUP BY page_path ORDER BY views DESC LIMIT 25`,
      [days]
    );

    // MySQL hands back SUM()/COUNT() as strings or BigInt depending on driver settings.
    const n = (v: any) => Number(v) || 0;
    res.json({
      days,
      pageViews: n(totals?.pageViews),
      visitors: n(totals?.visitors),
      listingViews: n(totals?.listingViews),
      calls: n(totals?.calls),
      websiteClicks: n(totals?.websiteClicks),
      directions: n(totals?.directions),
      quoteRequests: n(quoteTotals?.quotes),
      daily: (daily as any[]).map((d) => ({
        day: d.day instanceof Date ? d.day.toISOString().split('T')[0] : String(d.day).split('T')[0],
        visitors: n(d.visitors),
        contacts: n(d.contacts),
      })),
      topListings: (topListings as any[]).map((r) => ({
        listingId: r.listingId,
        name: r.name || '(deleted listing)',
        city: r.city || '',
        state: r.state || '',
        featured: !!r.featured,
        views: n(r.views),
        calls: n(r.calls),
        websiteClicks: n(r.websiteClicks),
        directions: n(r.directions),
      })),
      topPages: (topPages as any[]).map((r) => ({ path: r.path || '/', views: n(r.views) })),
    });
  } catch (err: any) {
    console.error('Error building traffic stats:', err);
    res.status(500).json({ error: 'Failed to load traffic stats.', details: err.message });
  }
});

app.get('/api/admin/subscriptions', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  try {
    await ensureSchema();
    const [rows] = await db.query(
      "SELECT id, name, city, state, featured, stripe_subscription_id FROM listings WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != ''"
    );

    const stripe = getStripe();

    const subscriptions = await Promise.all(
      (rows as any[]).map(async (row) => {
        const base = {
          listingId: row.id,
          listingName: row.name,
          city: row.city,
          state: row.state,
          featured: !!row.featured,
          subscriptionId: row.stripe_subscription_id,
        };

        if (!stripe) {
          return { ...base, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: null, amount: null, error: 'Stripe is not configured on server.' };
        }

        try {
          const sub: any = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
          const item = sub.items?.data?.[0];
          // Stripe moved current_period_end from the subscription to the item level in
          // newer API versions - check both so this keeps working either way.
          const periodEndUnix = sub.current_period_end ?? item?.current_period_end;

          return {
            ...base,
            status: sub.status,
            currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString().split('T')[0] : null,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
            amount: item?.price?.unit_amount ?? null,
            interval: item?.price?.recurring?.interval ?? null,
          };
        } catch (err: any) {
          return { ...base, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: null, amount: null, error: err.message };
        }
      })
    );

    res.json(subscriptions);
  } catch (err: any) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions.', details: err.message });
  }
});

const VALID_CATEGORIES = [
  'Estate Cleanouts',
  'Senior Move Management',
  'Junk Removal & Hauling',
  'Liquidation & Estate Sales',
  'Content Appraisal & Downsizing',
];

function normalizeCategory(value: string): string | null {
  const match = VALID_CATEGORIES.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  return match || null;
}

// Admin: bulk-import real businesses the admin has found/researched themselves (e.g. from
// public directories), as distinct from the public "Submit Free Listing" flow. These are
// NOT self-submitted by the business, so we deliberately do NOT stamp fake insured/bonded/
// rating values on them the way an approved self-submission gets - they're inserted as
// unclaimed and unverified until the actual business claims the listing.
app.post('/api/admin/listings/bulk-import', adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database is not configured on server.' });

  const { listings } = req.body;
  if (!Array.isArray(listings) || listings.length === 0) {
    return res.status(400).json({ error: 'No listings provided.' });
  }
  if (listings.length > 200) {
    return res.status(400).json({ error: 'Limit 200 listings per import batch.' });
  }

  const imported: any[] = [];
  const skipped: { row: number; reason: string }[] = [];

  try {
    await ensureSchema();

    for (let i = 0; i < listings.length; i++) {
      const raw = listings[i];
      const name = (raw.name || '').trim();
      const city = (raw.city || '').trim();
      const state = (raw.state || '').trim().toUpperCase();
      const category = normalizeCategory(raw.category || '');

      if (!name || !city || !state) {
        skipped.push({ row: i + 1, reason: 'Missing required field (name, city, or state).' });
        continue;
      }
      if (!category) {
        skipped.push({ row: i + 1, reason: `Unrecognized category "${raw.category}".` });
        continue;
      }

      const [existingRows] = await db.query(
        'SELECT id FROM listings WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?) AND state = ?',
        [name, city, state]
      );
      if ((existingRows as any[]).length > 0) {
        skipped.push({ row: i + 1, reason: `"${name}" in ${city}, ${state} already exists - skipped to avoid a duplicate.` });
        continue;
      }

      const id = 'l-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const createdAt = new Date().toISOString().split('T')[0];
      const tagline = `${category} serving ${city}, ${state}`;
      const description = `${name} has not yet claimed or verified this listing. Details shown here are from public research, not confirmed by the business.`;

      await db.query(
        `INSERT INTO listings
          (id, name, tagline, category, city, state, phone, website, description, services, featured, rating, review_count, insured, bonded, claimed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 0, 0, false, false, false, ?)`,
        [
          id,
          name,
          tagline,
          category,
          city,
          state,
          (raw.phone || '').trim(),
          (raw.website || '').trim(),
          description,
          JSON.stringify([]),
          createdAt,
        ]
      );

      imported.push({ row: i + 1, id, name });
    }

    res.status(201).json({ imported, skipped });
  } catch (err: any) {
    console.error('Error bulk-importing listings:', err);
    res.status(500).json({ error: 'Bulk import failed.', details: err.message, imported, skipped });
  }
});

// Admin: preview the monthly results emails for a month (default: last month).
app.get('/api/admin/reports', adminAuthLimiter, requireAdmin, async (req, res) => {
  const period = String(req.query.period || previousPeriod());
  if (!isValidPeriod(period)) return res.status(400).json({ error: 'Month must look like 2026-11.' });
  try {
    res.json({ period, label: periodLabel(period), reports: await buildReports(period, getStripe()) });
  } catch (err: any) {
    console.error('Error building monthly reports:', err);
    res.status(500).json({ error: 'Failed to build monthly reports.', details: err.message });
  }
});

// Admin: send the monthly results emails that haven't gone out yet for a month.
app.post('/api/admin/reports/send', adminAuthLimiter, requireAdmin, async (req, res) => {
  const period = String(req.body?.period || previousPeriod());
  if (!isValidPeriod(period)) return res.status(400).json({ error: 'Month must look like 2026-11.' });
  try {
    res.json(await sendReports(period, getStripe()));
  } catch (err: any) {
    console.error('Error sending monthly reports:', err);
    res.status(500).json({ error: 'Failed to send monthly reports.', details: err.message });
  }
});

// Scheduled: a cPanel cron job opens this link on the 1st of each month to send last
// month's results. CRON_SECRET (an environment variable) keeps anyone else from
// triggering it. Safe to call twice: a month is never sent twice to the same listing.
app.get('/api/cron/monthly-reports', adminAuthLimiter, async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET is not set on the server.' });
  const given = Buffer.from(String(req.query.key || ''));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Wrong key.' });
  }
  try {
    const period = previousPeriod();
    const result = await sendReports(period, getStripe());
    console.log(`Monthly reports for ${period}:`, result);
    if (result.sent.length > 0 || result.failed.length > 0) {
      notifyAdmin(
        `Monthly results emails sent for ${periodLabel(period)}`,
        `Sent: ${result.sent.length ? result.sent.join(', ') : 'none'}\nFailed: ${result.failed.length ? result.failed.join(', ') : 'none'}\nSkipped: ${result.skipped.map((s) => `${s.name} (${s.reason})`).join(', ') || 'none'}`
      );
    }
    res.json({ period, ...result });
  } catch (err: any) {
    console.error('Error sending scheduled monthly reports:', err);
    res.status(500).json({ error: 'Failed to send monthly reports.' });
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
    res.status(500).json({ error: 'Failed to fetch quote requests.', details: err.message });
  }
});

// Admin: send a test email and report the exact SMTP result
app.post('/api/admin/test-email', adminAuthLimiter, requireAdmin, async (req, res) => {
  const to = String(req.body?.to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Enter a valid email address to send the test to.' });
  }
  const passwordToTry = typeof req.body?.password === 'string' && req.body.password ? req.body.password : undefined;
  res.json(await sendTestMail(to, passwordToTry));
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
    res.status(500).json({ error: 'Failed to fetch claim requests.', details: err.message });
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

    const [listingRows] = await db.query('SELECT * FROM listings WHERE id = ?', [claim.listing_id]);
    const listingRow = (listingRows as any[])[0];
    if (listingRow) {
      emailClaimApproved(claim.claimant_name, claim.claimant_email, listingRow).catch((err) =>
        console.error('Failed to email claim approval:', err)
      );
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Error approving claim request:', err);
    res.status(500).json({ error: 'Failed to approve claim request.', details: err.message });
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
    res.status(500).json({ error: 'Failed to reject claim request.', details: err.message });
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
    res.status(500).json({ error: 'Failed to delete listing.', details: err.message });
  }
});

// ---- Server-side page meta ----
// The app is client-rendered, so without this every URL would ship the homepage's
// <title>/description until JavaScript runs. Filling them in here means search engines and
// link-preview bots see the right text for landing pages and listing pages immediately.

interface PageMeta {
  title: string;
  description: string;
  canonicalPath: string;
  notFound?: boolean;
  // Private pages (owner edit links): served normally but kept out of search results.
  noindex?: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function applyMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const extra = meta.notFound || meta.noindex
    ? '<meta name="robots" content="noindex" />'
    : `<link rel="canonical" href="${escapeHtml(SITE_URL + meta.canonicalPath)}" />\n` +
      `    <meta property="og:title" content="${title}" />\n` +
      `    <meta property="og:description" content="${description}" />\n` +
      `    <meta property="og:url" content="${escapeHtml(SITE_URL + meta.canonicalPath)}" />`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>\n    ${extra}`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`);
}

async function pageMeta(pathname: string): Promise<PageMeta | null> {
  if (pathname.replace(/\/+$/, '') === '/edit-listing') {
    return { title: 'Edit your listing | ClearAnEstate.com', description: '', canonicalPath: '/edit-listing', noindex: true };
  }

  const guide = parseGuidePath(pathname);
  if (guide) {
    return { title: `${guide.title} | ClearAnEstate.com`, description: guide.description, canonicalPath: guidePath(guide.slug) };
  }

  const db = getPool();
  if (!db) return null;

  const listingMatch = pathname.match(/^\/listings\/([^/]+)/);
  if (listingMatch) {
    await ensureSchema();
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [listingMatch[1]]);
    const row = (rows as any[])[0];
    if (!row) return { title: 'Listing not found | ClearAnEstate.com', description: '', canonicalPath: pathname, notFound: true };
    return {
      title: `${row.name} - ${row.category} in ${row.city}, ${row.state} | ClearAnEstate.com`,
      description: `${row.name} - ${row.tagline || row.description || `${row.category} services in ${row.city}, ${row.state}`}`.slice(0, 160),
      canonicalPath: listingPath(row),
    };
  }

  if (pathname.replace(/\/+$/, '') === '/advertise') {
    const { priceCents } = await currentPricing();
    return {
      title: 'Get Your Estate Business Featured | ClearAnEstate.com',
      description: `Put your estate cleanout, senior move or estate sale business at the top of your city's page. ${dollars(priceCents)}/year, price locked, only ${CITY_CAP} spots per city.`,
      canonicalPath: '/advertise',
    };
  }

  const landing = parseLandingPath(pathname);
  if (!landing) return null;

  await ensureSchema();
  const params: any[] = [];
  let sql = 'SELECT city FROM listings WHERE 1 = 1';
  if (landing.stateCode) {
    sql += ' AND state = ?';
    params.push(landing.stateCode);
  }
  if (landing.service.category) {
    sql += ' AND category = ?';
    params.push(landing.service.category);
  }
  const [rows] = await db.query(sql, params);
  const matching = (rows as any[]).filter((r) => !landing.citySlug || citySlug(r.city) === landing.citySlug);
  const cityName = landing.citySlug ? matching[0]?.city ?? null : null;

  if (matching.length === 0) {
    return { title: 'No listings here yet | ClearAnEstate.com', description: '', canonicalPath: pathname, notFound: true };
  }
  return {
    title: `${landingTitle(landing, cityName)} | ClearAnEstate.com`,
    description: landingDescription(landing, cityName, matching.length),
    canonicalPath: pathname.toLowerCase().replace(/\/+$/, ''),
  };
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    app.get('*', async (req, res) => {
      const meta = await pageMeta(req.path).catch((err) => {
        console.error('Error building page meta:', err);
        return null;
      });
      res.status(meta?.notFound ? 404 : 200).type('html').send(meta ? applyMeta(indexHtml, meta) : indexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
