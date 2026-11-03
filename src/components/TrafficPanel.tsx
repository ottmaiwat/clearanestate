import React, { useEffect, useState } from 'react';
import { Eye, Phone, Globe, Users, Send, Sparkles, Navigation } from 'lucide-react';
import { fetchTrafficStatsAdmin, TrafficStats } from '../lib/api';

interface TrafficPanelProps {
  adminPassword: string | null;
  dbConfigured: boolean;
}

const RANGES = [7, 30, 90, 365];

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// One entry per day in the range ending today, including days with no visits, so the
// chart's spacing reflects time rather than only the days that had traffic.
function fillDays(daily: TrafficStats['daily'], days: number): TrafficStats['daily'] {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out: TrafficStats['daily'] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const key = localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    out.push(byDay.get(key) ?? { day: key, visitors: 0, contacts: 0 });
  }
  return out;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const StatTile: React.FC<{ label: string; value: number; icon: React.ReactNode; hint?: string }> = ({ label, value, icon, hint }) => (
  <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
      {icon}
      {label}
    </div>
    <div className="text-3xl font-black text-stone-900 dark:text-stone-100 mt-1 tabular-nums">{value.toLocaleString()}</div>
    {hint && <div className="text-xs text-stone-500 mt-1">{hint}</div>}
  </div>
);

export const TrafficPanel: React.FC<TrafficPanelProps> = ({ adminPassword, dbConfigured }) => {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dbConfigured || !adminPassword) return;
    setLoading(true);
    setError(null);
    fetchTrafficStatsAdmin(adminPassword, days)
      .then(setStats)
      .catch((e) => setError(e.message || 'Failed to load traffic stats.'))
      .finally(() => setLoading(false));
  }, [adminPassword, dbConfigured, days]);

  if (!dbConfigured) {
    return <p className="text-stone-500">Traffic stats need the database to be connected.</p>;
  }

  const contacts = stats ? stats.calls + stats.websiteClicks + stats.quoteRequests : 0;
  const series = stats ? fillDays(stats.daily, days) : [];
  const maxVisitors = Math.max(1, ...series.map((d) => d.visitors));
  const hasVisits = series.some((d) => d.visitors > 0);
  const showValues = series.length <= 31;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Traffic</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                days === r ? 'bg-amber-600 text-white' : 'bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-200/60'
              }`}
            >
              {r === 365 ? '1 year' : `${r} days`}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && !stats && <p className="text-stone-500">Loading…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatTile label="Visitors" value={stats.visitors} icon={<Users className="w-3.5 h-3.5" />} hint="Unique per day, added up" />
            <StatTile label="Page views" value={stats.pageViews} icon={<Eye className="w-3.5 h-3.5" />} />
            <StatTile label="Listing views" value={stats.listingViews} icon={<Eye className="w-3.5 h-3.5" />} hint="Listing pages opened" />
            <StatTile label="Business contacts" value={contacts} icon={<Sparkles className="w-3.5 h-3.5" />} hint="Calls + website clicks + quote requests" />
            <StatTile label="Call clicks" value={stats.calls} icon={<Phone className="w-3.5 h-3.5" />} />
            <StatTile label="Website clicks" value={stats.websiteClicks} icon={<Globe className="w-3.5 h-3.5" />} />
            <StatTile label="Directions" value={stats.directions} icon={<Navigation className="w-3.5 h-3.5" />} hint="Featured cards only" />
          </div>

          <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4">
            <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-3">Visitors per day</h3>
            {!hasVisits ? (
              <p className="text-sm text-stone-500">No visits recorded yet in this period.</p>
            ) : (
              <>
                <div className={`flex items-end h-36 ${showValues ? 'gap-1' : 'gap-px'}`} role="img" aria-label="Visitors per day">
                  {series.map((d) => (
                    <div key={d.day} className="flex-1 h-full flex flex-col justify-end items-center min-w-0" title={`${dayLabel(d.day)}: ${d.visitors} visitors, ${d.contacts} contacts`}>
                      {showValues && d.visitors > 0 && (
                        <span className="text-[10px] font-bold tabular-nums text-stone-600 dark:text-stone-300 mb-0.5">{d.visitors}</span>
                      )}
                      <div
                        className={`w-full rounded-t-sm ${d.visitors > 0 ? 'bg-amber-500' : 'bg-stone-200 dark:bg-stone-700'}`}
                        style={{ height: d.visitors > 0 ? `${(d.visitors / maxVisitors) * 85}%` : '2px' }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 mt-1.5 tabular-nums">
                  <span>{dayLabel(series[0].day)}</span>
                  {series.length > 2 && <span>{dayLabel(series[Math.floor(series.length / 2)].day)}</span>}
                  <span>{dayLabel(series[series.length - 1].day)}</span>
                </div>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4 overflow-x-auto">
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-3">Listings with the most contacts</h3>
              {stats.topListings.length === 0 ? (
                <p className="text-sm text-stone-500">No listing activity yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-500 uppercase">
                      <th className="pb-2 font-bold">Listing</th>
                      <th className="pb-2 font-bold text-right">Views</th>
                      <th className="pb-2 font-bold text-right">Calls</th>
                      <th className="pb-2 font-bold text-right">Website</th>
                      <th className="pb-2 font-bold text-right">Directions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topListings.map((l) => (
                      <tr key={l.listingId} className="border-t border-stone-100 dark:border-stone-700">
                        <td className="py-1.5 pr-2">
                          <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                            {l.name}
                            {l.featured && <Sparkles className="w-3 h-3 text-amber-500" aria-label="Featured" />}
                          </div>
                          {l.city && <div className="text-xs text-stone-500">{l.city}, {l.state}</div>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{l.views}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.calls}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.websiteClicks}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.directions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4 overflow-x-auto">
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-3">Most viewed pages</h3>
              {stats.topPages.length === 0 ? (
                <p className="text-sm text-stone-500">No page views yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {stats.topPages.map((p) => (
                      <tr key={p.path} className="border-t border-stone-100 dark:border-stone-700 first:border-t-0">
                        <td className="py-1.5 pr-2 font-mono text-xs break-all">{p.path}</td>
                        <td className="py-1.5 text-right tabular-nums">{p.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            Quote requests in this period: {stats.quoteRequests}. Bots and crawlers are filtered out.
          </p>
        </>
      )}
    </div>
  );
};
