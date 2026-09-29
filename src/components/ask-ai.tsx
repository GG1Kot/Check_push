"use client";
import { useState } from "react";

export function AskAI({ repos }: { repos: Array<{id:string;fullName:string}> }) {
  const [question,setQuestion]=useState(""); const [repositoryId,setRepositoryId]=useState(""); const [answer,setAnswer]=useState(""); const [loading,setLoading]=useState(false); const [ids,setIds]=useState<string[]>([]);
  const ask=async()=>{setLoading(true);setAnswer(""); const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question,repositoryId:repositoryId||undefined})}); const d=await r.json(); setAnswer(d.answer??d.error??"No answer");setIds(d.relevantEventIds??[]);setLoading(false);};
  return <div className="card"><div className="grid2"><select className="select" value={repositoryId} onChange={e=>setRepositoryId(e.target.value)}><option value="">All repositories</option>{repos.map(r=><option key={r.id} value={r.id}>{r.fullName}</option>)}</select><div /></div><textarea className="textarea" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Что изменили в авторизации за последние дни?" /><div style={{marginTop:10}}><button className="button primary" disabled={loading||question.length<2} onClick={ask}>{loading?"Thinking…":"Ask AI"}</button></div>{answer&&<div className="section"><div className="summary">{answer}</div>{ids.length>0&&<div className="status" style={{marginTop:12}}>Grounded in {ids.length} event(s).</div>}</div>}</div>;
}
