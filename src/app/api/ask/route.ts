import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { answerRepositoryQuestion, embed } from "@/lib/openai";
import { cosineSimilarity } from "@/lib/semantic";
import { env } from "@/lib/env";

const Schema = z.object({ question: z.string().min(2).max(1000), repositoryId: z.string().optional() });

export async function POST(request: Request) {
  const { question, repositoryId } = Schema.parse(await request.json());
  const vector = await embed(question);
  const analyses = await prisma.aIAnalysis.findMany({
    where: repositoryId ? { event: { repositoryId } } : undefined,
    include: { event: { include: { repository: true, files: { select: { path: true } } } } }, orderBy: { createdAt: "desc" }, take: env.aiSearchCandidates,
  });
  const semantic = analyses.map((a) => ({ a, score: cosineSimilarity(vector, Array.isArray(a.embedding) ? a.embedding as number[] : []) }))
    .sort((x, y) => y.score - x.score).slice(0, 24);
  const temporalQuestion = /(today|yesterday|week|month|24 hours|сегодня|вчера|недел|месяц|24 час)/i.test(question);
  const merged = new Map<string, (typeof semantic)[number]>();
  for (const item of semantic) merged.set(item.a.eventId, item);
  if (temporalQuestion) {
    for (const a of analyses.slice(0, 40)) if (!merged.has(a.eventId)) merged.set(a.eventId, { a, score: 0 });
  }
  const ranked = [...merged.values()].slice(0, 60);
  if (!ranked.length) return NextResponse.json({ answer: "Недостаточно данных: пока нет проанализированной истории repository.", insufficientData: true, relevantEventIds: [] });
  const context = ranked.map(({ a }) => `[${a.eventId}] ${a.event.occurredAt.toISOString()} ${a.event.repository.fullName}\n${a.headline}\n${a.shortSummary}\nWhat changed: ${a.whatChanged}\nFiles: ${a.event.files.map((f) => f.path).join(", ")}\nAreas: ${a.affectedAreas.join(", ")}\nWarnings: ${a.warnings.join("; ")}`).join("\n\n");
  const ai = await answerRepositoryQuestion(question, context);
  await prisma.aIUsage.create({ data: { purpose: "ask-ai", model: ai.model, ...ai.usage } });
  return NextResponse.json(ai.result);
}
