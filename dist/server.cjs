var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_stripe = __toESM(require("stripe"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);

// db.ts
var import_promise = __toESM(require("mysql2/promise"), 1);
var pool = null;
var schemaReady = null;
function isDbConfigured() {
  return !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}
function getPool() {
  if (!isDbConfigured()) return null;
  if (!pool) {
    const socketPath = process.env.DB_SOCKET || (process.env.DB_HOST?.startsWith("/") ? process.env.DB_HOST : null);
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5
    };
    if (socketPath) {
      config.socketPath = socketPath;
    } else {
      config.host = process.env.DB_HOST;
      config.port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
    }
    pool = import_promise.default.createPool(config);
  }
  return pool;
}
function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = getPool();
    if (!db) return;
    await db.query(`
      CREATE TABLE IF NOT EXISTS pending_submissions (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(10) NOT NULL,
        phone VARCHAR(50),
        website VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255),
        description TEXT,
        services JSON,
        submitted_at DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tagline VARCHAR(500),
        category VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(10) NOT NULL,
        phone VARCHAR(50),
        website VARCHAR(255),
        email VARCHAR(255),
        description TEXT,
        services JSON,
        featured BOOLEAN DEFAULT FALSE,
        rating DECIMAL(2,1) DEFAULT 5.0,
        review_count INT DEFAULT 0,
        years_in_business INT,
        insured BOOLEAN DEFAULT TRUE,
        bonded BOOLEAN DEFAULT TRUE,
        hours VARCHAR(255),
        claimed BOOLEAN DEFAULT FALSE,
        address VARCHAR(255),
        created_at DATE NOT NULL,
        stripe_subscription_id VARCHAR(255)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id VARCHAR(64) PRIMARY KEY,
        listing_id VARCHAR(64) NOT NULL,
        listing_name VARCHAR(255) NOT NULL,
        requester_name VARCHAR(255) NOT NULL,
        requester_email VARCHAR(255) NOT NULL,
        requester_phone VARCHAR(50),
        property_type VARCHAR(100),
        project_scope VARCHAR(100),
        timeline VARCHAR(100),
        notes TEXT,
        emailed_to_business BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS claim_requests (
        id VARCHAR(64) PRIMARY KEY,
        listing_id VARCHAR(64) NOT NULL,
        listing_name VARCHAR(255) NOT NULL,
        claimant_name VARCHAR(255) NOT NULL,
        claimant_email VARCHAR(255) NOT NULL,
        claimant_phone VARCHAR(50),
        proof_details TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  })();
  return schemaReady;
}

// mailer.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);
var transporter = null;
function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}
function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = import_nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  return transporter;
}
async function sendMail(opts) {
  const mailer = getTransporter();
  if (!mailer) return false;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text
    });
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.set("trust proxy", 1);
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
function requireAdmin(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: "Admin portal is not configured (ADMIN_PASSWORD missing on server)." });
  }
  if (req.header("x-admin-password") !== adminPassword) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  next();
}
var submissionLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions from this network. Please try again later." }
});
var adminAuthLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many failed admin login attempts. Please try again later." }
});
function isHoneypotTripped(req) {
  return !!req.body?.hp;
}
function notifyAdmin(subject, text) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) return;
  sendMail({ to, subject, text }).catch(() => {
  });
}
var stripeInstance = null;
function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeInstance = new import_stripe.default(key);
    }
  }
  return stripeInstance;
}
app.post(
  "/api/stripe/webhook",
  import_express.default.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
      console.warn("Stripe secret key or webhook secret missing on server");
      return res.status(400).json({ error: "Stripe webhook is not configured" });
    }
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      if (!sig) {
        return res.status(400).send("Missing Stripe signature header");
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Payment checkout session completed:", session.id, session.customer_details?.email);
        const listingId = session.metadata?.listingId;
        const db = getPool();
        if (listingId && db) {
          try {
            await ensureSchema();
            await db.query("UPDATE listings SET featured = TRUE, stripe_subscription_id = ? WHERE id = ?", [
              typeof session.subscription === "string" ? session.subscription : null,
              listingId
            ]);
            console.log("Marked listing as featured after successful payment:", listingId);
          } catch (err) {
            console.error("Failed to mark listing as featured after checkout:", err);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log("Subscription cancelled:", subscription.id);
        const db = getPool();
        if (db) {
          try {
            await ensureSchema();
            await db.query("UPDATE listings SET featured = FALSE WHERE stripe_subscription_id = ?", [subscription.id]);
            console.log("Removed featured status after subscription cancellation:", subscription.id);
          } catch (err) {
            console.error("Failed to remove featured status after subscription cancellation:", err);
          }
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log("PaymentIntent succeeded:", paymentIntent.id);
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
    res.json({ received: true });
  }
);
app.use(import_express.default.json());
app.get("/api/stripe/status", (req, res) => {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  res.json({
    configured: hasSecretKey,
    hasWebhookSecret,
    message: hasSecretKey ? "Stripe secret key and webhook secret configured on server." : "Stripe secret key not set in environment."
  });
});
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({
        error: "STRIPE_SECRET_KEY is missing in backend environment variables."
      });
    }
    const { listingTitle, listingId, returnUrl } = req.body;
    const origin = returnUrl || req.headers.origin || process.env.APP_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Featured Listing Promotion - ${listingTitle || "ClearAnEstate Business"}`,
              description: "ClearAnEstate Top Placement & Priority Directory Badge ($30/mo)"
            },
            unit_amount: 3e3,
            // $30.00
            recurring: {
              interval: "month"
            }
          },
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: `${origin}?featured_success=true&listing_id=${listingId || ""}`,
      cancel_url: `${origin}?featured_cancel=true`,
      metadata: {
        listingId: listingId || "",
        listingTitle: listingTitle || ""
      }
    });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("Error creating Stripe checkout session:", err);
    res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});
