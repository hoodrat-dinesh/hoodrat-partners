"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Notice, Select } from "./ui";

type FormState = "idle" | "pending" | "success" | "error";

function useJsonForm(
  endpoint: string,
  method: "POST" | "PATCH" | "PUT" = "POST",
  transform: (payload: Record<string, FormDataEntryValue>) => Record<string, unknown> = (payload) => payload,
) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    const payload = transform(Object.fromEntries(new FormData(event.currentTarget)));
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      setState("success");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  return { state, message, submit };
}

function FormFeedback({ state, message }: { state: FormState; message: string }) {
  if (state === "success") return <Notice title="Changes saved" tone="success">Your updates are now live.</Notice>;
  if (state === "error") return <Notice title="Could not save changes" tone="danger">{message}</Notice>;
  return null;
}

export function ProfileForm({
  initial = {},
}: {
  initial?: { fullName?: string; instagramHandle?: string; followerCount?: number; upiPayoutId?: string };
}) {
  const { state, message, submit } = useJsonForm("/api/profile", "PATCH", (payload) => ({
    fullName: String(payload.fullName),
    instagramHandle: String(payload.instagramHandle).replace(/^@/, ""),
    followerCount: Number(payload.followerCount),
    upiPayoutId: String(payload.upiPayoutId || "") || null,
  }));
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid">
        <Input label="Full name" name="fullName" autoComplete="name" defaultValue={initial.fullName} required />
        <Input label="Instagram handle" name="instagramHandle" defaultValue={initial.instagramHandle} required />
        <Input label="Follower count" name="followerCount" type="number" min="0" step="1" defaultValue={initial.followerCount} required />
        <Input label="UPI payout ID" name="upiPayoutId" defaultValue={initial.upiPayoutId} placeholder="name@bank" />
      </div>
      <FormFeedback state={state} message={message} />
      <Button type="submit" disabled={state === "pending"}>{state === "pending" ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}

export function ProgramForm({
  influencers = [],
  products = [],
}: {
  influencers?: { id: string; name: string }[];
  products?: { id: string; title: string; costMinor: number | null; currency: string }[];
}) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [productRows, setProductRows] = useState(1);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const productIds = form.getAll("productId");
    const commissions = form.getAll("commissionPercent");
    const bases = form.getAll("commissionBasis");
    const costs = form.getAll("productCost");
    const payload = {
      influencerId: String(form.get("influencerId")),
      code: String(form.get("code")),
      discountPercent: Number(form.get("discountPercent")),
      status: String(form.get("status")),
      products: productIds.map((productId, index) => ({
        productId: String(productId),
        commissionPercent: Number(commissions[index]),
        commissionBasis: String(bases[index]),
        costBasisMinor:
          String(costs[index] || "").trim() === ""
            ? null
            : Math.round(Number(costs[index]) * 100),
      })),
    };

    try {
      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Request failed");
      setState("success");
      event.currentTarget.reset();
      setProductRows(1);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid">
        <Select label="Assign influencer" name="influencerId" required defaultValue="">
          <option value="" disabled>Select an influencer</option>
          {influencers.map((influencer) => <option key={influencer.id} value={influencer.id}>{influencer.name}</option>)}
        </Select>
        <Input label="Unique code" name="code" required placeholder="MAYA15" />
        <Input label="Discount (%)" name="discountPercent" type="number" min="0" max="100" step="0.1" required />
        <Select label="Initial status" name="status" defaultValue="draft">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </Select>
      </div>
      <div className="form-section">
        <div className="form-section__intro">
          <span className="eyebrow">Product economics</span>
          <h3>Assigned products</h3>
          <p>Set commission and cost independently for every product covered by this code.</p>
        </div>
        <div className="form-stack">
          {Array.from({ length: productRows }, (_, index) => (
            <div className="form-grid" key={index}>
              <Select id={`product-${index}`} label={`Product ${index + 1}`} name="productId" required defaultValue="">
                <option value="" disabled>Select a product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
              </Select>
              <Input id={`commission-${index}`} label="Commission (%)" name="commissionPercent" type="number" min="0" max="100" step="0.1" required />
              <Input id={`cost-${index}`} label="Product cost (major units)" name="productCost" type="number" min="0" step="0.01" />
              <Select id={`basis-${index}`} label="Commission basis" name="commissionBasis" required defaultValue="net_revenue">
                <option value="net_revenue">Net revenue</option>
                <option value="gross_margin">Gross margin</option>
              </Select>
            </div>
          ))}
          <div className="form-actions">
            {productRows > 1 ? (
              <Button type="button" variant="quiet" onClick={() => setProductRows((count) => count - 1)}>
                Remove last
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setProductRows((count) => Math.min(count + 1, products.length || 1))}>
              Add product
            </Button>
          </div>
        </div>
      </div>
      <FormFeedback state={state} message={message} />
      <Button type="submit" disabled={state === "pending"}>{state === "pending" ? "Creating…" : "Create promotion"}</Button>
    </form>
  );
}

export function SettingsForm({
  initial = {},
}: {
  initial?: Record<string, string | number | undefined>;
}) {
  const { state, message, submit } = useJsonForm("/api/settings", "PUT", (payload) => ({
    brandName: String(payload.brandName),
    logoUrl: String(payload.logoUrl || "").trim() || null,
    tagline: String(payload.tagline || ""),
    currency: String(payload.currency),
    payoutThresholdMinor: Math.round(Number(payload.payoutThreshold) * 100),
    defaultDiscountPercent: Number(payload.defaultDiscountPercent),
    primaryColor: String(payload.primaryColor),
    accentColor: String(payload.accentColor),
    supportEmail: String(payload.supportEmail || "") || null,
  }));
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-section">
        <div className="form-section__intro">
          <span className="eyebrow">Identity</span>
          <h2>Program branding</h2>
          <p>Shown to influencers across sign-in, onboarding, and their partner desk.</p>
        </div>
        <div className="form-grid">
          <Input label="Company name" name="brandName" defaultValue={initial.brandName} required />
          <Input label="Tagline" name="tagline" defaultValue={initial.tagline} />
          <Input label="Logo URL" name="logoUrl" type="url" defaultValue={initial.logoUrl} />
          <Input label="Support email" name="supportEmail" type="email" defaultValue={initial.supportEmail} required />
          <Input label="Primary color" name="primaryColor" type="color" defaultValue={String(initial.primaryColor || "#14213d")} />
          <Input label="Accent color" name="accentColor" type="color" defaultValue={String(initial.accentColor || "#e65336")} />
        </div>
      </div>
      <div className="form-section">
        <div className="form-section__intro">
          <span className="eyebrow">Economics</span>
          <h2>Program defaults</h2>
          <p>Defaults can be overridden for individual promotions.</p>
        </div>
        <div className="form-grid">
          <Input label="Currency" name="currency" minLength={3} maxLength={3} defaultValue={initial.currency || "INR"} required />
          <Input label="Payout threshold (major units)" name="payoutThreshold" type="number" min="0.01" step="0.01" defaultValue={Number(initial.payoutThresholdMinor || 200000) / 100} required />
          <Input label="Default discount (%)" name="defaultDiscountPercent" type="number" min="0.01" max="100" step="0.1" defaultValue={initial.defaultDiscountPercent} required />
        </div>
      </div>
      <FormFeedback state={state} message={message} />
      <Button type="submit" disabled={state === "pending"}>{state === "pending" ? "Saving settings…" : "Save settings"}</Button>
    </form>
  );
}
