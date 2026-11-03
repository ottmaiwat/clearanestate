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
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_crypto3 = __toESM(require("crypto"), 1);
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS listing_photos (
        id VARCHAR(40) PRIMARY KEY,
        listing_id VARCHAR(64) NOT NULL,
        kind VARCHAR(10) NOT NULL,
        filename VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        uploaded_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_photos_listing (listing_id, status)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS monthly_reports (
        listing_id VARCHAR(64) NOT NULL,
        period CHAR(7) NOT NULL,
        sent_to VARCHAR(255) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (listing_id, period)
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
    if (!existing.has("featured_email")) {
      await db.query("ALTER TABLE listings ADD COLUMN featured_email VARCHAR(255) NULL DEFAULT NULL");
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
function createSmtpTransport(pass) {
  return import_nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    // Fail fast on a wrong port/SSL combination instead of hanging the request.
    connectionTimeout: 15e3,
    greetingTimeout: 15e3,
    socketTimeout: 3e4,
    auth: {
      user: process.env.SMTP_USER,
      pass
    }
  });
}
function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = createSmtpTransport(process.env.SMTP_PASSWORD);
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
async function sendTestMail(to, passwordToTry) {
  const saved = process.env.SMTP_PASSWORD;
  const settings = {
    SMTP_HOST: process.env.SMTP_HOST || "(missing)",
    SMTP_PORT: process.env.SMTP_PORT || "(missing, using 587)",
    SMTP_SECURE: process.env.SMTP_SECURE || "(missing, using false)",
    SMTP_USER: process.env.SMTP_USER || "(missing)",
    SMTP_PASSWORD: saved ? `(set, ${saved.length} characters${saved !== saved.trim() ? ", HAS SPACES AT THE START OR END" : ""}${/^["'].*["']$/.test(saved) ? ", WRAPPED IN QUOTES" : ""})` : "(missing)",
    SMTP_FROM: process.env.SMTP_FROM || "(missing, using SMTP_USER)",
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || "(missing, no admin notifications are sent)"
  };
  if (passwordToTry) {
    settings["Password you typed"] = `${passwordToTry.length} characters, ${passwordToTry === saved ? "MATCHES" : "DOES NOT MATCH"} the saved SMTP_PASSWORD`;
  }
  const mailer = passwordToTry && process.env.SMTP_HOST && process.env.SMTP_USER ? createSmtpTransport(passwordToTry) : getTransporter();
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

// src/lib/site.ts
var SITE_URL = "https://clearanestate.com";

// src/lib/pricing.ts
var BASE_PRICE_CENTS = 19900;
var STEP_CENTS = 5e3;
var TIER_SIZE = 10;
var CITY_CAP = 3;
var GUARANTEE_CONTACTS = 10;
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

// ownerLinks.ts
var import_crypto = __toESM(require("crypto"), 1);
var LINK_DAYS = 30;
function secret() {
  return process.env.EDIT_LINK_SECRET || process.env.ADMIN_PASSWORD || null;
}
function sign(payload, key) {
  return import_crypto.default.createHmac("sha256", key).update(`edit-listing|${payload}`).digest("base64url");
}
function createEditToken(listingId, email) {
  const key = secret();
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1e3) + LINK_DAYS * 24 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ l: listingId, e: email, x: expires })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}
function verifyEditToken(token) {
  const key = secret();
  if (!key || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !import_crypto.default.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.l !== "string" || typeof data.e !== "string" || typeof data.x !== "number") return null;
    if (data.x < Date.now() / 1e3) return null;
    return { listingId: data.l, email: data.e };
  } catch {
    return null;
  }
}
function editLinkUrl(listingId, email) {
  const token = createEditToken(listingId, email);
  return token ? `${SITE_URL}/edit-listing?token=${encodeURIComponent(token)}` : null;
}
var EDIT_LINK_DAYS = LINK_DAYS;

