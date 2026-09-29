import { AISettingsForm } from "@/components/ai-settings-form";
import { prisma } from "@/lib/prisma";
import { getAISettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, repos, usage] = await Promise.all([
    getAISettings(),
    prisma.repository.findMany({ orderBy: { fullName: "asc" } }),
    prisma.aIUsage.aggregate({ _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true } }),
  ]);
  return <><h1 className="pageTitle">AI Settings</h1><p className="subtle">Private repository analysis is opt-in. All external AI context passes through the sanitization layer first.</p>
  <div className="card"><b>AI usage</b><div className="stats"><span>{usage._count._all} requests</span><span>{usage._sum.inputTokens ?? 0} input tokens</span><span>{usage._sum.outputTokens ?? 0} output tokens</span><span>~${(usage._sum.estimatedCostUsd ?? 0).toFixed(4)}</span></div></div>
  <AISettingsForm initial={settings} repos={repos.map((r) => ({ id: r.id, fullName: r.fullName, isPrivate: r.isPrivate, aiEnabled: r.aiEnabled }))} /></>;
}
