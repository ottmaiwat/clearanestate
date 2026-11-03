import { Listing } from '../types';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function listingSlug(listing: Listing): string {
  return slugify(`${listing.name}-${listing.city}-${listing.state}`);
}

// The slug segment is purely decorative/readable - lookups are always keyed off the id,
// so a stale or hand-edited slug in a shared link never breaks anything.
export function listingPath(listing: Listing): string {
  return `/listings/${listing.id}/${listingSlug(listing)}`;
}
