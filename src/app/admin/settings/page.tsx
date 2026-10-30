import type { Metadata } from "next";
import { ApiButton } from "@/components/actions";
import { Icon } from "@/components/icons";
import { SettingsForm } from "@/components/resource-forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminSettings } from "@/lib/data";
import { configurationStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Program settings" };

export default async function SettingsPage() {
  const context = await requireAdmin();
  const settings = await getAdminSettings(context);
  const shopifyConfigured = configurationStatus().shopifyAdmin;
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Manage the partner-facing identity, commercial defaults, and commerce connection."
      />
      <div className="admin-split">
        <Card className="section-shell">
          <SettingsForm initial={{
            brandName: settings.brandName,
            logoUrl: settings.logoUrl ?? undefined,
            tagline: settings.tagline,
            supportEmail: settings.supportEmail ?? undefined,
            primaryColor: settings.primaryColor,
            accentColor: settings.accentColor,
            currency: settings.currency,
            payoutThresholdMinor: settings.payoutThresholdMinor,
            defaultDiscountPercent: settings.defaultDiscountPercent,
          }} />
        </Card>
        <aside>
          <Card className="integration-card">
            <div className="integration-card__status">
              <Icon name="bag" />
              <Badge tone={shopifyConfigured ? "success" : "warning"}>{shopifyConfigured ? "Configured" : "Not configured"}</Badge>
            </div>
            <span className="eyebrow">Commerce source</span>
            <h2>Shopify</h2>
            <p>Credentials are managed in the server environment. Sync products and idempotently verify webhook subscriptions here.</p>
            <div className="form-stack">
              <ApiButton endpoint="/api/admin/products/sync">Sync products now</ApiButton>
              <ApiButton endpoint="/api/admin/shopify/webhooks/setup" variant="secondary">Verify webhooks</ApiButton>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
