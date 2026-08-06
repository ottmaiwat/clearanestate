import React, { useState, useEffect } from 'react';
import { Listing } from '../types';
import { DEFAULT_STRIPE_PAYMENT_LINK } from '../data/seedListings';
import { X, Sparkles, ShieldCheck, Eye, Zap, CreditCard, Copy, ExternalLink, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface GetFeaturedModalProps {
  isOpen: boolean;
  onClose: () => void;
  stripePaymentLink: string;
  onUpdateStripeLink: (newLink: string) => void;
  listings: Listing[];
  preselectedListingId?: string | null;
}

export const GetFeaturedModal: React.FC<GetFeaturedModalProps> = ({
  isOpen,
  onClose,
  stripePaymentLink,
  onUpdateStripeLink,
  listings,
  preselectedListingId,
}) => {
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [customLink, setCustomLink] = useState(stripePaymentLink);
  const [copied, setCopied] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState(preselectedListingId || '');

  useEffect(() => {
    if (isOpen) {
      setSelectedListingId(preselectedListingId || '');
    }
  }, [isOpen, preselectedListingId]);

  if (!isOpen) return null;

  const selectedListing = listings.find((l) => l.id === selectedListingId) || null;
  const unfeaturedListings = listings.filter((l) => !l.featured);

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStripeLink(customLink);
    setIsEditingLink(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(stripePaymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubscribeClick = async () => {
    if (!selectedListing) {
      alert('Please select which listing you want to feature first.');
      return;
    }

    setLoadingCheckout(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          listingTitle: selectedListing.name,
          returnUrl: window.location.origin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch (e) {
      console.warn('Backend Stripe session failed, falling back to payment link', e);
    } finally {
      setLoadingCheckout(false);
    }

    // Fallback to configured direct Stripe Payment Link
    window.open(stripePaymentLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-amber-50/95 dark:bg-stone-900 border-2 border-amber-400 dark:border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
        id="get-featured-modal"
      >
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 p-6 sm:p-8 text-stone-950 relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-950/10 hover:bg-stone-950/20 transition-colors text-stone-950"
            id="close-featured-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Decorative Tag Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-950 text-amber-300 mb-3 shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
            DIRECT DIRECTORY PROMOTION
          </div>

          <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight mb-2">
            Get Featured on ClearAnEstate.com
          </h2>
          <p className="text-sm font-medium text-amber-950 max-w-lg">
            Boost your estate cleanout, senior downsizing, or junk removal business with top search placement and eye-catching Price Tag badges.
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-black font-serif">$30</span>
            <span className="text-sm font-bold text-amber-950 uppercase tracking-wider">/ month</span>
            <span className="ml-2 text-xs bg-stone-950/20 px-2.5 py-0.5 rounded-full font-semibold">Cancel Anytime</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Listing Selector - required so the checkout session (and the webhook that
              activates the Featured badge afterward) knows exactly which business to upgrade */}
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Which listing is this for? *
            </label>
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              disabled={!!preselectedListingId}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden disabled:opacity-70"
              id="featured-listing-select"
            >
              <option value="">Select your business listing...</option>
              {unfeaturedListings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.city}, {l.state}
                </option>
              ))}
            </select>
            {!preselectedListingId && (
              <p className="text-[11px] text-stone-500 mt-1.5">
                Don't see your business? Make sure it's listed and claimed first.
              </p>
            )}
          </div>

          {/* Feature Comparison Benefits */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-3">
              Why Featured Listings Get 3X More Inquiries
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Top Grid Placement</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Pinned to the top of state & category searches for maximum visibility.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Estate Tag Gold Ribbon</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Glowing golden tag borders and glowing "FEATURED" price tag badges.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Direct Phone & Quote Form</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Click-to-call phone numbers and instant estimate quote request forms.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Probate & Senior Trust</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Featured badge builds instant authority with estate executors and attorneys.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stripe Payment Link Integration Section */}
          <div className="p-5 rounded-2xl bg-stone-100 dark:bg-stone-800/90 border border-stone-300 dark:border-stone-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-600" /> Stripe Payment Link Hookup Point
              </span>
              <button
                onClick={() => setIsEditingLink(!isEditingLink)}
                className="text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
                id="edit-stripe-link-btn"
              >
                <Settings className="w-3.5 h-3.5" />
                {isEditingLink ? 'Close Config' : 'Configure Stripe URL'}
              </button>
            </div>

            {isEditingLink ? (
              <form onSubmit={handleSaveLink} className="space-y-2 text-xs">
                <label className="block text-stone-600 dark:text-stone-400">
                  Paste your Stripe Payment Link (e.g. <code className="bg-stone-200 dark:bg-stone-950 px-1 py-0.5 rounded">https://buy.stripe.com/xxxx</code>):
                </label>
                <input
                  type="url"
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 font-mono text-xs focus:ring-2 focus:ring-amber-500"
                  id="stripe-url-input"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                  id="save-stripe-url-btn"
                >
                  Save Payment Link
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-950 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                <span className="truncate flex-1">{stripePaymentLink}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 font-sans font-semibold flex items-center gap-1"
                  title="Copy Stripe Link"
                  id="copy-stripe-link-btn"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubscribeClick}
              disabled={loadingCheckout || !selectedListingId}
              className="w-full py-3 px-6 rounded-2xl text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              id="subscribe-stripe-btn"
            >
              <CreditCard className="w-4 h-4" />
              {loadingCheckout ? 'Connecting to Stripe...' : 'Subscribe via Stripe ($30/mo)'}
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
