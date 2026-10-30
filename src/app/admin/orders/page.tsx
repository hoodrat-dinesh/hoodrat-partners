import type { Metadata } from "next";
import { Badge, DataTable, EmptyState, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminOrders } from "@/lib/data";
import { formatDate, formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Order attribution" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const query = filters.query?.trim().toLowerCase() || "";
  const status = filters.status?.toLowerCase() || "";
  const context = await requireAdmin();
  const records = await getAdminOrders(context);
  const baseOrders = records.map((order) => ({
    id: order.id,
    ref: order.reference,
    date: formatDate(order.paidAt),
    influencer: order.influencerName ?? "Unnamed partner",
    code: order.discountCode,
    products: order.products,
    net: formatMinorCurrency(order.revenueMinor, order.currency),
    commission: formatMinorCurrency(order.commissionMinor, order.currency),
    status: order.status,
  }));
  const orders = baseOrders.filter((order) => {
    const matchesQuery = !query || `${order.ref} ${order.influencer} ${order.code}`.toLowerCase().includes(query);
    const matchesStatus = !status || order.status.toLowerCase() === status;
    return matchesQuery && matchesStatus;
  });
  return (
    <>
      <PageHeader
        eyebrow="Shopify attribution"
        title="Orders"
        description="Audit attributed sales, validation state, and the commission obligation created by each order."
      />
      <form className="filter-bar" action="/admin/orders" method="get">
        <label className="field">
          <span className="field__label">Search orders</span>
          <input className="input" name="query" type="search" placeholder="Order reference, code, or influencer" defaultValue={filters.query} />
        </label>
        <Select label="Attribution status" name="status" defaultValue={filters.status || ""}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="partially_refunded">Partially refunded</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <button className="button button--secondary" type="submit">Apply filters</button>
      </form>
      {orders.length ? (
        <DataTable caption="Attributed Shopify orders" headers={["Order", "Date", "Influencer / code", "Products", "Net", "Commission", "Status"]}>
          {orders.map((order) => (
            <tr key={order.id}>
              <td data-label="Order"><strong>{order.ref}</strong></td>
              <td data-label="Date">{order.date}</td>
              <td data-label="Influencer / code">{order.influencer}<br /><code>{order.code}</code></td>
              <td data-label="Products">{order.products}</td>
              <td data-label="Net">{order.net}</td>
              <td data-label="Commission"><strong>{order.commission}</strong></td>
              <td data-label="Status"><Badge tone={order.status === "paid" ? "success" : order.status === "partially_refunded" ? "warning" : "danger"}>{order.status.replaceAll("_", " ")}</Badge></td>
            </tr>
          ))}
        </DataTable>
      ) : <EmptyState title="No attributed orders" body="Eligible Shopify orders will appear after a customer uses an active influencer code." />}
    </>
  );
}
