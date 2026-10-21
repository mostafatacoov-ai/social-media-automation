import { ReelStudio } from "./ReelStudio";

export const dynamic = "force-dynamic";

export default async function ReelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReelStudio reelId={id} />;
}
