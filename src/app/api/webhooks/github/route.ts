import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { verifyGitHubSignature } from "@/lib/github-signature";
import { enqueueEvent } from "@/lib/queue";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubSignature(body, signature, env.githubWebhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const deliveryId = request.headers.get("x-github-delivery");
  const githubEvent = request.headers.get("x-github-event") ?? "unknown";
  if (!deliveryId) return NextResponse.json({ error: "Missing delivery id" }, { status: 400 });

  const existing = await prisma.changeEvent.findUnique({ where: { deliveryId }, select: { id: true, status: true, entityType: true } });
  if (existing) {
    if (["RECEIVED", "QUEUED", "FAILED"].includes(existing.status) && (existing.entityType === "commit" || existing.entityType === "pull_request")) {
      try {
        await enqueueEvent(existing.id);
        await prisma.changeEvent.update({ where: { id: existing.id }, data: { status: "QUEUED" } });
      } catch {
        // Event is already durable. A later redelivery or recovery worker can enqueue it.
      }
    }
    return NextResponse.json({ ok: true, duplicate: true, eventId: existing.id });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const repo = payload.repository;
  if (!repo?.id || !repo?.full_name) return NextResponse.json({ ok: true, ignored: "No repository in payload" });

  const repository = await prisma.repository.upsert({
    where: { githubId: String(repo.id) },
    create: {
      githubId: String(repo.id), fullName: repo.full_name, name: repo.name,
      owner: repo.owner?.login ?? repo.full_name.split("/")[0], isPrivate: Boolean(repo.private), defaultBranch: repo.default_branch,
    },
    update: { fullName: repo.full_name, name: repo.name, owner: repo.owner?.login ?? repo.full_name.split("/")[0], isPrivate: Boolean(repo.private), defaultBranch: repo.default_branch },
  });

  let entityType = githubEvent;
  let sha: string | undefined;
  let prNumber: number | undefined;
  let title: string | undefined;
  let message: string | undefined;
  let branch: string | undefined;
  let author: string | undefined;
  let occurredAt = new Date();

  if (githubEvent === "push") {
    entityType = "commit";
    sha = payload.after;
    title = payload.head_commit?.message?.split("\n")[0];
    message = payload.head_commit?.message;
    branch = typeof payload.ref === "string" ? payload.ref.replace("refs/heads/", "") : undefined;
    author = payload.head_commit?.author?.username ?? payload.pusher?.name;
    if (payload.head_commit?.timestamp) occurredAt = new Date(payload.head_commit.timestamp);
  } else if (githubEvent === "pull_request") {
    entityType = "pull_request";
    prNumber = payload.number;
    sha = payload.pull_request?.head?.sha;
    title = payload.pull_request?.title;
    message = payload.pull_request?.body;
    branch = payload.pull_request?.head?.ref;
    author = payload.pull_request?.user?.login;
    if (payload.pull_request?.updated_at) occurredAt = new Date(payload.pull_request.updated_at);
  }

  const event = await prisma.changeEvent.create({ data: {
    deliveryId, githubEvent, action: payload.action, entityType, sha, prNumber, title, message, branch, author,
    rawPayload: payload, repositoryId: repository.id, occurredAt, status: "RECEIVED",
  } });

  // Do not wait for AI. The webhook is durable now; queueing is the only remaining fast operation.
  let queued = false;
  if (entityType === "commit" || entityType === "pull_request") {
    try {
      await enqueueEvent(event.id);
      await prisma.changeEvent.update({ where: { id: event.id }, data: { status: "QUEUED" } });
      queued = true;
    } catch (error) {
      console.error("Queue unavailable; event remains durable and pending", error);
    }
  } else {
    await prisma.changeEvent.update({ where: { id: event.id }, data: { status: "SKIPPED", errorMessage: "Event type not configured for AI analysis" } });
  }

  return NextResponse.json({ ok: true, eventId: event.id, queued }, { status: 202 });
}
