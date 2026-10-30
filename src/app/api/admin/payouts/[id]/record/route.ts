import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertSameOrigin, parseJson, throwIfDatabaseError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordPayoutSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const input = await parseJson(request, recordPayoutSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_payout", {
      p_request_id: id,
      p_reference: input.reference,
      p_notes: input.notes ?? null,
    });
    throwIfDatabaseError(error, error?.message ?? "Unable to record payout");
    return NextResponse.json({ payout: data });
  } catch (error) {
    return apiError(error);
  }
}
