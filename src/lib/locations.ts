import { ListingCategory } from '../types';
import { slugify } from './slug';

// Shared by the client (landing pages, internal links) and the server (sitemap, meta tags),
// so the URL scheme only lives in one place. Pure data + string helpers - no DOM access.

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
};

// "all" is the umbrella service covering every category; the rest map 1:1 to a category.
export const ALL_SERVICES_SLUG = 'estate-services';

export const SERVICES: { slug: string; category: ListingCategory | null; label: string; plural: string }[] = [
  { slug: ALL_SERVICES_SLUG, category: null, label: 'Estate Services', plural: 'Estate Cleanout & Downsizing Companies' },
  { slug: 'estate-cleanouts', category: 'Estate Cleanouts', label: 'Estate Cleanouts', plural: 'Estate Cleanout Companies' },
  { slug: 'senior-move-management', category: 'Senior Move Management', label: 'Senior Move Management', plural: 'Senior Move Managers' },
  { slug: 'junk-removal', category: 'Junk Removal & Hauling', label: 'Junk Removal & Hauling', plural: 'Junk Removal & Hauling Companies' },
  { slug: 'estate-sales', category: 'Liquidation & Estate Sales', label: 'Liquidation & Estate Sales', plural: 'Estate Sale & Liquidation Companies' },
  { slug: 'appraisal-downsizing', category: 'Content Appraisal & Downsizing', label: 'Content Appraisal & Downsizing', plural: 'Appraisal & Downsizing Specialists' },
];

export type Service = (typeof SERVICES)[number];

export function serviceBySlug(slug: string | undefined): Service | null {
  return SERVICES.find((s) => s.slug === slug) || null;
}

export function serviceForCategory(category: string): Service {
  return SERVICES.find((s) => s.category === category) || SERVICES[0];
}

export function stateName(code: string): string {
  return US_STATES[code.toUpperCase()] || code;
}

export function stateSlug(code: string): string {
  return slugify(stateName(code));
}

export function stateCodeFromSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  const match = Object.keys(US_STATES).find((code) => slugify(US_STATES[code]) === slug.toLowerCase());
  return match || null;
}

export function citySlug(city: string): string {
  return slugify(city);
}

// National page for one service (/estate-cleanouts), listing every state that has it.
export function servicePath(serviceSlug: string): string {
  return serviceSlug === ALL_SERVICES_SLUG ? '/' : `/${serviceSlug}`;
}

export function statePath(code: string, serviceSlug: string = ALL_SERVICES_SLUG): string {
  return `/${serviceSlug}/${stateSlug(code)}`;
}

export function cityPath(code: string, city: string, serviceSlug: string = ALL_SERVICES_SLUG): string {
  return `/${serviceSlug}/${stateSlug(code)}/${citySlug(city)}`;
}

export interface LocationRow {
  state: string;
  city: string;
  category: string;
}

// Every landing page worth publishing for a set of listings: one page per state and per
// city (all services), plus one per service within each state/city that actually has that
// service. Pages with zero listings are never generated, so we don't publish thin pages.
export function landingPaths(rows: LocationRow[]): string[] {
  const paths = new Set<string>();
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

export interface LandingMatch {
  service: Service;
  // null on a national service page (/estate-cleanouts)
  stateCode: string | null;
  citySlug: string | null;
}

// Parses /:service[/:state[/:city]]. Returns null for anything that isn't a landing page.
export function parseLandingPath(pathname: string): LandingMatch | null {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length === 1) {
    // The all-services national page is the homepage itself.
    const service = serviceBySlug(parts[0]);
    return service && service.category ? { service, stateCode: null, citySlug: null } : null;
  }
  if (parts.length > 3) return null;
  const service = serviceBySlug(parts[0]);
  const stateCode = stateCodeFromSlug(parts[1]);
  if (!service || !stateCode) return null;
  return { service, stateCode, citySlug: parts[2] || null };
}

function whereLabel(match: LandingMatch, cityName: string | null): string {
  if (!match.stateCode) return 'the U.S.';
  return cityName ? `${cityName}, ${match.stateCode}` : stateName(match.stateCode);
}

export function landingTitle(match: LandingMatch, cityName: string | null): string {
  if (!match.stateCode) return `${match.service.plural} Across the U.S.`;
  return `${match.service.plural} in ${whereLabel(match, cityName)}`;
}

export function landingDescription(match: LandingMatch, cityName: string | null, count: number): string {
  const where = whereLabel(match, cityName);
  const what = match.service.category ? match.service.label.toLowerCase() : 'estate cleanout, senior move, junk removal and estate sale';
  return `Compare ${count} ${what} ${count === 1 ? 'company' : 'companies'} in ${where}. See services, phone numbers and websites, and contact local pros directly on ClearAnEstate.com.`;
}
