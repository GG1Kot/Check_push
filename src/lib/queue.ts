import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

export const AI_QUEUE = "github-change-ai";

let queue: Queue | undefined;

export function getAIQueue() {
  if (!queue) queue = new Queue(AI_QUEUE, { connection: createRedisConnection() });
  return queue;
}

export async function enqueueEvent(eventId: string) {
  return getAIQueue().add(
    "analyze-event",
    { eventId },
    {
      jobId: `event:${eventId}`,
      attempts: 4,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { age: 86_400, count: 5_000 },
      removeOnFail: { age: 604_800, count: 10_000 },
    },
  );
}