function rowToListing(row) {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    category: row.category,
    city: row.city,
    state: row.state,
    phone: row.phone || void 0,
    website: row.website,
    email: row.email || void 0,
    description: row.description,
    services: row.services ? JSON.parse(row.services) : [],
    featured: !!row.featured,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    yearsInBusiness: row.years_in_business ?? void 0,
    insured: !!row.insured,
    bonded: !!row.bonded,
    hours: row.hours || void 0,
    claimed: !!row.claimed,
    address: row.address || void 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString().split("T")[0] : String(row.created_at).split("T")[0]
  };
}
function rowToPending(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    state: row.state,
    phone: row.phone || "",
    website: row.website,
    email: row.email,
    contactName: row.contact_name,
    description: row.description,
    services: row.services ? JSON.parse(row.services) : [],
    submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString().split("T")[0] : String(row.submitted_at).split("T")[0],
    status: row.status
  };
}
app.get("/api/listings/status", (req, res) => {
  res.json({ configured: isDbConfigured() });
});
app.get("/api/listings", async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listings ORDER BY featured DESC, rating DESC");
    res.json(rows.map(rowToListing));
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).json({ error: "Failed to fetch listings." });
  }
});
app.post("/api/listings/submit", submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const { name, category, city, state, phone, website, email, contactName, description, services } = req.body;
  if (!name || !city || !state || !email) {
    return res.status(400).json({ error: "Business Name, City, State, and Contact Email are required." });
  }
  if (isHoneypotTripped(req)) {
    return res.status(201).json({
      id: "p-" + Date.now(),
      name,
      category: category || "Estate Cleanouts",
      city,
      state,
      phone: phone || "",
      website: website || "https://example.com",
      email,
      contactName: contactName || "Business Owner",
      description: description || "",
      services: Array.isArray(services) ? services : [],
      submittedAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      status: "pending"
    });
  }
  try {
    await ensureSchema();
    const id = "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const submittedAt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const servicesList = Array.isArray(services) && services.length > 0 ? services : ["Estate Cleanout", "Property Clearing"];
    await db.query(
      `INSERT INTO pending_submissions
        (id, name, category, city, state, phone, website, email, contact_name, description, services, submitted_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        name,
        category || "Estate Cleanouts",
        city,
        state.toUpperCase(),
        phone || "",
        website || "https://example.com",
        email,
        contactName || "Business Owner",
        description || `${name} provides professional ${category || "estate cleanout"} services.`,
        JSON.stringify(servicesList),
        submittedAt
      ]
    );
    const [rows] = await db.query("SELECT * FROM pending_submissions WHERE id = ?", [id]);
    notifyAdmin(
      `New Listing Submission: ${name}`,
      `${name} (${category || "Estate Cleanouts"}) in ${city}, ${state.toUpperCase()} submitted a free listing.

Contact: ${contactName || "Business Owner"} (${email})

Review it in the Admin Portal's Pending Submissions tab.`
    );
    res.status(201).json(rowToPending(rows[0]));
  } catch (err) {
    console.error("Error submitting listing:", err);
    res.status(500).json({ error: "Failed to submit listing." });
  }
});
function rowToQuote(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingName: row.listing_name,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone || "",
    propertyType: row.property_type,
    projectScope: row.project_scope,
    timeline: row.timeline,
    notes: row.notes || "",
    submittedAt: row.created_at instanceof Date ? row.created_at.toISOString().split("T")[0] : String(row.created_at).split("T")[0]
  };
}
app.post("/api/listings/quote", submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
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
    notes
  } = req.body;
  if (!listingId || !listingName || !requesterName || !requesterEmail) {
    return res.status(400).json({ error: "Missing required quote request fields." });
  }
  if (isHoneypotTripped(req)) {
    return res.status(201).json({ ok: true, emailed: false });
  }
  try {
    await ensureSchema();
    const id = "q-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    let emailed = false;
    if (listingEmail) {
      emailed = await sendMail({
        to: listingEmail,
        replyTo: requesterEmail,
        subject: `New Cleanout Estimate Request via ClearAnEstate.com`,
        text: `You have a new estimate request from ${requesterName} (${requesterEmail}${requesterPhone ? ", " + requesterPhone : ""}).

Property Type: ${propertyType}
Project Scope: ${projectScope}
Timeline: ${timeline}

Message:
${notes || "(none provided)"}

Reply directly to this email to respond to ${requesterName}.`
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
        requesterPhone || "",
        propertyType || "",
        projectScope || "",
        timeline || "",
        notes || "",
        emailed
      ]
    );
    notifyAdmin(
      `New Estimate Request for ${listingName}`,
      `${requesterName} (${requesterEmail}${requesterPhone ? ", " + requesterPhone : ""}) requested an estimate from ${listingName}.

Property Type: ${propertyType}
Project Scope: ${projectScope}
Timeline: ${timeline}

${emailed ? "This was emailed directly to the business." : "The business has no email on file, so this was only saved to the database."} View it in the Admin Portal's Quote Requests tab.`
    );
    res.status(201).json({ ok: true, emailed });
  } catch (err) {
    console.error("Error submitting quote request:", err);
    res.status(500).json({ error: "Failed to submit quote request." });
  }
});
function rowToClaim(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingName: row.listing_name,
    claimantName: row.claimant_name,
    claimantEmail: row.claimant_email,
    claimantPhone: row.claimant_phone || "",
    proofDetails: row.proof_details || "",
    status: row.status,
    submittedAt: row.created_at instanceof Date ? row.created_at.toISOString().split("T")[0] : String(row.created_at).split("T")[0]
  };
}
function extractDomain(value) {
  if (!value) return null;
  try {
    const withProtocol = value.includes("://") ? value : `https://${value}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
app.post("/api/listings/:id/claim", submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const { claimantName, claimantEmail, claimantPhone, proofDetails } = req.body;
  if (!claimantName || !claimantEmail) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (isHoneypotTripped(req)) {
    return res.status(201).json({ status: "pending" });
  }
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [req.params.id]);
    const listing = rows[0];
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const claimantDomain = extractDomain(claimantEmail.split("@")[1]);
    const listingDomain = extractDomain(listing.website) || extractDomain(listing.email?.split("@")[1]);
    const autoApproved = !!claimantDomain && !!listingDomain && claimantDomain === listingDomain;
    const id = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const status = autoApproved ? "approved" : "pending";
    await db.query(
      `INSERT INTO claim_requests
        (id, listing_id, listing_name, claimant_name, claimant_email, claimant_phone, proof_details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, listing.name, claimantName, claimantEmail, claimantPhone || "", proofDetails || "", status]
    );
    if (autoApproved) {
      await db.query("UPDATE listings SET claimed = TRUE WHERE id = ?", [req.params.id]);
    } else {
      notifyAdmin(
        `Claim Request Needs Review: ${listing.name}`,
        `${claimantName} (${claimantEmail}${claimantPhone ? ", " + claimantPhone : ""}) is claiming "${listing.name}" but their email domain didn't match the listing's website, so it needs manual review.

${proofDetails ? "Their note: " + proofDetails : "No verification note provided."}

Review it in the Admin Portal's Claim Requests tab.`
      );
    }
    res.status(201).json({ status });
  } catch (err) {
    console.error("Error submitting claim request:", err);
    res.status(500).json({ error: "Failed to submit claim request." });
  }
});
app.post("/api/admin/login", adminAuthLimiter, (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: "Admin portal is not configured (ADMIN_PASSWORD missing on server)." });
  }
  if (req.body?.password !== adminPassword) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  res.json({ ok: true });
});
app.get("/api/admin/pending", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM pending_submissions ORDER BY created_at DESC");
    res.json(rows.map(rowToPending));
  } catch (err) {
    console.error("Error fetching pending submissions:", err);
    res.status(500).json({ error: "Failed to fetch pending submissions.", details: err.message });
  }
});
app.post("/api/admin/pending/:id/approve", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM pending_submissions WHERE id = ?", [req.params.id]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: "Submission not found." });
    const newId = "l-" + Date.now();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
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
        "Mon-Fri: 8:00 AM - 6:00 PM",
        createdAt
      ]
    );
    await db.query("DELETE FROM pending_submissions WHERE id = ?", [req.params.id]);
    const [newRows] = await db.query("SELECT * FROM listings WHERE id = ?", [newId]);
    res.json(rowToListing(newRows[0]));
  } catch (err) {
    console.error("Error approving submission:", err);
    res.status(500).json({ error: "Failed to approve submission." });
  }
});
app.post("/api/admin/pending/:id/reject", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    await db.query("DELETE FROM pending_submissions WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error rejecting submission:", err);
    res.status(500).json({ error: "Failed to reject submission." });
  }
});
app.post("/api/admin/listings/:id/toggle-featured", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    await db.query("UPDATE listings SET featured = NOT featured WHERE id = ?", [req.params.id]);
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Listing not found." });
    res.json(rowToListing(row));
  } catch (err) {
    console.error("Error toggling featured status:", err);
    res.status(500).json({ error: "Failed to update listing." });
  }
});
app.get("/api/admin/quotes", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM quote_requests ORDER BY created_at DESC");
    res.json(rows.map(rowToQuote));
  } catch (err) {
    console.error("Error fetching quote requests:", err);
    res.status(500).json({ error: "Failed to fetch quote requests." });
  }
});
app.get("/api/admin/claims", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM claim_requests ORDER BY created_at DESC");
    res.json(rows.map(rowToClaim));
  } catch (err) {
    console.error("Error fetching claim requests:", err);
    res.status(500).json({ error: "Failed to fetch claim requests." });
  }
});
app.post("/api/admin/claims/:id/approve", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM claim_requests WHERE id = ?", [req.params.id]);
    const claim = rows[0];
    if (!claim) return res.status(404).json({ error: "Claim request not found." });
    await db.query("UPDATE listings SET claimed = TRUE WHERE id = ?", [claim.listing_id]);
    await db.query("UPDATE claim_requests SET status = 'approved' WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error approving claim request:", err);
    res.status(500).json({ error: "Failed to approve claim request." });
  }
});
app.post("/api/admin/claims/:id/reject", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    await db.query("UPDATE claim_requests SET status = 'rejected' WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error rejecting claim request:", err);
    res.status(500).json({ error: "Failed to reject claim request." });
  }
});
app.delete("/api/admin/listings/:id", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    await db.query("DELETE FROM listings WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting listing:", err);
    res.status(500).json({ error: "Failed to delete listing." });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
