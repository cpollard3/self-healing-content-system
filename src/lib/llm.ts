import { generateText, Output, type LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type { LlmCall } from "./types";

/**
 * Every LLM call in Fidelis goes through callLlm():
 *   prompt + zod schema in  ->  validated JSON out, logged for the UI.
 * It talks to any OpenAI-compatible API through the Vercel AI SDK
 * (default: Google Gemini's free tier).
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export function modelName(): string {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

export function llmReady(): boolean {
  return !!process.env.LLM_API_KEY || !!testModel;
}

let testModel: LanguageModel | null = null;
/** Tests inject a mock model instead of calling a real API. */
export function setTestModel(m: LanguageModel | null) {
  testModel = m;
}

function model(): LanguageModel {
  if (testModel) return testModel;
  if (!process.env.LLM_API_KEY) {
    throw new Error("No LLM configured: set LLM_API_KEY in .env.local (see .env.example), then restart the app.");
  }
  return createOpenAICompatible({
    name: "llm",
    baseURL: process.env.LLM_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    supportsStructuredOutputs: true,
  })(modelName());
}

export async function callLlm<T>(opts: {
  step: number;
  label: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  log: (call: LlmCall) => void;
}): Promise<T> {
  const started = Date.now();
  const entry: LlmCall = {
    id: `${opts.step}-${started.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    step: opts.step,
    label: opts.label,
    model: modelName(),
    system: opts.system,
    prompt: opts.prompt,
    response: null,
    ms: 0,
  };
  try {
    // Free tiers rate-limit hard; the SDK retries 429s with exponential backoff.
    const result = await generateText({
      model: model(),
      system: opts.system,
      prompt: opts.prompt,
      output: Output.object({ schema: opts.schema }),
      maxRetries: 8,
    });
    const parsed = opts.schema.parse(result.output);
    entry.response = parsed;
    entry.ms = Date.now() - started;
    opts.log(entry);
    return parsed;
  } catch (e) {
    entry.error = (e as Error).message;
    entry.ms = Date.now() - started;
    opts.log(entry);
    throw e;
  }
}

/** Run async work with limited concurrency, keeping result order. */
export async function pMap<I, O>(items: I[], limit: number, fn: (item: I, i: number) => Promise<O>): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
