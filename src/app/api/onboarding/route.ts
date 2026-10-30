import { NextResponse } from "next/server";
import { apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/lib/validation";

const TERMS_VERSION = "2026-10-29";

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, profile } = await requireUser();
    if (profile.role !== "influencer") {
      return NextResponse.json({ error: "Admin profiles do not use onboarding" }, { status: 409 });
    }
    const input = await parseJson(request, onboardingSchema);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({
        full_name: input.fullName,
        instagram_handle: input.instagramHandle,
        follower_count: input.followerCount,
        upi_payout_id: input.upiPayoutId ?? null,
        onboarding_completed: true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      .eq("id", user.id)
      .select("id, approval_status, onboarding_completed, full_name, instagram_handle, follower_count, upi_payout_id")
      .single();
    throwIfDatabaseError(error, "Unable to save onboarding details");
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "profile.onboarding_completed",
      entity_type: "profile",
      entity_id: user.id,
      metadata: { terms_version: TERMS_VERSION },
    });
    return NextResponse.json({
      profile: data,
      message: "Your profile is complete and ready for review.",
    });
  } catch (error) {
    return apiError(error);
  }
}
