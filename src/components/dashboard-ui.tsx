import Link from "next/link";
import { CopyCode, PayoutRequestForm } from "./actions";
import { formatMinorCurrency } from "@/lib/format";
import { Icon } from "./icons";
import { Badge, Card, DataTable, EmptyState, Metric, Progress, type Tone } from "./ui";

export type OrderView = {
  id: string;
  reference: string;
  date: string;
  products: string;
  netRevenue: string;
  commission: string;
  status: string;
};

export type PayoutView = {
  id: string;
  date: string;
  amount: string;
  method: string;
  reference: string;
  status: string;
};

export type ProductView = {
  id: string;
  name: string;
  imageUrl?: string;
  price: string;
  discount: string;
  commission: string;
  basis: string;
  potentialEarning: string;
  url: string;
};

function badgeTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (["paid", "confirmed", "active"].includes(normalized)) return "success";
  if (["returned", "failed", "refunded", "rejected", "cancelled"].includes(normalized)) return "danger";
  return "warning";
}

export function EarningsGrid({
  available = "₹0",
  pending = "₹0",
  lifetime = "₹0",
  paid = "₹0",
}: {
  available?: string;
  pending?: string;
  lifetime?: string;
  paid?: string;
}) {
  return (
    <section className="metric-grid" aria-label="Earnings summary">
      <Metric label="Available" value={available} note="Ready to withdraw" tone="accent" />
      <Metric label="Reserved payout" value={pending} note="Pending settlement" />
      <Metric label="Lifetime earned" value={lifetime} note="All attributed commission" />
      <Metric label="Paid out" value={paid} note="Settled to date" tone="success" />
    </section>
  );
}

export function WithdrawalCard({
  availableMinor,
  thresholdMinor,
  currency,
}: {
  availableMinor: number;
  thresholdMinor: number;
  currency: string;
}) {
  const remaining = Math.max(0, thresholdMinor - availableMinor);
  return (
    <Card className="withdrawal-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Next payout</span>
          <h2>{remaining ? `${formatMinorCurrency(remaining, currency)} to go` : "You’re ready to withdraw"}</h2>
        </div>
        <Icon name="wallet" />
      </div>
      <Progress value={availableMinor} max={thresholdMinor} label="Withdrawal threshold progress" />
      <p>Requests open once your available balance reaches {formatMinorCurrency(thresholdMinor, currency)}.</p>
      <PayoutRequestForm
        availableMinor={availableMinor}
        thresholdMinor={thresholdMinor}
        currency={currency}
      />
    </Card>
  );
}

export function PromotionCode({ code }: { code?: string }) {
  return (
    <Card className="promo-card">
      <span className="eyebrow">Your promotion code</span>
      {code ? (
        <>
          <strong className="promo-card__code">{code}</strong>
          <p>Share this exact code. Eligible orders are attributed after Shopify validation.</p>
          <CopyCode code={code} />
        </>
      ) : (
        <EmptyState title="Code coming soon" body="Your code appears here after your profile and first promotion are approved." />
      )}
    </Card>
  );
}

export function ProductGrid({ products }: { products: ProductView[] }) {
  if (!products.length) {
    return <EmptyState title="No products assigned" body="Approved products and unique links will appear here when your program manager assigns them." />;
  }
  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <article className="product-card" key={`${product.id}-${index}`}>
          <div className="product-card__visual">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" />
            ) : <Icon name="bag" />}
            <Badge tone="accent">{product.discount} off</Badge>
          </div>
          <div className="product-card__body">
            <div>
              <h3>{product.name}</h3>
              <span>{product.price}</span>
            </div>
            <dl className="product-card__facts">
              <div><dt>Commission</dt><dd>{product.commission}</dd></div>
              <div><dt>Basis</dt><dd>{product.basis}</dd></div>
              <div><dt>Potential / sale</dt><dd>{product.potentialEarning}</dd></div>
            </dl>
            <a className="text-link" href={product.url} target="_blank" rel="noreferrer">
              Open product <Icon name="arrow" />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function OrdersTable({ orders, compact = false }: { orders: OrderView[]; compact?: boolean }) {
  if (!orders.length) {
    return <EmptyState title="No attributed orders yet" body="Orders using your code or tracked link will appear here after Shopify syncs." />;
  }
  return (
    <>
      <DataTable caption="Attributed orders" headers={["Order", "Date", "Products", "Net revenue", "Commission", "Status"]}>
        {orders.map((order) => (
          <tr key={order.id}>
            <td data-label="Order"><strong>{order.reference}</strong></td>
            <td data-label="Date">{order.date}</td>
            <td data-label="Products">{order.products}</td>
            <td data-label="Net revenue">{order.netRevenue}</td>
            <td data-label="Commission"><strong>{order.commission}</strong></td>
            <td data-label="Status"><Badge tone={badgeTone(order.status)}>{order.status}</Badge></td>
          </tr>
        ))}
      </DataTable>
      {compact ? <Link href="/dashboard/orders" className="text-link table-more">View all orders <Icon name="arrow" /></Link> : null}
    </>
  );
}

export function PayoutsTable({ payouts }: { payouts: PayoutView[] }) {
  if (!payouts.length) {
    return <EmptyState title="No payouts yet" body="Completed and processing payouts will be listed here with their payment references." />;
  }
  return (
    <DataTable caption="Payout history" headers={["Paid on", "Amount", "Method", "Reference", "Status"]}>
      {payouts.map((payout) => (
        <tr key={payout.id}>
          <td data-label="Paid on">{payout.date}</td>
          <td data-label="Amount"><strong>{payout.amount}</strong></td>
          <td data-label="Method">{payout.method}</td>
          <td data-label="Reference"><code>{payout.reference}</code></td>
          <td data-label="Status"><Badge tone={badgeTone(payout.status)}>{payout.status}</Badge></td>
        </tr>
      ))}
    </DataTable>
  );
}
