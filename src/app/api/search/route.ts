import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embed } from "@/lib/openai";
import { cosineSimilarity } from "@/lib/semantic";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const repositoryId = url.searchParams.get("repositoryId");
  if (!q) return NextResponse.json({ results: [] });
  const queryVector = await embed(q);
  const analyses = await prisma.aIAnalysis.findMany({
    where: repositoryId ? { event: { repositoryId } } : undefined,
    include: { event: { include: { repository: true } } },
    orderBy: { createdAt: "desc" }, take: env.aiSearchCandidates,
  });
  const results = analyses.map((a) => ({
    score: cosineSimilarity(queryVector, Array.isArray(a.embedding) ? a.embedding as number[] : []),
    id: a.eventId, headline: a.headline, summary: a.shortSummary,
    repository: a.event.repository.fullName, occurredAt: a.event.occurredAt,
  })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 30);
  return NextResponse.json({ results });
}
