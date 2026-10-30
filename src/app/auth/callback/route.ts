import { NextResponse, type NextRequest } from "next/server";
import { adminEmails } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const target = new URL(next, request.url);

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", request.url));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) throw error ?? new Error("Missing authenticated user");

    const email = data.user.email?.toLowerCase();
    if (email && adminEmails().has(email)) {
      const admin = createAdminClient();
      const { error: updateError } = await admin
        .from("profiles")
        .update({ role: "admin", approval_status: "approved" })
        .eq("id", data.user.id);
      if (updateError) throw updateError;
      target.pathname = "/admin";
      target.search = "";
    } else {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .single();
      if (profileError || !profile) throw profileError ?? new Error("Profile not found");
      target.pathname = profile.onboarding_completed
        ? next.startsWith("/admin")
          ? "/dashboard"
          : next
        : "/onboarding";
      target.search = "";
    }

    return NextResponse.redirect(target);
  } catch (error) {
    console.error("OAuth callback failed", error);
    return NextResponse.redirect(new URL("/?auth_error=callback_failed", request.url));
  }
}
