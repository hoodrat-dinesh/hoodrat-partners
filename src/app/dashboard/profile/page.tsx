import type { Metadata } from "next";
import { ProfileForm } from "@/components/resource-forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Partner profile" };

export default async function ProfilePage() {
  const context = await requireUser();
  const profile = context.profile;
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Keep your public identity and payout destination current."
        actions={<Badge tone={profile.approval_status === "approved" ? "success" : profile.approval_status === "pending" ? "warning" : "danger"}>{profile.approval_status}</Badge>}
      />
      <Card className="section-shell">
        <ProfileForm
          initial={{
            fullName: profile.full_name ?? "",
            instagramHandle: profile.instagram_handle ? `@${profile.instagram_handle}` : "",
            followerCount: profile.follower_count ?? 0,
            upiPayoutId: profile.upi_payout_id ?? "",
          }}
        />
      </Card>
    </>
  );
}
