import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Owner-uploaded logos and photos. The browser resizes each image and re-encodes it
// (which also drops hidden location data) before upload; the server only checks that the
// bytes really are a JPEG, PNG or WebP and stores them under a random name.
//
// Files live outside the git checkout's tracked files (uploads/ is gitignored), so
// "Update from Remote" never touches them. Back this folder up along with the database.

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
export const MAX_LOGOS = 1;
export const MAX_PHOTOS = 6;
const MAX_BYTES = 3 * 1024 * 1024;

export type PhotoKind = 'logo' | 'photo';

export interface PhotoRow {
  id: string;
  listing_id: string;
  kind: PhotoKind;
  filename: string;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_by: string | null;
  created_at: any;
}

export function photoUrl(filename: string): string {
  return `/uploads/${filename}`;
}

function detectType(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Decodes a data URL or bare base64 string and checks it's a real image of a sane size.
export function decodeImage(data: string): { buffer: Buffer; ext: 'jpg' | 'png' | 'webp' } | { error: string } {
  if (typeof data !== 'string' || data.length === 0) return { error: 'No image was received.' };
  const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) return { error: 'No image was received.' };
  if (buffer.length > MAX_BYTES) return { error: 'That image is too large. Please choose a smaller one.' };
  const ext = detectType(buffer);
  if (!ext) return { error: 'Please upload a JPEG, PNG or WebP image.' };
  return { buffer, ext };
}

export function savePhotoFile(listingId: string, buffer: Buffer, ext: string): string {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safeId = listingId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  const filename = `${safeId}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return filename;
}

export function deletePhotoFile(filename: string): void {
  // Only ever delete plain file names inside the upload folder.
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(filename)) return;
  fs.rm(path.join(UPLOAD_DIR, filename), { force: true }, () => {});
}

export function newPhotoId(): string {
  return 'p-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
}
