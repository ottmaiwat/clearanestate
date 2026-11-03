import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Trash2, Loader2, Sparkles } from 'lucide-react';
import { OwnerPhoto, uploadOwnerPhoto, deleteOwnerPhoto } from '../lib/api';

const MAX_PHOTOS = 6;

// Resizes and re-encodes an image in the browser before upload. That keeps uploads small
// and drops hidden data in the original file (such as a phone photo's GPS location).
// Logos stay PNG to keep transparent backgrounds; photos become JPEG.
async function prepareImage(file: File, kind: 'logo' | 'photo'): Promise<string> {
  const maxSide = kind === 'logo' ? 512 : 1600;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file couldn’t be read as an image. Please use a JPEG or PNG.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d')!;
    if (kind === 'photo') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return kind === 'logo' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const STATUS: Record<OwnerPhoto['status'], { label: string; className: string }> = {
  pending: { label: 'Waiting for review', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  rejected: { label: 'Not approved', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

export const OwnerPhotos: React.FC<{
  token: string;
  listingId: string;
  featured: boolean;
  photos: OwnerPhoto[];
  onChange: (photos: OwnerPhoto[]) => void;
}> = ({ token, listingId, featured, photos, onChange }) => {
  const [busy, setBusy] = useState<'logo' | 'photo' | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const logos = photos.filter((p) => p.kind === 'logo' && p.status !== 'rejected');
  const gallery = photos.filter((p) => p.kind === 'photo' && p.status !== 'rejected');
  const rejected = photos.filter((p) => p.status === 'rejected');

  const upload = async (kind: 'logo' | 'photo', files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(kind);
    try {
      const room = kind === 'logo' ? 1 - logos.length : MAX_PHOTOS - gallery.length;
      let latest = photos;
      for (const file of Array.from(files).slice(0, Math.max(0, room))) {
        const image = await prepareImage(file, kind);
        latest = (await uploadOwnerPhoto(token, kind, image)).photos;
        onChange(latest);
      }
    } catch (err: any) {
      setError(err?.message || 'The upload failed. Please try again.');
    } finally {
      setBusy(null);
      if (logoInput.current) logoInput.current.value = '';
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const remove = async (photo: OwnerPhoto) => {
    if (!window.confirm(`Remove this ${photo.kind}?`)) return;
    setError(null);
    setBusy(photo.id);
    try {
      onChange((await deleteOwnerPhoto(token, photo.id)).photos);
    } catch (err: any) {
      setError(err?.message || 'Could not remove it. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const Thumb: React.FC<{ photo: OwnerPhoto }> = ({ photo }) => (
    <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-900">
      {photo.url && (
        <img src={photo.url} alt="" className={`w-full h-28 ${photo.kind === 'logo' ? 'object-contain p-2' : 'object-cover'}`} />
      )}
      <span className={`absolute left-1.5 top-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS[photo.status].className}`}>
        {STATUS[photo.status].label}
      </span>
      <button
        type="button"
        onClick={() => remove(photo)}
        disabled={busy === photo.id}
        className="absolute right-1.5 top-1.5 p-1 rounded-md bg-white/90 dark:bg-stone-800/90 text-red-600 hover:bg-white disabled:opacity-50"
        title="Remove"
        aria-label={`Remove ${photo.kind}`}
      >
        {busy === photo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );

  const AddButton: React.FC<{ kind: 'logo' | 'photo'; label: string }> = ({ kind, label }) => (
    <button
      type="button"
      onClick={() => (kind === 'logo' ? logoInput : photoInput).current?.click()}
      disabled={busy !== null}
      className="h-28 w-full rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-500 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex flex-col items-center justify-center gap-1 text-xs font-semibold disabled:opacity-50"
      id={`add-${kind}-btn`}
    >
      {busy === kind ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
      {busy === kind ? 'Uploading…' : label}
    </button>
  );

  return (
    <section className="space-y-4 pt-2 border-t border-stone-200 dark:border-stone-800" id="owner-photos">
      <div>
        <h2 className="text-lg font-serif font-bold">Logo &amp; photos</h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
          We review each image before it goes live, usually within a day. Only upload photos you took or have permission to use: your crew,
          trucks, and before-and-after shots work best.
        </p>
        {!featured && (
          <p className="text-xs mt-2 p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Your logo and photos appear on your listing once it&rsquo;s featured.{' '}
              <Link to={`/advertise?listing=${encodeURIComponent(listingId)}`} className="underline font-semibold">
                See featured options
              </Link>
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Logo</p>
          {logos.length > 0 ? <Thumb photo={logos[0]} /> : <AddButton kind="logo" label="Add logo" />}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
          Photos ({gallery.length} of {MAX_PHOTOS})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {gallery.map((p) => (
            <Thumb key={p.id} photo={p} />
          ))}
          {gallery.length < MAX_PHOTOS && <AddButton kind="photo" label="Add photos" />}
        </div>
      </div>

      {rejected.length > 0 && (
        <p className="text-xs text-stone-500">
          {rejected.length} {rejected.length === 1 ? 'image was' : 'images were'} not approved. Questions? Reply to any email from us.
        </p>
      )}
      {error && <p className="text-sm text-red-600" id="owner-photos-error">{error}</p>}

      <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload('logo', e.target.files)} id="logo-file-input" />
      <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload('photo', e.target.files)} id="photo-file-input" />
    </section>
  );
};
