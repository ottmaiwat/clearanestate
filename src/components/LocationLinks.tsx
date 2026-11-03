import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Listing } from '../types';
import {
  LandingMatch,
  SERVICES,
  ALL_SERVICES_SLUG,
  US_STATES,
  stateName,
  statePath,
  cityPath,
  citySlug,
  servicePath,
} from '../lib/locations';

interface LocationLinksProps {
  listings: Listing[];
  landing: LandingMatch | null;
  cityName: string | null;
}

interface LinkItem {
  to: string;
  label: string;
  count: number;
}

// Counts listings per key, keeping the first display label seen for each key.
function tally(listings: Listing[], key: (l: Listing) => string, label: (l: Listing) => string, to: (l: Listing) => string): LinkItem[] {
  const map = new Map<string, LinkItem>();
  for (const l of listings) {
    const k = key(l);
    const existing = map.get(k);
    if (existing) existing.count += 1;
    else map.set(k, { to: to(l), label: label(l), count: 1 });
  }
  return Array.from(map.values());
}

const LinkGroup: React.FC<{ title: string; items: LinkItem[]; id: string }> = ({ title, items, id }) => {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3" id={id}>
      <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">{title}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-stone-400 font-mono text-xs shrink-0">{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Crawlable internal links between landing pages: homepage -> states, state -> cities and
// services, city -> other services and nearby cities. These links are how search engines
// (and visitors) discover every location page.
export const LocationLinks: React.FC<LocationLinksProps> = ({ listings, landing, cityName }) => {
  const known = listings.filter((l) => US_STATES[l.state?.toUpperCase()]);
  const byLabel = (a: LinkItem, b: LinkItem) => a.label.localeCompare(b.label);
  const byCount = (a: LinkItem, b: LinkItem) => b.count - a.count || a.label.localeCompare(b.label);

  if (!landing) {
    const states = tally(known, (l) => l.state, (l) => stateName(l.state), (l) => statePath(l.state)).sort(byLabel);
    const cities = tally(
      known,
      (l) => `${l.state}/${citySlug(l.city)}`,
      (l) => `${l.city}, ${l.state}`,
      (l) => cityPath(l.state, l.city)
    ).sort(byCount).slice(0, 24);
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8" id="browse-locations">
        <LinkGroup title="Popular Cities" items={cities} id="browse-cities" />
        <LinkGroup title="Browse Estate Services by State" items={states} id="browse-states" />
      </section>
    );
  }

  // National service page (/estate-cleanouts): that service by state and city, plus the
  // other services' national pages.
  if (!landing.stateCode) {
    const inService = known.filter((l) => l.category === landing.service.category);
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8" id="browse-locations">
        <LinkGroup
          title={`${landing.service.label} by State`}
          items={tally(inService, (l) => l.state, (l) => stateName(l.state), (l) => statePath(l.state, landing.service.slug)).sort(byLabel)}
          id="browse-states"
        />
        <LinkGroup
          title={`Popular Cities for ${landing.service.label}`}
          items={tally(
            inService,
            (l) => `${l.state}/${citySlug(l.city)}`,
            (l) => `${l.city}, ${l.state}`,
            (l) => cityPath(l.state, l.city, landing.service.slug)
          ).sort(byCount).slice(0, 24)}
          id="browse-cities"
        />
        <LinkGroup
          title="Other Services"
          items={SERVICES.filter((s) => s.category && s.slug !== landing.service.slug)
            .map((s) => ({ to: servicePath(s.slug), label: s.label, count: known.filter((l) => l.category === s.category).length }))
            .filter((s) => s.count > 0)}
          id="browse-national-services"
        />
      </section>
    );
  }

  const inState = known.filter((l) => l.state === landing.stateCode);
  const inService = landing.service.category ? inState.filter((l) => l.category === landing.service.category) : inState;
  const where = cityName || stateName(landing.stateCode);
  const groups: { title: string; items: LinkItem[]; id: string }[] = [];

  if (landing.citySlug) {
    const inCity = inState.filter((l) => citySlug(l.city) === landing.citySlug);
    groups.push({
      title: `Other Services in ${where}`,
      items: SERVICES.filter((s) => s.slug !== landing.service.slug)
        .map((s) => ({
          to: cityPath(landing.stateCode, cityName || '', s.slug),
          label: s.label,
          count: s.category ? inCity.filter((l) => l.category === s.category).length : inCity.length,
        }))
        .filter((s) => s.count > 0),
      id: 'browse-city-services',
    });
    groups.push({
      title: `More Cities in ${stateName(landing.stateCode)}`,
      items: tally(
        inService.filter((l) => citySlug(l.city) !== landing.citySlug),
        (l) => citySlug(l.city),
        (l) => l.city,
        (l) => cityPath(l.state, l.city, landing.service.slug)
      ).sort(byCount).slice(0, 24),
      id: 'browse-nearby-cities',
    });
  } else {
    groups.push({
      title: `${landing.service.category ? landing.service.label : 'Estate Services'} by City in ${where}`,
      items: tally(inService, (l) => citySlug(l.city), (l) => l.city, (l) => cityPath(l.state, l.city, landing.service.slug)).sort(byLabel),
      id: 'browse-cities',
    });
    groups.push({
      title: `Services in ${where}`,
      items: SERVICES.filter((s) => s.slug !== landing.service.slug)
        .map((s) => ({
          to: statePath(landing.stateCode, s.slug),
          label: s.slug === ALL_SERVICES_SLUG ? 'All Estate Services' : s.label,
          count: s.category ? inState.filter((l) => l.category === s.category).length : inState.length,
        }))
        .filter((s) => s.count > 0),
      id: 'browse-state-services',
    });
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8" id="browse-locations">
      {groups.map((g) => (
        <LinkGroup key={g.id} {...g} />
      ))}
      <p className="text-xs text-stone-500">
        <Link to="/" className="font-semibold text-amber-700 dark:text-amber-400 hover:underline">
          Browse all states
        </Link>
      </p>
    </section>
  );
};
