import React, { useState } from 'react';
import { ListingCategory, PendingSubmission } from '../types';
import { X, Send, Building, MapPin, Phone, Globe, Mail, User, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { submitListing } from '../lib/api';
import { HoneypotField } from './HoneypotField';

interface SubmitListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (submission: PendingSubmission) => void;
}

const CATEGORIES: ListingCategory[] = [
  'Estate Cleanouts',
  'Senior Move Management',
  'Junk Removal & Hauling',
  'Liquidation & Estate Sales',
  'Content Appraisal & Downsizing'
];

export const SubmitListingModal: React.FC<SubmitListingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    category: CATEGORIES[0],
    city: '',
    state: '',
    phone: '',
    website: '',
    email: '',
    contactName: '',
    description: '',
    services: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [hp, setHp] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.city || !formData.state || !formData.email) {
      alert('Please fill in required fields (Business Name, City, State, and Contact Email).');
      return;
    }

    const servicesList = formData.services
      ? formData.services.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Estate Cleanout', 'Property Clearing'];

    const payload = {
      name: formData.name,
      category: formData.category,
      city: formData.city,
      state: formData.state.toUpperCase(),
      phone: formData.phone,
      website: formData.website || 'https://example.com',
      email: formData.email,
      contactName: formData.contactName || 'Business Owner',
      description: formData.description || `${formData.name} provides professional ${formData.category} services.`,
      services: servicesList,
    };

    setIsSubmitting(true);
    try {
      const serverRecord = await submitListing({ ...payload, hp });
      onSubmit(serverRecord);
      setSavedOffline(false);
    } catch (err) {
      // No database configured (or request failed) - fall back to local-only demo storage.
      console.warn('Listing submission API unavailable, saving locally instead:', err);
      onSubmit({
        id: 'p-' + Date.now(),
        ...payload,
        submittedAt: new Date().toISOString().split('T')[0],
        status: 'pending',
      });
      setSavedOffline(true);
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setFormData({
      name: '',
      category: CATEGORIES[0],
      city: '',
      state: '',
      phone: '',
      website: '',
      email: '',
      contactName: '',
      description: '',
      services: '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl bg-amber-50/95 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
        id="submit-listing-modal"
      >
        {/* Header */}
        <div className="bg-amber-100/90 dark:bg-stone-800 p-6 border-b border-stone-200 dark:border-stone-700 relative">
          <button
            onClick={handleReset}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-200/80 dark:bg-stone-700 hover:bg-stone-300 transition-colors"
            id="close-submit-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-900 dark:text-amber-400 font-bold mb-1">
            <Building className="w-4 h-4" /> Free Business Submission
          </div>
          <h2 className="text-2xl font-serif font-bold">List Your Estate Business Free</h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
            Join ClearAnEstate.com's nationwide directory. Submissions are reviewed by our team before going live.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif font-bold">Submission Received!</h3>
            <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto">
              Thank you! Your business listing <strong className="text-stone-900 dark:text-stone-100">{formData.name}</strong> has been sent to our administrator pending queue.
            </p>
            {savedOffline ? (
              <div className="p-4 bg-amber-100/60 dark:bg-stone-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 border border-amber-200/80 max-w-md mx-auto text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Demo mode:</strong> the directory database isn't configured on this server, so this submission was saved locally in your browser only (not sent anywhere). You can still open the <strong>Admin Portal</strong> link in the footer to approve it into the live grid for this session.
                </span>
              </div>
            ) : (
              <div className="p-4 bg-amber-100/60 dark:bg-stone-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 border border-amber-200/80 max-w-md mx-auto text-left">
                <strong>Tip for Business Owners:</strong> An administrator will review your submission in the Admin Portal before it goes live on the directory grid.
              </div>
            )}
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs text-sm"
              id="submit-success-done-btn"
            >
              Back to Directory
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs sm:text-sm">
            <HoneypotField value={hp} onChange={setHp} />
            <div>
              <label className="block font-bold mb-1">Business Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Estate Cleanouts & Services"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="submit-business-name-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ListingCategory })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="submit-category-select"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chicago"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                    id="submit-city-input"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">State (2-letter) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="IL"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden uppercase"
                    id="submit-state-input"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="submit-phone-input"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Website URL</label>
                <input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="submit-website-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Contact Person Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="submit-contact-name-input"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Contact Email *</label>
                <input
                  type="email"
                  required
                  placeholder="owner@yourcompany.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="submit-email-input"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Services Offered (comma separated)</label>
              <input
                type="text"
                placeholder="Whole-House Cleanout, Donation Receipts, Broom-Clean Finish, Estate Sale Prep"
                value={formData.services}
                onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="submit-services-input"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Business Description</label>
              <textarea
                rows={3}
                placeholder="Tell probate attorneys, families, and senior clients what sets your cleanout service apart..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="submit-description-textarea"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
                id="submit-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white transition-colors shadow-md flex items-center gap-1.5"
                id="submit-confirm-btn"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Submitting...' : 'Submit Free Listing'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
