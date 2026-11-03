import React, { useState } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { requestEditLink } from '../lib/api';
import { HoneypotField } from './HoneypotField';

// "Owner? Edit this listing": emails a private edit link, but only to an address already
// on file for the listing. The reply is the same either way so it reveals nothing.
export const EditLinkRequest: React.FC<{ listingId: string }> = ({ listingId }) => {
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await requestEditLink(listingId, email.trim(), hp);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="text-left bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 space-y-3" id="edit-link-request">
      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
        <Mail className="w-4 h-4 text-amber-600" />
        Edit this listing
      </div>
      {done ? (
        <p className="text-xs text-stone-700 dark:text-stone-300 flex items-start gap-1.5" id="edit-link-sent">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          If that email is on file for this business, a private edit link is on its way. Check your inbox (and spam) in a minute or two.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <HoneypotField value={hp} onChange={setHp} />
          <p className="text-[11px] text-stone-600 dark:text-stone-400">
            Enter the email you claimed this listing with (or paid with). We&rsquo;ll email you a private link to update it.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
              id="edit-link-email"
            />
            <button
              type="submit"
              disabled={sending}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-stone-900 text-stone-50 hover:bg-amber-600 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-amber-500 disabled:opacity-60 transition-colors"
              id="edit-link-submit"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sending…' : 'Email me a link'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
};
