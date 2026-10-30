import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  assertSameOrigin,
  parseJson,
  throwIfDatabaseError,
} from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rejectPayoutSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const input = await parseJson(request, rejectPayoutSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reject_payout", {
      p_request_id: id,
      p_notes: input.notes,
    });
    throwIfDatabaseError(error, error?.message ?? "Unable to reject payout");
    return NextResponse.json({ payout: data });
  } catch (error) {
    return apiError(error);
  }
}
