import { Skeleton } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading program operations">
      <span className="eyebrow">Loading operations</span>
      <Skeleton className="skeleton--title" />
      <section className="kpi-band content-section">
        {[0, 1, 2, 3].map((item) => <div className="metric" key={item}><Skeleton /><Skeleton /></div>)}
      </section>
      <div className="card section-shell content-section"><Skeleton /><Skeleton /><Skeleton /></div>
    </div>
  );
}
