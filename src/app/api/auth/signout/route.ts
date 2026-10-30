import { NextResponse } from "next/server";
import { apiError, assertSameOrigin } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch (error) {
    return apiError(error);
  }
}
