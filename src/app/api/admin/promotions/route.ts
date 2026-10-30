import { NextResponse } from "next/server";
import { ApiError, apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createShopifyDiscount } from "@/lib/shopify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPromotionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let createdId: string | null = null;
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const input = await parseJson(request, createPromotionSchema);
    const admin = createAdminClient();

    const { data: influencer, error: influencerError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", input.influencerId)
      .eq("role", "influencer")
      .eq("approval_status", "approved")
      .maybeSingle();
    throwIfDatabaseError(influencerError, "Unable to validate influencer");
    if (!influencer) throw new ApiError("Influencer is not approved", 422);

    const productIds = input.products.map((product) => product.productId);
    const { data: products, error: productError } = await admin
      .from("products")
      .select("id, shopify_product_gid")
      .in("id", productIds)
      .eq("active", true);
    throwIfDatabaseError(productError, "Unable to validate products");
    if (!products || products.length !== new Set(productIds).size) {
      throw new ApiError("One or more products are missing or inactive", 422);
    }

    const { data: promotion, error: promotionError } = await admin
      .from("promotions")
      .insert({
        influencer_id: input.influencerId,
        code: input.code,
        discount_percent: input.discountPercent,
        status: "draft",
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
      })
      .select("id")
      .single();
    throwIfDatabaseError(promotionError, "Unable to create promotion");
    if (!promotion) throw new ApiError("Unable to create promotion", 500);
    createdId = promotion.id as string;

    const { error: assignmentError } = await admin
      .from("promotion_products")
      .insert(
        input.products.map((product) => ({
          promotion_id: createdId,
          product_id: product.productId,
          commission_percent: product.commissionPercent,
          commission_basis: product.commissionBasis,
          cost_basis_minor: product.costBasisMinor ?? null,
        })),
      );
    throwIfDatabaseError(assignmentError, "Unable to assign promotion products");

    let shopifyDiscountId: string | null = null;
    if (input.status === "active") {
      shopifyDiscountId = await createShopifyDiscount({
        code: input.code,
        percentage: input.discountPercent,
        productGids: products.map((product) => product.shopify_product_gid as string),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
    }

    const { data: completed, error: completeError } = await admin
      .from("promotions")
      .update({
        status: input.status,
        shopify_discount_id: shopifyDiscountId,
      })
      .eq("id", createdId)
      .select("*")
      .single();
    throwIfDatabaseError(completeError, "Unable to finalize promotion");

    await admin.from("audit_log").insert({
      actor_id: actor.user.id,
      action: "promotion.created",
      entity_type: "promotion",
      entity_id: createdId,
      metadata: { code: input.code, status: input.status },
    });
    return NextResponse.json({ promotion: completed }, { status: 201 });
  } catch (error) {
    if (createdId) {
      await createAdminClient().from("promotions").delete().eq("id", createdId);
    }
    return apiError(error);
  }
}
