import React, { useEffect, useRef, useState } from 'react';
import { Share2, X, Link2, Check } from 'lucide-react';

const SHARE_IMAGE = 'https://clearanestate.com/og-image.png';

// Facebook and Pinterest share dialogs handle sign-in themselves: a visitor who isn't
// logged in is asked to sign in first, then lands on the share screen.
function shareLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    pinterest: `https://www.pinterest.com/pin/create/button/?url=${u}&media=${encodeURIComponent(SHARE_IMAGE)}&description=${encodeURIComponent(text)}`,
  };
}

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5H16.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
  </svg>
);

const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.5 2.1-4.5 4.4 0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A10 10 0 1 0 12 2z" />
  </svg>
);

export const ShareButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the panel or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openShare = (network: 'facebook' | 'pinterest') => {
    const links = shareLinks(window.location.href, document.title);
    window.open(links[network], 'share', 'width=640,height=640,noopener');
    setOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the address bar still works.
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {open && (
        <div
          className="absolute bottom-14 right-0 w-56 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-xl p-4"
          role="dialog"
          aria-label="Share this page"
          id="share-panel"
        >
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400 text-center mb-3">
            Share this page
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => openShare('facebook')}
              className="w-11 h-11 rounded-full bg-[#1877F2] hover:brightness-110 text-white flex items-center justify-center shadow-sm"
              title="Share on Facebook"
              aria-label="Share on Facebook"
              id="share-facebook-btn"
            >
              <FacebookIcon />
            </button>
            <button
              onClick={() => openShare('pinterest')}
              className="w-11 h-11 rounded-full bg-[#E60023] hover:brightness-110 text-white flex items-center justify-center shadow-sm"
              title="Save to Pinterest"
              aria-label="Save to Pinterest"
              id="share-pinterest-btn"
            >
              <PinterestIcon />
            </button>
            <button
              onClick={copyLink}
              className="w-11 h-11 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center border border-stone-200 dark:border-stone-700"
              title={copied ? 'Link copied' : 'Copy link'}
              aria-label="Copy link"
              id="share-copy-btn"
            >
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Link2 className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 text-center mt-3">
            {copied ? 'Link copied!' : "You'll be asked to sign in if you aren't already."}
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-lg border border-amber-400 flex items-center justify-center transition-colors"
        title={open ? 'Close' : 'Share this page'}
        aria-label={open ? 'Close share menu' : 'Share this page'}
        aria-expanded={open}
        id="share-toggle-btn"
      >
        {open ? <X className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
      </button>
    </div>
  );
};
