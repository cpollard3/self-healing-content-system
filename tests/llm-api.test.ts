import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { callLlm, setTestModel } from "@/lib/llm";
import type { LlmCall } from "@/lib/types";

function mock(text: string) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

afterEach(() => setTestModel(null));

describe("callLlm (Vercel AI SDK)", () => {
  const schema = z.object({ verdict: z.enum(["still_true", "changed", "removed"]), reason: z.string() });

  it("returns schema-validated output and logs the call", async () => {
    setTestModel(mock(JSON.stringify({ verdict: "changed", reason: "Deprecated." })));
    const calls: LlmCall[] = [];
    const out = await callLlm({ step: 5, label: "t", system: "s", prompt: "p", schema, log: (c) => calls.push(c) });
    expect(out).toEqual({ verdict: "changed", reason: "Deprecated." });
    expect(calls[0].model).toBeTruthy();
    expect(calls[0].error).toBeUndefined();
  });

  it("fails visibly when the model returns something that does not match the schema", async () => {
    setTestModel(mock(JSON.stringify({ verdict: "maybe" })));
    const calls: LlmCall[] = [];
    await expect(callLlm({ step: 5, label: "t", system: "s", prompt: "p", schema, log: (c) => calls.push(c) })).rejects.toThrow();
    expect(calls[0].error).toBeTruthy();
  });

  it("explains how to configure a key when none is set", async () => {
    delete process.env.LLM_API_KEY;
    await expect(callLlm({ step: 2, label: "t", system: "s", prompt: "p", schema, log: () => {} })).rejects.toThrow(/LLM_API_KEY/);
  });
});
