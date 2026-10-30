"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "./icons";
import { Badge } from "./ui";

type NavItem = { href: string; label: string; icon: IconName };

const influencerNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/orders", label: "Orders", icon: "receipt" },
  { href: "/dashboard/products", label: "Products", icon: "bag" },
  { href: "/dashboard/payouts", label: "Payouts", icon: "wallet" },
  { href: "/dashboard/profile", label: "Profile", icon: "user" },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "grid" },
  { href: "/admin/users", label: "Influencers", icon: "people" },
  { href: "/admin/programs", label: "Programs", icon: "bag" },
  { href: "/admin/orders", label: "Attribution", icon: "receipt" },
  { href: "/admin/payouts", label: "Payouts", icon: "bank" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export type ShellBrand = {
  companyName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
};

export function BrandMark({
  brand,
  compact = false,
}: {
  brand?: ShellBrand;
  compact?: boolean;
}) {
  const companyName = brand?.companyName || "Common Thread";
  return (
    <span className={`brand-lockup ${compact ? "brand-lockup--compact" : ""}`}>
      {brand?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="brand-lockup__image" src={brand.logoUrl} alt="" />
      ) : (
        <span className="brand-lockup__mark" aria-hidden="true">CT</span>
      )}
      <span className="brand-lockup__copy">
        <strong>{companyName}</strong>
        {!compact ? <small>{brand?.tagline || "Partnership, made measurable."}</small> : null}
      </span>
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && href !== "/admin" && pathname.startsWith(`${href}/`));
}

export function AppShell({
  children,
  role = "influencer",
  brand,
  userName = "Partner",
  userEmail,
  status = "Active",
}: {
  children: React.ReactNode;
  role?: "influencer" | "admin";
  brand?: ShellBrand;
  userName?: string;
  userEmail?: string;
  status?: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = role === "admin" ? adminNav : influencerNav;
  const brandStyle = {
    ...(brand?.primaryColor ? { "--ink": brand.primaryColor } : {}),
    ...(brand?.accentColor ? { "--coral": brand.accentColor } : {}),
  } as CSSProperties;

  return (
    <div className="app-frame" style={brandStyle}>
      <aside className="sidebar">
        <Link href={role === "admin" ? "/admin" : "/dashboard"} className="sidebar__brand">
          <BrandMark brand={brand} />
        </Link>
        <nav className="sidebar__nav" aria-label={`${role} navigation`}>
          <span className="sidebar__label">{role === "admin" ? "Program operations" : "Partner desk"}</span>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar__link ${isActive(pathname, item.href) ? "is-active" : ""}`}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar__footer">
          <Badge tone={status.toLowerCase().includes("pending") ? "warning" : "success"}>{status}</Badge>
          <details className="user-menu">
            <summary>
              <span className="user-menu__avatar" aria-hidden="true">{userName.charAt(0).toUpperCase()}</span>
              <span><small>Signed in as</small><strong>{userName}</strong></span>
              <Icon name="chevron" />
            </summary>
            <div className="user-menu__panel">
              {userEmail ? <small>{userEmail}</small> : null}
              <Link href={role === "admin" ? "/admin/settings" : "/dashboard/profile"}>
                <Icon name={role === "admin" ? "settings" : "user"} /> Account
              </Link>
              <form action="/api/auth/signout" method="post">
                <button className="text-button" type="submit">
                  <Icon name="logout" /> Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </aside>

      <header className="mobile-header">
        <Link href={role === "admin" ? "/admin" : "/dashboard"}>
          <BrandMark brand={brand} compact />
        </Link>
        <button
          className="icon-button"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? "arrow" : "menu"} />
        </button>
      </header>

      {menuOpen ? (
        <nav className="mobile-nav" aria-label={`${role} mobile navigation`}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? "is-active" : ""}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
          <form action="/api/auth/signout" method="post">
            <button className="text-button" type="submit"><Icon name="logout" /> Sign out</button>
          </form>
        </nav>
      ) : null}

      <main className="app-main">{children}</main>
    </div>
  );
}
