import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthorizationError, requireAdmin } from "@/lib/auth";
import { getAdminSettings } from "@/lib/data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let context;
  try {
    context = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect("/login?next=/admin");
    }
    redirect("/dashboard");
  }
  const settings = await getAdminSettings(context);
  return (
    <AppShell
      role="admin"
      brand={{
        companyName: settings.brandName,
        logoUrl: settings.logoUrl ?? undefined,
        tagline: settings.tagline,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
      }}
      userName={context.profile.full_name || "Program admin"}
      userEmail={context.profile.email ?? context.user.email}
      status="Administrator"
    >
      {children}
    </AppShell>
  );
}
