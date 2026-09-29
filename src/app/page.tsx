import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PushButton } from "@/components/push-button";

export const dynamic = "force-dynamic";

function ago(date: Date) {
  const sec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60); if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default async function Home() {
  const events = await prisma.changeEvent.findMany({ include: { repository: true, aiAnalysis: true }, orderBy: { occurredAt: "desc" }, take: 100 });
  return <>
    <div className="row space"><div><h1 className="pageTitle">Changes</h1><div className="subtle">GitHub remains the source of truth. AI only explains what changed.</div></div><PushButton /></div>
    {!events.length && <div className="empty">No GitHub events yet. Configure the webhook, then push a commit.</div>}
    {events.map((event) => <Link className="card" key={event.id} href={`/events/${event.id}`}>
      <div className="row space"><span className="repo">{event.repository.name}</span><span className="status">{ago(event.occurredAt)}</span></div>
      <div className="row" style={{ marginTop: 10 }}>
        {event.aiAnalysis && <span className={`badge ${event.aiAnalysis.changeType}`}>{event.aiAnalysis.changeType.replace("_", " ")}</span>}
        <span className="status">{event.status === "ANALYZING" || event.status === "QUEUED" ? "Analyzing changes…" : event.status === "FAILED" ? "AI analysis unavailable" : event.githubEvent}</span>
      </div>
      <h2 className="headline">{event.aiAnalysis?.headline ?? event.title ?? event.message?.split("\n")[0] ?? "GitHub change"}</h2>
      <div className="summary">{event.aiAnalysis?.shortSummary ?? (event.status === "FAILED" ? "GitHub event is saved; AI analysis failed and can be retried." : "The raw GitHub event is available while AI processing runs in the background.")}</div>
      {event.aiAnalysis && <div className="impact" style={{ marginTop: 10 }}>Impact: <b>{event.aiAnalysis.impactLevel}</b></div>}
      <div className="row space"><div className="stats"><span>{event.filesChanged} files</span><span className="plus">+{event.additions}</span><span className="minus">-{event.deletions}</span></div><span className="status">View changes →</span></div>
    </Link>)}
  </>;
}
