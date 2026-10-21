import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBranding } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { getActiveCompanyId } from "@/lib/api-helpers";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [branding, companies, activeCompanyId] = await Promise.all([
    getBranding(),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, primaryColor: true } }),
    getActiveCompanyId(),
  ]);

  return (
    <AppShell
      branding={branding}
      user={{ name: user.name, email: user.email }}
      companies={companies}
      activeCompanyId={activeCompanyId}
    >
      {children}
    </AppShell>
  );
}
