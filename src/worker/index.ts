import "dotenv/config";
import { Worker } from "bullmq";
import { AI_QUEUE } from "@/lib/queue";
import { createRedisConnection } from "@/lib/redis";
import { buildDailyDigests, buildRepositorySummary, processEvent } from "@/lib/worker-tasks";
import { prisma } from "@/lib/prisma";

const worker = new Worker(
  AI_QUEUE,
  async (job) => {
    if (job.name === "analyze-event") return processEvent(job.data.eventId);
    if (job.name === "daily-digest") return buildDailyDigests();
    if (job.name === "repository-summary") return buildRepositorySummary(job.data.repositoryId, job.data.rangeKey);
    throw new Error(`Unknown job: ${job.name}`);
  },
  { connection: createRedisConnection(), concurrency: 3 },
);

worker.on("completed", (job) => console.log(`✓ ${job.name} ${job.id}`));
worker.on("failed", (job, error) => console.error(`✗ ${job?.name} ${job?.id}`, error));

console.log("GitHub Changes AI worker started");

// Recovery path: if Redis was unavailable when a webhook arrived, the event is still
// stored as RECEIVED. The worker periodically claims those durable events directly.
const recoveryTimer = setInterval(async () => {
  try {
    const pending = await prisma.changeEvent.findMany({
      where: { status: { in: ["RECEIVED", "QUEUED"] }, receivedAt: { lt: new Date(Date.now() - 15_000) } },
      select: { id: true },
      orderBy: { receivedAt: "asc" },
      take: 20,
    });
    for (const event of pending) await processEvent(event.id);
  } catch (error) {
    console.error("Pending-event recovery failed", error);
  }
}, 60_000);
(recoveryTimer as any).unref?.();

const shutdown = async () => {
  clearInterval(recoveryTimer);
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
