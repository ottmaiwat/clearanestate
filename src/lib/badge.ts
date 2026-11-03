import { Listing } from '../types';
import { listingPath } from './slug';
import { SITE_URL } from './site';

// "Listed on ClearAnEstate" badge for a business's own website. The badge links to their
// listing here, which sends them customers and gives this site a link back.
export function badgeImagePath(featured: boolean): string {
  return featured ? '/badge-featured.svg' : '/badge.svg';
}

export function badgeHtml(listing: Listing): string {
  const featured = !!listing.featured;
  const label = featured ? 'Featured on ClearAnEstate' : 'Listed on ClearAnEstate';
  return `<a href="${SITE_URL}${listingPath(listing)}" target="_blank" rel="noopener"><img src="${SITE_URL}${badgeImagePath(featured)}" alt="${label}" width="224" height="64" style="border:0"></a>`;
}
