import React from 'react';
import { Tag, PlusCircle, Sparkles, Bookmark, Search, SlidersHorizontal, ShieldCheck, PhoneCall } from 'lucide-react';

interface HeaderProps {
  onOpenSubmitModal: () => void;
  onOpenFeaturedModal: () => void;
  bookmarkCount: number;
  onToggleFavoritesOnly: () => void;
  showFavoritesOnly: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSubmitModal,
  onOpenFeaturedModal,
  bookmarkCount,
  onToggleFavoritesOnly,
  showFavoritesOnly,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-amber-50/95 dark:bg-stone-950/95 backdrop-blur-md border-b-2 border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Title & Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-500 text-stone-950 font-serif font-black text-xl shadow-md border-2 border-amber-600 rotate-1 transform hover:rotate-0 transition-transform">
            <Tag className="w-6 h-6 stroke-[2.5]" />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-stone-900 border-2 border-amber-400 rounded-full" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-black text-xl sm:text-2xl text-stone-900 dark:text-stone-50 tracking-tight">
                ClearAn<span className="text-amber-600 dark:text-amber-500">Estate</span>
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-950 dark:text-amber-300 text-amber-900 border border-amber-300 dark:border-amber-800">
                DIRECTORY
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 hidden sm:block font-serif italic">
              Verified Estate Cleanouts, Senior Downsizing & Liquidation Pros
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Bookmark Filter */}
          <button
            onClick={onToggleFavoritesOnly}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              showFavoritesOnly
                ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-xs'
                : 'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-amber-100/50'
            }`}
            title="Saved Favorite Listings"
            id="favorites-toggle-btn"
          >
            <Bookmark className={`w-4 h-4 ${bookmarkCount > 0 ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">Saved</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-900 text-amber-300 font-mono">
              {bookmarkCount}
            </span>
          </button>

          {/* Get Featured ($30/mo) */}
          <button
            onClick={onOpenFeaturedModal}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 transition-all shadow-md hover:shadow-amber-500/20 flex items-center gap-1.5 border border-amber-400 animate-pulse"
            id="header-get-featured-btn"
          >
            <Sparkles className="w-4 h-4" />
            <span>Get Featured</span>
            <span className="hidden md:inline font-mono font-normal opacity-90">($30/mo)</span>
          </button>

          {/* Free Submit Listing */}
          <button
            onClick={onOpenSubmitModal}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-stone-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-amber-400 transition-all shadow-sm flex items-center gap-1.5"
            id="header-submit-listing-btn"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Listing</span>
          </button>
        </div>
      </div>
    </header>
  );
};
