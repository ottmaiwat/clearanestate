import React, { useState } from 'react';
import { Copy, Check, Award } from 'lucide-react';
import { Listing } from '../types';
import { badgeHtml, badgeImagePath } from '../lib/badge';

export const BadgeCode: React.FC<{ listing: Listing }> = ({ listing }) => {
  const [copied, setCopied] = useState(false);
  const code = badgeHtml(listing);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is still selectable in the box.
    }
  };

  return (
    <div className="text-left bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 space-y-3" id="badge-code-panel">
      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
        <Award className="w-4 h-4 text-amber-600" />
        Add our badge to your website
      </div>
      <p className="text-[11px] text-stone-600 dark:text-stone-400">
        Show customers you&rsquo;re listed. Paste this code into your website (footer or About page). It links to your listing here.
      </p>
      <img src={badgeImagePath(listing.featured)} alt="Badge preview" width={224} height={64} />
      <textarea
        readOnly
        rows={3}
        value={code}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full font-mono text-[10px] px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 resize-none"
        id="badge-code-textarea"
      />
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-900 text-stone-50 hover:bg-amber-600 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-amber-500 transition-colors"
        id="badge-copy-btn"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy code'}
      </button>
    </div>
  );
};
