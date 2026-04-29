const STRIPE_API_BASE = "https://api.stripe.com/v1";
const ALLOWED_MONTHS = new Set(["3", "6", "12", "ongoing"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (url.pathname === "/create-monthly-donation" && request.method === "POST") {
        return await createMonthlyDonation(request, env);
      }

      if (url.pathname === "/stripe-webhook" && request.method === "POST") {
        return await handleStripeWebhook(request, env);
      }

      if (url.pathname === "/health") {
        return json({ ok: true }, request, env);
      }

      return json({ error: "Not found" }, request, env, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "Unable to create donation checkout." }, request, env, 500);
    }
  },
};

async function createMonthlyDonation(request, env) {
  const body = await request.json();
  const amount = Number(body.amount);
  const months = String(body.months || "");

  if (!Number.isFinite(amount) || amount < 5 || amount > 10000) {
    return json({ error: "Enter a monthly amount between $5 and $10,000." }, request, env, 400);
  }

  if (!ALLOWED_MONTHS.has(months)) {
    return json({ error: "Choose a valid plan length." }, request, env, 400);
  }

  const amountInCents = Math.round(amount * 100);
  const productName = donationProductName(months);
  const checkoutMessage = donationCheckoutMessage(months);
  const siteOrigin = env.SITE_ORIGIN || "https://cepamd.org";
  const successUrl = `${siteOrigin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteOrigin}/recurring.html?canceled=1`;

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("submit_type", "donate");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amountInCents));
  params.set("line_items[0][price_data][product_data][name]", productName);
  params.set("line_items[0][price_data][recurring][interval]", "month");
  params.set("line_items[0][quantity]", "1");
  params.set("custom_text[submit][message]", checkoutMessage);
  params.set("metadata[cepa_duration_months]", months);
  params.set("metadata[cepa_monthly_amount_cents]", String(amountInCents));
  params.set("subscription_data[metadata][cepa_duration_months]", months);
  params.set("subscription_data[metadata][cepa_monthly_amount_cents]", String(amountInCents));

  const session = await stripeRequest(env, "/checkout/sessions", {
    method: "POST",
    body: params,
  });

  return json({ url: session.url }, request, env);
}

function donationProductName(months) {
  if (months === "ongoing") {
    return "CEPA ongoing monthly donation";
  }

  return `CEPA monthly donation — ${months} monthly payments`;
}

function donationCheckoutMessage(months) {
  if (months === "ongoing") {
    return "You selected an ongoing monthly donation. You can cancel anytime by contacting CEPA.";
  }

  return `You selected ${months} monthly payments. CEPA will set this subscription to cancel automatically after ${months} monthly charges.`;
}

async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const event = await verifyStripeEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);

  if (event.type === "checkout.session.completed") {
    await scheduleFixedDurationSubscription(event.data.object, env);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function scheduleFixedDurationSubscription(session, env) {
  const months = session.metadata?.cepa_duration_months;

  if (!months || months === "ongoing" || !ALLOWED_MONTHS.has(months)) {
    return;
  }

  if (!session.subscription) {
    throw new Error("Checkout session completed without a subscription ID.");
  }

  const subscription = await stripeRequest(env, `/subscriptions/${session.subscription}`, {
    method: "GET",
  });

  const firstPeriodStart = subscription.current_period_start;
  const cancelAt = addUtcMonths(firstPeriodStart, Number(months));

  const params = new URLSearchParams();
  params.set("cancel_at", String(cancelAt));
  params.set("proration_behavior", "none");
  params.set("metadata[cepa_cancel_after_payments]", months);
  params.set("metadata[cepa_cancel_at]", String(cancelAt));

  await stripeRequest(env, `/subscriptions/${session.subscription}`, {
    method: "POST",
    body: params,
  });
}

async function stripeRequest(env, path, init) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(init.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Stripe request failed.");
  }

  return data;
}

async function verifyStripeEvent(payload, signature, webhookSecret) {
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );

  if (!parts.t || !parts.v1) {
    throw new Error("Invalid Stripe signature header.");
  }

  const signedPayload = `${parts.t}.${payload}`;
  const expected = await hmacSha256(webhookSecret, signedPayload);

  if (!timingSafeEqual(expected, parts.v1)) {
    throw new Error("Invalid Stripe webhook signature.");
  }

  return JSON.parse(payload);
}

async function hmacSha256(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function addUtcMonths(unixSeconds, months) {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);

  return Math.floor(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds) / 1000);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set([
    env.SITE_ORIGIN || "https://cepamd.org",
    "https://www.cepamd.org",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
  ]);
  const allowOrigin = allowed.has(origin) ? origin : env.SITE_ORIGIN || "https://cepamd.org";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin",
  };
}

function json(data, request, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request, env),
    },
  });
}
