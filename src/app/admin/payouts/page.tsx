import type { Metadata } from "next";
import { RecordPayoutForm, RejectPayoutButton } from "@/components/actions";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminPayouts } from "@/lib/data";
import { formatDate, formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Payout operations" };

export default async function AdminPayoutsPage() {
  const context = await requireAdmin();
  const records = await getAdminPayouts(context);
  const queue = records.filter((record) => record.status === "pending").map((record) => ({
    id: record.id,
    name: record.influencerName ?? "Unnamed partner",
    upi: record.upiPayoutId ?? "Not provided",
    available: formatMinorCurrency(record.amountMinor, record.currency),
    requested: formatDate(record.requestedAt),
  }));
  const history = records.filter((record) => record.status !== "pending").map((record) => ({
    id: record.id,
    date: formatDate(record.recordedAt ?? record.requestedAt),
    partner: record.influencerName ?? "Unnamed partner",
    amount: formatMinorCurrency(record.amountMinor, record.currency),
    reference: record.reference ?? "—",
    status: record.status === "paid" ? "Paid" : record.status === "rejected" ? "Rejected" : "Cancelled",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Settlement desk"
        title="Payouts"
        description="Review eligible balances, record external transfers, and preserve an auditable payout history."
      />
      <section>
        <div className="section-heading">
          <div><span className="eyebrow">Action required</span><h2>Payout queue</h2></div>
          <p>Confirm the payment destination outside this interface before sending funds.</p>
        </div>
        {queue.length ? (
          <DataTable caption="Payout requests" headers={["Partner", "UPI destination", "Requested amount", "Requested on", "Action"]}>
            {queue.map((item) => (
              <tr key={item.id}>
                <td data-label="Partner"><strong>{item.name}</strong></td>
                <td data-label="UPI destination"><code>{item.upi}</code></td>
                <td data-label="Requested amount"><strong>{item.available}</strong></td>
                <td data-label="Requested on">{item.requested}</td>
                <td data-label="Action">
                  <div className="table-actions">
                    <RecordPayoutForm payoutRequestId={item.id} partnerName={item.name} amountLabel={item.available} />
                    <RejectPayoutButton payoutRequestId={item.id} />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : <EmptyState title="The queue is clear" body="Eligible withdrawal requests will appear here." />}
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div><span className="eyebrow">Ledger</span><h2>Payout history</h2></div>
        </div>
        {history.length ? (
          <DataTable caption="Recorded payout history" headers={["Paid on", "Partner", "Amount", "Reference", "Status"]}>
            {history.map((item) => (
              <tr key={item.id}>
                <td data-label="Paid on">{item.date}</td>
                <td data-label="Partner">{item.partner}</td>
                <td data-label="Amount"><strong>{item.amount}</strong></td>
                <td data-label="Reference"><code>{item.reference}</code></td>
                <td data-label="Status"><Badge tone={item.status === "Paid" ? "success" : "danger"}>{item.status}</Badge></td>
              </tr>
            ))}
          </DataTable>
        ) : <EmptyState title="No recorded payouts" body="Completed transfers will remain available here for reconciliation." />}
      </section>
    </>
  );
}
