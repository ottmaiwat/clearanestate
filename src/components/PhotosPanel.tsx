import React, { useEffect, useState } from 'react';
import { Check, X, Trash2, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { fetchPhotosAdmin, updatePhotoAdmin, AdminPhoto } from '../lib/api';

// Admin: review owner-uploaded logos and photos. Nothing shows on the site until approved.
export const PhotosPanel: React.FC<{ adminPassword: string | null; dbConfigured: boolean }> = ({ adminPassword, dbConfigured }) => {
  const [view, setView] = useState<'pending' | 'approved'>('pending');
  const [photos, setPhotos] = useState<AdminPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    if (!dbConfigured || !adminPassword) return;
    setError(null);
    fetchPhotosAdmin(adminPassword, view)
      .then(setPhotos)
      .catch((e) => setError(e?.message || 'Could not load photos.'));
  };

  useEffect(load, [adminPassword, dbConfigured, view]);

  const act = async (photo: AdminPhoto, action: 'approve' | 'reject' | 'remove') => {
    if (!adminPassword) return;
    if (action === 'remove' && !window.confirm(`Remove this ${photo.kind} from ${photo.listingName}? The file is deleted.`)) return;
    setBusyId(photo.id);
    try {
      await updatePhotoAdmin(adminPassword, photo.id, action);
      setPhotos((prev) => prev?.filter((p) => p.id !== photo.id) ?? null);
    } catch (e: any) {
      alert(e?.message || 'Could not update this photo.');
    } finally {
      setBusyId(null);
    }
  };

  if (!dbConfigured) return <p className="text-stone-500">Photos need the database to be connected.</p>;

  return (
    <div className="space-y-4" id="photos-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Photos</h2>
        <div className="flex gap-1">
          {(['pending', 'approved'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                view === v ? 'bg-amber-600 text-white' : 'bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              {v === 'pending' ? 'Waiting for review' : 'Live'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Owners upload these from their edit link. Approved photos appear on <strong>featured</strong> listings only. Reject anything that
        isn&rsquo;t their business, isn&rsquo;t appropriate, or looks like someone else&rsquo;s photo.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!photos && !error && <Loader2 className="w-5 h-5 animate-spin text-stone-500" />}
      {photos && photos.length === 0 && (
        <p className="text-stone-500 dark:text-stone-400">{view === 'pending' ? 'Nothing waiting for review.' : 'No live photos yet.'}</p>
      )}

      {photos && photos.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((p) => (
            <div key={p.id} className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block bg-stone-100 dark:bg-stone-900">
                <img src={p.url} alt="" className={`w-full h-48 ${p.kind === 'logo' ? 'object-contain p-4' : 'object-cover'}`} loading="lazy" />
              </a>
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1">
                    {p.listingName}
                    {p.featured && <Sparkles className="w-3 h-3 text-amber-500" aria-label="Featured" />}
                  </p>
                  <p className="text-xs text-stone-500">
                    {p.kind === 'logo' ? 'Logo' : 'Photo'} · {p.city}, {p.state}
                    {p.uploadedBy && <> · {p.uploadedBy}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {view === 'pending' ? (
                    <>
                      <button
                        onClick={() => act(p, 'approve')}
                        disabled={busyId === p.id}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => act(p, 'reject')}
                        disabled={busyId === p.id}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 disabled:opacity-50 text-xs font-bold"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => act(p, 'remove')}
                      disabled={busyId === p.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 disabled:opacity-50 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-2 rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300"
                    title="Open full size"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
