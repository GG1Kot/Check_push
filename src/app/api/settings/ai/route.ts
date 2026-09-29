import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAISettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

const Patch = z.object({
  aiAnalysis: z.boolean().optional(),
  analyzePrivateRepositories: z.boolean().optional(),
  aiPushSummaries: z.boolean().optional(),
  dailyAIDigest: z.boolean().optional(),
  detailedAnalysis: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(await getAISettings());
}

export async function PATCH(request: Request) {
  const data = Patch.parse(await request.json());
  const settings = await prisma.aISettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  return NextResponse.json(settings);
}
