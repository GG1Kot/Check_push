import { Octokit } from "@octokit/rest";
import { env } from "@/lib/env";
import type { RawChangedFile } from "@/lib/diff";

function client() {
  if (!env.githubToken) throw new Error("GITHUB_TOKEN is not configured");
  return new Octokit({ auth: env.githubToken });
}

function split(fullName: string) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) throw new Error(`Invalid repository name: ${fullName}`);
  return { owner, repo };
}

export async function fetchCommit(fullName: string, sha: string) {
  const { owner, repo } = split(fullName);
  const response = await client().rest.repos.getCommit({ owner, repo, ref: sha, per_page: 100 });
  const files: RawChangedFile[] = (response.data.files ?? []).map((f) => ({
    path: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  }));
  return {
    title: response.data.commit.message.split("\n")[0] ?? "Commit",
    message: response.data.commit.message,
    author: response.data.author?.login ?? response.data.commit.author?.name ?? undefined,
    additions: files.reduce((n, f) => n + (f.additions ?? 0), 0),
    deletions: files.reduce((n, f) => n + (f.deletions ?? 0), 0),
    files,
  };
}

export async function fetchPullRequest(fullName: string, number: number) {
  const { owner, repo } = split(fullName);
  const [pr, list] = await Promise.all([
    client().rest.pulls.get({ owner, repo, pull_number: number }),
    client().rest.pulls.listFiles({ owner, repo, pull_number: number, per_page: 100 }),
  ]);
  const files: RawChangedFile[] = list.data.map((f) => ({
    path: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  }));
  return {
    title: pr.data.title,
    message: pr.data.body ?? "",
    author: pr.data.user?.login ?? undefined,
    branch: pr.data.head.ref,
    additions: pr.data.additions,
    deletions: pr.data.deletions,
    files,
  };
}
