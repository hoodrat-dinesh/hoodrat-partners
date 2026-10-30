import { NextResponse } from "next/server";
import {
  apiError,
  assertSameOrigin,
  parseJson,
  throwIfDatabaseError,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, profile } = await requireUser();
    if (profile.role !== "influencer") {
      return NextResponse.json(
        { error: "Administrator profiles cannot use this route" },
        { status: 409 },
      );
    }
    const input = await parseJson(request, profileSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: input.fullName,
        instagram_handle: input.instagramHandle,
        follower_count: input.followerCount,
        upi_payout_id: input.upiPayoutId ?? null,
      })
      .eq("id", user.id)
      .select(
        "id, full_name, instagram_handle, follower_count, upi_payout_id, approval_status",
      )
      .single();
    throwIfDatabaseError(error, "Unable to update profile");
    return NextResponse.json({ profile: data });
  } catch (error) {
    return apiError(error);
  }
}
