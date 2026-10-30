import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/app-shell";
import { GoogleLoginButton } from "@/components/login-button";
import { getPublicSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Partner sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, settings] = await Promise.all([
    searchParams,
    getPublicSettings(),
  ]);
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
    <main className="auth-layout" style={brandStyle}>
      <section className="auth-story">
        <Link href="/"><BrandMark brand={brand} /></Link>
        <div className="auth-quote page-reveal">
          <blockquote>“A partnership is strongest when the numbers speak plainly.”</blockquote>
          <p>Private, permissioned, and synced to the source of truth.</p>
        </div>
        <small>{settings.brandName} partner access</small>
      </section>
      <section className="auth-main">
        <div className="auth-card page-reveal">
          <span className="eyebrow">Welcome back</span>
          <h1>Your ledger awaits.</h1>
          <p>Use the Google account connected to your partnership application.</p>
          <GoogleLoginButton next={next} />
          <p className="auth-card__fine">
            By continuing, you agree to the program terms and acknowledge the privacy policy.
          </p>
          <Link className="text-link" href="/">Return to the program overview</Link>
        </div>
      </section>
    </main>
  );
}
