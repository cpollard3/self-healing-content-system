import { llmReady, modelName } from "./llm";
import { readDb } from "./store";

export function snapshot() {
  return { db: readDb(), llm: { model: modelName(), ready: llmReady() } };
}
export type Snapshot = ReturnType<typeof snapshot>;

export function fail(e: unknown, status = 400) {
  return Response.json({ error: (e as Error).message }, { status });
}
