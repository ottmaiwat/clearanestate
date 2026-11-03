import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, Lock, Save, AlertTriangle } from 'lucide-react';
import { Listing } from '../types';
import { fetchOwnerListing, saveOwnerListing, OwnerListingEdit, OwnerPhoto } from '../lib/api';
import { OwnerPhotos } from './OwnerPhotos';
import { listingPath } from '../lib/slug';
import { CONTACT_EMAIL } from '../lib/site';

function toForm(l: Listing): OwnerListingEdit {
  return {
    phone: l.phone || '',
    website: l.website || '',
    email: l.email || '',
    tagline: l.tagline || '',
    description: /not yet claimed/i.test(l.description || '') ? '' : l.description || '',
    services: l.services || [],
    hours: l.hours || '',
    address: l.address || '',
    yearsInBusiness: l.yearsInBusiness != null ? String(l.yearsInBusiness) : '',
    insured: l.insured,
    bonded: l.bonded,
  };
}

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500 outline-hidden text-sm';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="block text-sm font-bold text-stone-800 dark:text-stone-200">{label}</span>
    {hint && <span className="block text-xs text-stone-500 dark:text-stone-400">{hint}</span>}
    {children}
  </label>
);

// Owner-facing editor, opened from the private link emailed to a listing's owner.
export const EditListingPage: React.FC<{ onSaved?: (listing: Listing) => void }> = ({ onSaved }) => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [listing, setListing] = useState<Listing | null>(null);
  const [editorEmail, setEditorEmail] = useState('');
  const [photos, setPhotos] = useState<OwnerPhoto[]>([]);
  const [form, setForm] = useState<OwnerListingEdit | null>(null);
  const [servicesText, setServicesText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('This page needs the private link we emailed you. Open it from that email, or ask for a new one from your listing page.');
      return;
    }
    fetchOwnerListing(token)
      .then(({ listing: l, editorEmail: e, photos: p }) => {
        setListing(l);
        setEditorEmail(e);
        setPhotos(p || []);
        const f = toForm(l);
        setForm(f);
        setServicesText(f.services.join('\n'));
      })
      .catch((err) => setLoadError(err?.message || 'This edit link is invalid or has expired.'));
  }, [token]);

  const set = <K extends keyof OwnerListingEdit>(key: K, value: OwnerListingEdit[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSavedAt(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const services = servicesText.split('\n').map((s) => s.trim()).filter(Boolean);
      const result = await saveOwnerListing(token, { ...form, services });
      setListing(result.listing);
      onSaved?.(result.listing);
      const f = toForm(result.listing);
      setForm(f);
      setServicesText(f.services.join('\n'));
      setSavedAt(Date.now());
    } catch (err: any) {
      setSaveError(err?.message || 'Your changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 text-stone-900 dark:text-stone-100" id="edit-listing-error">
        <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
        <h1 className="text-2xl font-serif font-bold">We couldn&rsquo;t open your listing</h1>
        <p className="text-sm text-stone-600 dark:text-stone-300">{loadError}</p>
        <p className="text-xs text-stone-500">Need help? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.</p>
      </div>
    );
  }

  if (!listing || !form) {
    return (
      <div className="py-24 flex justify-center text-stone-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-stone-900 dark:text-stone-100" id="edit-listing-page">
      <header className="bg-gradient-to-b from-amber-100/70 to-stone-100 dark:from-stone-900 dark:to-stone-950 border-b border-stone-200 dark:border-stone-800 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-2">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Edit your listing
          </p>
          <h1 className="text-2xl sm:text-3xl font-serif font-black">{listing.name}</h1>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {listing.category} · {listing.city}, {listing.state}
          </p>
          <Link to={listingPath(listing)} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2">
            View your listing <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <form onSubmit={save} className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(816) 555-0142" id="edit-phone" />
          </Field>
          <Field label="Website *">
            <input className={inputClass} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://yourcompany.com" required id="edit-website" />
          </Field>
        </div>

        <Field label="Email for estimate requests" hint="Estimate requests from families are sent to this address.">
          <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="office@yourcompany.com" id="edit-email" />
        </Field>

        <Field label="Tagline" hint="One short line shown under your name.">
          <input className={inputClass} value={form.tagline} maxLength={160} onChange={(e) => set('tagline', e.target.value)} id="edit-tagline" />
        </Field>

        <Field label="About your business" hint="What you do, the area you serve, and why families choose you.">
          <textarea className={inputClass} rows={5} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} id="edit-description" />
        </Field>

        <Field label="Services" hint="One per line, up to 15.">
          <textarea className={inputClass} rows={5} value={servicesText} onChange={(e) => { setServicesText(e.target.value); setSavedAt(null); }} id="edit-services" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Hours">
            <input className={inputClass} value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="Mon-Fri 8am-6pm" id="edit-hours" />
          </Field>
          <Field label="Years in business">
            <input type="number" min={0} max={150} className={inputClass} value={form.yearsInBusiness} onChange={(e) => set('yearsInBusiness', e.target.value)} id="edit-years" />
          </Field>
        </div>

        <Field label="Street address" hint="Optional. Used for the Directions button on featured listings.">
          <input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} id="edit-address" />
        </Field>

        <div className="flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.insured} onChange={(e) => set('insured', e.target.checked)} className="accent-amber-600 w-4 h-4" id="edit-insured" />
            Insured
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.bonded} onChange={(e) => set('bonded', e.target.checked)} className="accent-amber-600 w-4 h-4" id="edit-bonded" />
            Bonded
          </label>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          To change your business name, category or city, email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
          Signed in as {editorEmail}.
        </p>

        {saveError && <p className="text-sm text-red-600" id="edit-save-error">{saveError}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-stone-950 transition-colors shadow-sm"
            id="edit-save-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
          {savedAt && (
            <span className="text-sm text-green-700 dark:text-green-400 font-semibold flex items-center gap-1.5" id="edit-saved-msg">
              <CheckCircle2 className="w-4 h-4" /> Saved. Your listing is updated.
            </span>
          )}
        </div>
      </form>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        <OwnerPhotos token={token} listingId={listing.id} featured={listing.featured} photos={photos} onChange={setPhotos} />
      </div>
    </div>
  );
};
