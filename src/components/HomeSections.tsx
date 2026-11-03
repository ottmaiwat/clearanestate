import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Users, Truck, Gavel, ClipboardList, BookOpen, ArrowRight } from 'lucide-react';
import { Listing } from '../types';
import { SERVICES, US_STATES, servicePath } from '../lib/locations';
import { GUIDES, guidePath } from '../lib/guides';

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'estate-cleanouts': Home,
  'senior-move-management': Users,
  'junk-removal': Truck,
  'estate-sales': Gavel,
  'appraisal-downsizing': ClipboardList,
};

// Directory-wide numbers shown under the homepage search.
export const HomeStats: React.FC<{ listings: Listing[] }> = ({ listings }) => {
  const known = listings.filter((l) => US_STATES[l.state?.toUpperCase()]);
  const cities = new Set(known.map((l) => `${l.state}/${l.city.trim().toLowerCase()}`)).size;
  const states = new Set(known.map((l) => l.state)).size;
  if (listings.length === 0) return null;

  const stats = [
    { value: listings.length, label: 'Businesses listed' },
    { value: cities, label: 'Cities' },
    { value: states, label: states === 1 ? 'State' : 'States' },
  ];
  return (
    <dl className="flex items-center justify-center gap-6 sm:gap-10 pt-2" id="home-stats">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <dd className="text-2xl sm:text-3xl font-serif font-black text-stone-900 dark:text-stone-50">{s.value.toLocaleString()}</dd>
          <dt className="text-[11px] font-mono uppercase tracking-widest text-stone-500 dark:text-stone-400">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
};

// One tile per service, each linking to that service's national page.
export const BrowseByService: React.FC<{ listings: Listing[] }> = ({ listings }) => {
  const tiles = SERVICES.filter((s) => s.category)
    .map((s) => ({ ...s, count: listings.filter((l) => l.category === s.category).length }))
    .filter((s) => s.count > 0);
  if (tiles.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10" id="browse-services">
      <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-3">Browse by Service</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((s) => {
          const Icon = SERVICE_ICONS[s.slug] || Home;
          return (
            <li key={s.slug}>
              <Link
                to={servicePath(s.slug)}
                className="group flex flex-col gap-2 h-full p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 hover:shadow-md transition-all"
              >
                <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 leading-tight">
                  {s.label}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {s.count} {s.count === 1 ? 'company' : 'companies'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export const GuidesSection: React.FC = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12" id="home-guides">
    <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
      <BookOpen className="w-5 h-5 text-amber-600" />
      Guides for Families &amp; Executors
    </h2>
    <ul className="grid sm:grid-cols-3 gap-3">
      {GUIDES.map((g) => (
        <li key={g.slug}>
          <Link
            to={guidePath(g.slug)}
            className="group flex flex-col h-full p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 hover:shadow-md transition-all"
          >
            <span className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">{g.title}</span>
            <span className="text-sm text-stone-600 dark:text-stone-400 mt-1.5 flex-1">{g.summary}</span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-3 inline-flex items-center gap-1">
              Read the guide <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
