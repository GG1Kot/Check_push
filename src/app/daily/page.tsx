import Link from "next/link";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function DailyPage(){
  const digests=await prisma.dailyDigest.findMany({include:{repository:true},orderBy:{date:"desc"},take:50});
  return <><h1 className="pageTitle">Daily Summary</h1><p className="subtle">One AI digest per repository from already analyzed GitHub events.</p>
  {!digests.length&&<div className="empty">No daily digests yet. The scheduled daily job will create them after events have been analyzed.</div>}
  {digests.map(d=><Link className="card" href={`/repositories/${d.repositoryId}`} key={d.id}><div className="row space"><span className="repo">{d.repository.fullName}</span><span className="status">{d.date.toISOString().slice(0,10)}</span></div><div className="stats"><span>{d.commitCount} commits</span><span>{d.prCount} pull requests</span><span>{d.filesChanged} files changed</span></div><div className="section"><div className="summary">{d.summary}</div></div>{d.highlights.length>0&&<ul className="list">{d.highlights.map(x=><li key={x}>{x}</li>)}</ul>}{d.important.map(x=><div className="warning" key={x}>⚠ {x}</div>)}</Link>)}
  </>;
}
