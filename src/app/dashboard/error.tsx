"use client";

import { Button, Notice, PageHeader } from "@/components/ui";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader eyebrow="Partner desk" title="The ledger paused." description="We couldn’t load this view just now." />
      <Notice title="Your data is safe" tone="danger">
        Try the request again. If the issue persists, contact the program support team.
      </Notice>
      <div className="content-section"><Button type="button" onClick={reset}>Try again</Button></div>
    </>
  );
}