// reports.ts
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function isValidPeriod(period) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}
function previousPeriod(now = /* @__PURE__ */ new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function periodRange(period) {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${period}-01 00:00:00`, end: `${next}-01 00:00:00` };
}
function periodLabel(period) {
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function toSqlDateTime(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function shortDate(sqlDateTime) {
  const [datePart] = sqlDateTime.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}
async function countsBetween(listingId, from, to) {
  const db = getPool();
  const [[events]] = await db.query(
    `SELECT SUM(event_type = 'listing_view') AS views, SUM(event_type = 'call') AS calls,
       SUM(event_type = 'website') AS websiteClicks, SUM(event_type = 'directions') AS directions
     FROM listing_events WHERE listing_id = ? AND created_at >= ? AND created_at < ?`,
    [listingId, from, to]
  );
  const [[quotes]] = await db.query(
    "SELECT COUNT(*) AS n FROM quote_requests WHERE listing_id = ? AND created_at >= ? AND created_at < ?",
    [listingId, from, to]
  );
  const n = (v) => Number(v) || 0;
  const numbers = {
    views: n(events?.views),
    calls: n(events?.calls),
    websiteClicks: n(events?.websiteClicks),
    directions: n(events?.directions),
    quotes: n(quotes?.n),
    contacts: 0
  };
  numbers.contacts = numbers.calls + numbers.websiteClicks + numbers.quotes;
  return numbers;
}
async function findRecipient(row, stripe) {
  if (row.featured_email) return { recipient: row.featured_email, recipientSource: "payment" };
  const db = getPool();
  if (stripe && row.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id, { expand: ["customer"] });
      const customer = sub.customer;
      const email = "email" in customer ? customer.email : null;
      if (email) {
        await db.query("UPDATE listings SET featured_email = ? WHERE id = ?", [email, row.id]);
        return { recipient: email, recipientSource: "stripe" };
      }
    } catch (err) {
      console.error("Could not look up Stripe customer email for listing", row.id, err);
    }
  }
  const [claims] = await db.query(
    "SELECT claimant_email FROM claim_requests WHERE listing_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1",
    [row.id]
  );
  const claimEmail = claims[0]?.claimant_email;
  if (claimEmail) return { recipient: claimEmail, recipientSource: "claim" };
  if (row.email) return { recipient: row.email, recipientSource: "listing" };
  return { recipient: null, recipientSource: null };
}
async function buildReports(period, stripe) {
  const db = getPool();
  if (!db) throw new Error("Database is not configured on server.");
  await ensureSchema();
  const { start, end } = periodRange(period);
  const [rows] = await db.query(
    "SELECT * FROM listings WHERE featured = TRUE AND (featured_at IS NULL OR featured_at < ?) ORDER BY featured_at ASC",
    [end]
  );
  const [sentRows] = await db.query("SELECT listing_id FROM monthly_reports WHERE period = ?", [period]);
  const sent = new Set(sentRows.map((r) => r.listing_id));
  const reports = [];
  for (const row of rows) {
    const featuredSince = toSqlDateTime(row.featured_at);
    const from = featuredSince && featuredSince > start ? featuredSince : start;
    const numbers = await countsBetween(row.id, from, end);
    const sinceFeatured = featuredSince ? await countsBetween(row.id, featuredSince, end) : numbers;
    const { recipient, recipientSource } = await findRecipient(row, stripe);
    let skipReason = null;
    if (sent.has(row.id)) skipReason = "Already sent";
    else if (!recipient) skipReason = "No email address";
    else if (numbers.views === 0 && numbers.contacts === 0 && numbers.directions === 0) skipReason = "No activity this month";
    reports.push({
      listingId: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      recipient,
      recipientSource,
      from,
      numbers,
      contactsSinceFeatured: sinceFeatured.contacts,
      featuredSince,
      alreadySent: sent.has(row.id),
      skipReason
    });
  }
  return reports;
}
function reportEmailText(report, period, listingUrl, editUrl) {
  const { numbers } = report;
  const partial = report.from !== periodRange(period).start;
  const lines = [
    `Hi ${report.name} team,`,
    "",
    `Here's what your featured listing on ClearAnEstate.com got in ${periodLabel(period)}${partial ? ` (since you joined on ${shortDate(report.from)})` : ""}:`,
    "",
    `  Listing views:       ${numbers.views}`,
    `  Phone taps:          ${numbers.calls}`,
    `  Website clicks:      ${numbers.websiteClicks}`,
    `  Directions:          ${numbers.directions}`,
    `  Estimate requests:   ${numbers.quotes}`,
    "",
    `That's ${numbers.contacts} ${numbers.contacts === 1 ? "contact" : "contacts"} (phone taps, website clicks and estimate requests) from people looking for help in ${report.city}.`
  ];
  if (report.featuredSince) {
    const firstYearEnds = new Date(report.featuredSince.replace(" ", "T"));
    firstYearEnds.setFullYear(firstYearEnds.getFullYear() + 1);
    if (/* @__PURE__ */ new Date() < firstYearEnds) {
      const total = report.contactsSinceFeatured;
      lines.push(
        "",
        total >= GUARANTEE_CONTACTS ? `Since you joined, your listing has had ${total} contacts, past the ${GUARANTEE_CONTACTS} we guarantee in your first year.` : `Since you joined, your listing has had ${total} of the ${GUARANTEE_CONTACTS} contacts we guarantee in your first year.`
      );
    }
  }
  lines.push(
    "",
    `Your listing: ${listingUrl}`,
    ...editUrl ? [`Update your phone, services, hours or description: ${editUrl}`] : [],
    "",
    "Phone taps count people who tapped your number on our site. Calls from people who typed your number in by hand are not included, so your real number is likely higher.",
    "",
    "Questions, or anything you want changed on your listing? Just reply to this email.",
    "",
    "ClearAnEstate.com"
  );
  return lines.join("\n");
}
async function sendReports(period, stripe) {
  const db = getPool();
  const reports = await buildReports(period, stripe);
  const result = { sent: [], skipped: [], failed: [] };
  for (const report of reports) {
    if (report.skipReason || !report.recipient) {
      result.skipped.push({ name: report.name, reason: report.skipReason || "No email address" });
      continue;
    }
    const listingUrl = `${SITE_URL}${listingPath({ id: report.listingId, name: report.name, city: report.city, state: report.state })}`;
    const ok = await sendMail({
      to: report.recipient,
      subject: `Your ClearAnEstate results for ${periodLabel(period)}`,
      text: reportEmailText(report, period, listingUrl, editLinkUrl(report.listingId, report.recipient))
    });
    if (ok) {
      await db.query("INSERT IGNORE INTO monthly_reports (listing_id, period, sent_to) VALUES (?, ?, ?)", [report.listingId, period, report.recipient]);
      result.sent.push(report.name);
    } else {
      result.failed.push(report.name);
    }
  }
  return result;
}

