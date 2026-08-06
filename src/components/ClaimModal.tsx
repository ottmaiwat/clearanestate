import React, { useState } from 'react';
import { Listing } from '../types';
import { X, UserCheck, Send, CheckCircle2, ShieldCheck, Mail, Phone, Building, Clock, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { submitClaimRequest } from '../lib/api';
import { HoneypotField } from './HoneypotField';

interface ClaimModalProps {
  listing: Listing | null;
  onClose: () => void;
  onConfirmClaim: (listingId: string) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  listing,
  onClose,
  onConfirmClaim,
}) => {
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [proofDetails, setProofDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'approved' | 'pending' | 'demo-only'>('pending');
  const [hp, setHp] = useState('');

  if (!listing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName || !ownerEmail) {
      alert('Please fill in your name and work email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitClaimRequest(listing.id, {
        claimantName: ownerName,
        claimantEmail: ownerEmail,
        claimantPhone: ownerPhone,
        proofDetails,
        hp,
      });
      setClaimStatus(result.status);
      if (result.status === 'approved') {
        onConfirmClaim(listing.id);
      }
    } catch (err) {
      console.warn('Claim request API unavailable, falling back to instant local claim:', err);
      onConfirmClaim(listing.id);
      setClaimStatus('demo-only');
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setOwnerName('');
    setOwnerEmail('');
    setOwnerPhone('');
    setProofDetails('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-amber-50/95 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
        id="claim-listing-modal"
      >
        <div className="bg-amber-100/90 dark:bg-stone-800 p-6 border-b border-stone-200 dark:border-stone-700 relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-200/80 dark:bg-stone-700 hover:bg-stone-300 transition-colors"
            id="close-claim-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-amber-900 dark:text-amber-400 font-bold mb-1">
            <UserCheck className="w-4 h-4" /> Free Business Verification
          </div>
          <h2 className="text-2xl font-serif font-bold">Claim "{listing.name}"</h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
            Claiming your listing gives you ownership rights to edit phone numbers, website links, and services.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 ${
                claimStatus === 'pending'
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 border-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 border-emerald-300'
              }`}
            >
              {claimStatus === 'pending' ? <Clock className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
            </div>
            {claimStatus === 'approved' && (
              <>
                <h3 className="text-xl font-serif font-bold">Claim Approved!</h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto">
                  Your email domain matched <strong>{listing.name}</strong>'s listed website, so your claim was verified automatically. The listing is now marked "Claimed Pro".
                </p>
              </>
            )}
            {claimStatus === 'pending' && (
              <>
                <h3 className="text-xl font-serif font-bold">Claim Request Submitted</h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto">
                  We couldn't automatically verify your email against <strong>{listing.name}</strong>'s listed website, so this claim needs a quick manual review before it's approved. You'll be notified once it's confirmed.
                </p>
              </>
            )}
            {claimStatus === 'demo-only' && (
              <div className="p-4 bg-amber-100/60 dark:bg-stone-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 border border-amber-200/80 max-w-md mx-auto text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Demo mode:</strong> the directory database isn't configured on this server, so this claim was approved locally without any verification.
                </span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              id="claim-done-btn"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
            <HoneypotField value={hp} onChange={setHp} />
            <div>
              <label className="block font-bold mb-1">Your Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Robert Vance"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="claim-owner-name-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Business Email *</label>
                <p className="text-[11px] font-normal text-stone-500 mb-1">
                  Use an email at the same domain as the listing's website for instant verification.
                </p>
                <input
                  type="email"
                  required
                  placeholder="robert@yourcompany.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="claim-owner-email-input"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  id="claim-owner-phone-input"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Verification Note (optional)</label>
              <textarea
                rows={2}
                placeholder="Include website URL, domain ownership, or registration info..."
                value={proofDetails}
                onChange={(e) => setProofDetails(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
                id="claim-proof-textarea"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 transition-colors text-xs"
                id="claim-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white transition-colors shadow-md text-xs flex items-center gap-1.5"
                id="claim-submit-btn"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSubmitting ? 'Verifying...' : 'Claim This Listing'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
