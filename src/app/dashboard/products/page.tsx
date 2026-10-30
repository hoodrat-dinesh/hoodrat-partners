import type { Metadata } from "next";
import { ProductGrid } from "@/components/dashboard-ui";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getInfluencerProducts } from "@/lib/data";
import { formatMinorCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Promotion products" };

export default async function ProductsPage() {
  const context = await requireUser();
  const assignments = await getInfluencerProducts(context.user.id);
  const products = assignments.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl ?? undefined,
    price: formatMinorCurrency(product.priceMinor, product.currency),
    discount: `${product.discountPercent}%`,
    commission: `${product.commissionPercent}%`,
    basis: product.basis === "gross_margin" ? "Gross margin" : "Net revenue",
    potentialEarning: formatMinorCurrency(product.potentialEarningMinor, product.currency),
    url: product.url,
  }));
  return (
    <>
      <PageHeader
        eyebrow="Your edit"
        title="Products"
        description="Everything approved for promotion, with the discount, commission basis, and expected earning shown before you share."
      />
      <ProductGrid products={products} />
    </>
  );
}
