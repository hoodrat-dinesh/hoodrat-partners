"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleLoginButton({ next = "/dashboard" }: { next?: string }) {
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  async function signIn() {
    setState("pending");
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next.startsWith("/") && !next.startsWith("//")) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) setState("error");
  }

  return (
    <>
      <button className="button button--primary" type="button" onClick={signIn} disabled={state === "pending"}>
        <span className="google-g" aria-hidden="true">G</span>
        {state === "pending" ? "Opening Google…" : "Continue with Google"}
      </button>
      {state === "error" ? <p className="field__error" role="alert">Google sign-in could not start. Please try again.</p> : null}
    </>
  );
}
