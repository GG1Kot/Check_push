import IORedis from "ioredis";
import { env } from "@/lib/env";

export function createRedisConnection() {
  return new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
}
