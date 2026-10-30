import { NextResponse } from "next/server";
import { apiError, assertSameOrigin, throwIfDatabaseError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { fetchAllProducts } from "@/lib/shopify/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const products = await fetchAllProducts();
    const admin = createAdminClient();
    if (products.length > 0) {
      const { error } = await admin
        .from("products")
        .upsert(products, { onConflict: "shopify_product_gid" });
      throwIfDatabaseError(error, "Unable to persist Shopify products");
    }
    const syncedGids = new Set(
      products.map((product) => product.shopify_product_gid),
    );
    const { data: activeProducts, error: activeReadError } = await admin
      .from("products")
      .select("id, shopify_product_gid")
      .eq("active", true);
    throwIfDatabaseError(activeReadError, "Unable to reconcile Shopify products");
    const removedIds = (activeProducts ?? [])
      .filter((product) => !syncedGids.has(product.shopify_product_gid as string))
      .map((product) => product.id as string);
    if (removedIds.length > 0) {
      const { error: deactivateError } = await admin
        .from("products")
        .update({ active: false, synced_at: new Date().toISOString() })
        .in("id", removedIds);
      throwIfDatabaseError(deactivateError, "Unable to deactivate removed products");
    }
    await admin.from("audit_log").insert({
      actor_id: actor.user.id,
      action: "products.synced",
      entity_type: "product",
      metadata: { count: products.length, deactivated: removedIds.length },
    });
    return NextResponse.json({
      synced: products.length,
      deactivated: removedIds.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
