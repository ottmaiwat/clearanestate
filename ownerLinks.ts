import crypto from 'crypto';
import { SITE_URL } from './src/lib/site';

// Private "edit your listing" links for business owners. A link carries the listing id,
// the owner's email and an expiry, signed with a server secret, so it can't be forged or
// pointed at another listing. Nothing is stored: changing the secret (EDIT_LINK_SECRET,
// or ADMIN_PASSWORD when that isn't set) invalidates every link already sent.

const LINK_DAYS = 30;

function secret(): string | null {
  return process.env.EDIT_LINK_SECRET || process.env.ADMIN_PASSWORD || null;
}

function sign(payload: string, key: string): string {
  return crypto.createHmac('sha256', key).update(`edit-listing|${payload}`).digest('base64url');
}

export function isEditLinkConfigured(): boolean {
  return !!secret();
}

export function createEditToken(listingId: string, email: string): string | null {
  const key = secret();
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1000) + LINK_DAYS * 24 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ l: listingId, e: email, x: expires })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

export function verifyEditToken(token: string): { listingId: string; email: string } | null {
  const key = secret();
  if (!key || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.l !== 'string' || typeof data.e !== 'string' || typeof data.x !== 'number') return null;
    if (data.x < Date.now() / 1000) return null;
    return { listingId: data.l, email: data.e };
  } catch {
    return null;
  }
}

export function editLinkUrl(listingId: string, email: string): string | null {
  const token = createEditToken(listingId, email);
  return token ? `${SITE_URL}/edit-listing?token=${encodeURIComponent(token)}` : null;
}

export const EDIT_LINK_DAYS = LINK_DAYS;
