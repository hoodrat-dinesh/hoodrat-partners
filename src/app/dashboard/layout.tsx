import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthorizationError, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let context;
  try {
    context = await requireUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login?next=/dashboard");
    }
    throw error;
  }
  if (context.profile.role === "admin") redirect("/admin");
  if (!context.profile.onboarding_completed) redirect("/onboarding");
  const settings = await getSettings();
  return (
    <AppShell
      role="influencer"
      brand={{
        companyName: settings.brandName,
        logoUrl: settings.logoUrl ?? undefined,
        tagline: settings.tagline,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
      }}
      userName={context.profile.full_name || "Partner"}
      userEmail={context.profile.email ?? context.user.email}
      status={context.profile.approval_status}
    >
      {children}
    </AppShell>
  );
}
