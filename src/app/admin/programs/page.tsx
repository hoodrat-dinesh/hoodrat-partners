import type { Metadata } from "next";
import { ApiButton } from "@/components/actions";
import { ProgramForm } from "@/components/resource-forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminPrograms } from "@/lib/data";

export const metadata: Metadata = { title: "Products & promotions" };

export default async function ProgramsPage() {
  const context = await requireAdmin();
  const data = await getAdminPrograms(context);
  const programs = data.programs.map((program) => ({
    id: program.id,
    product: program.products.map((product) => product.name).join(", ") || "No products",
    influencer: program.influencerName,
    code: program.code,
    discount: `${program.discountPercent}%`,
    commission: program.products.length === 1 ? `${program.products[0].commissionPercent}%` : "Varies",
    basis: program.products.length === 1 && program.products[0].basis === "gross_margin" ? "Gross margin" : "Net revenue",
    status: program.status,
  }));
  const influencers = data.influencers;
  const products = data.products;

  return (
    <>
      <PageHeader
        eyebrow="Commercial terms"
        title="Products & promotions"
        description="Sync the Shopify catalogue, assign products, and define each promotion’s economics."
        actions={<ApiButton endpoint="/api/admin/products/sync">Sync Shopify products</ApiButton>}
      />
      <Card className="section-shell">
        <div className="section-heading">
          <div><span className="eyebrow">New assignment</span><h2>Create a promotion</h2></div>
          <p>Codes must be unique. Commission is calculated against the selected basis after Shopify adjustments.</p>
        </div>
        <ProgramForm influencers={influencers} products={products} />
      </Card>
      <section className="content-section">
        <div className="section-heading">
          <div><span className="eyebrow">Current programme</span><h2>Active promotions</h2></div>
        </div>
        {programs.length ? (
          <Card>
            {programs.map((program) => (
              <article className="program-card" key={program.id}>
                <div>
                  <div><Badge tone={program.status.toLowerCase() === "active" ? "success" : "warning"}>{program.status}</Badge></div>
                  <h3>{program.product}</h3>
                  <p>{program.influencer} · <strong>{program.code}</strong></p>
                  <div className="program-card__facts">
                    <span>Discount <strong>{program.discount}</strong></span>
                    <span>Commission <strong>{program.commission}</strong></span>
                    <span>Basis <strong>{program.basis}</strong></span>
                  </div>
                </div>
                <ApiButton endpoint={`/api/admin/promotions/${program.id}`} method="PATCH" body={{ status: "paused" }} variant="quiet" confirmMessage="Pause this promotion?">Pause promotion</ApiButton>
              </article>
            ))}
          </Card>
        ) : (
          <EmptyState title="No promotions configured" body="Sync Shopify, then assign an eligible product to an approved influencer." />
        )}
      </section>
    </>
  );
}
