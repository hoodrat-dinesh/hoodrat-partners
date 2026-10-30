# Product gap analysis

This document records requirements that are easy to miss in an influencer
commerce product and the decision made for this implementation.

## Included in v1

### Identity and access

- Google-only sign-in through Supabase PKCE.
- Separate influencer and admin roles, protected in server code and Postgres
  RLS.
- Pending, approved, rejected, and suspended account states.
- First-admin bootstrap through an explicit email allowlist.
- Influencer onboarding with full name, Instagram handle, follower count, and
  optional UPI ID.
- Versioned program-terms acceptance recorded at onboarding.
- Admin audit log for material actions.

### Shopify and attribution

- One custom Shopify app connected to one store.
- Product catalog sync from Shopify.
- Unique promotion code per influencer with a fixed customer discount.
- Product-level commission rate, product cost, and commission basis.
- Signed paid-order, refund, and cancellation webhooks.
- Idempotent event and order handling.
- Attribution only for the assigned products on an order using the code.
- No persisted buyer name, email, phone, address, or Shopify customer record.

### Earnings and payouts

- Integer minor-unit accounting; no floating-point currency math.
- Append-only commission ledger for earnings, refunds, adjustments, and
  payouts.
- Available, pending, lifetime earned, and paid totals.
- Partial-refund reversals.
- Configurable ₹2,000 default payout threshold.
- Influencer payout requests and admin-paid/rejected workflow.
- Admin payout reference, notes, actor, and timestamp.
- Product-level potential earning estimate.

### Operations and presentation

- Responsive influencer and admin dashboards.
- Searchable operational records and clear empty/error states.
- Configurable name, logo, tagline, support email, colors, discount, currency,
  and payout threshold.
- Health/configuration endpoint that never exposes secrets.
- Shopify setup and product-sync controls.

## Decisions added to close ambiguity

### What “revenue share” means

Products support two explicit bases:

- **Net revenue:** commission is a percentage of discounted product revenue.
- **Gross margin:** commission is a percentage of discounted product revenue
  after subtracting configured product cost.

Shipping, tax, tips, duties, and unassigned products do not earn commission.
This avoids silently changing economics when the store's tax or shipping rules
change.

### Refunds, cancellations, and pending earnings

Paid orders create earnings. Refunds create separate negative entries instead
of editing history. A cancellation changes order status but does not reverse
money by itself; Shopify's refund event is the financial source of truth. This
prevents a cancellation plus refund from deducting twice.

For businesses with a long return window, add an admin-configurable
`hold_days` before earnings become withdrawable. The schema and UI distinguish
pending from available amounts so this can be enabled without rewriting order
history.

### Coupon leakage

Shopify discount codes can be shared outside the influencer's audience. v1
attributes by code, which is deterministic but cannot prove who shared it. If
leakage becomes material, add:

- campaign-specific landing links with first-party click IDs;
- per-customer usage limits or customer-segment restrictions;
- anomaly flags for sudden geographic or volume changes;
- code rotation without deleting historical attribution.

### Payout destination and compliance

v1 records an optional UPI ID and a manual payout reference. Before paying at
meaningful scale, decide and document:

- whether influencers are vendors/contractors under local law;
- GST/TDS and invoice requirements;
- identity/KYC requirements;
- who may view or change payout details;
- retention and deletion periods.

Do not add bank account data until an encrypted payment provider and operating
policy are selected.

## Recommended next-stage additions

These are intentionally not automatic v1 features because they require a
business or provider decision.

1. **Return-window hold:** make commission withdrawable only after a selected
   number of days.
2. **Automated payouts:** RazorpayX, Cashfree, or another approved provider,
   with KYC, idempotent transfers, and reconciliation.
3. **Click attribution:** short links and UTM/click IDs for funnel reporting,
   while preserving code attribution as the financial authority.
4. **Tax exports:** monthly influencer statement, invoice status, and
   accountant-ready CSV.
5. **Notifications:** approval, threshold reached, payout status, and promotion
   changes through a transactional email provider.
6. **Webhook reconciliation:** a scheduled Shopify query that finds missed paid
   orders after an outage. Shopify webhooks are retried, but an independent
   reconciliation lane is the safer accounting control.
7. **Multi-store support:** store-scoped credentials and records if the company
   operates more than one Shopify store.
8. **Approval policy:** documented follower-quality checks and rejection
   reasons to keep admin decisions consistent.
9. **Data lifecycle:** self-service profile deletion, legal retention rules,
   and anonymized analytics.
10. **Observability:** alerts for webhook verification failures, processing
    errors, stale product sync, and balance invariants.

## Launch gates

Do not launch real payouts until all of these pass:

- A paid test order attributes exactly once.
- Partial and full refunds reverse the correct commission.
- An influencer cannot access another influencer's records by URL or API.
- A non-admin cannot call any admin mutation.
- Buyer PII is absent from the database and application logs.
- Payout recording cannot overdraw available earnings.
- Shopify and Supabase secrets exist only in server-side Vercel settings.
- The company has approved the revenue-share definition, return policy, payout
  method, and tax treatment.
