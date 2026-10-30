# Architecture

## Runtime boundaries

The application is one Next.js deployment. Browser components contain only
presentation and Supabase's publishable key. Server Components, route handlers,
and server-side utilities own authorization, Shopify calls, service-role
database access, and accounting mutations.

Supabase provides:

- Google identity and rotating cookie sessions;
- Postgres persistence;
- row-level security for user-scoped reads;
- transactional functions for order attribution and payouts.

Shopify provides:

- the product catalog;
- customer-facing discount codes;
- paid-order, refund, and cancellation events.

Vercel runs the Next.js application and stores production secrets.

## Authentication flow

1. The browser starts Google OAuth through Supabase using PKCE.
2. Google returns through Supabase to `/auth/callback`.
3. The callback exchanges the authorization code for a cookie session.
4. A profile is created by the database trigger if one does not exist.
5. Emails listed in `ADMIN_EMAILS` are promoted server-side.
6. The Next.js proxy refreshes sessions, while each protected page and API
   performs its own role/status authorization.

The proxy is an optimization for session continuity, not the authorization
authority.

## Promotion flow

1. Admin syncs Shopify products.
2. Admin selects an approved influencer, unique code, discount percentage, and
   products.
3. Each product gets a commission percentage, cost, and commission basis.
4. The server creates the matching Shopify code through Admin GraphQL.
5. The local promotion becomes active only after Shopify returns a discount ID.

## Order flow

1. Shopify sends `orders/paid` to the webhook route.
2. The route verifies HMAC against the untouched request bytes.
3. `X-Shopify-Webhook-Id` is reserved in `webhook_events`; a duplicate exits
   safely. `X-Shopify-Event-Id` is retained only for correlation.
4. The discount code is matched case-insensitively to one active promotion.
5. Assigned lines are converted to integer minor units.
6. Postgres writes the attributed order, lines, and commission ledger entries
   transactionally.
7. Influencer and admin dashboards read the privacy-safe local projection.

No dashboard reads Shopify's customer object.

## Refund flow

Refund events reference the original Shopify order and refunded lines. The
transaction computes the commission attributable to the refunded quantity or
amount and appends a negative ledger entry. Replayed refund events are ignored.
Historical earnings remain visible.

An order cancellation changes status only. Refund events control financial
reversal to prevent a double deduction.

## Payout flow

1. Available balance is computed from finalized ledger entries less reserved
   payout requests.
2. The influencer requests an amount at or above the configured threshold and
   not above available balance.
3. Postgres creates the request and reserves the amount in one transaction.
4. Admin pays externally and records a reference.
5. The paid transition appends a payout debit and audit entry atomically.
6. Rejecting/cancelling releases the reservation without deleting history.

## Accounting invariants

- Money is integer minor units.
- Commission percentages are constrained to sensible ranges.
- One Shopify webhook delivery ID can be processed once.
- One paid order can be attributed once.
- One payout request can be marked paid once.
- A payout cannot exceed the available unreserved balance.
- Refund and payout entries are append-only reversals/debits.
- Product cost cannot make gross-margin commission negative.

## Privacy boundaries

Persisted order records may contain:

- Shopify order ID and display reference;
- processing date and currency;
- assigned product IDs/titles, quantity, and financial totals;
- promotion code and calculated commission;
- financial status.

They must not contain:

- buyer/customer ID;
- name, email, or phone;
- billing or shipping address;
- order note;
- IP address or browser metadata.

## Runtime route contract

- `POST /api/auth/google` starts Google OAuth.
- `POST /api/auth/signout` clears the Supabase session.
- `PUT /api/onboarding` completes influencer onboarding.
- `PATCH /api/profile` updates influencer profile fields.
- `POST /api/payouts/request` creates a reserved payout request.
- `PUT /api/settings` updates branding and economics for admins.
- `POST /api/admin/users/[id]/status` changes influencer approval state.
- `POST /api/admin/promotions` creates a promotion.
- `PATCH /api/admin/promotions/[id]` updates or pauses a promotion.
- `POST /api/admin/products/sync` syncs the Shopify catalog.
- `POST /api/admin/shopify/webhooks/setup` idempotently configures webhooks.
- `POST /api/admin/payouts/[id]/record` records a paid request.
- `POST /api/admin/payouts/[id]/reject` rejects a request with notes.
- `POST /api/webhooks/shopify` receives signed Shopify deliveries.