// photos.ts
var import_crypto2 = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var UPLOAD_DIR = process.env.UPLOAD_DIR || import_path.default.join(process.cwd(), "uploads");
var MAX_LOGOS = 1;
var MAX_PHOTOS = 6;
var MAX_BYTES = 3 * 1024 * 1024;
function photoUrl(filename) {
  return `/uploads/${filename}`;
}
function detectType(buf) {
  if (buf.length > 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
function decodeImage(data) {
  if (typeof data !== "string" || data.length === 0) return { error: "No image was received." };
  const base64 = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) return { error: "No image was received." };
  if (buffer.length > MAX_BYTES) return { error: "That image is too large. Please choose a smaller one." };
  const ext = detectType(buffer);
  if (!ext) return { error: "Please upload a JPEG, PNG or WebP image." };
  return { buffer, ext };
}
function savePhotoFile(listingId, buffer, ext) {
  import_fs.default.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safeId = listingId.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const filename = `${safeId}-${import_crypto2.default.randomBytes(12).toString("hex")}.${ext}`;
  import_fs.default.writeFileSync(import_path.default.join(UPLOAD_DIR, filename), buffer);
  return filename;
}
function deletePhotoFile(filename) {
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(filename)) return;
  import_fs.default.rm(import_path.default.join(UPLOAD_DIR, filename), { force: true }, () => {
  });
}
function newPhotoId() {
  return "p-" + Date.now() + "-" + import_crypto2.default.randomBytes(4).toString("hex");
}

// src/lib/badge.ts
function badgeImagePath(featured) {
  return featured ? "/badge-featured.svg" : "/badge.svg";
}
function badgeHtml(listing) {
  const featured = !!listing.featured;
  const label = featured ? "Featured on ClearAnEstate" : "Listed on ClearAnEstate";
  return `<a href="${SITE_URL}${listingPath(listing)}" target="_blank" rel="noopener"><img src="${SITE_URL}${badgeImagePath(featured)}" alt="${label}" width="224" height="64" style="border:0"></a>`;
}

