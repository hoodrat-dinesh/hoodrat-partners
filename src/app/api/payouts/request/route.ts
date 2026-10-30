import { NextResponse } from "next/server";
import { apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireApprovedInfluencer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { payoutRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApprovedInfluencer();
    const input = await parseJson(request, payoutRequestSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_payout", {
      p_amount_minor: input.amountMinor,
    });
    throwIfDatabaseError(error, error?.message ?? "Unable to request payout");
    return NextResponse.json({ payout: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
