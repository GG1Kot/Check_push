import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RepositoryOverview } from "@/components/repository-overview";
export const dynamic="force-dynamic";
export default async function RepositoryPage({params}:{params:Promise<{id:string}>}){const{id}=await params;const repo=await prisma.repository.findUnique({where:{id}});if(!repo)notFound();const digest=await prisma.dailyDigest.findFirst({where:{repositoryId:id},orderBy:{date:"desc"}});return <><div className="subtle">Repository</div><h1 className="pageTitle">{repo.fullName}</h1><RepositoryOverview repositoryId={id}/>{digest&&<div className="section"><h2>Latest Daily Summary</h2><div className="card"><div className="summary">{digest.summary}</div><div className="stats"><span>{digest.commitCount} commits</span><span>{digest.prCount} PRs</span><span>{digest.filesChanged} files</span></div>{digest.important.map(x=><div className="warning" key={x}>⚠ {x}</div>)}</div></div>}</>}
