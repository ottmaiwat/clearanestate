import Stripe from 'stripe';
import { getPool, ensureSchema } from './db';
import { sendMail } from './mailer';
import { listingPath } from './src/lib/slug';
import { SITE_URL } from './src/lib/site';
import { GUARANTEE_CONTACTS } from './src/lib/pricing';

// Monthly results emails for featured listings: what their listing got from this site
// last month. This is the main reason a business renews, and the evidence behind the
// 10-contacts guarantee. A month is sent at most once per listing (monthly_reports).

export interface ReportNumbers {
  views: number;
  calls: number;
  websiteClicks: number;
  directions: number;
  quotes: number;
  // Contacts as the guarantee counts them: calls + website clicks + estimate requests.
  contacts: number;
}

export interface ListingReport {
  listingId: string;
  name: string;
  city: string;
  state: string;
  recipient: string | null;
  recipientSource: 'payment' | 'stripe' | 'claim' | 'listing' | null;
  // First day counted: the 1st of the month, or the day it became featured if later.
  from: string;
  numbers: ReportNumbers;
  contactsSinceFeatured: number;
  featuredSince: string | null;
  alreadySent: boolean;
  skipReason: string | null;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

// The calendar month before `now`, as 'YYYY-MM'.
export function previousPeriod(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { start: `${period}-01 00:00:00`, end: `${next}-01 00:00:00` };
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function toSqlDateTime(value: any): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortDate(sqlDateTime: string): string {
  const [datePart] = sqlDateTime.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}

async function countsBetween(listingId: string, from: string, to: string): Promise<ReportNumbers> {
  const db = getPool()!;
  const [[events]] = (await db.query(
    `SELECT SUM(event_type = 'listing_view') AS views, SUM(event_type = 'call') AS calls,
       SUM(event_type = 'website') AS websiteClicks, SUM(event_type = 'directions') AS directions
     FROM listing_events WHERE listing_id = ? AND created_at >= ? AND created_at < ?`,
    [listingId, from, to]
  )) as any;
  const [[quotes]] = (await db.query(
    'SELECT COUNT(*) AS n FROM quote_requests WHERE listing_id = ? AND created_at >= ? AND created_at < ?',
    [listingId, from, to]
  )) as any;
  const n = (v: any) => Number(v) || 0;
  const numbers = {
    views: n(events?.views),
    calls: n(events?.calls),
    websiteClicks: n(events?.websiteClicks),
    directions: n(events?.directions),
    quotes: n(quotes?.n),
    contacts: 0,
  };
  numbers.contacts = numbers.calls + numbers.websiteClicks + numbers.quotes;
  return numbers;
}

// Where to send a listing's report: the address they paid with, else the Stripe
// customer's email (looked up once and saved), else an approved claim, else the listing.
async function findRecipient(row: any, stripe: Stripe | null): Promise<Pick<ListingReport, 'recipient' | 'recipientSource'>> {
  if (row.featured_email) return { recipient: row.featured_email, recipientSource: 'payment' };

  const db = getPool()!;
  if (stripe && row.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id, { expand: ['customer'] });
      const customer = sub.customer as Stripe.Customer | Stripe.DeletedCustomer;
      const email = 'email' in customer ? customer.email : null;
      if (email) {
        await db.query('UPDATE listings SET featured_email = ? WHERE id = ?', [email, row.id]);
        return { recipient: email, recipientSource: 'stripe' };
      }
    } catch (err) {
      console.error('Could not look up Stripe customer email for listing', row.id, err);
    }
  }

  const [claims] = await db.query(
    "SELECT claimant_email FROM claim_requests WHERE listing_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1",
    [row.id]
  );
  const claimEmail = (claims as any[])[0]?.claimant_email;
  if (claimEmail) return { recipient: claimEmail, recipientSource: 'claim' };

  if (row.email) return { recipient: row.email, recipientSource: 'listing' };
  return { recipient: null, recipientSource: null };
}

