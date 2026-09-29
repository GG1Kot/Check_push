import { SemanticSearch } from "@/components/semantic-search";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function SearchPage(){const repos=await prisma.repository.findMany({orderBy:{fullName:"asc"},select:{id:true,fullName:true}});return <><h1 className="pageTitle">AI Search</h1><p className="subtle">Semantic search across commits, PRs and AI summaries.</p><SemanticSearch repos={repos}/></>}
