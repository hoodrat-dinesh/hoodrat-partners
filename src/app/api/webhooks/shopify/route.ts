import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiError, throwIfDatabaseError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseOrderWebhook,
  parseRefundWebhook,
  verifyShopifyDomain,
  verifyShopifyHmac,
} from "@/lib/shopify/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function payloadId(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    throw new ApiError("Invalid cancellation payload", 400);
  }
  const value = payload.id;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError("Invalid cancellation order id", 400);
  }
  return String(value);
}

export async function POST(request: Request) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    verifyShopifyHmac(rawBody, request.headers.get("x-shopify-hmac-sha256"));
    verifyShopifyDomain(request.headers.get("x-shopify-shop-domain"));

    const eventId = request.headers.get("x-shopify-event-id");
    const webhookId = request.headers.get("x-shopify-webhook-id");
    if (!webhookId) throw new ApiError("Missing Shopify webhook id", 400);
    const topic = request.headers.get("x-shopify-topic")?.toLowerCase();
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new ApiError("Invalid webhook JSON", 400);
    }

    const admin = createAdminClient();
    if (topic === "orders/paid") {
      const order = parseOrderWebhook(payload);
      const { data, error } = await admin.rpc("process_shopify_paid_order", {
        p_webhook_delivery_id: webhookId,
        p_correlation_id: eventId,
        p_payload_sha256: payloadHash,
        p_shopify_order_id: order.shopifyOrderId,
        p_shopify_order_gid: order.shopifyOrderGid,
        p_currency: order.currency,
        p_discount_codes: order.discountCodes,
        p_lines: order.lines,
      });
      throwIfDatabaseError(error, "Unable to process paid order");
      return NextResponse.json({ received: true, result: data });
    }

    if (topic === "refunds/create") {
      const refund = parseRefundWebhook(payload);
      const { data, error } = await admin.rpc("process_shopify_refund", {
        p_webhook_delivery_id: webhookId,
        p_correlation_id: eventId,
        p_payload_sha256: payloadHash,
        p_shopify_refund_id: refund.shopifyRefundId,
        p_shopify_order_id: refund.shopifyOrderId,
        p_lines: refund.lines,
      });
      throwIfDatabaseError(error, "Unable to process refund");
      return NextResponse.json({ received: true, result: data });
    }

    if (topic === "orders/cancelled") {
      const { data, error } = await admin.rpc("process_shopify_cancellation", {
        p_webhook_delivery_id: webhookId,
        p_correlation_id: eventId,
        p_payload_sha256: payloadHash,
        p_shopify_order_id: payloadId(payload),
      });
      throwIfDatabaseError(error, "Unable to process cancellation");
      return NextResponse.json({ received: true, result: data });
    }

    throw new ApiError("Unsupported Shopify webhook topic", 400);
  } catch (error) {
    return apiError(error);
  }
}
