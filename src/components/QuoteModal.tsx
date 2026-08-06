import React, { useState } from 'react';
import { Listing } from '../types';
import { X, Send, CheckCircle2, Calendar, MapPin, Mail, Phone, Home, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { submitQuoteRequest } from '../lib/api';
import { HoneypotField } from './HoneypotField';

interface QuoteModalProps {
  listing: Listing | null;
  onClose: () => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({ listing, onClose }) => {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [propertyType, setPropertyType] = useState('Single Family Home');
  const [projectScope, setProjectScope] = useState('Full Estate Cleanout');
  const [timeline, setTimeline] = useState('Within 1-2 Weeks');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<'emailed' | 'saved-only' | 'demo-only'>('saved-only');
  const [hp, setHp] = useState('');

  if (!listing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail) {
      alert('Please enter your name and email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitQuoteRequest({
        listingId: listing.id,
        listingName: listing.name,
        listingEmail: listing.email,
        requesterName: userName,
        requesterEmail: userEmail,
        requesterPhone: userPhone,
        propertyType,
        projectScope,
        timeline,
        notes,
        hp,
      });
      setDeliveryStatus(result.emailed ? 'emailed' : 'saved-only');
    } catch (err) {
      console.warn('Quote request API unavailable, this request was not saved anywhere:', err);
      setDeliveryStatus('demo-only');
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setUserName('');
    setUserEmail('');
    setUserPhone('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-amber-50/95 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
        id="request-quote-modal"
      >
        <div className="bg-amber-100/90 dark:bg-stone-800 p-6 border-b border-stone-200 dark:border-stone-700 relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-200/80 dark:bg-stone-700 hover:bg-stone-300 transition-colors"
            id="close-quote-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-amber-900 dark:text-amber-400 font-bold mb-1">
            <Send className="w-4 h-4" /> Free Cleanout & Downsizing Estimate
          </div>
          <h2 className="text-2xl font-serif font-bold">Request Estimate from {listing.name}</h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
            Directly message this provider for a no-obligation estate assessment or phone estimate.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-serif font-bold">Estimate Request Sent!</h3>
            {deliveryStatus === 'demo-only' ? (
              <div className="p-4 bg-amber-100/60 dark:bg-stone-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 border border-amber-200/80 max-w-md mx-auto text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Demo mode:</strong> the directory database isn't configured on this server, so this request wasn't saved or delivered anywhere.
                </span>
              </div>
            ) : (
              <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto">
                Your cleanout request for {listing.name} in {listing.city}, {listing.state} has been {deliveryStatus === 'emailed' ? 'emailed directly to the business' : 'submitted'}. The business representative will follow up via phone/email shortly.
              </p>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              id="quote-done-btn"
            >
              Back to Listing
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs sm:text-sm">
            <HoneypotField value={hp} onChange={setHp} />
            <div>
              <label className="block font-bold mb-1">Your Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Margaret Sterling (Executor / Family)"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="quote-user-name-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="margaret@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="quote-user-email-input"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="(555) 000-1234"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="quote-user-phone-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden text-xs"
                  id="quote-property-select"
                >
                  <option value="Single Family Home">Single Family Home</option>
                  <option value="Condo / Townhouse">Condo / Townhouse</option>
                  <option value="Senior Living Facility">Senior Living Facility</option>
                  <option value="Commercial / Warehouse">Commercial / Warehouse</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Primary Goal</label>
                <select
                  value={projectScope}
                  onChange={(e) => setProjectScope(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden text-xs"
                  id="quote-scope-select"
                >
                  <option value="Full Estate Cleanout">Full Estate Cleanout</option>
                  <option value="Senior Downsizing & Relocation">Senior Downsizing & Relocation</option>
                  <option value="Estate Sale & Liquidation Prep">Estate Sale & Liquidation Prep</option>
                  <option value="Junk & Debris Haulaway">Junk & Debris Haulaway</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Target Timeline</label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden text-xs"
                id="quote-timeline-select"
              >
                <option value="Urgent (Within 48 Hours)">Urgent (Within 48 Hours)</option>
                <option value="Within 1-2 Weeks">Within 1-2 Weeks</option>
                <option value="This Month">This Month</option>
                <option value="Planning Ahead">Planning Ahead</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Estate Details / Message</label>
              <textarea
                rows={2}
                placeholder="Mention house size, special items (furniture, antiques, pianos), or probate timeline..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="quote-notes-textarea"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 transition-colors text-xs"
                id="quote-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white transition-colors shadow-md text-xs flex items-center gap-1.5"
                id="quote-submit-btn"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending...' : 'Send Estimate Request'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
