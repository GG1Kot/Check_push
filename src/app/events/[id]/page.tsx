import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.changeEvent.findUnique({ where: { id }, include: { repository: true, aiAnalysis: true, files: { orderBy: { path: "asc" } } } });
  if (!event) notFound();
  const ai = event.aiAnalysis;
  return <>
    <div className="subtle"><Link href={`/repositories/${event.repository.id}`}>{event.repository.fullName} →</Link></div>
    <h1 className="pageTitle">{ai?.headline ?? event.title ?? "GitHub change"}</h1>
    <div className="row">
      {ai && <span className={`badge ${ai.changeType}`}>{ai.changeType.replace("_", " ")}</span>}
      <span className="status">{event.status}</span>
      {event.sha && <span className="status">{event.sha.slice(0, 8)}</span>}
    </div>

    {!ai && <div className="card"><b>{event.status === "FAILED" ? "AI analysis unavailable" : "Analyzing changes…"}</b><p className="subtle">The GitHub event is already saved and remains viewable. AI never blocks webhook processing.</p>{event.errorMessage && <div className="status">{event.errorMessage}</div>}</div>}

    {ai && <>
      <div className="section"><h2>AI Summary</h2><div className="summary">{ai.shortSummary}</div></div>
      <div className="section"><h2>What changed</h2><div className="summary">{ai.whatChanged}</div></div>
      <div className="section"><h2>Why it matters</h2><div className="summary">{ai.whyItMatters}</div></div>
      <div className="section"><h2>Impact: {ai.impactLevel}</h2><div className="summary">{ai.impactReason}</div></div>
      <div className="section"><h2>Technical changes</h2><ul className="list">{ai.technicalChanges.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div className="section"><h2>Affected areas</h2><div className="row">{ai.affectedAreas.map((x) => <span className="badge" key={x}>{x}</span>)}</div></div>
      {!!ai.warnings.length && <div className="section"><h2>Attention</h2>{ai.warnings.map((w) => <div className="warning" key={w}>⚠ {w}</div>)}</div>}
    </>}

    <div className="section"><h2>Files changed</h2><div className="stats"><span>{event.filesChanged} files</span><span className="plus">+{event.additions}</span><span className="minus">-{event.deletions}</span></div>
      {event.files.map((file) => <details className="file" key={file.id}><summary><code>{file.path}</code> <span className="plus">+{file.additions}</span> <span className="minus">-{file.deletions}</span>{file.skippedAI && <span className="status"> · AI skipped: {file.skipReason}</span>}</summary>{file.patch && <pre className="diff">{file.patch}</pre>}</details>)}
    </div>
  </>;
}
