import React, { useState } from 'react';
import { Listing } from '../types';
import {
  X,
  Phone,
  Globe,
  MapPin,
  Star,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  Building2,
  Calendar,
  Send,
  UserCheck,
  MessageSquare,
  Award,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
  onClaim: (listing: Listing) => void;
  onRequestQuote: (listing: Listing) => void;
  onGetFeatured: (listing: Listing) => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  onClose,
  onClaim,
  onRequestQuote,
  onGetFeatured,
}) => {
  if (!listing) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-amber-50/90 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
          id="listing-detail-modal"
        >
          {/* Estate Tag Header Visual */}
          <div className="bg-amber-100/80 dark:bg-stone-800/90 border-b border-stone-200 dark:border-stone-700 p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-stone-200/80 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
              id="close-detail-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Grommet Graphic */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-stone-300 dark:bg-stone-700 border-2 border-stone-400 dark:border-stone-600 flex items-center justify-center shadow-inner">
                <div className="w-3.5 h-3.5 rounded-full bg-stone-100 dark:bg-stone-900" />
              </div>
              <span className="text-xs font-mono tracking-widest text-amber-900 dark:text-amber-400 font-bold uppercase">
                ESTATE CLEANOUT DIRECTORY RECORD #{listing.id.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-200/80 dark:bg-amber-950 dark:text-amber-300 text-amber-900 mb-2">
                  {listing.category}
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-50">
                  {listing.name}
                </h2>
                <p className="text-stone-700 dark:text-stone-300 italic font-serif mt-1">
                  "{listing.tagline}"
                </p>
              </div>

              {listing.featured && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-stone-950 shadow-md">
                  <Sparkles className="w-4 h-4" />
                  VERIFIED FEATURED PRO
                </span>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-100/80 dark:bg-stone-800/50 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 block">Location</span>
                <span className="font-semibold text-sm flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  {listing.city}, {listing.state}
                </span>
              </div>

              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 block">Rating & Reviews</span>
                <span className="font-semibold text-sm flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {listing.rating.toFixed(1)} ({listing.reviewCount} reviews)
                </span>
              </div>

              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 block">Trust Badges</span>
                <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {listing.insured && <span className="flex items-center gap-0.5"><ShieldCheck className="w-3.5 h-3.5" /> Insured</span>}
                  {listing.bonded && <span className="flex items-center gap-0.5"><Award className="w-3.5 h-3.5" /> Bonded</span>}
                </div>
              </div>

              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 block">Experience</span>
                <span className="font-semibold text-sm mt-0.5 block">
                  {listing.yearsInBusiness ? `${listing.yearsInBusiness}+ Years in Business` : 'Established Local Pro'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-bold uppercase text-stone-500 dark:text-stone-400 tracking-wider mb-2">
                About The Business
              </h3>
              <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-sm bg-white/60 dark:bg-stone-950/40 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
                {listing.description}
              </p>
            </div>

            {/* Services Provided */}
            <div>
              <h3 className="text-sm font-bold uppercase text-stone-500 dark:text-stone-400 tracking-wider mb-2">
                Services Offered
              </h3>
              <div className="flex flex-wrap gap-2">
                {listing.services.map((srv, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 dark:bg-stone-800 text-amber-950 dark:text-amber-200 border border-amber-200 dark:border-stone-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    {srv}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact & Hours Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                <h4 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" /> Operating Hours
                </h4>
                <p className="text-sm font-medium">{listing.hours || 'Mon-Fri: 8:00 AM - 6:00 PM'}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {listing.address || `${listing.city}, ${listing.state} Service Area`}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-100/50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-600" /> Direct Contact
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-300">
                    Reach out directly for cleanout estimates, senior move quotes, or estate sale appraisals.
                  </p>
                </div>
                
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onRequestQuote(listing)}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    id="request-quote-btn"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Request Free Estimate
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Reviews (if any) */}
            {listing.reviews && listing.reviews.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase text-stone-500 dark:text-stone-400 tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-amber-600" /> Client Reviews
                </h3>
                <div className="space-y-2">
                  {listing.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 bg-white/70 dark:bg-stone-950/50 rounded-xl border border-stone-200 dark:border-stone-800 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold">{rev.author}</span>
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-amber-500" />
                          <span>{rev.rating}.0</span>
                          <span className="text-stone-400 ml-2 font-normal">{rev.date}</span>
                        </div>
                      </div>
                      <p className="text-stone-600 dark:text-stone-300 italic">"{rev.comment}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Action Footer */}
          <div className="p-4 bg-stone-100 dark:bg-stone-800/90 border-t border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onClaim(listing)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-2"
                id="claim-this-listing-link"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {listing.claimed ? 'Claimed Business Owner' : 'Is this your business? Claim it free'}
              </button>

              {listing.claimed && !listing.featured && (
                <button
                  onClick={() => onGetFeatured(listing)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline underline-offset-2"
                  id="get-featured-from-listing-link"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Get Featured ($30/mo)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {listing.phone && (
                <a
                  href={`tel:${listing.phone.replace(/[^\d+]/g, '')}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-stone-50 hover:bg-amber-600 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-amber-500 transition-colors flex items-center gap-1.5"
                  id="modal-phone-btn"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call {listing.phone}
                </a>
              )}

              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 transition-colors flex items-center gap-1.5 shadow-xs"
                id="modal-website-btn"
              >
                <Globe className="w-3.5 h-3.5" />
                Visit Website
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
