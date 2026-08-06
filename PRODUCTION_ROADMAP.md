# ClearAnEstate.com — Path to Production

Tracking progress from demo to production, tackled one item at a time in priority order.

## Status

1. **[DONE] Legal: fictional seed data.** Replaced all 18 seed listings (and the 2 seed pending submissions) with invented business names, fictional phone numbers (555-01xx, NANPA-reserved), and non-resolving `.example` websites/emails (RFC 2606-reserved) — no more real company names or fabricated reviews attached to real businesses.
2. **[DONE] Functional: Quote requests now work.** "Request Estimate" saves to a database (`quote_requests` table) and best-effort emails the business directly via SMTP (nodemailer). Visible in Admin Portal's new "Quote Requests" tab. Falls back to a clear "demo mode" notice if no database is configured.
3. **[DONE] Functional: Claim Listing verification.** "Claim This Listing" now checks whether the claimant's email domain matches the listing's website — instant approval on a match, otherwise it's queued in a new Admin Portal "Claim Requests" tab for manual review. No more instant, unverified claims.
4. **[DONE] Functional: Stripe "Featured" upgrade now activates for real.** Found two bugs, fixed both: the webhook never touched the database, and the "Get Featured" popup never even knew which business it was for. Now: the popup requires picking a specific listing (or auto-fills it if opened from that business's own page), and once Stripe confirms payment, the webhook marks that exact listing as Featured — and un-marks it automatically if the subscription is later cancelled.
5. **[DONE] Removed the "Demo Featured Activation" fake-it button** from GetFeaturedModal.tsx — the only way to feature a listing now is through the real Stripe checkout flow.
6. **[DONE] Spam protection added to all public forms.** Each of the three public endpoints (submit listing, request estimate, claim listing) is now rate-limited to 5 submissions per 15 minutes per visitor, shared across all three so a bot can't dodge the limit by switching forms. Also added an invisible "honeypot" field to each form — real people never see it, but simple bots that auto-fill every field will, and get silently ignored instead of processed.
7. **[DONE] Admin login is now protected against password-guessing.** You confirmed you're the only admin, so we kept the single password but locked down the real gap: previously, someone could try to guess your password directly against any Admin Portal action (not just the login screen). Now, after 10 wrong attempts from the same visitor within 15 minutes, they're locked out for a while — verified this actually blocks further attempts, including (temporarily) correct ones, which is the expected trade-off for this kind of lockout.
8. **[DONE] Cosmetic cleanup.** The browser tab now shows the real site name and a favicon (a price-tag icon matching the site's branding) instead of "My Google AI Studio App," added a proper meta description, removed an unused AI dependency left over from the project scaffold, and rewrote the README to actually describe this project.
9. **[DONE] Operational odds and ends.** Added a real Privacy Policy / Terms of Service page (footer links → "Legal" modal — **you still need to fill in the bracketed placeholders** like [DATE], [CONTACT EMAIL], [COMPANY NAME], [STATE] with your real info, and have a lawyer review it). Added admin email notifications: set `ADMIN_NOTIFICATION_EMAIL` in your env vars and you'll get an email whenever a new listing is submitted, a new estimate request comes in, or a claim request needs manual review — no more having to check the Admin Portal manually. DNS/SSL setup and MySQL backups are pure hosting configuration only you can do in your Namecheap account (no code involved) — step-by-step instructions below.

## Pre-Launch Checklist (do this before going live)

Roughly in the order you'd actually do them:

### 1. Fill in the Privacy Policy / Terms of Service placeholders

1. Open `src/components/LegalModal.tsx`.
2. Find and replace every bracketed placeholder: `[DATE]` (twice — one in each tab), `[CONTACT EMAIL]` (appears in both tabs), `[COMPANY NAME]` (Terms tab, Limitation of Liability section), and `[STATE]` (Terms tab, Governing Law section).
3. Read through both tabs once fully — this is starter template text, not legal advice. Have a lawyer review it before launch, especially the data-collection (Privacy) and liability-limitation (Terms) sections.

### 2. Swap the demo Stripe Payment Link

`src/data/seedListings.ts` still exports `DEFAULT_STRIPE_PAYMENT_LINK` pointing at a placeholder Stripe link (a leftover fallback used if the `/api/stripe/create-checkout-session` call fails). Replace its value with a real Stripe Payment Link for your $30/mo Featured product, or leave the fallback as-is if you're confident the primary checkout flow (which is what actually runs — see step 5) will always be configured correctly.

### 3. Create the MySQL database and email mailbox in cPanel

1. In cPanel, under **Databases**, open **MySQL Databases**. Create a new database, create a new database user with a strong password, and add that user to the database with **All Privileges**.
2. Under **Email**, open **Email Accounts** and create a mailbox (e.g. `noreply@yourdomain.com`) — this is what quote-request emails and admin notifications will send from.
3. Note down the database name/user/password and the mailbox's SMTP settings (host, port, username, password) — you'll enter these as env vars in step 4.

### 4. Deploy the code and set environment variables

1. Get the project onto your Namecheap hosting — either connect a Git repo through cPanel's **Git Version Control** tool, or upload the files via **File Manager** / FTP.
2. In cPanel, under **Software**, open **Setup Node.js App**. Create the application, pointing "Application Root" at where you uploaded the project, and "Application Startup File" at `dist/server.cjs` (see step 5 for why — you'll build this next).
3. In that same app's **Environment Variables** section, click **Add Variable** for each of the following (see `.env.example` for the full annotated list):
   - `ADMIN_PASSWORD` — a strong password you choose; this is what gates the Admin Portal (no signup flow, you just pick it here)
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — from step 3
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — from step 3
   - `ADMIN_NOTIFICATION_EMAIL` — your own inbox, for new-submission/quote/claim alerts
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — from step 6 below
   - `APP_URL` — your live domain, e.g. `https://clearanestate.com`
4. Click **Run NPM Install** in the same screen (installs `mysql2`, `nodemailer`, `express-rate-limit`, `stripe`, etc. on the server).

### 5. Build for production

`server.ts` behaves differently depending on `NODE_ENV` — in production it serves the pre-built static site instead of running a live dev server, so skipping this step means the app runs in the wrong mode.

1. From the server's terminal (cPanel's Node.js App screen has a "Enter to the virtual environment" command you can copy/paste into SSH, or use cPanel's Terminal app), run `npm run build`. This bundles the server into `dist/server.cjs` and builds the frontend into `dist/`.
2. Confirm `NODE_ENV=production` is set — add it as another environment variable in step 4 if the Node.js App interface doesn't set it automatically.
3. Click **Restart App** in the Setup Node.js App screen so it picks up the build and all the env vars from step 4.

### 6. Register the Stripe webhook

The webhook code from item 4 above only fires if Stripe actually knows to call it:

1. In your [Stripe Dashboard](https://dashboard.stripe.com), go to **Developers** → **Webhooks** → **Add endpoint**.
2. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`.
3. Select events to listen for: `checkout.session.completed` and `customer.subscription.deleted` (the two events server.ts actually handles).
4. Save, then copy the **Signing secret** it gives you — that's your `STRIPE_WEBHOOK_SECRET` from step 4. Add/update it in cPanel's Environment Variables and restart the app.

### 7. Point your domain at this hosting and turn on HTTPS

1. In cPanel, open **General Information** (usually a sidebar widget on the main dashboard) and note your account's shared IP address.
2. In Namecheap, go to **Domain List** → your domain → **Manage** → **Advanced DNS**.
3. Add/edit an **A Record** for host `@` pointing to that IP address, and a **CNAME Record** for host `www` pointing to `@`.
4. Wait for DNS to propagate (usually under an hour, can take up to 24-48 hours).
5. Once the domain resolves to your hosting (visiting `http://yourdomain.com` loads the site), go to cPanel → **Security** → **SSL/TLS Status**, select your domain, and run **AutoSSL** to issue a free certificate.
6. In cPanel's **Domains** section, turn on **Force HTTPS Redirect** so `http://` visitors get bounced to `https://` automatically.
7. Confirm `https://yourdomain.com` loads with a valid padlock in the browser.

### 8. Set up MySQL backups

cPanel's automatic table-creation (this app creates its own tables on first run) means there's no manual schema setup, but you still need a backup plan for the actual data once real submissions start coming in:

1. In cPanel, look for **Backup** or **Backup Wizard** under Files (or **JetBackup** if your plan includes it — check with Namecheap support if unsure).
2. For a quick manual backup anytime: Backup Wizard → **Download a MySQL Database Backup** → select your database.
3. If JetBackup (or similar) is available, schedule recurring automated backups (daily is reasonable for a low-traffic directory) rather than relying on manual downloads.
4. Periodically download a copy somewhere off-server too (your own computer, cloud storage) — a backup that lives only on the same server doesn't help if that server has a problem.

### 9. Smoke test on the live site

Before calling it launched, actually click through each flow on `https://yourdomain.com` (not localhost):

- [ ] Submit a free listing → confirm it appears in Admin Portal's Pending Submissions tab, and you get an admin notification email
- [ ] Approve that submission → confirm it shows up in the live grid
- [ ] Request an estimate on a listing with a real email → confirm the business receives it and it shows in the Quote Requests tab
- [ ] Claim a listing with a matching-domain email → confirm instant approval; with a non-matching email → confirm it lands in Claim Requests for manual review
- [ ] Subscribe a listing to Featured via real Stripe checkout (use a real card or Stripe test mode first) → confirm the webhook marks it Featured after payment
- [ ] Log into the Admin Portal with your real password → confirm it works and that 10 wrong attempts locks you out temporarily
- [ ] Check the Legal page loads with your real business details, not placeholders

## Architecture notes

- Backend: Express (`server.ts`) + MySQL (`db.ts`, lazy pool, auto-creates tables) + SMTP (`mailer.ts`, nodemailer). All optional — the whole app gracefully falls back to the original localStorage/seed-data demo behavior if no database is configured, so local dev without MySQL still works.
- Admin routes require `x-admin-password` header matching `ADMIN_PASSWORD` env var.
- See `.env.example` for every environment variable needed (DB, SMTP, Stripe, admin password).
- Hosting target: Namecheap reseller hosting (cPanel "Setup Node.js App" / Passenger, MySQL + PostgreSQL both available).
