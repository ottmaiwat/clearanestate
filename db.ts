import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function isDbConfigured(): boolean {
  return !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}

export function getPool(): mysql.Pool | null {
  if (!isDbConfigured()) return null;
  if (!pool) {
    // Support both TCP (host:port) and Unix socket connections
    // If DB_HOST starts with "/" it's treated as a socket path, or use DB_SOCKET if provided
    const socketPath = process.env.DB_SOCKET || (process.env.DB_HOST?.startsWith('/') ? process.env.DB_HOST : null);

    const config: any = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
    };

    if (socketPath) {
      config.socketPath = socketPath;
    } else {
      config.host = process.env.DB_HOST;
      config.port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
    }

    pool = mysql.createPool(config);
  }
  return pool;
}

// Creates the tables on first use if they don't already exist. Safe to call repeatedly.
export function ensureSchema(): Promise<void> {
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

    // First-party traffic counter: page views, listing views, and contact clicks (call /
    // website). visitor_hash is a daily-rotating hash of IP + user agent, never the raw
    // values, so we can count unique visitors without cookies or storing personal data.
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

    // Columns added after the listings table first shipped. CREATE TABLE IF NOT EXISTS
    // won't add them to an existing table, so add any that are missing.
    // featured_at: when the listing became featured - featured listings are shown in
    //   sign-up order, so the first business to feature in a city stays on top.
    // featured_price_cents: the yearly price that business locked in at checkout.
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings'`
    );
    const existing = new Set((cols as any[]).map((c) => c.COLUMN_NAME));
    if (!existing.has('featured_at')) {
      await db.query('ALTER TABLE listings ADD COLUMN featured_at TIMESTAMP NULL DEFAULT NULL');
    }
    if (!existing.has('featured_price_cents')) {
      await db.query('ALTER TABLE listings ADD COLUMN featured_price_cents INT NULL DEFAULT NULL');
    }
  })();

  return schemaReady;
}
