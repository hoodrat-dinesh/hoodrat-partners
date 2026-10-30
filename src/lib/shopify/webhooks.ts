import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";
import { getShopifyWebhookEnv } from "@/lib/env";

interface ShopifyDiscountCode {
  code?: unknown;
}

interface ShopifyOrderLine {
  id?: unknown;
  product_id?: unknown;
  title?: unknown;
  quantity?: unknown;
  price?: unknown;
  total_discount?: unknown;
}

interface ShopifyOrderPayload {
  id?: unknown;
  admin_graphql_api_id?: unknown;
  currency?: unknown;
  discount_codes?: unknown;
  line_items?: unknown;
  cancelled_at?: unknown;
}

interface ShopifyRefundLine {
  id?: unknown;
  line_item_id?: unknown;
  quantity?: unknown;
}

interface ShopifyRefundPayload {
  id?: unknown;
  order_id?: unknown;
  refund_line_items?: unknown;
}

export interface NormalizedOrderWebhook {
  shopifyOrderId: string;
  shopifyOrderGid: string | null;
  currency: string;
  discountCodes: string[];
  lines: Array<{
    shopifyLineId: string;
    shopifyProductGid: string;
    title: string;
    quantity: number;
    unitPriceMinor: number;
    discountMinor: number;
  }>;
}

export interface NormalizedRefundWebhook {
  shopifyRefundId: string;
  shopifyOrderId: string;
  lines: Array<{
    shopifyRefundLineId: string;
    shopifyLineId: string;
    quantity: number;
  }>;
}

function requiredString(value: unknown, field: string): string {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") {
    throw new ApiError(`Invalid Shopify webhook field: ${field}`, 400);
  }
  return String(value);
}

function requiredInteger(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ApiError(`Invalid Shopify webhook field: ${field}`, 400);
  }
  return number;
}

function moneyToMinor(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(`Invalid Shopify webhook money: ${field}`, 400);
  }
  return Math.round(number * 100);
}

export function verifyShopifyHmac(rawBody: Buffer, signature: string | null): void {
  if (!signature) throw new ApiError("Missing Shopify HMAC", 401);
  const env = getShopifyWebhookEnv();
  const expected = createHmac(
    "sha256",
    env.SHOPIFY_WEBHOOK_SECRET ?? env.SHOPIFY_CLIENT_SECRET,
  )
    .update(rawBody)
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    throw new ApiError("Invalid Shopify HMAC", 401);
  }
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new ApiError("Invalid Shopify HMAC", 401);
  }
}

export function verifyShopifyDomain(shopDomain: string | null): void {
  if (
    !shopDomain ||
    shopDomain.toLowerCase() !==
      getShopifyWebhookEnv().SHOPIFY_STORE_DOMAIN.toLowerCase()
  ) {
    throw new ApiError("Shopify shop domain does not match configuration", 401);
  }
}

export function parseOrderWebhook(payload: unknown): NormalizedOrderWebhook {
  if (!payload || typeof payload !== "object") {
    throw new ApiError("Invalid order webhook payload", 400);
  }
  const order = payload as ShopifyOrderPayload;
  const rawDiscounts = Array.isArray(order.discount_codes)
    ? (order.discount_codes as ShopifyDiscountCode[])
    : [];
  const rawLines = Array.isArray(order.line_items)
    ? (order.line_items as ShopifyOrderLine[])
    : [];

  return {
    shopifyOrderId: requiredString(order.id, "id"),
    shopifyOrderGid:
      typeof order.admin_graphql_api_id === "string"
        ? order.admin_graphql_api_id
        : null,
    currency: requiredString(order.currency, "currency").toUpperCase(),
    discountCodes: rawDiscounts
      .map((discount) =>
        typeof discount.code === "string" ? discount.code.toUpperCase() : "",
      )
      .filter(Boolean),
    lines: rawLines
      .filter(
        (line) =>
          (typeof line.product_id === "string" ||
            typeof line.product_id === "number") &&
          line.product_id !== "",
      )
      .map((line) => ({
        shopifyLineId: requiredString(line.id, "line_items.id"),
        shopifyProductGid: `gid://shopify/Product/${requiredString(
          line.product_id,
          "line_items.product_id",
        )}`,
      title:
        typeof line.title === "string" && line.title.trim()
          ? line.title
          : "Product",
        quantity: requiredInteger(line.quantity, "line_items.quantity"),
        unitPriceMinor: moneyToMinor(line.price, "line_items.price"),
        discountMinor: moneyToMinor(
          line.total_discount ?? 0,
          "line_items.total_discount",
        ),
      })),
  };
}

export function parseRefundWebhook(payload: unknown): NormalizedRefundWebhook {
  if (!payload || typeof payload !== "object") {
    throw new ApiError("Invalid refund webhook payload", 400);
  }
  const refund = payload as ShopifyRefundPayload;
  const rawLines = Array.isArray(refund.refund_line_items)
    ? (refund.refund_line_items as ShopifyRefundLine[])
    : [];
  return {
    shopifyRefundId: requiredString(refund.id, "id"),
    shopifyOrderId: requiredString(refund.order_id, "order_id"),
    lines: rawLines.map((line) => ({
      shopifyRefundLineId: requiredString(line.id, "refund_line_items.id"),
      shopifyLineId: requiredString(
        line.line_item_id,
        "refund_line_items.line_item_id",
      ),
      quantity: requiredInteger(line.quantity, "refund_line_items.quantity"),
    })),
  };
}
