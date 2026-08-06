import React from 'react';
import { Listing } from '../types';
import { Phone, Globe, MapPin, Star, ShieldCheck, Sparkles, ArrowRight, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';

interface PriceTagCardProps {
  listing: Listing;
  onSelect: (listing: Listing) => void;
  onClaim: (listing: Listing) => void;
  isBookmarked: boolean;
  onToggleBookmark: (id: string, e: React.MouseEvent) => void;
}

export const PriceTagCard: React.FC<PriceTagCardProps> = ({
  listing,
  onSelect,
  onClaim,
  isBookmarked,
  onToggleBookmark,
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      id={`listing-card-${listing.id}`}
      onClick={() => onSelect(listing)}
      className={`group relative bg-amber-50/40 dark:bg-stone-900 border-2 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
        listing.featured
          ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/20 shadow-amber-500/10'
          : 'border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700'
      }`}
    >
      {/* Top Tag Hole & String Graphic */}
      <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3 mb-3">
        {/* Estate Sale Tag Grommet / Punch Hole */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-800 border-2 border-stone-300 dark:border-stone-700 shadow-inner">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-100 dark:bg-stone-950 shadow-sm" />
            {/* String thread indicator */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-amber-700/60 dark:bg-amber-500/60" />
          </div>
          <span className="text-xs font-mono tracking-widest text-stone-500 dark:text-stone-400 uppercase font-semibold">
            ESTATE ID: #{listing.id.toUpperCase()}
          </span>
        </div>

        {/* Featured Ribbon or Category Tag */}
        <div className="flex items-center gap-1.5">
          {listing.featured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-stone-950 shadow-xs animate-pulse">
              <Sparkles className="w-3 h-3" />
              FEATURED
            </span>
          )}
          <button
            onClick={(e) => onToggleBookmark(listing.id, e)}
            className={`p-1.5 rounded-full transition-colors ${
              isBookmarked
                ? 'text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400'
                : 'text-stone-400 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark listing'}
            id={`bookmark-btn-${listing.id}`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        {/* Category Badge */}
        <div className="mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/60">
            {listing.category}
          </span>
        </div>

        {/* Company Title */}
        <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-1 mb-1">
          {listing.name}
        </h3>

        {/* Tagline */}
        <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2 italic mb-3 font-serif">
          "{listing.tagline}"
        </p>

        {/* Perforated Separator */}
        <div className="border-t-2 border-dashed border-stone-300 dark:border-stone-800 my-3 relative">
          <div className="absolute -left-6 -top-2.5 w-4 h-5 bg-stone-100 dark:bg-stone-950 rounded-r-full" />
          <div className="absolute -right-6 -top-2.5 w-4 h-5 bg-stone-100 dark:bg-stone-950 rounded-l-full" />
        </div>

        {/* Service Highlights */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {listing.services.slice(0, 3).map((srv, idx) => (
            <span
              key={idx}
              className="text-[11px] font-sans px-2 py-0.5 rounded bg-amber-100/60 dark:bg-stone-800/80 text-amber-900 dark:text-amber-200"
            >
              • {srv}
            </span>
          ))}
          {listing.services.length > 3 && (
            <span className="text-[11px] font-sans px-1.5 py-0.5 text-stone-500 dark:text-stone-400">
              +{listing.services.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800/80">
        <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 mb-3">
          <div className="flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
            <span>{listing.city}, {listing.state}</span>
          </div>

          <div className="flex items-center gap-1 font-semibold text-stone-800 dark:text-stone-200">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{listing.rating.toFixed(1)}</span>
            <span className="text-stone-400 font-normal">({listing.reviewCount})</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {listing.phone ? (
            <a
              href={`tel:${listing.phone.replace(/[^\d+]/g, '')}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-stone-50 hover:bg-amber-600 dark:bg-stone-800 dark:hover:bg-amber-600 transition-colors shadow-xs"
              id={`call-btn-${listing.id}`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{listing.phone}</span>
            </a>
          ) : (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700 transition-colors"
              id={`website-btn-${listing.id}`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </a>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(listing);
            }}
            className="p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-stone-800 transition-colors"
            title="View Full Price Tag Listing"
            id={`view-btn-${listing.id}`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
