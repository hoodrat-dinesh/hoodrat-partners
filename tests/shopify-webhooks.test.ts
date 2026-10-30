import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseOrderWebhook,
  parseRefundWebhook,
  verifyShopifyDomain,
  verifyShopifyHmac,
} from "@/lib/shopify/webhooks";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
  process.env.SHOPIFY_CLIENT_SECRET = "client-secret-for-tests";
  delete process.env.SHOPIFY_WEBHOOK_SECRET;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Shopify webhook boundaries", () => {
  it("verifies the raw body with the client-secret fallback", () => {
    const raw = Buffer.from('{"id":123,"line_items":[]}');
    const signature = createHmac("sha256", "client-secret-for-tests")
      .update(raw)
      .digest("base64");

    expect(() => verifyShopifyHmac(raw, signature)).not.toThrow();
    expect(() =>
      verifyShopifyHmac(Buffer.from('{"id":124}'), signature),
    ).toThrow("Invalid Shopify HMAC");
  });

  it("honors a separately configured webhook secret", () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = "separate-webhook-secret";
    const raw = Buffer.from('{"id":123}');
    const signature = createHmac("sha256", "separate-webhook-secret")
      .update(raw)
      .digest("base64");
    expect(() => verifyShopifyHmac(raw, signature)).not.toThrow();
  });

  it("rejects deliveries from another shop domain", () => {
    expect(() => verifyShopifyDomain("test-store.myshopify.com")).not.toThrow();
    expect(() => verifyShopifyDomain("other-store.myshopify.com")).toThrow(
      "does not match",
    );
  });

  it("normalizes only attribution-safe paid-order fields", () => {
    const order = parseOrderWebhook({
      id: 1001,
      admin_graphql_api_id: "gid://shopify/Order/1001",
      currency: "inr",
      discount_codes: [{ code: "maya15" }],
      line_items: [
        {
          id: 2001,
          product_id: 3001,
          quantity: 2,
          price: "199.50",
          total_discount: "20.00",
        },
      ],
      email: "must-not-be-read@example.com",
      customer: { id: 999 },
    });

    expect(order).toEqual({
      shopifyOrderId: "1001",
      shopifyOrderGid: "gid://shopify/Order/1001",
      currency: "INR",
      discountCodes: ["MAYA15"],
      lines: [
        {
          shopifyLineId: "2001",
          shopifyProductGid: "gid://shopify/Product/3001",
          title: "Product",
          quantity: 2,
          unitPriceMinor: 19_950,
          discountMinor: 2_000,
        },
      ],
    });
  });

  it("normalizes refund line identifiers and quantities", () => {
    expect(
      parseRefundWebhook({
        id: 5001,
        order_id: 1001,
        refund_line_items: [
          { id: 6001, line_item_id: 2001, quantity: 1 },
        ],
      }),
    ).toEqual({
      shopifyRefundId: "5001",
      shopifyOrderId: "1001",
      lines: [
        {
          shopifyRefundLineId: "6001",
          shopifyLineId: "2001",
          quantity: 1,
        },
      ],
    });
  });
});
