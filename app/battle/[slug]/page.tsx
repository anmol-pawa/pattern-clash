import { notFound } from "next/navigation";
import BattleScreen from "@/components/battle/BattleScreen";
import { getProblem, problemSlugs } from "@/lib/stages/registry";

export function generateStaticParams() {
  return problemSlugs().map((slug) => ({ slug }));
}

export default async function BattlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();
  return <BattleScreen problem={problem} />;
}
