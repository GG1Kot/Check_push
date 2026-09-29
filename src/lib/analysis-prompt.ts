import type { PreparedFile } from "@/lib/diff";

export function analysisPrompt(params: {
  repository: string;
  eventType: string;
  commitMessage?: string | null;
  prTitle?: string | null;
  prDescription?: string | null;
  branch?: string | null;
  additions: number;
  deletions: number;
  files: PreparedFile[];
  diff: string;
}) {
  const fileList = params.files.map((f) => `- ${f.path} (+${f.additions ?? 0}/-${f.deletions ?? 0})${f.skippedAI ? ` [AI skipped: ${f.skipReason}]` : ""}`).join("\n");
  return `Analyze this GitHub change.\n\nRepository: ${params.repository}\nEvent: ${params.eventType}\nBranch: ${params.branch ?? "unknown"}\nCommit message: ${params.commitMessage ?? "n/a"}\nPR title: ${params.prTitle ?? "n/a"}\nPR description: ${params.prDescription ?? "n/a"}\nStats: +${params.additions} / -${params.deletions}, ${params.files.length} files\n\nChanged files:\n${fileList}\n\nSanitized diff:\n${params.diff}`;
}
