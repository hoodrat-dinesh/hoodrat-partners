import { NextResponse } from "next/server";
import { apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "brand_name, logo_url, tagline, currency, payout_threshold_minor, default_discount_percent, primary_color, accent_color, support_email",
      )
      .eq("id", 1)
      .single();
    throwIfDatabaseError(error, "Unable to load platform settings");
    return NextResponse.json({ settings: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const input = await parseJson(request, settingsSchema);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .update({
        brand_name: input.brandName,
        logo_url: input.logoUrl,
        tagline: input.tagline,
        currency: input.currency,
        payout_threshold_minor: input.payoutThresholdMinor,
        default_discount_percent: input.defaultDiscountPercent,
        primary_color: input.primaryColor,
        accent_color: input.accentColor,
        support_email: input.supportEmail,
      })
      .eq("id", 1)
      .select("*")
      .single();
    throwIfDatabaseError(error, "Unable to update platform settings");
    await admin.from("audit_log").insert({
      actor_id: actor.user.id,
      action: "settings.updated",
      entity_type: "platform_settings",
      entity_id: "1",
      metadata: { fields: Object.keys(input) },
    });
    return NextResponse.json({ settings: data });
  } catch (error) {
    return apiError(error);
  }
}
