import Link from "next/link";
import { BrandMark } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { getPublicSettings } from "@/lib/data";

export default async function HomePage() {
  const settings = await getPublicSettings();
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
    <main className="landing" style={brandStyle}>
      <nav className="landing__nav" aria-label="Primary navigation">
        <Link href="/" aria-label={`${settings.brandName} home`}><BrandMark brand={brand} /></Link>
        <div className="landing__nav-links">
          <a className="text-link" href="#how-it-works">How it works</a>
          <Link className="button button--primary" href="/login">Partner sign in <Icon name="arrow" /></Link>
        </div>
      </nav>

      <section className="landing__hero">
        <div className="landing__copy page-reveal">
          <span className="eyebrow landing__subhead">built for progress , not perfection.</span>
          <h1>
            <span className="landing__heading-lead">AMBITION HAS NO LIMIT.</span>
            <span className="landing__heading-body">the opportunity is yours. the effort is yours. the success you build is yours.</span>
          </h1>
          <div className="landing__actions">
            <Link className="button button--primary" href="/login">Continue with Google <Icon name="arrow" /></Link>
            <a className="text-link" href="#how-it-works">See the partnership flow</a>
          </div>
        </div>
      </section>

      <section className="flow-section" id="how-it-works">
        <div className="flow-section__heading">
          <div>
            <span className="eyebrow">Simple by design</span>
            <h2>One thoughtful recommendation. Every rupee accounted for.</h2>
          </div>
          <p>No spreadsheets, vague screenshots, or buyer data. Just the promotion details and earnings context you need.</p>
        </div>
        <div className="flow-grid">
          <article className="flow-step">
            <span className="flow-step__number">01</span>
            <h3>Join the program</h3>
            <p>Sign in with Google and share a few details about your Instagram presence.</p>
          </article>
          <article className="flow-step">
            <span className="flow-step__number">02</span>
            <h3>Share your edit</h3>
            <p>Receive assigned products, a personal code, and the exact economics for each sale.</p>
          </article>
          <article className="flow-step">
            <span className="flow-step__number">03</span>
            <h3>Follow the return</h3>
            <p>See validated orders, commission movement, and payout records in one private ledger.</p>
          </article>
        </div>
      </section>

      <footer className="landing__footer">
        <span>© {new Date().getFullYear()} {settings.brandName}</span>
        <span>{settings.tagline}</span>
      </footer>
    </main>
  );
}
