"use client";

import { Button, Notice, PageHeader } from "@/components/ui";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader eyebrow="Program operations" title="This view didn’t reconcile." description="The operation failed before the latest data could be shown." />
      <Notice title="No changes were assumed" tone="danger">Retry the request before taking further action.</Notice>
      <div className="content-section"><Button type="button" onClick={reset}>Try again</Button></div>
    </>
  );
}
