import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading partner dashboard">
      <span className="eyebrow">Loading your ledger</span>
      <Skeleton className="skeleton--title" />
      <section className="metric-grid content-section">
        {[0, 1, 2, 3].map((item) => <div className="metric" key={item}><Skeleton /><Skeleton /></div>)}
      </section>
      <div className="dashboard-grid">
        <div className="card section-shell"><Skeleton /><Skeleton /><Skeleton /></div>
        <div className="card section-shell"><Skeleton /><Skeleton /></div>
      </div>
    </div>
  );
}
