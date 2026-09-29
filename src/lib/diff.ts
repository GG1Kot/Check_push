import { env } from "@/lib/env";
import { sanitizeSecrets } from "@/lib/sanitizer";

export type RawChangedFile = {
  path: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch?: string | null;
};

export type PreparedFile = RawChangedFile & {
  patch: string;
  skippedAI: boolean;
  skipReason?: string;
  redactions: number;
};

const SKIP_NAMES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock",
  "poetry.lock", "Pipfile.lock", "Cargo.lock", "composer.lock",
]);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|mp4|mov|mp3|woff2?|ttf|otf|exe|dll|so|dylib|bin)$/i;
const MINIFIED = /\.min\.(js|css)$/i;
const GENERATED = /(^|\/)(dist|build|coverage|vendor|generated|\.next)(\/|$)/i;

export function classifySkip(path: string) {
  const name = path.split("/").pop() ?? path;
  if (SKIP_NAMES.has(name)) return "lock file";
  if (BINARY_EXT.test(path)) return "binary/asset";
  if (MINIFIED.test(path)) return "minified file";
  if (GENERATED.test(path)) return "generated/build output";
  return undefined;
}

export function prepareFiles(files: RawChangedFile[]): PreparedFile[] {
  return files.map((file) => {
    const skipReason = classifySkip(file.path);
    const original = file.patch ?? "";
    const truncated = original.slice(0, env.aiMaxFileChars);
    const { text, redactions } = sanitizeSecrets(truncated);
    return {
      ...file,
      patch: text,
      skippedAI: Boolean(skipReason || !original),
      skipReason: skipReason ?? (!original ? "no textual patch available" : undefined),
      redactions,
    };
  });
}

function priority(path: string) {
  if (/auth|security|permission|oauth|session|token/i.test(path)) return 100;
  if (/migration|schema\.prisma|database|db\//i.test(path)) return 90;
  if (/api|route|controller|server/i.test(path)) return 80;
  if (/config|docker|deploy|infra|\.ya?ml$/i.test(path)) return 70;
  if (/src|app|lib/i.test(path)) return 60;
  if (/test|spec/i.test(path)) return 30;
  if (/docs|readme/i.test(path)) return 20;
  return 50;
}

export function buildDiffGroups(files: PreparedFile[]) {
  const usable = files
    .filter((f) => !f.skippedAI)
    .sort((a, b) => priority(b.path) - priority(a.path));

  const groups: string[] = [];
  let current = "";
  let total = 0;

  for (const file of usable) {
    const header = `\n### ${file.path} (${file.status ?? "modified"}, +${file.additions ?? 0}/-${file.deletions ?? 0})\n`;
    const entry = header + file.patch + "\n";
    if (total >= env.aiMaxTotalChars) break;
    const remaining = env.aiMaxTotalChars - total;
    const clipped = entry.slice(0, remaining);
    if (current && current.length + clipped.length > env.aiMaxGroupChars) {
      groups.push(current);
      current = "";
    }
    current += clipped;
    total += clipped.length;
  }
  if (current) groups.push(current);
  return groups;
}
