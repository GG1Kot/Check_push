# GitHub Changes AI

A mobile-first PWA that receives GitHub webhooks, stores GitHub events immediately, analyzes diffs asynchronously, redacts likely credentials before sending context to an external AI API, and turns technical changes into short human-readable summaries.

## Implemented

- GitHub `push` and `pull_request` webhooks.
- HMAC SHA-256 webhook signature verification.
- Durable raw event storage before AI work.
- BullMQ + Redis background processing; webhook never waits for the model.
- GitHub API diff fetching for commits and PRs.
- Secret sanitization for private keys, bearer tokens, GitHub tokens, AWS keys, JWTs, database URLs, common `.env` credential names, and more.
- Large-diff chunking with priority for auth/security, DB migrations, API, config and source code; lock/generated/minified/binary files are skipped for AI.
- Structured AI output: headline, short summary, What changed, Why it matters, technical changes, classification, impact, affected areas and warnings.
- `Low / Medium / High` blast-radius impact, not code-quality scoring.
- Web Push summaries for the installed PWA.
- Daily digest queue job and cached repository overview.
- Ask AI grounded only in stored repository history.
- Semantic search using embeddings stored with each analysis.
- Per-repository AI override plus global AI/privacy settings.
- AI usage + approximate token/cost tracking.
- Read-only GitHub behavior. There is no commit, merge, issue mutation or deployment action.

## Architecture

```text
GitHub
  -> POST /api/webhooks/github
  -> verify X-Hub-Signature-256
  -> upsert repository + store raw event
  -> enqueue BullMQ job
  -> HTTP 202 to GitHub

Worker
  -> GitHub API: commit / PR files
  -> diff filtering + secret sanitization
  -> chunk large changes
  -> OpenAI structured analysis
  -> save AIAnalysis + usage + embeddings
  -> Web Push
  -> UI reads DB
```

## Local setup

Requirements: Node.js 22.18+, Docker, a GitHub token with read access to the repositories you want to inspect, and an OpenAI API key.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

In another terminal:

```bash
npm run worker
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Copy them into `.env`, restart the app and worker, then enable Push from the homepage.

## GitHub webhook

For local development, expose `http://localhost:3000` with a tunnel. In GitHub repository settings add a webhook:

- Payload URL: `https://YOUR_HOST/api/webhooks/github`
- Content type: `application/json`
- Secret: exactly the value of `GITHUB_WEBHOOK_SECRET`
- Events: Pushes and Pull requests

The app verifies `X-Hub-Signature-256` against the unmodified request body.

## Private repositories

Private-repo AI is **off by default**. Open `Settings -> AI` and enable **Analyze private repositories** explicitly. A repository can also override the global setting.

The sanitizer reduces accidental credential exposure, but it is not a mathematical guarantee that arbitrary secrets can never pass through. For high-assurance deployments, add organization-specific secret detectors, data-loss-prevention rules and/or route the model through a provider configuration that satisfies your data-handling requirements.

## PWA / iPhone

Deploy the app over HTTPS, open it in Safari, use **Add to Home Screen**, launch the installed PWA, then press **Enable Push**. Web Push requires the VAPID environment variables.

## Daily digest

`/api/cron/daily` enqueues the daily digest. `vercel.json` contains a sample daily cron. If `CRON_SECRET` is set, call the route with `Authorization: Bearer <CRON_SECRET>` in environments that support custom cron headers. For other hosts, use their scheduler to call this route once per day.

## Production notes

This repository is a strong single-user/self-hosted MVP. Before a public multi-tenant launch, add:

1. Authentication and authorization around every UI/API route.
2. A GitHub App with installation tokens instead of one global `GITHUB_TOKEN`.
3. Per-user / per-installation webhook secret routing.
4. Encryption-at-rest strategy for stored patches/raw payloads and retention controls.
5. A managed Redis/Postgres deployment, observability and dead-letter/retry dashboards.
6. pgvector or a vector database if semantic-search history grows beyond a few hundred/thousand analyses; this MVP computes cosine similarity over a bounded candidate set in application memory.
7. Rate limits and per-user AI budgets.
8. A retry button / operations page for failed AI analyses.

## Important read-only rule

The GitHub client in this project only calls read endpoints (`repos.getCommit`, `pulls.get`, `pulls.listFiles`). AI is explanatory only and cannot change a repository.
