import { prisma } from "@/lib/prisma";
import { fetchCommit, fetchPullRequest } from "@/lib/github";
import { buildDiffGroups, prepareFiles } from "@/lib/diff";
import { analyzeDiff, embed, summarizeMany, createPeriodSummary } from "@/lib/openai";
import { analysisPrompt } from "@/lib/analysis-prompt";
import { getAISettings, isAIAllowed } from "@/lib/settings";
import { sendPush } from "@/lib/push";
import { sanitizeSecrets } from "@/lib/sanitizer";

function combineUsage(items: Array<{ inputTokens: number; outputTokens: number; estimatedCostUsd: number }>) {
  return items.reduce((a, b) => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd }), { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
}

export async function processEvent(eventId: string) {
  const event = await prisma.changeEvent.findUnique({ where: { id: eventId }, include: { repository: true, aiAnalysis: true } });
  if (!event) throw new Error(`Event ${eventId} not found`);
  if (event.aiAnalysis) return;
  if (!(await isAIAllowed(event.repository))) {
    await prisma.changeEvent.update({ where: { id: eventId }, data: { status: "SKIPPED", errorMessage: "AI disabled by settings" } });
    return;
  }

  const claim = await prisma.changeEvent.updateMany({
    where: { id: eventId, status: { in: ["RECEIVED", "QUEUED", "FAILED"] } },
    data: { status: "ANALYZING", errorMessage: null },
  });
  if (claim.count === 0) return;

  try {
    let fetched: Awaited<ReturnType<typeof fetchCommit>> | Awaited<ReturnType<typeof fetchPullRequest>>;
    let eventType: string;
    let prTitle: string | null = null;
    let prDescription: string | null = null;

    if (event.entityType === "pull_request" && event.prNumber) {
      fetched = await fetchPullRequest(event.repository.fullName, event.prNumber);
      eventType = `Pull Request #${event.prNumber}`;
      prTitle = fetched.title;
      prDescription = fetched.message;
    } else if (event.sha) {
      fetched = await fetchCommit(event.repository.fullName, event.sha);
      eventType = "Commit";
    } else {
      await prisma.changeEvent.update({ where: { id: eventId }, data: { status: "SKIPPED", errorMessage: "No analyzable commit or PR reference" } });
      return;
    }

    const prepared = prepareFiles(fetched.files);
    await prisma.$transaction([
      prisma.changedFile.deleteMany({ where: { eventId } }),
      prisma.changeEvent.update({
        where: { id: eventId },
        data: {
          title: fetched.title,
          message: fetched.message,
          author: fetched.author,
          branch: "branch" in fetched ? fetched.branch ?? event.branch : event.branch,
          additions: fetched.additions,
          deletions: fetched.deletions,
          filesChanged: prepared.length,
        },
      }),
      ...prepared.map((f) => prisma.changedFile.create({ data: {
        eventId,
        path: f.path,
        status: f.status,
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
        patch: f.patch || null,
        skippedAI: f.skippedAI,
        skipReason: f.skipReason,
      } })),
    ]);

    const groups = buildDiffGroups(prepared);
    if (!groups.length) {
      await prisma.changeEvent.update({ where: { id: eventId }, data: { status: "SKIPPED", errorMessage: "No useful textual diff after filtering" } });
      return;
    }

    const common = {
      repository: event.repository.fullName,
      eventType,
      commitMessage: event.entityType === "pull_request" ? null : fetched.message,
      prTitle,
      prDescription,
      branch: ("branch" in fetched ? fetched.branch : undefined) ?? event.branch,
      additions: fetched.additions,
      deletions: fetched.deletions,
      files: prepared,
    };

    const usages = [];
    let finalResult;
    let model = "";
    if (groups.length === 1) {
      const one = await analyzeDiff(sanitizeSecrets(analysisPrompt({ ...common, diff: groups[0]! })).text);
      finalResult = one.result; model = one.model; usages.push(one.usage);
    } else {
      const partials = [];
      for (let i = 0; i < groups.length; i++) {
        const partialPrompt = analysisPrompt({ ...common, diff: groups[i]! }) + `\n\nThis is diff group ${i + 1} of ${groups.length}. Focus only on this group.`;
        const partial = await analyzeDiff(sanitizeSecrets(partialPrompt).text);
        partials.push(partial.result);
        usages.push(partial.usage);
        model = partial.model;
      }
      const aggregate = await summarizeMany(sanitizeSecrets(`Repository: ${event.repository.fullName}\nEvent: ${eventType}\nStats: +${fetched.additions}/-${fetched.deletions}\n\nPartial analyses:\n${JSON.stringify(partials)}`).text);
      finalResult = aggregate.result; model = aggregate.model; usages.push(aggregate.usage);
    }

    const embedding = await embed(`${finalResult.headline}\n${finalResult.shortSummary}\n${finalResult.whatChanged}\n${finalResult.affectedAreas.join(", ")}`).catch(() => []);
    const usage = combineUsage(usages);

    await prisma.$transaction([
      prisma.aIAnalysis.create({ data: {
        eventId,
        ...finalResult,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: usage.estimatedCostUsd,
        embedding,
      } }),
      prisma.aIUsage.create({ data: { eventId, purpose: "event-analysis", model, ...usage } }),
      prisma.changeEvent.update({ where: { id: eventId }, data: { status: "READY", errorMessage: null } }),
    ]);

    const settings = await getAISettings();
    if (settings.aiPushSummaries) {
      await sendPush({
        title: `${event.repository.name} · ${finalResult.headline}`,
        body: `${finalResult.shortSummary}\n+${fetched.additions} / -${fetched.deletions} · ${prepared.length} files`,
        url: `/events/${eventId}`,
        tag: `event-${eventId}`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.changeEvent.update({ where: { id: eventId }, data: { status: "FAILED", errorMessage: message.slice(0, 1000) } });
    throw error;
  }
}

export async function buildDailyDigests() {
  const settings = await getAISettings();
  if (!settings.dailyAIDigest || !settings.aiAnalysis) return;
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const repos = await prisma.repository.findMany();

  for (const repository of repos) {
    if (!(await isAIAllowed(repository))) continue;
    const events = await prisma.changeEvent.findMany({
      where: { repositoryId: repository.id, occurredAt: { gte: start, lte: end }, aiAnalysis: { isNot: null } },
      include: { aiAnalysis: true }, orderBy: { occurredAt: "asc" },
    });
    if (!events.length) continue;
    const context = events.map((e) => `[${e.id}] ${e.aiAnalysis!.headline}: ${e.aiAnalysis!.shortSummary} Warnings: ${e.aiAnalysis!.warnings.join("; ")}`).join("\n");
    const ai = await createPeriodSummary(`Create a daily digest for ${repository.fullName}.\nEvents (${events.length}):\n${context}`);
    await prisma.dailyDigest.upsert({
      where: { repositoryId_date: { repositoryId: repository.id, date } },
      create: {
        repositoryId: repository.id, date, ...ai.result, model: ai.model,
        commitCount: events.filter((e) => e.entityType === "commit").length,
        prCount: events.filter((e) => e.entityType === "pull_request").length,
        filesChanged: events.reduce((n, e) => n + e.filesChanged, 0),
      },
      update: {
        ...ai.result, model: ai.model,
        commitCount: events.filter((e) => e.entityType === "commit").length,
        prCount: events.filter((e) => e.entityType === "pull_request").length,
        filesChanged: events.reduce((n, e) => n + e.filesChanged, 0),
      },
    });
    await prisma.aIUsage.create({ data: { purpose: "daily-digest", model: ai.model, ...ai.usage } });
  }
}

export async function buildRepositorySummary(repositoryId: string, rangeKey: "24h" | "7d" | "30d") {
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository || !(await isAIAllowed(repository))) throw new Error("Repository not found or AI disabled");
  const hours = rangeKey === "24h" ? 24 : rangeKey === "7d" ? 24 * 7 : 24 * 30;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - hours * 60 * 60 * 1000);
  const events = await prisma.changeEvent.findMany({
    where: { repositoryId, occurredAt: { gte: periodStart }, aiAnalysis: { isNot: null } },
    include: { aiAnalysis: true }, orderBy: { occurredAt: "asc" }, take: 250,
  });
  if (!events.length) return null;
  const context = events.map((e) => `[${e.id}] ${e.aiAnalysis!.headline}: ${e.aiAnalysis!.shortSummary}`).join("\n");
  const ai = await createPeriodSummary(`Create a repository overview for ${repository.fullName}, range ${rangeKey}.\n${context}`);
  const summary = await prisma.repositorySummary.create({ data: { repositoryId, rangeKey, periodStart, periodEnd, ...ai.result, model: ai.model, eventCount: events.length } });
  await prisma.aIUsage.create({ data: { purpose: `repository-summary:${rangeKey}`, model: ai.model, ...ai.usage } });
  return summary;
}
