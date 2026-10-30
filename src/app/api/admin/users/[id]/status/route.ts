import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { setShopifyDiscountActive } from "@/lib/shopify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { userStatusSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const input = await parseJson(request, userStatusSchema);
    if (id === actor.user.id && input.status !== "approved") {
      return NextResponse.json(
        { error: "Administrators cannot suspend or reject themselves" },
        { status: 409 },
      );
    }

    const admin = createAdminClient();
    let discountIdsToDeactivate: string[] = [];
    if (input.status === "suspended" || input.status === "rejected") {
      const { data: promotions, error: promotionReadError } = await admin
        .from("promotions")
        .select("id, shopify_discount_id")
        .eq("influencer_id", id)
        .eq("status", "active");
      throwIfDatabaseError(promotionReadError, "Unable to load influencer promotions");
      discountIdsToDeactivate = (promotions ?? [])
        .map((promotion) => promotion.shopify_discount_id as string | null)
        .filter((id): id is string => Boolean(id));
      const { error: pauseError } = await admin
        .from("promotions")
        .update({ status: "paused" })
        .eq("influencer_id", id)
        .eq("status", "active");
      throwIfDatabaseError(
        pauseError,
        "Unable to pause influencer promotions",
      );
    }

    const { data, error } = await admin
      .from("profiles")
      .update({
        approval_status: input.status,
        rejection_notes: input.status === "approved" ? null : input.notes,
      })
      .eq("id", id)
      .eq("role", "influencer")
      .select("id, approval_status, rejection_notes")
      .single();
    throwIfDatabaseError(error, "Unable to update influencer status");

    const discountResults = await Promise.allSettled(
      discountIdsToDeactivate.map((discountId) =>
        setShopifyDiscountActive(discountId, false),
      ),
    );
    const shopifyDeactivationFailures = discountResults.filter(
      (result) => result.status === "rejected",
    ).length;
    await admin.from("audit_log").insert({
      actor_id: actor.user.id,
      action: `influencer.${input.status}`,
      entity_type: "profile",
      entity_id: id,
      metadata: {
        notes: input.notes ?? null,
        shopify_deactivation_failures: shopifyDeactivationFailures,
      },
    });
    return NextResponse.json({
      profile: data,
      ...(shopifyDeactivationFailures > 0
        ? {
            warning: `${shopifyDeactivationFailures} Shopify discounts could not be deactivated; local promotions are paused`,
          }
        : {}),
    });
  } catch (error) {
    return apiError(error);
  }
}
