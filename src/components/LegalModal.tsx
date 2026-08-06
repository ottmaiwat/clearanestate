import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, initialTab }) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-amber-50/95 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
        id="legal-modal"
      >
        <div className="bg-amber-100/90 dark:bg-stone-800 p-6 border-b border-stone-200 dark:border-stone-700 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-200/80 dark:bg-stone-700 hover:bg-stone-300 transition-colors"
            id="close-legal-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-serif font-bold mb-3">Legal</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'privacy'
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-200/60'
              }`}
              id="legal-tab-privacy"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'terms'
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-200/60'
              }`}
              id="legal-tab-terms"
            >
              <FileText className="w-3.5 h-3.5" /> Terms of Service
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs sm:text-sm leading-relaxed">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              <p className="text-stone-500 dark:text-stone-400">Last updated: 2026-08-05</p>

              <p className="text-xs italic">
                ClearAnEstate.com (the "Directory") is operated by Ottster LLC ("we," "us," "our"). This policy explains what we collect, how we use it, and your rights regarding it.
              </p>

              <section>
                <h3 className="font-bold text-sm mb-1">Information We Collect</h3>
                <p>
                  When you submit a business listing, request an estimate, or claim a listing, we collect the information you provide directly: name, email address, phone number, business details, and any message content you enter. We also store your bookmarked listings in your browser's local storage — this data stays on your device and is not sent to us.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">How We Use Your Information</h3>
                <p>
                  Business submission details are reviewed by our team before a listing goes live. Estimate request details (your name, contact info, and project description) are sent directly to the business you're requesting a quote from, so they can follow up with you. Claim request details are used to verify business ownership before granting claim status.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Who We Share Information With</h3>
                <p>
                  We share estimate request details with the specific business you requested a quote from. We use Stripe to process Featured Listing subscription payments — Stripe's own privacy policy governs how they handle payment information; we never see or store your card details ourselves. We do not sell your personal information to third parties.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Cookies and Tracking</h3>
                <p>
                  We do not currently use analytics, advertising, or tracking cookies. If that changes — for example, if we add site analytics — we will update this policy to describe what's collected and, where required, seek your consent first.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Data Security and Breach Notification</h3>
                <p>
                  We take reasonable administrative and technical measures to protect the information you provide. No online service can guarantee complete security. In the event of a breach affecting unencrypted personal information, we will notify affected individuals without unreasonable delay, consistent with applicable state law — including Kansas's breach notification statute (K.S.A. 50-6,139b) and the notification laws of other states where affected individuals reside, such as Missouri (§407.1500 RSMo). Where required, we will also notify the applicable state Attorney General.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Children's Privacy</h3>
                <p>
                  This site is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact us using the details below and we will delete it.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Your Rights</h3>
                <p>
                  You can request deletion of your personal information at any time by contacting us at the email below. If you are a California resident, you may also have rights under the CCPA to know what personal information we hold about you and to request its deletion; contact us to exercise these rights, and we will respond consistent with applicable law.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Data Retention</h3>
                <p>
                  We retain submission, estimate request, and claim request records for as long as needed to operate the Directory and respond to inquiries, or until you request deletion.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Contact</h3>
                <p>Questions about this policy, or requests to access or delete your data? Contact us at [privacy@clearanestate.com] (or your current contact address until the domain email is set up).</p>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-stone-500 dark:text-stone-400">Last updated: 2026-08-05</p>

              <p className="text-xs italic">
                ClearAnEstate.com (the "Directory") is operated by Ottster LLC ("we," "us," "our").
              </p>

              <section>
                <h3 className="font-bold text-sm mb-1">Acceptance of Terms</h3>
                <p>
                  By using the Directory, you agree to these Terms of Service. If you don't agree, please don't use the site.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Directory Listings Are Not Endorsements</h3>
                <p>
                  Businesses listed in this Directory submit their own information, which we review before publishing but do not independently verify (insurance, bonding, licensing, and years-in-business claims are as reported by the business). We are not responsible for the quality, safety, legality, or outcome of any service performed by a listed business. Always verify credentials directly with a business before hiring them.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Submitting a Listing</h3>
                <p>
                  Free listing submissions are reviewed before publication and may be rejected or removed at our discretion, including for inaccurate information, prohibited content, or violation of these terms.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Featured Listing Subscriptions</h3>
                <p>
                  Featured Listing upgrades are billed at $30/month via Stripe and renew automatically until cancelled. You can cancel anytime through your Stripe customer portal link (sent at signup and available on request), or by emailing us at [billing@clearanestate.com]; cancellation is effective at the end of your current billing period, and you will not be charged again. All payments are processed by Stripe; we do not store your payment card details.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">User-Submitted Content</h3>
                <p>
                  You are responsible for the accuracy of any information you submit through this site, including business listings, estimate requests, and claim requests. Don't submit false, misleading, or fraudulent information.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Limitation of Liability</h3>
                <p>
                  The Directory is provided "as is" without warranties of any kind. To the fullest extent permitted by law, Ottster LLC is not liable for any damages arising from your use of the Directory or your dealings with any listed business. This limitation does not apply to damages caused by our gross negligence, willful misconduct, or any liability that cannot be limited or excluded under applicable law.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Dispute Resolution and Venue</h3>
                <p>
                  Any dispute arising out of these Terms or your use of the Directory will be brought exclusively in the state or federal courts located in Johnson County, Kansas, and you consent to the jurisdiction of those courts.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Governing Law</h3>
                <p>These terms are governed by the laws of Kansas, without regard to conflict-of-law principles.</p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-1">Contact</h3>
                <p>Questions about these terms? Contact us at [legal@clearanestate.com] (or your current contact address until the domain email is set up).</p>
              </section>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
