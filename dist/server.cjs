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
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS listing_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(20) NOT NULL,
        listing_id VARCHAR(64),
        page_path VARCHAR(255),
        visitor_hash CHAR(16) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_events_created (created_at),
        INDEX idx_events_listing (listing_id, created_at)
      )
    `);
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings'`
    );
    const existing = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!existing.has("featured_at")) {
      await db.query("ALTER TABLE listings ADD COLUMN featured_at TIMESTAMP NULL DEFAULT NULL");
    }
    if (!existing.has("featured_price_cents")) {
      await db.query("ALTER TABLE listings ADD COLUMN featured_price_cents INT NULL DEFAULT NULL");
    }
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
      // Fail fast on a wrong port/SSL combination instead of hanging the request.
      connectionTimeout: 15e3,
      greetingTimeout: 15e3,
      socketTimeout: 3e4,
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
async function sendTestMail(to) {
  const settings = {
    SMTP_HOST: process.env.SMTP_HOST || "(missing)",
    SMTP_PORT: process.env.SMTP_PORT || "(missing, using 587)",
    SMTP_SECURE: process.env.SMTP_SECURE || "(missing, using false)",
    SMTP_USER: process.env.SMTP_USER || "(missing)",
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ? "(set)" : "(missing)",
    SMTP_FROM: process.env.SMTP_FROM || "(missing, using SMTP_USER)",
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || "(missing, no admin notifications are sent)"
  };
  const mailer = getTransporter();
  if (!mailer) {
    return { ok: false, error: "Email is switched off: SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set.", settings };
  }
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "ClearAnEstate test email",
      text: "This is a test email from the ClearAnEstate admin portal. If you can read it, email sending works."
    });
    return { ok: true, settings };
  } catch (err) {
    console.error("Test email failed:", err);
    return { ok: false, error: [err?.code, err?.response || err?.message].filter(Boolean).join(": "), settings };
  }
}

// src/lib/slug.ts
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function listingSlug(listing) {
  return slugify(`${listing.name}-${listing.city}-${listing.state}`);
}
function listingPath(listing) {
  return `/listings/${listing.id}/${listingSlug(listing)}`;
}

// src/lib/locations.ts
var US_STATES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
};
var ALL_SERVICES_SLUG = "estate-services";
var SERVICES = [
  { slug: ALL_SERVICES_SLUG, category: null, label: "Estate Services", plural: "Estate Cleanout & Downsizing Companies" },
  { slug: "estate-cleanouts", category: "Estate Cleanouts", label: "Estate Cleanouts", plural: "Estate Cleanout Companies" },
  { slug: "senior-move-management", category: "Senior Move Management", label: "Senior Move Management", plural: "Senior Move Managers" },
  { slug: "junk-removal", category: "Junk Removal & Hauling", label: "Junk Removal & Hauling", plural: "Junk Removal & Hauling Companies" },
  { slug: "estate-sales", category: "Liquidation & Estate Sales", label: "Liquidation & Estate Sales", plural: "Estate Sale & Liquidation Companies" },
  { slug: "appraisal-downsizing", category: "Content Appraisal & Downsizing", label: "Content Appraisal & Downsizing", plural: "Appraisal & Downsizing Specialists" }
];
function serviceBySlug(slug) {
  return SERVICES.find((s) => s.slug === slug) || null;
}
function serviceForCategory(category) {
  return SERVICES.find((s) => s.category === category) || SERVICES[0];
}
function stateName(code) {
  return US_STATES[code.toUpperCase()] || code;
}
function stateSlug(code) {
  return slugify(stateName(code));
}
function stateCodeFromSlug(slug) {
  if (!slug) return null;
  const match = Object.keys(US_STATES).find((code) => slugify(US_STATES[code]) === slug.toLowerCase());
  return match || null;
}
function citySlug(city) {
  return slugify(city);
}
function statePath(code, serviceSlug = ALL_SERVICES_SLUG) {
  return `/${serviceSlug}/${stateSlug(code)}`;
}
function cityPath(code, city, serviceSlug = ALL_SERVICES_SLUG) {
  return `/${serviceSlug}/${stateSlug(code)}/${citySlug(city)}`;
}
function landingPaths(rows) {
  const paths = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (!US_STATES[row.state?.toUpperCase()]) continue;
    const service = serviceForCategory(row.category);
    paths.add(statePath(row.state));
    paths.add(cityPath(row.state, row.city));
    if (service.slug !== ALL_SERVICES_SLUG) {
      paths.add(statePath(row.state, service.slug));
      paths.add(cityPath(row.state, row.city, service.slug));
    }
  }
  return Array.from(paths).sort();
}
function parseLandingPath(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2 || parts.length > 3) return null;
  const service = serviceBySlug(parts[0]);
  const stateCode = stateCodeFromSlug(parts[1]);
  if (!service || !stateCode) return null;
  return { service, stateCode, citySlug: parts[2] || null };
}
function landingTitle(match, cityName) {
  const where = cityName ? `${cityName}, ${match.stateCode}` : stateName(match.stateCode);
  return `${match.service.plural} in ${where}`;
}
function landingDescription(match, cityName, count) {
  const where = cityName ? `${cityName}, ${match.stateCode}` : stateName(match.stateCode);
  const what = match.service.category ? match.service.label.toLowerCase() : "estate cleanout, senior move, junk removal and estate sale";
  return `Compare ${count} ${what} ${count === 1 ? "company" : "companies"} in ${where}. See services, phone numbers and websites, and contact local pros directly on ClearAnEstate.com.`;
}

