import { prisma } from "@/lib/prisma";

export async function getAISettings() {
  return prisma.aISettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function isAIAllowed(repository: { isPrivate: boolean; aiEnabled: boolean | null }) {
  const settings = await getAISettings();
  if (!settings.aiAnalysis) return false;
  if (repository.aiEnabled === false) return false;
  if (repository.isPrivate && !settings.analyzePrivateRepositories) return false;
  return true;
}
