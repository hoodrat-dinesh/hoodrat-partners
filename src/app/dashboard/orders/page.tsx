import type { Metadata } from "next";
import { OrdersTable } from "@/components/dashboard-ui";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getInfluencerOrders } from "@/lib/data";
import { formatDate, formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Attributed orders" };

export default async function OrdersPage() {
  const context = await requireUser();
  const records = await getInfluencerOrders(context.user.id);
  const orders = records.map((order) => ({
    id: order.id,
    reference: order.reference,
    date: formatDate(order.paidAt),
    products: order.products,
    netRevenue: formatMinorCurrency(order.revenueMinor, order.currency),
    commission: formatMinorCurrency(order.commissionMinor, order.currency),
    status: order.status.replaceAll("_", " "),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Attribution ledger"
        title="Orders"
        description="Eligible Shopify orders tied to your promotion code, without buyer information."
      />
      <OrdersTable orders={orders} />
    </>
  );
}
