const number = (name: string, fallback: number) => {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  aiMaxFileChars: number("AI_MAX_FILE_CHARS", 16_000),
  aiMaxGroupChars: number("AI_MAX_GROUP_CHARS", 36_000),
  aiMaxTotalChars: number("AI_MAX_TOTAL_CHARS", 140_000),
  aiSearchCandidates: number("AI_SEARCH_CANDIDATES", 500),
  inputUsdPerMillion: number("OPENAI_INPUT_USD_PER_MILLION", 0.2),
  outputUsdPerMillion: number("OPENAI_OUTPUT_USD_PER_MILLION", 1.2),
  vapidSubject: process.env.VAPID_SUBJECT ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
};
