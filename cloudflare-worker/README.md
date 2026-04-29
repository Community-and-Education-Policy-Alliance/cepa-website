# CEPA Donations Cloudflare Worker

This Worker creates Stripe Checkout Sessions for monthly CEPA donations from the static GitHub Pages site.

## Required Secrets

Set these in Cloudflare:

- `STRIPE_SECRET_KEY`: Stripe secret key for the CEPA account.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the Worker webhook endpoint.

## Routes

- `POST /create-monthly-donation`: accepts `{ "amount": 50, "months": "6" }` and returns a Stripe Checkout URL.
- `POST /stripe-webhook`: receives Stripe events. On `checkout.session.completed`, fixed-duration plans are scheduled to cancel after the selected number of monthly payments.
- `GET /health`: basic health check.

## Deploy

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Set secrets:

   ```bash
   wrangler secret put STRIPE_SECRET_KEY
   wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

3. Deploy:

   ```bash
   wrangler deploy
   ```

4. In Cloudflare, attach the Worker to a custom domain:

   ```text
   donations.cepamd.org
   ```

5. In Stripe, add a webhook endpoint pointing to:

   ```text
   https://donations.cepamd.org/stripe-webhook
   ```

   Subscribe it to `checkout.session.completed`.

6. Confirm `DONATION_API_URL` in `recurring.html` matches the deployed Worker URL:

   ```js
   const DONATION_API_URL = "https://donations.cepamd.org/create-monthly-donation";
   ```