// One report per featured listing for the period, without sending anything.
export async function buildReports(period: string, stripe: Stripe | null): Promise<ListingReport[]> {
  const db = getPool();
  if (!db) throw new Error('Database is not configured on server.');
  await ensureSchema();

  const { start, end } = periodRange(period);
  const [rows] = await db.query(
    'SELECT * FROM listings WHERE featured = TRUE AND (featured_at IS NULL OR featured_at < ?) ORDER BY featured_at ASC',
    [end]
  );
  const [sentRows] = await db.query('SELECT listing_id FROM monthly_reports WHERE period = ?', [period]);
  const sent = new Set((sentRows as any[]).map((r) => r.listing_id));

  const reports: ListingReport[] = [];
  for (const row of rows as any[]) {
    const featuredSince = toSqlDateTime(row.featured_at);
    const from = featuredSince && featuredSince > start ? featuredSince : start;
    const numbers = await countsBetween(row.id, from, end);
    const sinceFeatured = featuredSince ? await countsBetween(row.id, featuredSince, end) : numbers;
    const { recipient, recipientSource } = await findRecipient(row, stripe);

    let skipReason: string | null = null;
    if (sent.has(row.id)) skipReason = 'Already sent';
    else if (!recipient) skipReason = 'No email address';
    else if (numbers.views === 0 && numbers.contacts === 0 && numbers.directions === 0) skipReason = 'No activity this month';

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
      skipReason,
    });
  }
  return reports;
}

export function reportEmailText(report: ListingReport, period: string, listingUrl: string): string {
  const { numbers } = report;
  const partial = report.from !== periodRange(period).start;
  const lines = [
    `Hi ${report.name} team,`,
    '',
    `Here's what your featured listing on ClearAnEstate.com got in ${periodLabel(period)}${partial ? ` (since you joined on ${shortDate(report.from)})` : ''}:`,
    '',
    `  Listing views:       ${numbers.views}`,
    `  Phone taps:          ${numbers.calls}`,
    `  Website clicks:      ${numbers.websiteClicks}`,
    `  Directions:          ${numbers.directions}`,
    `  Estimate requests:   ${numbers.quotes}`,
    '',
    `That's ${numbers.contacts} ${numbers.contacts === 1 ? 'contact' : 'contacts'} (phone taps, website clicks and estimate requests) from people looking for help in ${report.city}.`,
  ];

  if (report.featuredSince) {
    const firstYearEnds = new Date(report.featuredSince.replace(' ', 'T'));
    firstYearEnds.setFullYear(firstYearEnds.getFullYear() + 1);
    if (new Date() < firstYearEnds) {
      const total = report.contactsSinceFeatured;
      lines.push(
        '',
        total >= GUARANTEE_CONTACTS
          ? `Since you joined, your listing has had ${total} contacts, past the ${GUARANTEE_CONTACTS} we guarantee in your first year.`
          : `Since you joined, your listing has had ${total} of the ${GUARANTEE_CONTACTS} contacts we guarantee in your first year.`
      );
    }
  }

  lines.push(
    '',
    `Your listing: ${listingUrl}`,
    '',
    'Phone taps count people who tapped your number on our site. Calls from people who typed your number in by hand are not included, so your real number is likely higher.',
    '',
    'Questions, or anything you want changed on your listing? Just reply to this email.',
    '',
    'ClearAnEstate.com'
  );
  return lines.join('\n');
}

// Sends every report for the period that isn't skipped, and records each one sent.
export async function sendReports(period: string, stripe: Stripe | null): Promise<{ sent: string[]; skipped: { name: string; reason: string }[]; failed: string[] }> {
  const db = getPool()!;
  const reports = await buildReports(period, stripe);
  const result = { sent: [] as string[], skipped: [] as { name: string; reason: string }[], failed: [] as string[] };

  for (const report of reports) {
    if (report.skipReason || !report.recipient) {
      result.skipped.push({ name: report.name, reason: report.skipReason || 'No email address' });
      continue;
    }
    const listingUrl = `${SITE_URL}${listingPath({ id: report.listingId, name: report.name, city: report.city, state: report.state } as any)}`;
    const ok = await sendMail({
      to: report.recipient,
      subject: `Your ClearAnEstate results for ${periodLabel(period)}`,
      text: reportEmailText(report, period, listingUrl),
    });
    if (ok) {
      await db.query('INSERT IGNORE INTO monthly_reports (listing_id, period, sent_to) VALUES (?, ?, ?)', [report.listingId, period, report.recipient]);
      result.sent.push(report.name);
    } else {
      result.failed.push(report.name);
    }
  }
  return result;
}
