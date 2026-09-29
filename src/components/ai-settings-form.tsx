"use client";
import { useState } from "react";

type Settings = { aiAnalysis:boolean; analyzePrivateRepositories:boolean; aiPushSummaries:boolean; dailyAIDigest:boolean; detailedAnalysis:boolean };
type Repo = { id:string; fullName:string; isPrivate:boolean; aiEnabled:boolean|null };

export function AISettingsForm({ initial, repos: initialRepos }: { initial: Settings; repos: Repo[] }) {
  const [settings, setSettings] = useState(initial);
  const [repos, setRepos] = useState(initialRepos);
  const [status, setStatus] = useState("");
  const update = async (key: keyof Settings, value: boolean) => {
    const next = { ...settings, [key]: value }; setSettings(next); setStatus("Saving…");
    await fetch("/api/settings/ai", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ [key]: value }) }); setStatus("Saved");
  };
  const labels: Array<[keyof Settings,string,string]> = [
    ["aiAnalysis","AI Analysis","Generate AI summaries for eligible repositories."],
    ["analyzePrivateRepositories","Analyze private repositories","Explicit opt-in for sending sanitized private-repo context to the AI API."],
    ["aiPushSummaries","AI Push Summaries","Use concise AI summaries in Web Push notifications."],
    ["dailyAIDigest","Daily AI Digest","Generate a daily summary from already analyzed repository events."],
    ["detailedAnalysis","Detailed Analysis","Keep detailed What changed / Why it matters views enabled."],
  ];
  return <div className="controls">
    {labels.map(([key,title,desc]) => <label className="control" key={key}><span><b>{title}</b><small>{desc}</small></span><input type="checkbox" checked={settings[key]} onChange={(e)=>update(key,e.target.checked)} /></label>)}
    <div className="status">{status}</div>
    <div className="section"><h2>Repository overrides</h2>{repos.map((repo) => <div className="control" key={repo.id}><span><b>{repo.fullName}</b><small>{repo.isPrivate ? "Private" : "Public"} · {repo.aiEnabled === null ? "Uses global setting" : repo.aiEnabled ? "AI forced on" : "AI off"}</small></span><select className="select" style={{width:160}} value={repo.aiEnabled === null ? "inherit" : repo.aiEnabled ? "on" : "off"} onChange={async(e)=>{const v=e.target.value; const aiEnabled=v==="inherit"?null:v==="on"; setRepos(rs=>rs.map(r=>r.id===repo.id?{...r,aiEnabled}:r)); await fetch(`/api/repositories/${repo.id}/ai`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({aiEnabled})});}}><option value="inherit">Global</option><option value="on">On</option><option value="off">Off</option></select></div>)}</div>
  </div>;
}
