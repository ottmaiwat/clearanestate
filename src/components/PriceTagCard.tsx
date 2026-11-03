import React from 'react';
import { Listing } from '../types';
import { trackEvent } from '../lib/api';
import { Phone, Globe, MapPin, Star, ShieldCheck, Sparkles, ArrowRight, Bookmark, Navigation } from 'lucide-react';
import { motion } from 'motion/react';

// Google Maps search: the street address when we have one, otherwise the business name and
// city, which usually lands on the business's own Maps pin.
function directionsUrl(listing: Listing): string {
  const query = listing.address ? `${listing.name}, ${listing.address}` : `${listing.name}, ${listing.city}, ${listing.state}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

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
  // Featured (paid) cards get more on the card itself: description, trust badges, more
  // services and a full Call / Website / Directions row. Free cards stay compact.
  const featured = listing.featured;
  const serviceLimit = featured ? 6 : 3;
  const trustBadges = [
    listing.insured && 'Insured',
    listing.bonded && 'Bonded',
    listing.yearsInBusiness && `${listing.yearsInBusiness}+ yrs`,
  ].filter(Boolean) as string[];

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
      className={`group relative border-2 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
        featured
          ? 'bg-gradient-to-b from-amber-100/80 to-amber-50/60 dark:from-amber-950/40 dark:to-stone-900 border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/20 shadow-amber-500/10'
          : 'bg-amber-50/40 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700'
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

        {/* Featured: what they do and why to trust them, right on the card */}
        {featured && listing.description && !/not yet claimed/i.test(listing.description) && (
          <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-2 mb-3">{listing.description}</p>
        )}
        {featured && trustBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900"
              >
                <ShieldCheck className="w-3 h-3" />
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Service Highlights */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {listing.services.slice(0, serviceLimit).map((srv, idx) => (
            <span
              key={idx}
              className="text-[11px] font-sans px-2 py-0.5 rounded bg-amber-100/60 dark:bg-stone-800/80 text-amber-900 dark:text-amber-200"
            >
              • {srv}
            </span>
          ))}
          {listing.services.length > serviceLimit && (
            <span className="text-[11px] font-sans px-1.5 py-0.5 text-stone-500 dark:text-stone-400">
              +{listing.services.length - serviceLimit} more
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
            {listing.reviewCount > 0 ? (
              <>
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{listing.rating.toFixed(1)}</span>
                <span className="text-stone-400 font-normal">({listing.reviewCount})</span>
              </>
            ) : (
              <span className="text-stone-400 font-normal italic">Not yet rated</span>
            )}
          </div>
        </div>

        {featured ? (
          <div className="grid grid-cols-3 gap-1.5">
            {listing.phone && (
              <a
                href={`tel:${listing.phone.replace(/[^\d+]/g, '')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent('call', listing.id);
                }}
                className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 transition-colors shadow-xs"
                title={`Call ${listing.phone}`}
                id={`call-btn-${listing.id}`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            )}
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent('website', listing.id);
              }}
              className={`inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-bold bg-stone-900 hover:bg-stone-700 text-stone-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white transition-colors shadow-xs ${listing.phone ? '' : 'col-span-2'}`}
              id={`website-btn-${listing.id}`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </a>
            <a
              href={directionsUrl(listing)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent('directions', listing.id);
              }}
              className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-bold border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-stone-800 transition-colors"
              id={`directions-btn-${listing.id}`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Directions</span>
            </a>
          </div>
        ) : (
        <div className="flex items-center justify-between gap-2">
          {listing.phone ? (
            <a
              href={`tel:${listing.phone.replace(/[^\d+]/g, '')}`}
              onClick={(e) => {
                e.stopPropagation();
                trackEvent('call', listing.id);
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                trackEvent('website', listing.id);
              }}
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
        )}
      </div>
    </motion.div>
  );
};
