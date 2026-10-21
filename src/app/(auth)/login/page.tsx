import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.count();
  if (users === 0) redirect("/setup");
  const branding = await getBranding();
  return <LoginForm branding={branding} />;
}
