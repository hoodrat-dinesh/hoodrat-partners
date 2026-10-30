import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/202610290001_initial_backend.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const webhookRoute = readFileSync(
  path.join(process.cwd(), "src/app/api/webhooks/shopify/route.ts"),
  "utf8",
);

function tableDefinition(table: string): string {
  const start = migration.indexOf(`create table public.${table}`);
  const end = migration.indexOf("\n);", start);
  expect(start, `${table} should exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${table} should have a closing definition`).toBeGreaterThan(start);
  return migration.slice(start, end).toLowerCase();
}

describe("database privacy boundaries", () => {
  it("does not persist Shopify buyer identity in attributed order tables", () => {
    const orderProjection = [
      tableDefinition("attributed_orders"),
      tableDefinition("attributed_order_lines"),
    ].join("\n");

    for (const prohibitedField of [
      "customer_id",
      "buyer",
      "email",
      "phone",
      "shipping_address",
      "billing_address",
      "ip_address",
      "browser_ip",
    ]) {
      expect(orderProjection).not.toContain(prohibitedField);
    }
  });

  it("enables row-level security on every exposed financial table", () => {
    for (const table of [
      "profiles",
      "platform_settings",
      "products",
      "promotions",
      "promotion_products",
      "webhook_events",
      "attributed_orders",
      "attributed_order_lines",
      "commission_ledger",
      "payout_requests",
      "audit_log",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("keeps the commission ledger immutable", () => {
    expect(migration).toContain("create trigger commission_ledger_immutable");
    expect(migration).toContain("raise exception 'commission ledger entries are immutable'");
  });

  it("deduplicates on Shopify delivery IDs and treats event IDs as correlation", () => {
    expect(migration).toContain("webhook_delivery_id text primary key");
    expect(webhookRoute).toContain('request.headers.get("x-shopify-webhook-id")');
    expect(webhookRoute).toContain('request.headers.get("x-shopify-event-id")');
    expect(webhookRoute).toContain("p_webhook_delivery_id: webhookId");
    expect(webhookRoute).toContain("p_correlation_id: eventId");
  });

  it("does not reverse commission when an order is cancelled", () => {
    const cancellation = migration.slice(
      migration.indexOf("create function public.process_shopify_cancellation"),
      migration.indexOf("create function public.replace_promotion_products"),
    );
    expect(cancellation).not.toContain("insert into public.commission_ledger");
    expect(cancellation).toContain("set status = 'cancelled'");
  });
});
