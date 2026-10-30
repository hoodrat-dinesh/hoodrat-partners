"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Notice } from "./ui";

type Errors = Partial<Record<"fullName" | "instagramHandle" | "followerCount" | "upiId" | "terms", string>>;

function validate(form: FormData): Errors {
  const errors: Errors = {};
  const fullName = String(form.get("fullName") || "").trim();
  const instagramHandle = String(form.get("instagramHandle") || "").trim().replace(/^@/, "");
  const followers = Number(form.get("followerCount"));
  const upiId = String(form.get("upiId") || "").trim();

  if (fullName.length < 2) errors.fullName = "Enter your full name.";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(instagramHandle)) errors.instagramHandle = "Enter a valid Instagram handle.";
  if (!Number.isInteger(followers) || followers < 0) errors.followerCount = "Enter a valid follower count.";
  if (upiId && !/^[\w.-]{2,256}@[A-Za-z]{2,64}$/.test(upiId)) errors.upiId = "Enter a valid UPI ID, such as name@bank.";
  if (form.get("terms") !== "on") errors.terms = "You must accept the program terms.";
  return errors;
}

export function OnboardingForm({
  initial,
}: {
  initial: {
    fullName: string;
    instagramHandle: string;
    followerCount?: number;
    upiPayoutId: string;
  };
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setState("pending");
    setMessage("");
    const payload = {
      fullName: String(form.get("fullName")).trim(),
      instagramHandle: String(form.get("instagramHandle")).trim().replace(/^@/, ""),
      followerCount: Number(form.get("followerCount")),
      upiPayoutId: String(form.get("upiId") || "").trim() || null,
      acceptedTerms: true,
    };

    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || result.message || "Unable to submit your application.");
      setState("success");
      setMessage(result.message || "Your profile is complete and ready for review.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit your application.");
    }
  }

  if (state === "success") {
    return (
      <div className="onboarding-success page-reveal">
        <span className="onboarding-success__seal" aria-hidden="true">✓</span>
        <span className="eyebrow">Application received</span>
        <h1>Your partnership starts here.</h1>
        <p>{message}</p>
        <a className="button button--primary" href="/dashboard">View your dashboard</a>
      </div>
    );
  }

  return (
    <form className="onboarding-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="Your legal name"
          defaultValue={initial.fullName}
          error={errors.fullName}
          required
        />
        <Input
          label="Instagram handle"
          name="instagramHandle"
          autoComplete="off"
          placeholder="@yourhandle"
          defaultValue={initial.instagramHandle}
          error={errors.instagramHandle}
          required
        />
        <Input
          label="Follower count"
          name="followerCount"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          placeholder="25000"
          defaultValue={initial.followerCount}
          error={errors.followerCount}
          required
        />
        <Input
          label="UPI payout ID"
          name="upiId"
          autoComplete="off"
          placeholder="name@bank"
          defaultValue={initial.upiPayoutId}
          hint="Optional. You can add this later in your profile."
          error={errors.upiId}
        />
      </div>
      <label className="checkbox-field">
        <input name="terms" type="checkbox" aria-describedby={errors.terms ? "terms-error" : undefined} />
        <span>
          I agree to the program terms, including attribution, returns, and payout rules.
          {errors.terms ? <small id="terms-error" className="field__error">{errors.terms}</small> : null}
        </span>
      </label>
      {state === "error" ? <Notice title="Submission failed" tone="danger">{message}</Notice> : null}
      <Button type="submit" disabled={state === "pending"}>
        {state === "pending" ? "Submitting application…" : "Submit for review"}
      </Button>
      <p className="form-footnote">Your follower count helps us tailor the program; it does not determine approval on its own.</p>
    </form>
  );
}
