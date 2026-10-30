"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Button, Notice } from "./ui";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={copy} aria-live="polite">
      <Icon name={copied ? "check" : "copy"} />
      {copied ? "Copied" : "Copy code"}
    </Button>
  );
}

export function ApiButton({
  endpoint,
  children,
  method = "POST",
  variant = "primary",
  confirmMessage,
  body,
}: {
  endpoint: string;
  children: React.ReactNode;
  method?: "POST" | "PATCH" | "DELETE";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  confirmMessage?: string;
  body?: Record<string, unknown>;
}) {
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submit() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setState("pending");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      setState("success");
      router.refresh();
      window.setTimeout(() => setState("idle"), 1800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <span className="api-action">
      <Button type="button" variant={variant} onClick={submit} disabled={state === "pending"}>
        {state === "pending" ? "Working…" : state === "success" ? "Done" : children}
      </Button>
      {state === "error" ? <span className="field__error" role="alert">{message}</span> : null}
    </span>
  );
}

export function RecordPayoutForm({
  payoutRequestId,
  partnerName,
  amountLabel,
}: {
  payoutRequestId: string;
  partnerName: string;
  amountLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      reference: String(values.get("reference") ?? ""),
      notes: String(values.get("notes") ?? "").trim() || null,
    };
    try {
      const response = await fetch(`/api/admin/payouts/${payoutRequestId}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      setState("success");
      form.reset();
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Record payout</Button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-payout-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <div>
                <span className="eyebrow">Manual settlement</span>
                <h2 id="record-payout-title">Record payout</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            {state === "success" ? (
              <Notice title="Payout recorded" tone="success">The ledger is now up to date.</Notice>
            ) : (
              <form className="form-stack" onSubmit={submit}>
                <p>Recording <strong>{amountLabel}</strong> for <strong>{partnerName}</strong>.</p>
                <label className="field">
                  <span className="field__label">Payment reference</span>
                  <input className="input" name="reference" autoComplete="off" required />
                </label>
                <label className="field">
                  <span className="field__label">Notes</span>
                  <input className="input" name="notes" autoComplete="off" placeholder="Optional reconciliation note" />
                </label>
                {state === "error" ? <Notice title="Could not record payout" tone="danger">{message}</Notice> : null}
                <div className="form-actions">
                  <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={state === "pending"}>{state === "pending" ? "Recording…" : "Record payout"}</Button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

export function UserStatusActions({
  userId,
  name,
  status,
}: {
  userId: string;
  name: string;
  status: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function updateStatus(nextStatus: "approved" | "rejected" | "suspended") {
    let notes: string | undefined;
    if (nextStatus !== "approved") {
      const entered = window.prompt(
        `Required notes for ${nextStatus === "rejected" ? "rejecting" : "suspending"} ${name}:`,
      );
      if (entered === null) return;
      notes = entered.trim();
      if (!notes) {
        setState("error");
        setMessage("Notes are required.");
        return;
      }
    }
    setState("pending");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, notes }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      setState("idle");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <div className="table-actions">
      {status !== "approved" ? (
        <Button type="button" variant="secondary" disabled={state === "pending"} onClick={() => updateStatus("approved")}>
          {status === "suspended" ? "Restore" : "Approve"}
        </Button>
      ) : null}
      {status === "pending" ? (
        <Button type="button" variant="quiet" disabled={state === "pending"} onClick={() => updateStatus("rejected")}>Reject</Button>
      ) : null}
      {status === "approved" ? (
        <Button type="button" variant="danger" disabled={state === "pending"} onClick={() => updateStatus("suspended")}>Suspend</Button>
      ) : null}
      {state === "error" ? <span className="field__error" role="alert">{message}</span> : null}
    </div>
  );
}

export function RejectPayoutButton({
  payoutRequestId,
}: {
  payoutRequestId: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function reject() {
    const notes = window.prompt("Required reason for rejecting this payout:");
    if (notes === null) return;
    if (!notes.trim()) {
      setMessage("Rejection notes are required.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/payouts/${payoutRequestId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="api-action">
      <Button type="button" variant="quiet" disabled={pending} onClick={reject}>
        {pending ? "Rejecting…" : "Reject"}
      </Button>
      {message ? <span className="field__error" role="alert">{message}</span> : null}
    </span>
  );
}

export function PayoutRequestForm({
  availableMinor,
  thresholdMinor,
  currency,
}: {
  availableMinor: number;
  thresholdMinor: number;
  currency: string;
}) {
  const eligible = availableMinor >= thresholdMinor;
  const [amount, setAmount] = useState(
    eligible ? (availableMinor / 100).toFixed(2) : "",
  );
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = Math.round(Number(amount) * 100);
    if (
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < thresholdMinor ||
      amountMinor > availableMinor
    ) {
      setState("error");
      setMessage("Enter an amount within your available balance and above the threshold.");
      return;
    }
    setState("pending");
    setMessage("");
    try {
      const response = await fetch("/api/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMinor }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      setState("success");
      setMessage("Your payout request has been reserved for review.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  if (!eligible) {
    return <Button type="button" variant="secondary" disabled>Threshold not reached</Button>;
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Request amount ({currency})</span>
        <input
          className="input"
          type="number"
          min={(thresholdMinor / 100).toFixed(2)}
          max={(availableMinor / 100).toFixed(2)}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>
      {message ? (
        <Notice title={state === "success" ? "Request submitted" : "Could not request payout"} tone={state === "success" ? "success" : "danger"}>
          {message}
        </Notice>
      ) : null}
      <Button type="submit" disabled={state === "pending" || state === "success"}>
        {state === "pending" ? "Requesting…" : "Request payout"}
      </Button>
    </form>
  );
}
