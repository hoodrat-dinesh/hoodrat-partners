# Security policy

## Sensitive data

Never commit or paste into client-side code:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_WEBHOOK_SECRET`

Only variables prefixed with `NEXT_PUBLIC_` are intended for the browser.

This application does not persist buyer identity or contact details. If a
change adds a Shopify webhook field to the database, verify first that it is
not a name, email, phone number, customer ID, address, note, or IP address.

## Dependency policy

Dependencies are kept small and pinned to stable releases. Before deploying:

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run typecheck
npm test
npm run build
```

Do not bypass an organizational package firewall to install a blocked package.
Review the package, advisory, and provenance, then have it approved or replace
it.

## Authorization policy

- RLS is a second enforcement layer, not a replacement for server checks.
- Every admin API must verify an authenticated `admin` profile.
- Every influencer read must be scoped to the authenticated profile ID.
- Supabase service-role access is reserved for signed Shopify webhooks and
  narrowly scoped server administration.
- Promotion, commission, adjustment, and payout changes must leave an audit
  record.

## Reporting

For a private deployment, report vulnerabilities directly to the company
owner. Include the affected route, expected impact, and a minimal reproduction.
Do not include live credentials or buyer data in the report.
