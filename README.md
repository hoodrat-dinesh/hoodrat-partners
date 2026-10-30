# Influencer Revshare

A secure influencer revenue-share portal for a Shopify store. Influencers sign
in with Google, complete an Instagram-first profile, receive an approved
promotion code and product assignments, and see privacy-safe earnings and
payout history. Admins control approvals, commissions, products, branding, and
payouts.

## Stack

- Next.js 16 App Router + TypeScript
- Supabase Auth and Postgres with row-level security
- Shopify Admin GraphQL API and signed webhooks
- Tailwind CSS 4
- Vitest
- Vercel

All money is stored as integer minor units (paise for INR). Buyer names, email,
phone numbers, and shipping addresses are never persisted.

## Local setup

Requirements: Node.js 24+, a Supabase project, a Shopify store with a custom
app, and a Google OAuth client.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `.env.local`. Set `ADMIN_EMAILS` to the Google accounts that should
   become administrators.

4. In the Supabase SQL editor, run
   `supabase/migrations/202610290001_initial_backend.sql`.

5. Configure Google OAuth in Supabase and add these redirect URLs:

   - `http://localhost:3000/auth/callback`
   - `https://YOUR-VERCEL-DOMAIN/auth/callback`

6. Start the app:

   ```bash
   npm run dev
   ```

7. Sign in with an address from `ADMIN_EMAILS`, then open `/admin/settings`.
   Sync Shopify products and register webhooks from the integration controls.

See [docs/SETUP.md](docs/SETUP.md) for the complete Supabase, Shopify, and
Vercel instructions.

## Scripts

```bash
npm run dev        # local development
npm run lint       # ESLint
npm run typecheck  # strict TypeScript check
npm test           # unit and integration tests
npm run build      # production build
```

## Environment files

Use `.env.local` for local development. Vercel should receive the same values
through Project Settings → Environment Variables. Do not commit `.env.prod`,
`.env.production`, service-role keys, or Shopify client credentials.

The browser receives only variables prefixed with `NEXT_PUBLIC_`. Supabase's
service-role key, Shopify client secret, and webhook secret stay server-side.
Shopify client credentials are exchanged for a short-lived Admin API token by
the server.

## Core accounting rules

- An order is attributed only when Shopify reports one of this platform's
  active discount codes.
- Only assigned products in that order earn commission.
- `net_revenue` commissions use the discounted line revenue.
- `gross_margin` commissions use
  `max(discounted line revenue - product cost × quantity, 0)`.
- Refunds write reversing ledger entries; history is never overwritten.
- A payout request is allowed only when available earnings meet the configured
  threshold (₹2,000 by default).
- Recording a payout creates a ledger debit and preserves the payout reference
  and administrator audit trail.

## Security model

- Google OAuth uses the PKCE flow and server-managed cookies.
- Every protected server mutation verifies the authenticated user's role.
- Supabase RLS is enabled for every exposed table with least-privilege grants.
- Shopify webhook signatures are checked against the raw request body before
  processing.
- Shopify webhook delivery IDs and object IDs provide idempotency.
- Admin and influencer route shells are separate; influencers can read only
  their own orders, earnings, and payouts.

## Deployment

Import this directory into Vercel, set all environment variables for Production
and Preview, and deploy. Next.js does not require a custom `vercel.json`.
Point Shopify webhook subscriptions at:

```text
https://YOUR-VERCEL-DOMAIN/api/webhooks/shopify
```

After deployment, run the integration setup from the admin panel and place a
small test order with a generated promotion code. Refund that order as a second
end-to-end test.

## Product scope

The implementation and deliberate v1 trade-offs are documented in
[docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md). The runtime and accounting flows
are described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
