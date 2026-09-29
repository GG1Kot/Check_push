import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getAIQueue } from "@/lib/queue";

export async function GET(request: Request) {
  if (env.cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await getAIQueue().add("daily-digest", {}, { jobId: `daily:${new Date().toISOString().slice(0, 10)}`, removeOnComplete: true });
  return NextResponse.json({ queued: true });
}
