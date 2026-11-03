import React, { useEffect, useState } from 'react';
import { Mail, Send, Loader2 } from 'lucide-react';
import { fetchReportsAdmin, sendReportsAdmin, ListingReport } from '../lib/api';

const SOURCE_LABELS: Record<string, string> = {
  payment: 'paid with',
  stripe: 'from Stripe',
  claim: 'from claim',
  listing: 'listing email',
};

// Admin: preview and send the monthly results emails featured businesses get. The same
// emails go out automatically on the 1st when the cPanel cron job is set up.
export const MonthlyReportsPanel: React.FC<{ adminPassword: string | null }> = ({ adminPassword }) => {
  const [period, setPeriod] = useState('');
  const [label, setLabel] = useState('');
  const [reports, setReports] = useState<ListingReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const load = async (p?: string) => {
    if (!adminPassword) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportsAdmin(adminPassword, p);
      setPeriod(data.period);
      setLabel(data.label);
      setReports(data.reports);
    } catch (err: any) {
      setError(err?.message || 'Could not load the reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  const toSend = reports?.filter((r) => !r.skipReason) ?? [];

  const send = async () => {
    if (!adminPassword || toSend.length === 0) return;
    if (!window.confirm(`Send ${toSend.length} results ${toSend.length === 1 ? 'email' : 'emails'} for ${label}?`)) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await sendReportsAdmin(adminPassword, period);
      setSendResult(
        `Sent ${result.sent.length}${result.failed.length ? `, failed ${result.failed.length} (${result.failed.join(', ')})` : ''}.`
      );
      await load(period);
    } catch (err: any) {
      setSendResult(err?.message || 'Sending failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-xl p-5 border border-stone-200 dark:border-stone-700 space-y-4" id="monthly-reports-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Monthly results emails
          </h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Each featured business gets its views, phone taps, website clicks, directions and estimate requests for the month.
            Listings with no activity are skipped, and a month is never sent twice.
          </p>
        </div>
        <label className="text-sm text-stone-700 dark:text-stone-300 flex items-center gap-2">
          Month
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && load(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
            id="reports-month-input"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-stone-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}

      {reports && !loading && (
        reports.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No featured listings in {label}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700">
                  <th className="py-2 pr-3">Business</th>
                  <th className="py-2 pr-3">Send to</th>
                  <th className="py-2 pr-3 text-right">Views</th>
                  <th className="py-2 pr-3 text-right">Calls</th>
                  <th className="py-2 pr-3 text-right">Website</th>
                  <th className="py-2 pr-3 text-right">Directions</th>
                  <th className="py-2 pr-3 text-right">Estimates</th>
                  <th className="py-2 pr-3 text-right">Since joining</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.listingId} className="border-b border-stone-100 dark:border-stone-700/60 text-stone-800 dark:text-stone-200">
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{r.name}</span>
                      <span className="block text-xs text-stone-500">{r.city}, {r.state}</span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {r.recipient ?? <span className="text-red-600">none</span>}
                      {r.recipientSource && <span className="block text-stone-500">{SOURCE_LABELS[r.recipientSource]}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{r.numbers.views}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.numbers.calls}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.numbers.websiteClicks}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.numbers.directions}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.numbers.quotes}</td>
                    <td className="py-2 pr-3 text-right font-mono" title="Contacts since this business became featured (the guarantee counts these)">
                      {r.contactsSinceFeatured}
                    </td>
                    <td className="py-2 text-xs">
                      {r.skipReason ? <span className="text-stone-500">{r.skipReason}</span> : <span className="text-green-700 dark:text-green-400 font-semibold">Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={send}
          disabled={sending || toSend.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold"
          id="send-reports-btn"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send {toSend.length} {toSend.length === 1 ? 'email' : 'emails'} for {label || 'this month'}
        </button>
        {sendResult && <span className="text-sm text-stone-700 dark:text-stone-300">{sendResult}</span>}
      </div>
    </div>
  );
};
