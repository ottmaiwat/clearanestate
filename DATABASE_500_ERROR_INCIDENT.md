# Incident Report: ClearAnEstate.com 500 Errors (August 2026)

## Summary
The admin portal and most non-root pages on clearanestate.com were returning 500
errors. Root cause turned out to be **three separate, stacked bugs** — an Apache
`.htaccess` misconfiguration, a stale in-memory database connection pool, and a
JSON double-parsing bug in the app code. All three were found and fixed in this
session.

Host: Namecheap shared hosting (cPanel), account `clearanest`, server `host43`.
App: Node.js/Express, served via CloudLinux Passenger, MySQL database.

---

## Root Cause #1: Apache internal redirect loop (`.htaccess`)

**Symptom:** Every URL except the literal root `/` returned an Apache-level 500
(not a JSON/Express error — confirmed the request never reached Node).

**Diagnosis:** Namecheap support found this in server logs:
> "Request exceeded the limit of 10 internal redirects due to probable
> configuration error."

The live `.htaccess` had a manual rule appended below the standard CloudLinux
Passenger block:

```apache
# Route all dynamic application routes to Passenger
RewriteRule ^(.*)$ /home/clearanest/repositories/clearanestate/dist/server.cjs/$1 [QSA,L]
```

This rule was redundant (Passenger's own `PassengerBaseURI "/"` config already
routes all requests to the app) and self-referential — because it lacked the `R`
(external redirect) flag, Apache re-ran the rewrite cycle on its own output,
matching itself again and again until hitting the internal redirect ceiling.

Root `/` worked because it resolved to a physical directory, which an earlier
rule (`-d` check) caught and stopped before reaching the broken rule.

**Fix:** Removed the offending `RewriteRule` block (2 lines) from
`/home/clearanest/public_html/.htaccess`. Backup was saved as
`.htaccess.bak` (since deleted after confirming the fix worked).

**File:** `/home/clearanest/public_html/.htaccess`

---

## Root Cause #2: Stale database connection pool

**Symptom:** After fixing #1, most pages worked, but `/api/admin/pending`
still returned 500.

**Diagnosis:** The app's `getPool()` function caches the MySQL connection pool
in a module-level variable the first time it's created:

```js
function getPool() {
  if (!pool) {
    // ...builds config from env vars (DB_SOCKET, DB_HOST, etc.)...
    pool = mysql.createPool(config);
  }
  return pool;
}
```

Environment variables (`DB_SOCKET`, `DB_HOST`, etc., set via cPanel's Node.js
App Manager) are only read once, at process startup. If the Node process had
been running since before some environment/config changes, it could be holding
a pool built from stale settings — and would never pick up corrected values
without a full restart.

**Fix:** Did a full **Stop App → Start App** cycle in cPanel's Node.js selector
(a plain "Restart" was previously found to be unreliable — it sometimes left
the same PID running). This forces a brand new process with a freshly-built
pool from current env vars.

**Where to check/set env vars:** cPanel → Node.js App Manager →
clearanestate.com app → "Environment variables" section. Current DB-related
vars: `DB_SOCKET=/tmp/mysql.sock`, `DB_HOST=localhost`, `DB_NAME=clearanest_db`,
`DB_USER=clearanest_clearanest`, `DB_PASSWORD=(rotate this — see below)`.

**Takeaway for future DB issues:** If you change any DB-related environment
variable in cPanel, you must Stop/Start the Node app afterward — editing the
variable alone does not affect the already-running process.

---

## Root Cause #3: JSON double-parsing bug

**Symptom:** After fixing #1 and #2, `/api/admin/pending` still failed, now with
a genuine application error: `"Unexpected token 'E', \"Estate Cle\"... is not
valid JSON"`.

**Diagnosis:** The `services` column in both the `pending_submissions` and
`listings` tables is declared as native MySQL `JSON` type:

```sql
CREATE TABLE ... ( ... services JSON, ... )
```

The `mysql2` driver automatically deserializes `JSON`-typed columns into real
JavaScript arrays/objects when queried. But the code in `rowToPending()` and
`rowToListing()` assumed it was still a raw string and called `JSON.parse()`
on it again:

```js
services: row.services ? JSON.parse(row.services) : [],
```

Since `row.services` was already an array, JavaScript coerced it to a string
first (e.g. `["Estate Cleanout","Property Clearing"]` → `"Estate
Cleanout,Property Clearing"`), and `JSON.parse` choked on the very first
character.

**Fix:** Updated both occurrences to handle either case safely:

```js
services: Array.isArray(row.services)
  ? row.services
  : (typeof row.services === "string" && row.services ? JSON.parse(row.services) : []),
```

**File:** `server.ts` (lines ~246 and ~275 — search for `row.services` to relocate)

**Also fixed along the way (unrelated but found during this session):**
- Removed Express HTTPS redirect middleware to let cPanel/Apache handle SSL
  termination instead (was causing potential redirect conflicts).
- Updated database connection logic in `db.ts` to support Unix socket
  connections (`DB_SOCKET` env var) in addition to TCP, required for Namecheap
  shared hosting CageFS isolation.

---

## Follow-up items (not yet done)

1. **Rotate credentials.** `ADMIN_PASSWORD`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`,
   and `SMTP_PASSWORD` were all exposed in a screenshot shared with Namecheap
   support, and were also visible in cPanel's Node.js env variable UI and in
   terminal commands run during this session. Rotate all four when
   convenient, then update them in cPanel's Node.js App Manager environment
   variables (and Stop/Start the app afterward — see Root Cause #2).
2. **Send closing note to Namecheap** (if not already sent) to close out the
   support ticket and thank them for the investigation work.
3. Spot-check the public listings page for any listing with `services` data,
   since Root Cause #3 affected `rowToListing()` too.

---

## Quick reference for future DB debugging on this app

- DB connection settings live in cPanel → Node.js App Manager → environment
  variables (not in `.htaccess` — Namecheap mistakenly suggested cleaning that
  up, but the real config is in the Node app manager).
- To test the DB connection directly against the app's actual logic, reuse the
  `getPool()` config pattern from `db.ts` in a throwaway script rather than
  guessing — delete the script afterward (it will contain the DB password).
- After any env var change in cPanel, always do a full **Stop App → Start
  App**, not just Restart — Restart was observed to sometimes leave the old
  process running unchanged.
- Apache-level 500s (plain HTML error page, `server: Apache`, no JSON body)
  mean the request never reached Node — check `.htaccess` first. App-level
  500s (JSON body with `x-powered-by: Express`) mean the request reached the
  app — check application code/logs next.
- On shared hosting with CageFS, MySQL connections must use Unix socket
  (`DB_SOCKET=/var/lib/mysql/mysql.sock` or similar) not TCP (`DB_HOST` +
  `DB_PORT`), as incoming port 3306 connections are blocked by CageFS.
