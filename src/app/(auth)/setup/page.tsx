import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const users = await prisma.user.count();
  if (users > 0) redirect("/login");
  const branding = await getBranding();
  return <SetupForm branding={branding} />;
}
