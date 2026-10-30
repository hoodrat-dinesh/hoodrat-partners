import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import {
  createShopifyDiscount,
  setShopifyDiscountActive,
  updateShopifyDiscount,
} from "@/lib/shopify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { updatePromotionSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const input = await parseJson(request, updatePromotionSchema);
    if (Object.keys(input).length === 0) {
      throw new ApiError("At least one promotion field is required", 422);
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("promotions")
      .select("id, code, discount_percent, shopify_discount_id, status, starts_at, ends_at")
      .eq("id", id)
      .single();
    throwIfDatabaseError(existingError, "Promotion not found");
    if (!existing) throw new ApiError("Promotion not found", 404);

    const { data: currentAssignments, error: assignmentReadError } = await admin
      .from("promotion_products")
      .select("product_id, commission_percent, commission_basis, cost_basis_minor")
      .eq("promotion_id", id);
    throwIfDatabaseError(assignmentReadError, "Unable to load promotion products");

    const effectiveAssignments = input.products ?? (currentAssignments ?? []).map((row) => ({
      productId: row.product_id as string,
      commissionPercent: Number(row.commission_percent),
      commissionBasis: row.commission_basis as "net_revenue" | "gross_margin",
      costBasisMinor: row.cost_basis_minor as number | null,
    }));
    const productIds = effectiveAssignments.map((product) => product.productId);
    const { data: products, error: productError } = await admin
      .from("products")
      .select("id, shopify_product_gid")
      .in("id", productIds)
      .eq("active", true);
    throwIfDatabaseError(productError, "Unable to validate products");
    if (!products || products.length !== new Set(productIds).size) {
      throw new ApiError("One or more products are missing or inactive", 422);
    }
    const currentProductIds = (currentAssignments ?? []).map(
      (assignment) => assignment.product_id as string,
    );
    const { data: currentProducts, error: currentProductError } =
      currentProductIds.length > 0
        ? await admin
            .from("products")
            .select("id, shopify_product_gid")
            .in("id", currentProductIds)
        : { data: [], error: null };
    throwIfDatabaseError(
      currentProductError,
      "Unable to load current Shopify products",
    );

    const effectiveStatus = input.status ?? existing.status;
    const effectiveCode = input.code ?? existing.code;
    const effectivePercent = input.discountPercent ?? Number(existing.discount_percent);
    const effectiveStarts = input.startsAt === undefined ? existing.starts_at : input.startsAt;
    const effectiveEnds = input.endsAt === undefined ? existing.ends_at : input.endsAt;
    if (effectiveStarts && effectiveEnds && effectiveEnds <= effectiveStarts) {
      throw new ApiError("endsAt must be after startsAt", 422);
    }
    const productGids = products.map((product) => product.shopify_product_gid as string);
    const currentGids = new Set(
      (currentProducts ?? []).map(
        (product) => product.shopify_product_gid as string,
      ),
    );
    const nextGids = new Set(productGids);
    const productsToAdd = productGids.filter((gid) => !currentGids.has(gid));
    const productsToRemove = [...currentGids].filter((gid) => !nextGids.has(gid));
    let discountId = existing.shopify_discount_id as string | null;

    if (effectiveStatus === "active" && !discountId) {
      discountId = await createShopifyDiscount({
        code: effectiveCode,
        percentage: effectivePercent,
        productGids,
        startsAt: effectiveStarts,
        endsAt: effectiveEnds,
      });
    } else if (discountId) {
      await updateShopifyDiscount(discountId, {
        code: effectiveCode,
        percentage: effectivePercent,
        ...(productsToAdd.length > 0 ? { productsToAdd } : {}),
        ...(productsToRemove.length > 0 ? { productsToRemove } : {}),
        startsAt: effectiveStarts,
        endsAt: effectiveEnds,
      });
      await setShopifyDiscountActive(discountId, effectiveStatus === "active");
    }

    if (input.products) {
      const { error: replaceError } = await admin.rpc(
        "replace_promotion_products",
        {
          p_promotion_id: id,
          p_products: effectiveAssignments.map((product) => ({
            product_id: product.productId,
            commission_percent: product.commissionPercent,
            commission_basis: product.commissionBasis,
            cost_basis_minor: product.costBasisMinor ?? null,
          })),
        },
      );
      throwIfDatabaseError(
        replaceError,
        "Unable to replace product assignments",
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("promotions")
      .update({
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.discountPercent !== undefined
          ? { discount_percent: input.discountPercent }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startsAt !== undefined ? { starts_at: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
        shopify_discount_id: discountId,
      })
      .eq("id", id)
      .select("*")
      .single();
    throwIfDatabaseError(updateError, "Unable to update promotion");

    await admin.from("audit_log").insert({
      actor_id: actor.user.id,
      action: "promotion.updated",
      entity_type: "promotion",
      entity_id: id,
      metadata: { fields: Object.keys(input) },
    });
    return NextResponse.json({ promotion: updated });
  } catch (error) {
    return apiError(error);
  }
}
