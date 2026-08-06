import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function isDbConfigured(): boolean {
  return !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}

export function getPool(): mysql.Pool | null {
  if (!isDbConfigured()) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
    });
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
  })();

  return schemaReady;
}