// src/lib/pricing.ts
var BASE_PRICE_CENTS = 19900;
var STEP_CENTS = 5e3;
var TIER_SIZE = 10;
var CITY_CAP = 3;
function pricingFor(paidCount) {
  const tier = Math.floor(paidCount / TIER_SIZE);
  return {
    priceCents: BASE_PRICE_CENTS + tier * STEP_CENTS,
    nextPriceCents: BASE_PRICE_CENTS + (tier + 1) * STEP_CENTS,
    spotsLeftAtPrice: TIER_SIZE - paidCount % TIER_SIZE,
    paidCount
  };
}
function dollars(cents) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var SITE_URL = (process.env.APP_URL || "https://clearanestate.com").replace(/\/$/, "");
app.set("trust proxy", 1);
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
        const priceCents = Number(session.metadata?.priceCents) || null;
        const db = getPool();
        if (listingId && db) {
          try {
            await ensureSchema();
            await db.query(
              "UPDATE listings SET featured = TRUE, featured_at = CURRENT_TIMESTAMP, featured_price_cents = ?, stripe_subscription_id = ? WHERE id = ?",
              [priceCents, typeof session.subscription === "string" ? session.subscription : null, listingId]
            );
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
            await db.query("UPDATE listings SET featured = FALSE, featured_at = NULL WHERE stripe_subscription_id = ?", [subscription.id]);
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
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database is not configured on server." });
    const listingId = typeof req.body?.listingId === "string" ? req.body.listingId : "";
    await ensureSchema();
    const [rows] = await db.query("SELECT id, name, city, state, featured FROM listings WHERE id = ?", [listingId]);
    const listing = rows[0];
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (listing.featured) return res.status(409).json({ error: "This listing is already featured." });
    const cityTaken = await cityFeaturedCount(listing.city, listing.state);
    if (cityTaken >= CITY_CAP) {
      return res.status(409).json({
        error: `All ${CITY_CAP} featured spots in ${listing.city}, ${listing.state} are taken. Email us to join the waitlist.`
      });
    }
    const { priceCents } = await currentPricing();
    const origin = process.env.APP_URL ? SITE_URL : req.headers.origin || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Featured Listing - ${listing.name} (${listing.city}, ${listing.state})`,
              description: `Top placement on the ${listing.city} page, Featured badge, contact report. ${dollars(priceCents)}/year, price locked while subscribed.`
            },
            unit_amount: priceCents,
            recurring: {
              interval: "year"
            }
          },
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: `${origin}/advertise?featured_success=true&listing_id=${encodeURIComponent(listing.id)}`,
      cancel_url: `${origin}/advertise?listing=${encodeURIComponent(listing.id)}`,
      metadata: {
        listingId: listing.id,
        listingTitle: listing.name,
        priceCents: String(priceCents)
      },
      subscription_data: {
        metadata: { listingId: listing.id, priceCents: String(priceCents) }
      }
    });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("Error creating Stripe checkout session:", err);
    res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});
function parseServices(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}
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
    services: parseServices(row.services),
    featured: !!row.featured,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    yearsInBusiness: row.years_in_business ?? void 0,
    insured: !!row.insured,
    bonded: !!row.bonded,
    hours: row.hours || void 0,
    claimed: !!row.claimed,
    address: row.address || void 0,
    featuredAt: row.featured_at ? new Date(row.featured_at).toISOString() : void 0,
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
    services: parseServices(row.services),
    submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString().split("T")[0] : String(row.submitted_at).split("T")[0],
    status: row.status
  };
}
async function currentPricing() {
  const db = getPool();
  if (!db) return pricingFor(0);
  await ensureSchema();
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS n FROM listings WHERE featured = TRUE AND stripe_subscription_id IS NOT NULL"
  );
  return pricingFor(Number(row?.n) || 0);
}
async function cityFeaturedCount(city, state) {
  const db = getPool();
  if (!db) return 0;
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS n FROM listings WHERE featured = TRUE AND city = ? AND state = ?",
    [city, state]
  );
  return Number(row?.n) || 0;
}
app.get("/api/pricing", async (req, res) => {
  try {
    const pricing = await currentPricing();
    const db = getPool();
    let city = null;
    let listingFeatured = false;
    const listingId = typeof req.query.listingId === "string" ? req.query.listingId : "";
    if (db && listingId) {
      const [rows] = await db.query("SELECT city, state, featured FROM listings WHERE id = ?", [listingId]);
      const listing = rows[0];
      if (listing) {
        city = { name: listing.city, state: listing.state, taken: await cityFeaturedCount(listing.city, listing.state) };
        listingFeatured = !!listing.featured;
      }
    }
    res.json({ ...pricing, cityCap: CITY_CAP, city, listingFeatured });
  } catch (err) {
    console.error("Error loading pricing:", err);
    res.status(500).json({ error: "Failed to load pricing." });
  }
});
var publicStatsCache = null;
app.get("/api/public-stats", async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  if (publicStatsCache && Date.now() - publicStatsCache.at < 10 * 60 * 1e3) {
    return res.json(publicStatsCache.data);
  }
  try {
    await ensureSchema();
    const [[events]] = await db.query(
      `SELECT COUNT(DISTINCT visitor_hash, DATE(created_at)) AS visitors,
         SUM(event_type IN ('call', 'website')) AS contacts
       FROM listing_events WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)`
    );
    const [[quotes]] = await db.query(
      "SELECT COUNT(*) AS n FROM quote_requests WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)"
    );
    const [[counts]] = await db.query(
      `SELECT COUNT(*) AS listings, COUNT(DISTINCT city, state) AS cities FROM listings`
    );
    const data = {
      visitors30d: Number(events?.visitors) || 0,
      contacts30d: (Number(events?.contacts) || 0) + (Number(quotes?.n) || 0),
      listings: Number(counts?.listings) || 0,
      cities: Number(counts?.cities) || 0
    };
    publicStatsCache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error("Error loading public stats:", err);
    res.status(500).json({ error: "Failed to load stats." });
  }
});
app.get("/api/listings/status", (req, res) => {
  res.json({ configured: isDbConfigured() });
});
app.get("/api/listings", async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listings ORDER BY featured DESC, featured_at ASC, rating DESC");
    res.json(rows.map(rowToListing));
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).json({ error: "Failed to fetch listings." });
  }
});
app.get("/sitemap.xml", async (req, res) => {
  res.type("application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  const urls = [{ loc: `${SITE_URL}/` }, { loc: `${SITE_URL}/advertise` }];
  const db = getPool();
  if (db) {
    try {
      await ensureSchema();
      const [rows] = await db.query("SELECT id, name, city, state, category, created_at FROM listings");
      for (const landing of landingPaths(rows)) {
        urls.push({ loc: `${SITE_URL}${landing}` });
      }
      for (const row of rows) {
        urls.push({
          loc: `${SITE_URL}${listingPath(row)}`,
          lastmod: row.created_at instanceof Date ? row.created_at.toISOString().split("T")[0] : String(row.created_at).split("T")[0]
        });
      }
    } catch (err) {
      console.error("Error building sitemap:", err);
    }
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
` + urls.map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
` + (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>
` : "") + `  </url>`
  ).join("\n") + `
</urlset>
`;
  res.send(body);
});
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`);
});
var TRACK_EVENT_TYPES = /* @__PURE__ */ new Set(["page_view", "listing_view", "call", "website"]);
var BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i;
var trackLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  limit: 120,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req, res) => res.status(204).end()
});
function visitorHash(req) {
  const day = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return import_crypto.default.createHash("sha256").update(`${day}|${process.env.ADMIN_PASSWORD || ""}|${req.ip}|${req.get("user-agent") || ""}`).digest("hex").slice(0, 16);
}
app.post("/api/track", trackLimiter, async (req, res) => {
  res.status(204).end();
  const db = getPool();
  const type = String(req.body?.type || "");
  if (!db || !TRACK_EVENT_TYPES.has(type) || BOT_UA.test(req.get("user-agent") || "")) return;
  const listingId = typeof req.body?.listingId === "string" ? req.body.listingId.slice(0, 64) : null;
  if (type !== "page_view" && !listingId) return;
  const pagePath = typeof req.body?.path === "string" ? req.body.path.slice(0, 255) : null;
  try {
    await ensureSchema();
    await db.query(
      "INSERT INTO listing_events (event_type, listing_id, page_path, visitor_hash) VALUES (?, ?, ?, ?)",
      [type, listingId, pagePath, visitorHash(req)]
    );
  } catch (err) {
    console.error("Error recording tracking event:", err);
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
    emailed: !!row.emailed_to_business,
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
        JSON.stringify(parseServices(target.services)),
        "Mon-Fri: 8:00 AM - 6:00 PM",
        createdAt
      ]
    );
    await db.query("DELETE FROM pending_submissions WHERE id = ?", [req.params.id]);
    const [newRows] = await db.query("SELECT * FROM listings WHERE id = ?", [newId]);
    res.json(rowToListing(newRows[0]));
  } catch (err) {
    console.error("Error approving submission:", err);
    res.status(500).json({ error: "Failed to approve submission.", details: err.message });
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
    res.status(500).json({ error: "Failed to reject submission.", details: err.message });
  }
});
app.post("/api/admin/listings/:id/toggle-featured", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    await db.query(
      // featured_at is assigned first, from the old value of featured, so this is correct
      // whether the server evaluates SET left to right (MySQL) or simultaneously (MariaDB option).
      "UPDATE listings SET featured_at = IF(featured, NULL, CURRENT_TIMESTAMP), featured = NOT featured WHERE id = ?",
      [req.params.id]
    );
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Listing not found." });
    res.json(rowToListing(row));
  } catch (err) {
    console.error("Error toggling featured status:", err);
    res.status(500).json({ error: "Failed to update listing.", details: err.message });
  }
});
app.get("/api/admin/stats", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  try {
    await ensureSchema();
    const since = "created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)";
    const [[totals]] = await db.query(
      `SELECT
         SUM(event_type = 'page_view') AS pageViews,
         COUNT(DISTINCT visitor_hash, DATE(created_at)) AS visitors,
         SUM(event_type = 'listing_view') AS listingViews,
         SUM(event_type = 'call') AS calls,
         SUM(event_type = 'website') AS websiteClicks
       FROM listing_events WHERE ${since}`,
      [days]
    );
    const [[quoteTotals]] = await db.query(
      `SELECT COUNT(*) AS quotes FROM quote_requests WHERE ${since}`,
      [days]
    );
    const [daily] = await db.query(
      `SELECT DATE(created_at) AS day,
         COUNT(DISTINCT visitor_hash) AS visitors,
         SUM(event_type IN ('call', 'website')) AS contacts
       FROM listing_events WHERE ${since}
       GROUP BY DATE(created_at) ORDER BY day`,
      [days]
    );
    const [topListings] = await db.query(
      `SELECT e.listing_id AS listingId, l.name, l.city, l.state, l.featured,
         SUM(e.event_type = 'listing_view') AS views,
         SUM(e.event_type = 'call') AS calls,
         SUM(e.event_type = 'website') AS websiteClicks
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
    const n = (v) => Number(v) || 0;
    res.json({
      days,
      pageViews: n(totals?.pageViews),
      visitors: n(totals?.visitors),
      listingViews: n(totals?.listingViews),
      calls: n(totals?.calls),
      websiteClicks: n(totals?.websiteClicks),
      quoteRequests: n(quoteTotals?.quotes),
      daily: daily.map((d) => ({
        day: d.day instanceof Date ? d.day.toISOString().split("T")[0] : String(d.day).split("T")[0],
        visitors: n(d.visitors),
        contacts: n(d.contacts)
      })),
      topListings: topListings.map((r) => ({
        listingId: r.listingId,
        name: r.name || "(deleted listing)",
        city: r.city || "",
        state: r.state || "",
        featured: !!r.featured,
        views: n(r.views),
        calls: n(r.calls),
        websiteClicks: n(r.websiteClicks)
      })),
      topPages: topPages.map((r) => ({ path: r.path || "/", views: n(r.views) }))
    });
  } catch (err) {
    console.error("Error building traffic stats:", err);
    res.status(500).json({ error: "Failed to load traffic stats.", details: err.message });
  }
});
app.get("/api/admin/subscriptions", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    const [rows] = await db.query(
      "SELECT id, name, city, state, featured, stripe_subscription_id FROM listings WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != ''"
    );
    const stripe = getStripe();
    const subscriptions = await Promise.all(
      rows.map(async (row) => {
        const base = {
          listingId: row.id,
          listingName: row.name,
          city: row.city,
          state: row.state,
          featured: !!row.featured,
          subscriptionId: row.stripe_subscription_id
        };
        if (!stripe) {
          return { ...base, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: null, amount: null, error: "Stripe is not configured on server." };
        }
        try {
          const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
          const item = sub.items?.data?.[0];
          const periodEndUnix = sub.current_period_end ?? item?.current_period_end;
          return {
            ...base,
            status: sub.status,
            currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1e3).toISOString().split("T")[0] : null,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
            amount: item?.price?.unit_amount ?? null,
            interval: item?.price?.recurring?.interval ?? null
          };
        } catch (err) {
          return { ...base, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: null, amount: null, error: err.message };
        }
      })
    );
    res.json(subscriptions);
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions.", details: err.message });
  }
});
var VALID_CATEGORIES = [
  "Estate Cleanouts",
  "Senior Move Management",
  "Junk Removal & Hauling",
  "Liquidation & Estate Sales",
  "Content Appraisal & Downsizing"
];
function normalizeCategory(value) {
  const match = VALID_CATEGORIES.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  return match || null;
}
app.post("/api/admin/listings/bulk-import", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const { listings } = req.body;
  if (!Array.isArray(listings) || listings.length === 0) {
    return res.status(400).json({ error: "No listings provided." });
  }
  if (listings.length > 200) {
    return res.status(400).json({ error: "Limit 200 listings per import batch." });
  }
  const imported = [];
  const skipped = [];
  try {
    await ensureSchema();
    for (let i = 0; i < listings.length; i++) {
      const raw = listings[i];
      const name = (raw.name || "").trim();
      const city = (raw.city || "").trim();
      const state = (raw.state || "").trim().toUpperCase();
      const category = normalizeCategory(raw.category || "");
      if (!name || !city || !state) {
        skipped.push({ row: i + 1, reason: "Missing required field (name, city, or state)." });
        continue;
      }
      if (!category) {
        skipped.push({ row: i + 1, reason: `Unrecognized category "${raw.category}".` });
        continue;
      }
      const [existingRows] = await db.query(
        "SELECT id FROM listings WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?) AND state = ?",
        [name, city, state]
      );
      if (existingRows.length > 0) {
        skipped.push({ row: i + 1, reason: `"${name}" in ${city}, ${state} already exists - skipped to avoid a duplicate.` });
        continue;
      }
      const id = "l-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const createdAt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
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
          (raw.phone || "").trim(),
          (raw.website || "").trim(),
          description,
          JSON.stringify([]),
          createdAt
        ]
      );
      imported.push({ row: i + 1, id, name });
    }
    res.status(201).json({ imported, skipped });
  } catch (err) {
    console.error("Error bulk-importing listings:", err);
    res.status(500).json({ error: "Bulk import failed.", details: err.message, imported, skipped });
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
    res.status(500).json({ error: "Failed to fetch quote requests.", details: err.message });
  }
});
app.post("/api/admin/test-email", adminAuthLimiter, requireAdmin, async (req, res) => {
  const to = String(req.body?.to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "Enter a valid email address to send the test to." });
  }
  res.json(await sendTestMail(to));
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
    res.status(500).json({ error: "Failed to fetch claim requests.", details: err.message });
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
    res.status(500).json({ error: "Failed to approve claim request.", details: err.message });
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
    res.status(500).json({ error: "Failed to reject claim request.", details: err.message });
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
    res.status(500).json({ error: "Failed to delete listing.", details: err.message });
  }
});
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function applyMeta(html, meta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const extra = meta.notFound ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeHtml(SITE_URL + meta.canonicalPath)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(SITE_URL + meta.canonicalPath)}" />`;
  return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>
    ${extra}`).replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`);
}
async function pageMeta(pathname) {
  const db = getPool();
  if (!db) return null;
  const listingMatch = pathname.match(/^\/listings\/([^/]+)/);
  if (listingMatch) {
    await ensureSchema();
    const [rows2] = await db.query("SELECT * FROM listings WHERE id = ?", [listingMatch[1]]);
    const row = rows2[0];
    if (!row) return { title: "Listing not found | ClearAnEstate.com", description: "", canonicalPath: pathname, notFound: true };
    return {
      title: `${row.name} - ${row.category} in ${row.city}, ${row.state} | ClearAnEstate.com`,
      description: `${row.name} - ${row.tagline || row.description || `${row.category} services in ${row.city}, ${row.state}`}`.slice(0, 160),
      canonicalPath: listingPath(row)
    };
  }
  if (pathname.replace(/\/+$/, "") === "/advertise") {
    const { priceCents } = await currentPricing();
    return {
      title: "Get Your Estate Business Featured | ClearAnEstate.com",
      description: `Put your estate cleanout, senior move or estate sale business at the top of your city's page. ${dollars(priceCents)}/year, price locked, only ${CITY_CAP} spots per city.`,
      canonicalPath: "/advertise"
    };
  }
  const landing = parseLandingPath(pathname);
  if (!landing) return null;
  await ensureSchema();
  const params = [landing.stateCode];
  let sql = "SELECT city FROM listings WHERE state = ?";
  if (landing.service.category) {
    sql += " AND category = ?";
    params.push(landing.service.category);
  }
  const [rows] = await db.query(sql, params);
  const matching = rows.filter((r) => !landing.citySlug || citySlug(r.city) === landing.citySlug);
  const cityName = landing.citySlug ? matching[0]?.city ?? null : null;
  if (matching.length === 0) {
    return { title: "No listings here yet | ClearAnEstate.com", description: "", canonicalPath: pathname, notFound: true };
  }
  return {
    title: `${landingTitle(landing, cityName)} | ClearAnEstate.com`,
    description: landingDescription(landing, cityName, matching.length),
    canonicalPath: pathname.toLowerCase().replace(/\/+$/, "")
  };
}
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, { index: false }));
    const indexHtml = import_fs.default.readFileSync(import_path.default.join(distPath, "index.html"), "utf8");
    app.get("*", async (req, res) => {
      const meta = await pageMeta(req.path).catch((err) => {
        console.error("Error building page meta:", err);
        return null;
      });
      res.status(meta?.notFound ? 404 : 200).type("html").send(meta ? applyMeta(indexHtml, meta) : indexHtml);
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
