import type { Metadata } from "next";
import { EarningsGrid, OrdersTable, PromotionCode, WithdrawalCard } from "@/components/dashboard-ui";
import { Badge, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getInfluencerOverview } from "@/lib/data";
import { formatDate, formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Partner overview" };

export default async function DashboardPage() {
  const context = await requireUser();
  const overview = await getInfluencerOverview(context.user.id);
  const orders = overview.orders.map((order) => ({
    id: order.id,
    reference: order.reference,
    date: formatDate(order.paidAt),
    products: order.products,
    netRevenue: formatMinorCurrency(order.revenueMinor, order.currency),
    commission: formatMinorCurrency(order.commissionMinor, order.currency),
    status: order.status.replaceAll("_", " "),
  }));
  const currency = overview.balance.currency;
  const availableMinor = overview.balance.availableMinor;
  const thresholdMinor = overview.settings.payoutThresholdMinor;
  const displayName = context.profile.full_name?.split(" ")[0];
  const status = context.profile.approval_status;

  return (
    <>
      <PageHeader
        eyebrow="Partner overview"
        title={displayName ? `Good to see you, ${displayName}.` : "Good to see you."}
        description="A clear view of what you’ve earned, what is still validating, and what comes next."
        actions={<Badge tone={status === "approved" ? "success" : status === "suspended" || status === "rejected" ? "danger" : "warning"}>{status}</Badge>}
      />
      <EarningsGrid
        available={formatMinorCurrency(availableMinor, currency)}
        pending={formatMinorCurrency(overview.balance.pendingPayoutMinor, currency)}
        lifetime={formatMinorCurrency(overview.balance.lifetimeEarnedMinor, currency)}
        paid={formatMinorCurrency(overview.balance.paidMinor, currency)}
      />
      <div className="dashboard-grid">
        <WithdrawalCard availableMinor={availableMinor} thresholdMinor={thresholdMinor} currency={currency} />
        <PromotionCode code={overview.promotionCode ?? undefined} />
      </div>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Latest attribution</span>
            <h2>Recent orders</h2>
          </div>
          <p>Customer details stay private. Your ledger contains only the information needed to verify commission.</p>
        </div>
        <OrdersTable orders={orders} compact />
      </section>
    </>
  );
}
