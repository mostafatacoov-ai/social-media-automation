import { PlanViewer } from "./PlanViewer";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanViewer planId={id} />;
}
