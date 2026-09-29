import { AskAI } from "@/components/ask-ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function AskPage() {
  const repos = await prisma.repository.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } });
  return <><h1 className="pageTitle">Ask AI</h1><p className="subtle">Answers are grounded only in stored GitHub history and AI summaries.</p><AskAI repos={repos} /></>;
}
