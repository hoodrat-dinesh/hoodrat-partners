import { NextResponse } from "next/server";
import { apiError, assertSameOrigin } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
  updateWebhookSubscription,
  webhookFieldsForTopic,
} from "@/lib/shopify/client";
import { createAdminClient } from "@/lib/supabase/admin";

const topics = ["ORDERS_PAID", "REFUNDS_CREATE", "ORDERS_CANCELLED"] as const;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const callbackUrl = new URL("/api/webhooks/shopify", getPublicEnv().NEXT_PUBLIC_APP_URL).toString();
    const existing = await listWebhookSubscriptions([...topics]);
    const subscriptions = await Promise.all(
      topics.map(async (topic) => {
        const endpointMatch = existing.find(
          (subscription) =>
            subscription.topic === topic &&
            subscription.uri === callbackUrl,
        );
        const match =
          endpointMatch ??
          existing.find((subscription) => subscription.topic === topic);
        if (match) {
          const expectedFields = webhookFieldsForTopic(topic).sort();
          const actualFields = [...match.includeFields].sort();
          const needsUpdate =
            match.uri !== callbackUrl ||
            expectedFields.length !== actualFields.length ||
            expectedFields.some(
              (field, index) => field !== actualFields[index],
            );
          if (needsUpdate) {
            await updateWebhookSubscription(match.id, topic, callbackUrl);
          }
          return { topic, id: match.id, created: false, updated: needsUpdate };
        }
        return {
          topic,
          id: await createWebhookSubscription(topic, callbackUrl),
          created: true,
          updated: false,
        };
      }),
    );
    await createAdminClient().from("audit_log").insert({
      actor_id: actor.user.id,
      action: "shopify.webhooks_configured",
      entity_type: "shopify",
      metadata: { callbackUrl, topics: [...topics] },
    });
    return NextResponse.json({ callbackUrl, subscriptions });
  } catch (error) {
    return apiError(error);
  }
}
