import { NextResponse } from "next/server";
import { apiError, assertSameOrigin } from "@/lib/api";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const next = safeNext(
      typeof form.get("next") === "string" ? String(form.get("next")) : null,
    );
    const callback = new URL(
      "/auth/callback",
      getPublicEnv().NEXT_PUBLIC_APP_URL,
    );
    callback.searchParams.set("next", next);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error || !data.url) throw error ?? new Error("Missing OAuth URL");
    return NextResponse.redirect(data.url, 303);
  } catch (error) {
    return apiError(error);
  }
}
