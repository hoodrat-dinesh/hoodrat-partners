import type { Metadata } from "next";
import { PayoutsTable, WithdrawalCard } from "@/components/dashboard-ui";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getInfluencerPayouts } from "@/lib/data";
import { formatDate, formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const context = await requireUser();
  const data = await getInfluencerPayouts(context.user.id);
  const payouts = data.payouts.map((payout) => ({
    id: payout.id,
    date: formatDate(payout.recordedAt ?? payout.requestedAt),
    amount: formatMinorCurrency(payout.amountMinor, payout.currency),
    method: "UPI",
    reference: payout.reference ?? "Awaiting reference",
    status: payout.status,
  }));
  return (
    <>
      <PageHeader
        eyebrow="Settlement ledger"
        title="Payouts"
        description="Request a withdrawal when you cross the program threshold and keep every settlement reference close."
      />
      <WithdrawalCard
        availableMinor={data.balance.availableMinor}
        thresholdMinor={data.settings.payoutThresholdMinor}
        currency={data.balance.currency}
      />
      <section className="content-section">
        <div className="section-heading">
          <div><span className="eyebrow">Archive</span><h2>Payout history</h2></div>
        </div>
        <PayoutsTable payouts={payouts} />
      </section>
    </>
  );
}
