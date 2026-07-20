# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Donation website for CEPA (Community and Education Policy Alliance), a nonprofit funding the legal appeal against the closure of Wootton High School. Two parts:

1. **Static site** (repo root) — plain HTML/CSS, no build step, no package manager, no framework. Deployed via GitHub Pages to `https://cepamd.org` (custom domain set in `CNAME`). Pages: `index.html` (main donation page), `recurring.html` (monthly giving form), `thank-you.html` (post-checkout redirect). Shared styles in `css/style.css`; small page-specific inline styles are acceptable and already common.
2. **Cloudflare Worker** (`cloudflare-worker/`) — `src/worker.js` creates Stripe Checkout Sessions for monthly donations and handles Stripe webhooks. Deployed separately with Wrangler; not part of the Pages deploy.

Do not introduce a build system, JavaScript framework, or dependency manager. Keep the site lightweight and static.

## Commands

- `python3 -m http.server 8000` — serve the site locally at http://localhost:8000 (the Worker's CORS allowlist already permits localhost:8000).
- Worker deploy (from `cloudflare-worker/`): copy `wrangler.toml.example` to `wrangler.toml` (gitignored), then `wrangler deploy`. Secrets: `wrangler secret put STRIPE_SECRET_KEY` and `wrangler secret put STRIPE_WEBHOOK_SECRET`.

There is no automated test suite or linter. Validate changes manually in a browser at desktop and mobile widths; confirm donation links work and images load.

## How the donation flow works

- The donation form is embedded in `index.html` (`#donate` section): preset amounts or custom amount, a one-time/monthly frequency toggle (monthly reveals plan-length options), and an optional note field (used for the alumni class-year challenge). Inline JS POSTs `{ amount, frequency, months?, note? }` to the Worker's `/create-donation` endpoint and redirects the donor to the returned Stripe Checkout URL. The Worker URL is hardcoded as `DONATION_API_URL` in `index.html` — currently `https://damp-bird-b203.cepamd.workers.dev/...` (the `donations.cepamd.org` custom domain mentioned in `cloudflare-worker/README.md` is not what's live). If the Worker is redeployed elsewhere, update this constant. `recurring.html` is now just a redirect to `/#donate` (kept because old emails link to it); the Worker's legacy `/create-monthly-donation` endpoint is kept for cached pages.
- `months` is one of `"3" | "6" | "12" | "ongoing"` (validated in the Worker against `ALLOWED_MONTHS`). Fixed-duration plans work via metadata: the Checkout Session and subscription carry `cepa_duration_months`, and the Worker's `/stripe-webhook` handler (on `checkout.session.completed`) sets `cancel_at` on the subscription so it stops after the selected number of monthly charges. The optional note travels as `cepa_note` metadata on the session and the payment intent (one-time) or subscription (monthly). Stripe checkout success redirects to `thank-you.html`; cancel returns to `/?canceled=1#donate`.
- Deploy order matters when the form contract changes: deploy the Worker (`wrangler deploy`) before pushing site changes that depend on new endpoints/fields.
- The Worker calls the Stripe REST API directly with `fetch` (form-encoded params, no Stripe SDK) and verifies webhook signatures manually via HMAC-SHA256. Allowed site origins for CORS are listed in `corsHeaders()` in `worker.js`.

## Conventions

- Two-space indentation in HTML and CSS. Semantic sections and descriptive class names (`.donate-grid`, `.donate-card`, `.match-banner`).
- Lowercase hyphenated filenames for new assets/pages (e.g. `annual-report.html`).
- External links use `target="_blank" rel="noopener"`.
- Commit subjects are short and imperative (e.g. "Add CEPA board members").
- If you change the public message or primary image, also update the Open Graph / Twitter card metadata in `index.html`.
- Changes to donation wording, legal language, or payment URLs are sensitive — call them out explicitly for review.