// src/lib/guides.ts
var GUIDES = [
  {
    slug: "estate-cleanout-cost",
    title: "How Much Does an Estate Cleanout Cost?",
    description: "What drives the price of an estate cleanout, how companies quote, what a fair quote includes, and practical ways to lower the cost.",
    summary: "What drives the price, how companies quote, and how to keep the bill down.",
    readMinutes: 4,
    serviceSlug: "estate-cleanouts",
    serviceCta: "Compare estate cleanout companies",
    sections: [
      {
        paragraphs: [
          "There is no single price for an estate cleanout. Clearing one bedroom might cost a few hundred dollars, while a full house with a garage, basement and decades of belongings can run into the thousands. The good news: once you know what companies look at, quotes become much easier to compare."
        ],
        heading: "The short answer"
      },
      {
        heading: "What drives the price",
        bullets: [
          "Volume. Most companies think in truckloads. The more there is to remove, the more it costs.",
          "Size and layout of the home. Stairs, basements, attics, long walks to the truck and tight access all add labor.",
          "What happens to the items. Sorting for donation, recycling and resale takes more time than hauling everything to the landfill, but it is often worth it.",
          "Special items. Pianos, hot tubs, safes, appliances, paint, chemicals and other hazardous materials usually cost extra.",
          "Condition of the home. Hoarding situations, pest problems or water damage need more crew and protective equipment.",
          "Timeline. A rush job (for example, a house closing next week) can cost more than a flexible one."
        ]
      },
      {
        heading: "How companies quote",
        paragraphs: [
          "Most estate cleanout companies give a flat project price after a walkthrough, in person or by video. Junk removal companies more often price by the truckload or a fraction of one. Some charge hourly for labor plus disposal fees. A flat, written quote is the easiest to compare and protects you from surprises."
        ]
      },
      {
        heading: "What a good quote includes",
        bullets: [
          "Exactly which rooms and areas are included (garage, shed, attic, basement).",
          "What is donated, recycled, sold or thrown away, and whether you get donation receipts.",
          "Disposal and dump fees, and any extra charges for special items.",
          "Whether the home is left broom-clean.",
          "The start date, how many days it will take, and when payment is due."
        ]
      },
      {
        heading: "Ways to lower the cost",
        bullets: [
          "Take what the family wants first, including photos, papers and keepsakes.",
          "Sell anything valuable before the cleanout. An estate sale or buyout can offset some or all of the cleanout cost.",
          "Ask whether the company buys items or credits resale value against the price.",
          "Get two or three quotes. Prices for the same house can differ a lot.",
          "Be flexible on timing if you can."
        ]
      }
    ]
  },
  {
    slug: "choose-estate-cleanout-company",
    title: "How to Choose an Estate Cleanout Company",
    description: "A checklist for hiring an estate cleanout company: insurance, written quotes, what happens to belongings, and the questions to ask before you sign.",
    summary: "A simple checklist and the questions to ask before you hire anyone.",
    readMinutes: 4,
    serviceSlug: "estate-cleanouts",
    serviceCta: "Find estate cleanout companies near you",
    sections: [
      {
        heading: "Why it matters",
        paragraphs: [
          "A cleanout crew will be alone in a home full of a family\u2019s belongings, often while the family lives far away. Choosing a careful, honest company protects valuables, important papers and your peace of mind."
        ]
      },
      {
        heading: "Checklist",
        bullets: [
          "Insured. Ask for proof of liability insurance, and workers\u2019 compensation if they have employees. Bonded is a plus.",
          "Walkthrough and written quote. A company that quotes a whole house without seeing it, in person or on video, is guessing.",
          "Clear plan for belongings. Ask where items go: donation, recycling, resale or landfill.",
          "Care with papers and valuables. A good crew watches for cash, jewelry, photos, wills, deeds and financial documents, and sets them aside for you.",
          "Reviews and references. Look for recent reviews, and ask for a reference from a similar job.",
          "Fair payment terms. A deposit is normal. Paying everything up front is not.",
          "Good communication. If you can\u2019t be there, ask for photo or video updates."
        ]
      },
      {
        heading: "Questions to ask",
        bullets: [
          "What exactly is included in the price, and what would cost extra?",
          "Do you donate items, and will I get a receipt for taxes?",
          "What do you do if you find valuables or personal papers?",
          "How many people will be on the crew, and how long will it take?",
          "Will the home be broom-clean when you\u2019re done?",
          "Can you also handle an estate sale, a buyout or junk removal, or recommend someone who does?"
        ]
      },
      {
        heading: "Red flags",
        bullets: [
          "No proof of insurance.",
          "Cash only, or full payment before any work.",
          "A price that changes on the day of the job.",
          "Pressure to decide on the spot."
        ]
      }
    ]
  },
  {
    slug: "estate-cleanout-vs-estate-sale",
    title: "Estate Cleanout vs. Estate Sale: Which Do You Need?",
    description: "The difference between an estate sale and an estate cleanout, when each makes sense, and why many families use both, in the right order.",
    summary: "What each one does, when to use which, and why many families use both.",
    readMinutes: 3,
    serviceSlug: "estate-sales",
    serviceCta: "Compare estate sale companies",
    sections: [
      {
        heading: "The difference",
        paragraphs: [
          "An estate sale turns belongings into money: a company prices the contents of the home and runs a public sale, usually over a few days, and keeps a percentage of what sells. An estate cleanout empties the home: a crew removes what is left, donating, recycling or disposing of it, and you pay for the service."
        ]
      },
      {
        heading: "An estate sale makes sense when",
        bullets: [
          "The home has furniture, collectibles, tools, jewelry or other items with real resale value.",
          "You have a few weeks before the home needs to be empty.",
          "You want the contents to help pay estate costs."
        ]
      },
      {
        heading: "A cleanout makes sense when",
        bullets: [
          "The contents have little resale value.",
          "The house needs to be empty quickly, for example for a sale or a lease ending.",
          "An estate sale has already happened and items are left over."
        ]
      },
      {
        heading: "Using both",
        paragraphs: [
          "Many families do both, in this order: the family takes what it wants, an estate sale company sells what has value, and a cleanout crew clears the rest. Some companies offer all of this, or will buy the remaining contents outright. If a parent is moving to a smaller home or senior living rather than an estate being settled, a senior move manager can plan the move, downsizing and sale together."
        ]
      }
    ]
  }
];
function guideBySlug(slug) {
  return GUIDES.find((g) => g.slug === slug) || null;
}
function guidePath(slug) {
  return `/guides/${slug}`;
}
function parseGuidePath(pathname) {
  const match = pathname.replace(/\/+$/, "").match(/^\/guides\/([^/]+)$/);
  return match ? guideBySlug(match[1]) : null;
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
function servicePath(serviceSlug) {
  return serviceSlug === ALL_SERVICES_SLUG ? "/" : `/${serviceSlug}`;
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
      paths.add(servicePath(service.slug));
      paths.add(statePath(row.state, service.slug));
      paths.add(cityPath(row.state, row.city, service.slug));
    }
  }
  return Array.from(paths).sort();
}
function parseLandingPath(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length === 1) {
    const service2 = serviceBySlug(parts[0]);
    return service2 && service2.category ? { service: service2, stateCode: null, citySlug: null } : null;
  }
  if (parts.length > 3) return null;
  const service = serviceBySlug(parts[0]);
  const stateCode = stateCodeFromSlug(parts[1]);
  if (!service || !stateCode) return null;
  return { service, stateCode, citySlug: parts[2] || null };
}
function whereLabel(match, cityName) {
  if (!match.stateCode) return "the U.S.";
  return cityName ? `${cityName}, ${match.stateCode}` : stateName(match.stateCode);
}
function landingTitle(match, cityName) {
  if (!match.stateCode) return `${match.service.plural} Across the U.S.`;
  return `${match.service.plural} in ${whereLabel(match, cityName)}`;
}
function landingDescription(match, cityName, count) {
  const where = whereLabel(match, cityName);
  const what = match.service.category ? match.service.label.toLowerCase() : "estate cleanout, senior move, junk removal and estate sale";
  return `Compare ${count} ${what} ${count === 1 ? "company" : "companies"} in ${where}. See services, phone numbers and websites, and contact local pros directly on ClearAnEstate.com.`;
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var SITE_URL2 = (process.env.APP_URL || "https://clearanestate.com").replace(/\/$/, "");
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
var ownerEditLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many saves in a short time. Please wait a few minutes and try again." }
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
              "UPDATE listings SET featured = TRUE, featured_at = CURRENT_TIMESTAMP, featured_price_cents = ?, stripe_subscription_id = ?, featured_email = ? WHERE id = ?",
              [
                priceCents,
                typeof session.subscription === "string" ? session.subscription : null,
                session.customer_details?.email || null,
                listingId
              ]
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
var PHOTO_UPLOAD_PATH = "/api/owner/photos";
app.use((req, res, next) => req.path === PHOTO_UPLOAD_PATH ? next() : import_express.default.json()(req, res, next));
app.use(
  "/uploads",
  import_express.default.static(UPLOAD_DIR, {
    fallthrough: false,
    index: false,
    maxAge: "30d",
    setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff")
  })
);
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
    const origin = process.env.APP_URL ? SITE_URL2 : req.headers.origin || "http://localhost:3000";
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
    const [photoRows] = await db.query(
      "SELECT listing_id, kind, filename FROM listing_photos WHERE status = 'approved' ORDER BY created_at ASC"
    );
    const photos = /* @__PURE__ */ new Map();
    for (const p of photoRows) {
      const entry = photos.get(p.listing_id) || { photos: [] };
      if (p.kind === "logo") entry.logoUrl = photoUrl(p.filename);
      else entry.photos.push(photoUrl(p.filename));
      photos.set(p.listing_id, entry);
    }
    res.json(rows.map((row) => ({ ...rowToListing(row), ...photos.get(row.id) })));
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).json({ error: "Failed to fetch listings." });
  }
});
app.get("/sitemap.xml", async (req, res) => {
  res.type("application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  const urls = [
    { loc: `${SITE_URL2}/` },
    { loc: `${SITE_URL2}/advertise` },
    ...GUIDES.map((g) => ({ loc: `${SITE_URL2}${guidePath(g.slug)}` }))
  ];
  const db = getPool();
  if (db) {
    try {
      await ensureSchema();
      const [rows] = await db.query("SELECT id, name, city, state, category, created_at FROM listings");
      for (const landing of landingPaths(rows)) {
        urls.push({ loc: `${SITE_URL2}${landing}` });
      }
      for (const row of rows) {
        urls.push({
          loc: `${SITE_URL2}${listingPath(row)}`,
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

Sitemap: ${SITE_URL2}/sitemap.xml
`);
});
var TRACK_EVENT_TYPES = /* @__PURE__ */ new Set(["page_view", "listing_view", "call", "website", "directions"]);
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
  return import_crypto3.default.createHash("sha256").update(`${day}|${process.env.ADMIN_PASSWORD || ""}|${req.ip}|${req.get("user-agent") || ""}`).digest("hex").slice(0, 16);
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
async function emailClaimApproved(claimantName, claimantEmail, listingRow) {
  const listing = rowToListing(listingRow);
  const lines = [
    `Hi ${claimantName},`,
    "",
    `Your claim of "${listing.name}" on ClearAnEstate.com is approved. Your listing:`,
    `${SITE_URL2}${listingPath(listing)}`
  ];
  const editUrl = editLinkUrl(listing.id, claimantEmail);
  if (editUrl) {
    lines.push(
      "",
      "UPDATE YOUR LISTING",
      `Check your phone number, website, services and hours, and add a short description. This private link works for ${EDIT_LINK_DAYS} days (you can always ask for a new one from your listing page):`,
      editUrl
    );
  }
  if (!listing.featured) {
    const pricing = await currentPricing();
    const taken = await cityFeaturedCount(listing.city, listing.state);
    const left = Math.max(0, CITY_CAP - taken);
    lines.push(
      "",
      `GET TO THE TOP OF ${listing.city.toUpperCase()}'S PAGE`,
      `Featured listings show first, with Call, Website and Directions buttons on the card. ${dollars(pricing.priceCents)}/year, price locked while you stay. ${left} of ${CITY_CAP} featured spots are left in ${listing.city}.`,
      `${SITE_URL2}/advertise?listing=${encodeURIComponent(listing.id)}`
    );
  }
  lines.push(
    "",
    "ADD OUR BADGE TO YOUR WEBSITE",
    "Paste this code into your website (footer or About page). It shows customers you are listed and links to your listing:",
    "",
    badgeHtml(listing),
    "",
    `Questions? Just reply to this email.`,
    "",
    "ClearAnEstate.com"
  );
  await sendMail({ to: claimantEmail, subject: `Your claim of ${listing.name} is approved`, text: lines.join("\n") });
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
      emailClaimApproved(claimantName, claimantEmail, { ...listing, claimed: true }).catch(
        (err) => console.error("Failed to email claim approval:", err)
      );
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
async function trustedOwnerEmails(listingRow) {
  const db = getPool();
  const [claims] = await db.query("SELECT claimant_email FROM claim_requests WHERE listing_id = ? AND status = 'approved'", [listingRow.id]);
  const emails = [...claims.map((c) => c.claimant_email), listingRow.featured_email, listingRow.email];
  return new Set(emails.filter(Boolean).map((e) => e.trim().toLowerCase()));
}
var NO_LONGER_OWNER = "This email is no longer on file for this listing, so this link no longer works. Contact us if you think that is a mistake.";
async function emailEditLink(listingRow, email) {
  const url = editLinkUrl(listingRow.id, email);
  if (!url) return false;
  return sendMail({
    to: email,
    subject: `Edit your ClearAnEstate listing: ${listingRow.name}`,
    text: [
      "Hi,",
      "",
      `Here's your private link to update "${listingRow.name}" on ClearAnEstate.com: phone, website, description, services and hours.`,
      "",
      url,
      "",
      `The link works for ${EDIT_LINK_DAYS} days. Don't forward it: anyone with it can edit your listing. You can always ask for a new one from your listing page.`,
      "",
      "Didn't ask for this? You can ignore this email.",
      "",
      "ClearAnEstate.com"
    ].join("\n")
  });
}
app.post("/api/listings/:id/edit-link", submissionLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (isHoneypotTripped(req)) return res.json({ ok: true });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [req.params.id]);
    const row = rows[0];
    if (row && (await trustedOwnerEmails(row)).has(email)) {
      emailEditLink(row, email).catch((err) => console.error("Failed to email edit link:", err));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Error sending edit link:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});
function cleanOwnerEdit(body) {
  const text = (v, max) => String(v ?? "").trim().slice(0, max);
  let website = text(body.website, 255);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website) {
    try {
      new URL(website);
    } catch {
      return { values: {}, error: "The website address doesn\u2019t look right." };
    }
  }
  const email = text(body.email, 255);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { values: {}, error: "The email address doesn\u2019t look right." };
  const phone = text(body.phone, 30);
  if (phone && !/^[0-9+().\-\s xX]+$/.test(phone)) return { values: {}, error: "The phone number can only contain digits, spaces and + ( ) - ." };
  const services = (Array.isArray(body.services) ? body.services : String(body.services ?? "").split(/\n|,/)).map((s) => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 15);
  const years = body.yearsInBusiness === "" || body.yearsInBusiness == null ? null : Number(body.yearsInBusiness);
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 150)) {
    return { values: {}, error: "Years in business should be a whole number." };
  }
  return {
    error: null,
    values: {
      phone: phone || null,
      website,
      email: email || null,
      tagline: text(body.tagline, 160),
      description: text(body.description, 2e3),
      services: JSON.stringify(services),
      hours: text(body.hours, 255) || null,
      address: text(body.address, 255) || null,
      years_in_business: years,
      insured: !!body.insured,
      bonded: !!body.bonded
    }
  };
}
app.get("/api/owner/listing", async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const access = verifyEditToken(String(req.query.token || ""));
  if (!access) return res.status(401).json({ error: "This edit link is invalid or has expired. Ask for a new one from your listing page." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [access.listingId]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "This listing no longer exists." });
    if (!(await trustedOwnerEmails(row)).has(access.email.toLowerCase())) return res.status(401).json({ error: NO_LONGER_OWNER });
    res.json({ listing: rowToListing(row), editorEmail: access.email, photos: await ownerPhotos(row.id) });
  } catch (err) {
    console.error("Error loading listing for owner:", err);
    res.status(500).json({ error: "Failed to load your listing." });
  }
});
app.post("/api/owner/listing", ownerEditLimiter, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const access = verifyEditToken(String(req.body?.token || ""));
  if (!access) return res.status(401).json({ error: "This edit link is invalid or has expired. Ask for a new one from your listing page." });
  const { values, error } = cleanOwnerEdit(req.body?.listing || {});
  if (error) return res.status(400).json({ error });
  if (!values.website) return res.status(400).json({ error: "Please enter your website address." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [access.listingId]);
    const before = rows[0];
    if (!before) return res.status(404).json({ error: "This listing no longer exists." });
    if (!(await trustedOwnerEmails(before)).has(access.email.toLowerCase())) return res.status(401).json({ error: NO_LONGER_OWNER });
    const columns = Object.keys(values);
    await db.query(
      `UPDATE listings SET ${columns.map((c) => `${c} = ?`).join(", ")}, claimed = TRUE WHERE id = ?`,
      [...columns.map((c) => values[c]), access.listingId]
    );
    const show = (c, v) => c === "services" ? parseServices(v).join(", ") : c === "insured" || c === "bonded" ? v ? "yes" : "no" : v ?? "";
    const changes = columns.filter((c) => String(show(c, before[c])) !== String(show(c, values[c]))).map((c) => `${c}:
  was: ${show(c, before[c]) || "(empty)"}
  now: ${show(c, values[c]) || "(empty)"}`);
    if (changes.length > 0) {
      notifyAdmin(
        `Listing edited by owner: ${before.name}`,
        `${access.email} updated "${before.name}" (${before.city}, ${before.state}):

${changes.join("\n\n")}

${SITE_URL2}${listingPath(before)}`
      );
    }
    const [updated] = await db.query("SELECT * FROM listings WHERE id = ?", [access.listingId]);
    res.json({ listing: rowToListing(updated[0]), changed: changes.length });
  } catch (err) {
    console.error("Error saving owner edit:", err);
    res.status(500).json({ error: "Failed to save your changes." });
  }
});
async function ownerPhotos(listingId) {
  const db = getPool();
  const [rows] = await db.query("SELECT * FROM listing_photos WHERE listing_id = ? ORDER BY created_at ASC", [listingId]);
  return rows.map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    url: p.status === "rejected" ? null : photoUrl(p.filename)
  }));
}
async function ownerListingFromToken(token, res) {
  const db = getPool();
  if (!db) {
    res.status(503).json({ error: "Database is not configured on server." });
    return null;
  }
  const access = verifyEditToken(String(token || ""));
  if (!access) {
    res.status(401).json({ error: "This edit link is invalid or has expired. Ask for a new one from your listing page." });
    return null;
  }
  await ensureSchema();
  const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [access.listingId]);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "This listing no longer exists." });
    return null;
  }
  if (!(await trustedOwnerEmails(row)).has(access.email.toLowerCase())) {
    res.status(401).json({ error: NO_LONGER_OWNER });
    return null;
  }
  return { row, email: access.email };
}
app.post(PHOTO_UPLOAD_PATH, ownerEditLimiter, import_express.default.json({ limit: "5mb" }), async (req, res) => {
  try {
    const owner = await ownerListingFromToken(req.body?.token, res);
    if (!owner) return;
    const kind = req.body?.kind === "logo" ? "logo" : "photo";
    const db = getPool();
    const [[{ n }]] = await db.query(
      "SELECT COUNT(*) AS n FROM listing_photos WHERE listing_id = ? AND kind = ? AND status <> 'rejected'",
      [owner.row.id, kind]
    );
    const max = kind === "logo" ? MAX_LOGOS : MAX_PHOTOS;
    if (Number(n) >= max) {
      return res.status(400).json({
        error: kind === "logo" ? "You already have a logo. Remove it first to upload a new one." : `You can have up to ${MAX_PHOTOS} photos. Remove one to add another.`
      });
    }
    const image = decodeImage(req.body?.image);
    if ("error" in image) return res.status(400).json({ error: image.error });
    const filename = savePhotoFile(owner.row.id, image.buffer, image.ext);
    await db.query(
      "INSERT INTO listing_photos (id, listing_id, kind, filename, status, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)",
      [newPhotoId(), owner.row.id, kind, filename, "pending", owner.email]
    );
    notifyAdmin(
      `New ${kind} to review: ${owner.row.name}`,
      `${owner.email} uploaded a ${kind} for "${owner.row.name}" (${owner.row.city}, ${owner.row.state}).

${SITE_URL2}${photoUrl(filename)}

Approve or reject it in the Admin Portal's Photos tab.`
    );
    res.status(201).json({ photos: await ownerPhotos(owner.row.id) });
  } catch (err) {
    console.error("Error uploading photo:", err);
    res.status(500).json({ error: "Failed to upload the image." });
  }
});
app.post("/api/owner/photos/:photoId/delete", ownerEditLimiter, async (req, res) => {
  try {
    const owner = await ownerListingFromToken(req.body?.token, res);
    if (!owner) return;
    const db = getPool();
    const [rows] = await db.query("SELECT * FROM listing_photos WHERE id = ? AND listing_id = ?", [req.params.photoId, owner.row.id]);
    const photo = rows[0];
    if (!photo) return res.status(404).json({ error: "Photo not found." });
    deletePhotoFile(photo.filename);
    await db.query("DELETE FROM listing_photos WHERE id = ?", [photo.id]);
    res.json({ photos: await ownerPhotos(owner.row.id) });
  } catch (err) {
    console.error("Error deleting photo:", err);
    res.status(500).json({ error: "Failed to remove the image." });
  }
});
app.get("/api/admin/photos", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const status = req.query.status === "approved" ? "approved" : "pending";
  try {
    await ensureSchema();
    const [rows] = await db.query(
      `SELECT p.*, l.name, l.city, l.state, l.featured FROM listing_photos p
       LEFT JOIN listings l ON l.id = p.listing_id
       WHERE p.status = ? ORDER BY p.created_at ${status === "pending" ? "ASC" : "DESC"}`,
      [status]
    );
    res.json(
      rows.map((p) => ({
        id: p.id,
        listingId: p.listing_id,
        listingName: p.name || "(deleted listing)",
        city: p.city || "",
        state: p.state || "",
        featured: !!p.featured,
        kind: p.kind,
        status: p.status,
        url: photoUrl(p.filename),
        uploadedBy: p.uploaded_by,
        createdAt: p.created_at
      }))
    );
  } catch (err) {
    console.error("Error listing photos:", err);
    res.status(500).json({ error: "Failed to load photos." });
  }
});
app.post("/api/admin/photos/:id/:action", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  const { id, action } = req.params;
  if (!["approve", "reject", "remove"].includes(action)) return res.status(404).json({ error: "Unknown action." });
  try {
    await ensureSchema();
    const [rows] = await db.query("SELECT * FROM listing_photos WHERE id = ?", [id]);
    const photo = rows[0];
    if (!photo) return res.status(404).json({ error: "Photo not found." });
    if (action === "approve") {
      await db.query("UPDATE listing_photos SET status = 'approved' WHERE id = ?", [id]);
    } else if (action === "reject") {
      deletePhotoFile(photo.filename);
      await db.query("UPDATE listing_photos SET status = 'rejected' WHERE id = ?", [id]);
    } else {
      deletePhotoFile(photo.filename);
      await db.query("DELETE FROM listing_photos WHERE id = ?", [id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating photo:", err);
    res.status(500).json({ error: "Failed to update the photo." });
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
app.post("/api/admin/listings/:id/unclaim", adminAuthLimiter, requireAdmin, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database is not configured on server." });
  try {
    await ensureSchema();
    await db.query("UPDATE listings SET claimed = FALSE WHERE id = ?", [req.params.id]);
    await db.query("UPDATE claim_requests SET status = 'revoked' WHERE listing_id = ? AND status = 'approved'", [req.params.id]);
    const [rows] = await db.query("SELECT * FROM listings WHERE id = ?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Listing not found." });
    res.json(rowToListing(row));
  } catch (err) {
    console.error("Error removing claim:", err);
    res.status(500).json({ error: "Failed to remove the claim.", details: err.message });
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
         SUM(event_type = 'website') AS websiteClicks,
         SUM(event_type = 'directions') AS directions
       FROM listing_events WHERE ${since}`,
      [days]
    );
    const [[quoteTotals]] = await db.query(
      `SELECT COUNT(*) AS quotes FROM quote_requests WHERE ${since}`,
      [days]
    );
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
    const n = (v) => Number(v) || 0;
    res.json({
      days,
      pageViews: n(totals?.pageViews),
      visitors: n(totals?.visitors),
      listingViews: n(totals?.listingViews),
      calls: n(totals?.calls),
      websiteClicks: n(totals?.websiteClicks),
      directions: n(totals?.directions),
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
        websiteClicks: n(r.websiteClicks),
        directions: n(r.directions)
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
app.get("/api/admin/reports", adminAuthLimiter, requireAdmin, async (req, res) => {
  const period = String(req.query.period || previousPeriod());
  if (!isValidPeriod(period)) return res.status(400).json({ error: "Month must look like 2026-11." });
  try {
    res.json({ period, label: periodLabel(period), reports: await buildReports(period, getStripe()) });
  } catch (err) {
    console.error("Error building monthly reports:", err);
    res.status(500).json({ error: "Failed to build monthly reports.", details: err.message });
  }
});
app.post("/api/admin/reports/send", adminAuthLimiter, requireAdmin, async (req, res) => {
  const period = String(req.body?.period || previousPeriod());
  if (!isValidPeriod(period)) return res.status(400).json({ error: "Month must look like 2026-11." });
  try {
    res.json(await sendReports(period, getStripe()));
  } catch (err) {
    console.error("Error sending monthly reports:", err);
    res.status(500).json({ error: "Failed to send monthly reports.", details: err.message });
  }
});
app.get("/api/cron/monthly-reports", adminAuthLimiter, async (req, res) => {
  const secret2 = process.env.CRON_SECRET;
  if (!secret2) return res.status(503).json({ error: "CRON_SECRET is not set on the server." });
  const given = Buffer.from(String(req.query.key || ""));
  const expected = Buffer.from(secret2);
  if (given.length !== expected.length || !import_crypto3.default.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: "Wrong key." });
  }
  try {
    const period = previousPeriod();
    const result = await sendReports(period, getStripe());
    console.log(`Monthly reports for ${period}:`, result);
    if (result.sent.length > 0 || result.failed.length > 0) {
      notifyAdmin(
        `Monthly results emails sent for ${periodLabel(period)}`,
        `Sent: ${result.sent.length ? result.sent.join(", ") : "none"}
Failed: ${result.failed.length ? result.failed.join(", ") : "none"}
Skipped: ${result.skipped.map((s) => `${s.name} (${s.reason})`).join(", ") || "none"}`
      );
    }
    res.json({ period, ...result });
  } catch (err) {
    console.error("Error sending scheduled monthly reports:", err);
    res.status(500).json({ error: "Failed to send monthly reports." });
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
  const passwordToTry = typeof req.body?.password === "string" && req.body.password ? req.body.password : void 0;
  res.json(await sendTestMail(to, passwordToTry));
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
    const [listingRows] = await db.query("SELECT * FROM listings WHERE id = ?", [claim.listing_id]);
    const listingRow = listingRows[0];
    if (listingRow) {
      emailClaimApproved(claim.claimant_name, claim.claimant_email, listingRow).catch(
        (err) => console.error("Failed to email claim approval:", err)
      );
    }
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
  const extra = meta.notFound || meta.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeHtml(SITE_URL2 + meta.canonicalPath)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(SITE_URL2 + meta.canonicalPath)}" />`;
  return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>
    ${extra}`).replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`);
}
async function pageMeta(pathname) {
  if (pathname.replace(/\/+$/, "") === "/edit-listing") {
    return { title: "Edit your listing | ClearAnEstate.com", description: "", canonicalPath: "/edit-listing", noindex: true };
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
  const params = [];
  let sql = "SELECT city FROM listings WHERE 1 = 1";
  if (landing.stateCode) {
    sql += " AND state = ?";
    params.push(landing.stateCode);
  }
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
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, { index: false }));
    const indexHtml = import_fs2.default.readFileSync(import_path2.default.join(distPath, "index.html"), "utf8");
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
