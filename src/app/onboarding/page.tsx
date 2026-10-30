import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/app-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { AuthorizationError, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Join the program" };

export default async function OnboardingPage() {
  let context;
  try {
    context = await requireUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login?next=/onboarding");
    }
    throw error;
  }
  if (context.profile.role === "admin") redirect("/admin");
  if (context.profile.onboarding_completed) redirect("/dashboard");
  const settings = await getSettings();
  const brand = {
    companyName: settings.brandName,
    logoUrl: settings.logoUrl ?? undefined,
    tagline: settings.tagline,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
  };
  const brandStyle = {
    "--ink": settings.primaryColor,
    "--coral": settings.accentColor,
  } as React.CSSProperties;
  return (
    <main className="onboarding-page" style={brandStyle}>
      <aside className="onboarding-aside">
        <Link href="/"><BrandMark brand={brand} /></Link>
        <span className="onboarding-aside__count" aria-hidden="true">01</span>
        <div>
          <span className="eyebrow">Your application</span>
          <p>Four details. One transparent partnership.</p>
        </div>
      </aside>
      <section className="onboarding-main">
        <div className="onboarding-main__inner page-reveal">
          <span className="eyebrow">Partner profile</span>
          <h1>Tell us how to know you.</h1>
          <p>This information is used to review and operate your creator partnership.</p>
          <OnboardingForm
            initial={{
              fullName: context.profile.full_name ?? "",
              instagramHandle: context.profile.instagram_handle ?? "",
              followerCount: context.profile.follower_count ?? undefined,
              upiPayoutId: context.profile.upi_payout_id ?? "",
            }}
          />
        </div>
      </section>
    </main>
  );
}
