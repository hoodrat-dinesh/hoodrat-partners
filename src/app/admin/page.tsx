import type { Metadata } from "next";
import Link from "next/link";
import { Metric, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { getAdminOverview } from "@/lib/data";
import { formatDate, formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Program operations" };

export default async function AdminOverviewPage() {
  const context = await requireAdmin();
  const overview = await getAdminOverview(context);
  const activity = overview.activity.map((item) => ({
    time: formatDate(item.createdAt),
    event: item.action,
    type: item.type,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Program operations"
        title="The day’s ledger."
        description="Applications, attributed revenue, and settlement work at a glance."
        actions={<Link href="/admin/users" className="button button--primary">Review applications <Icon name="arrow" /></Link>}
      />
      <section className="kpi-band" aria-label="Program metrics">
        <Metric label="Attributed revenue" value={formatMinorCurrency(overview.attributedRevenueMinor, overview.currency)} note="Last 30 days" tone="accent" />
        <Metric label="Commission owed" value={formatMinorCurrency(overview.commissionOwedMinor, overview.currency)} note="Confirmed, unpaid" />
        <Metric label="Active partners" value={String(overview.activePartners)} note={`${overview.pendingPartners} awaiting review`} />
        <Metric label="Orders captured" value={String(overview.orderCount)} note="Last 30 days" tone="success" />
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div><span className="eyebrow">Live operations</span><h2>Recent activity</h2></div>
          <Link href="/admin/orders" className="text-link">Open attribution <Icon name="arrow" /></Link>
        </div>
        {activity.length ? (
          <ol className="activity-list">
            {activity.map((item) => (
              <li key={item.id}>
                <time>{item.time}</time>
                <strong>{item.event}</strong>
                <span className="badge badge--neutral">{item.type}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <span className="empty-state__mark" aria-hidden="true">✦</span>
            <h3>No activity yet</h3>
            <p>Material program actions will appear here as they occur.</p>
          </div>
        )}
      </section>
    </>
  );
}
