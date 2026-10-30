# Production setup

## 1. Supabase

Create a Supabase project in the region closest to your Vercel deployment and
Shopify customers.

### Database

Open SQL Editor and run:

```text
supabase/migrations/202610290001_initial_backend.sql
```

Run the whole migration in one operation. It creates the schema, accounting
functions, constraints, indexes, grants, and row-level security policies.

Copy these values from Project Settings → API:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Service role key → `SUPABASE_SERVICE_ROLE_KEY`

The service-role key bypasses RLS. It must exist only in server environment
variables and must never use a `NEXT_PUBLIC_` prefix.

### Google login

1. In Google Cloud Console, create an OAuth 2.0 Web application.
2. Add the Supabase callback shown under Authentication → Providers → Google
   as an authorized redirect URI. It normally looks like:
   `https://PROJECT_REF.supabase.co/auth/v1/callback`.
3. Paste the Google client ID and client secret into the Supabase Google
   provider settings.
4. In Supabase Authentication → URL Configuration:
   - Set the Site URL to the production Vercel URL.
   - Add `http://localhost:3000/auth/callback`.
   - Add `https://YOUR-VERCEL-DOMAIN/auth/callback`.
   - Add explicit preview URLs only when trusted testers need them.

Set `ADMIN_EMAILS` to a comma-separated list of owner accounts. On successful
Google callback, these exact normalized email addresses are assigned the admin
role. All other accounts start as pending influencers.

## 2. Shopify custom app

This app connects to one Shopify store. Create a custom app in Shopify Admin →
Settings → Apps and sales channels → Develop apps.

Request only these Admin API scopes:

- `read_products`
- `read_inventory`
- `read_orders`
- `write_discounts`

`read_all_orders` is not needed for live webhook attribution. Add it only if a
future historical backfill must read orders older than Shopify's standard
window.

Install the app on the store and copy:

- Store host, for example `example.myshopify.com`
- Client ID
- Client secret, also used to verify webhook HMAC signatures

Set them as:

```text
SHOPIFY_STORE_DOMAIN
SHOPIFY_CLIENT_ID
SHOPIFY_CLIENT_SECRET
SHOPIFY_API_VERSION=2026-10
```

The server uses Shopify's client-credentials grant to request a 24-hour Admin
API token and refreshes it before expiry. Do not request or persist a token in
the browser. Set `SHOPIFY_WEBHOOK_SECRET` only if Shopify has issued a webhook
signing secret different from the app client secret.

After production deployment:

1. Sign in as an admin.
2. Open Admin → Settings and check the integration status.
3. Sync products.
4. Register webhooks. The app subscribes the production endpoint to paid
   orders, refunds, and order cancellations.
5. Create an influencer promotion and assign one or more products.

Shopify sends order payloads that contain buyer information. The webhook
handler intentionally extracts only Shopify order IDs/references, dates,
currency, discount code, assigned line items, totals, and commission amounts.

## 3. Vercel

Create a new Vercel project from this directory. Framework detection should
select Next.js automatically.

Add every key from `.env.example` under Project Settings → Environment
Variables. Sensitive values should be marked sensitive and applied only to the
environments that need them.

Set:

```text
NEXT_PUBLIC_APP_URL=https://YOUR-VERCEL-DOMAIN
```

Currency, payout threshold, default discount, and branding are stored in
Supabase and managed from the admin Settings page.

Next.js does not automatically load a file named `.env.prod`. Its standard
local production file is `.env.production.local`, but Vercel's encrypted
environment settings are safer and are the production source of truth.

Deploy, then update Supabase's Site URL and OAuth allow list if the final
production domain differs from the initial one.

## 4. Acceptance test

Use a low-value test product:

1. Influencer signs in with Google and submits onboarding.
2. Admin approves the influencer.
3. Admin creates a unique code, selects the test product, records cost, chooses
   a commission basis, and sets the commission percentage.
4. Complete a Shopify order using that code.
5. Confirm the order appears once in both dashboards without buyer details.
6. Confirm commission agrees with the chosen basis.
7. Partially refund one unit and confirm a reversing ledger entry appears.
8. Temporarily lower the payout threshold, request payout, record it with a
   reference, and confirm available earnings decrease without deleting history.
9. Restore the production payout threshold.

## 5. Secret rotation

If a server credential is exposed:

1. Rotate it at Shopify or Supabase immediately.
2. replace it in Vercel for all affected environments.
3. Redeploy.
4. Review the admin audit log and webhook events.

Changing the Shopify app secret also changes the default webhook signing secret
and requires a redeploy.
