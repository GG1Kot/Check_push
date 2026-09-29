import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAIQueue } from "@/lib/queue";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const rangeKey = ["24h", "7d", "30d"].includes(url.searchParams.get("range") ?? "") ? url.searchParams.get("range")! : "7d";
  const latest = await prisma.repositorySummary.findFirst({ where: { repositoryId: id, rangeKey }, orderBy: { createdAt: "desc" } });
  const fresh = latest && Date.now() - latest.createdAt.getTime() < 30 * 60 * 1000;
  if (!fresh) {
    await getAIQueue().add("repository-summary", { repositoryId: id, rangeKey }, { jobId: `repo-summary:${id}:${rangeKey}:${Math.floor(Date.now() / 1_800_000)}`, removeOnComplete: true });
  }
  return NextResponse.json({ summary: latest, status: fresh ? "ready" : latest ? "refreshing" : "analyzing" });
}
