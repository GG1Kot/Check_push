import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { env } from "@/lib/env";
import { AIAnalysisSchema, AskSchema, SummarySchema, type AIAnalysisResult } from "@/lib/ai-schema";

let client: OpenAI | undefined;
function getClient() {
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");
  return (client ??= new OpenAI({ apiKey: env.openaiApiKey }));
}

export type Usage = { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
function usageOf(response: { usage?: { input_tokens?: number; output_tokens?: number } | null }): Usage {
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const estimatedCostUsd = (inputTokens / 1_000_000) * env.inputUsdPerMillion + (outputTokens / 1_000_000) * env.outputUsdPerMillion;
  return { inputTokens, outputTokens, estimatedCostUsd };
}

const systemRules = `You analyze GitHub changes as a READ-ONLY explanatory layer. GitHub data is the source of truth.
Be concise and concrete. Never claim a bug definitely exists unless the diff proves it.
When uncertain, use wording such as "may affect", "potentially affects", or "appears to change".
Impact is potential blast radius, not code quality. Warnings are informational, not accusations.
Explicitly watch for: database schema/migrations, authentication, permissions, environment variables, API contract changes, dependency removal/upgrades, deployment configuration, security-sensitive code, and possible breaking API changes.
Use a warning only when the supplied data supports it.
Never reveal or reconstruct secrets; redacted tokens are intentionally unavailable.`;

export async function analyzeDiff(input: string): Promise<{ result: AIAnalysisResult; usage: Usage; model: string }> {
  const response = await getClient().responses.parse({
    model: env.openaiModel,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: systemRules },
      { role: "user", content: input },
    ],
    text: { format: zodTextFormat(AIAnalysisSchema, "github_change_analysis") },
  });
  if (!response.output_parsed) throw new Error(`AI returned no parsed analysis (${response.status})`);
  return { result: response.output_parsed, usage: usageOf(response), model: env.openaiModel };
}

export async function summarizeMany(input: string) {
  const response = await getClient().responses.parse({
    model: env.openaiModel,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: systemRules + " Synthesize multiple partial analyses without inventing facts." },
      { role: "user", content: input },
    ],
    text: { format: zodTextFormat(AIAnalysisSchema, "github_change_aggregate") },
  });
  if (!response.output_parsed) throw new Error("AI returned no aggregate analysis");
  return { result: response.output_parsed, usage: usageOf(response), model: env.openaiModel };
}

export async function createPeriodSummary(input: string) {
  const response = await getClient().responses.parse({
    model: env.openaiModel,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: systemRules + " Summarize a period of repository work from only the supplied event summaries." },
      { role: "user", content: input },
    ],
    text: { format: zodTextFormat(SummarySchema, "repository_period_summary") },
  });
  if (!response.output_parsed) throw new Error("AI returned no period summary");
  return { result: response.output_parsed, usage: usageOf(response), model: env.openaiModel };
}

export async function answerRepositoryQuestion(question: string, context: string) {
  const response = await getClient().responses.parse({
    model: env.openaiModel,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: systemRules + " Answer only from the supplied repository history. If it is insufficient, say so plainly and set insufficientData=true." },
      { role: "user", content: `Question:\n${question}\n\nRepository history:\n${context}` },
    ],
    text: { format: zodTextFormat(AskSchema, "repository_question_answer") },
  });
  if (!response.output_parsed) throw new Error("AI returned no answer");
  return { result: response.output_parsed, usage: usageOf(response), model: env.openaiModel };
}

export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: env.openaiEmbeddingModel,
    input: text.slice(0, 12_000),
    encoding_format: "float",
  });
  return response.data[0]?.embedding ?? [];
}
