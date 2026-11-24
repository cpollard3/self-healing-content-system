import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestModel } from "@/lib/llm";
import { checkProposal, decide, runStep } from "@/lib/steps";
import { emptyDb, readDb, writeDb } from "@/lib/store";
import type { DB } from "@/lib/types";

// The whole pipeline, steps 1-6, with a scripted model standing in for the LLM.
// The script answers like a real model would for Container Registry's deprecation,
// a reworded Pub/Sub page and the new Gemini Cloud Assist page, so this checks the
// plumbing end to end (quotes, verdicts, targeted rewrites, review) without an API key.

const question = (stem: string, options: string[], answer: number, factIds: string[]) => ({
  stem,
  options,
  answer,
  explanation: "Because the documentation says so.",
  factIds,
});

function answer(prompt: string): unknown {
  // Step 2: extract concepts and facts from one page.
  if (prompt.includes('Documentation page "Container Registry"')) {
    return {
      concepts: [{ name: "Container Registry", kind: "product", summary: "Private image registry.", examSection: "section-4" }],
      facts: [
        {
          statement: "GKE clusters can pull images directly from Container Registry.",
          quote: "Google Kubernetes Engine (GKE) clusters can pull images from it directly",
          concepts: ["Container Registry"],
        },
      ],
    };
  }
  if (prompt.includes('Documentation page "Pub/Sub"')) {
    return {
      concepts: [{ name: "Pub/Sub", kind: "product", summary: "Messaging.", examSection: "section-2" }],
      facts: [
        {
          statement: "Pub/Sub delivers each message at least once by default.",
          quote: "Pub/Sub delivers each message at least once by default.",
          concepts: ["Pub/Sub"],
        },
      ],
    };
  }
  // Step 3: generate questions from the graph.
  if (prompt.includes("most important multiple-choice questions")) {
    return {
      questions: [
        question("Where should GKE pull private images from?", ["Container Registry", "Cloud SQL", "BigQuery", "Pub/Sub"], 0, ["f1"]),
        question("How often does Pub/Sub deliver a message by default?", ["At least once", "Exactly once", "At most once", "Never"], 0, ["f2"]),
      ],
    };
  }
  // Step 5: check each page's facts against the updated docs.
  if (prompt.includes('from the page "Container Registry"')) {
    return {
      checks: [
        {
          factId: "f1",
          verdict: "changed",
          reason: "Container Registry is deprecated; GKE pulls from Artifact Registry.",
          newStatement: "GKE clusters pull images directly from Artifact Registry.",
          newQuote: "Google Kubernetes Engine (GKE) clusters can pull images from it directly",
          newConcepts: ["Artifact Registry"],
        },
      ],
      newFacts: [
        {
          // Not new: the previous version already said this. Code must drop it.
          statement: "Container Registry stores images in Cloud Storage buckets.",
          quote: "It stores images in Cloud Storage buckets in your project",
          concepts: ["Container Registry"],
        },
        {
          statement: "Container Registry is deprecated.",
          quote: "Container Registry is deprecated and no longer accepts new images.",
          concepts: ["Container Registry"],
        },
      ],
      addedConcepts: [{ name: "Artifact Registry", examSection: "section-4" }],
    };
  }
  if (prompt.includes('from the page "Pub/Sub"')) {
    return {
      checks: [{ factId: "f2", verdict: "still_true", reason: "Reworded only.", newStatement: null, newQuote: null, newConcepts: [] }],
      newFacts: [],
      addedConcepts: [],
    };
  }
  if (prompt.includes('from the page "Gemini Cloud Assist"')) {
    return {
      checks: [],
      newFacts: [
        {
          statement: "Gemini Cloud Assist is generally available.",
          quote: "Gemini Cloud Assist is now generally available.",
          concepts: ["Gemini Cloud Assist"],
        },
      ],
      addedConcepts: [{ name: "Gemini Cloud Assist", examSection: null }],
    };
  }
  // Step 6: re-check an affected question, then propose new ones.
  if (prompt.startsWith("Question q1:")) {
    return {
      decision: "rewrite",
      reason: "Container Registry is deprecated; use Artifact Registry.",
      question: {
        stem: "Where should GKE pull private images from?",
        options: ["Artifact Registry", "Cloud SQL", "BigQuery", "Pub/Sub"],
        answer: 0,
        explanation: "Artifact Registry replaced the deprecated Container Registry.",
      },
      factIds: ["f3", "f4"],
    };
  }
  if (prompt.includes("Propose up to")) {
    return {
      questions: [question("What is Gemini Cloud Assist's status?", ["Generally available", "Preview", "Deprecated", "Retired"], 0, ["f5"])],
    };
  }
  throw new Error(`Unexpected prompt: ${prompt.slice(0, 120)}`);
}

const scripted = new MockLanguageModelV4({
  doGenerate: async (opts) => {
    const prompt = opts.prompt
      .filter((m) => m.role === "user")
      .flatMap((m) => (m.content as { type: string; text?: string }[]).map((p) => p.text ?? ""))
      .join("\n");
    return {
      content: [{ type: "text", text: JSON.stringify(answer(prompt)) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      warnings: [],
    };
  },
});

async function runAll(review: boolean): Promise<DB> {
  const db = emptyDb();
  db.selectedDocIds = ["container-registry", "pubsub"];
  db.settings.review = review;
  writeDb(db);
  for (let n = 1; n <= 6; n++) {
    const cur = readDb();
    await runStep(cur, n);
    writeDb(cur);
    if (cur.error) throw new Error(`step ${n}: ${cur.error.message}`);
  }
  return readDb();
}

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fidelis-test-"));
  setTestModel(scripted);
});
afterEach(() => setTestModel(null));

describe("full pipeline", () => {
  it("builds a graph whose quotes are verified in the page, and questions linked to facts", async () => {
    const db = await runAll(true);
    const original = db.facts.filter((f) => f.origin === "original");
    expect(original).toHaveLength(2);
    expect(original.every((f) => f.quoteFound)).toBe(true);
    expect(db.questions.filter((q) => q.origin === "original").map((q) => q.factIds)).toEqual([["f1"], ["f2"]]);
  });

  it("applies fact verdicts: changed facts link to their correction, reworded pages stay true", async () => {
    const db = await runAll(true);
    const f1 = db.facts.find((f) => f.id === "f1")!;
    expect(f1.status).toBe("changed");
    expect(db.facts.find((f) => f.id === f1.replacedBy)?.statement).toMatch(/Artifact Registry/);
    expect(db.facts.find((f) => f.id === "f2")!.status).toBe("current");
    expect(db.concepts.find((c) => c.id === "artifact-registry")?.examSection).toBe("section-4");
    // The "new" fact whose quote was already in the previous page is dropped by code.
    expect(db.facts.filter((f) => f.origin === "new").map((f) => f.statement)).toEqual([
      "Container Registry is deprecated.",
      "Gemini Cloud Assist is generally available.",
    ]);
  });

  it("re-checks only questions on changed facts; with review on, holds changes and hides them", async () => {
    const db = await runAll(true);
    expect(db.llmCalls.filter((c) => c.step === 6).map((c) => c.label)).toEqual(["Check question q1", "Propose new questions"]);
    expect(db.contentChecks.find((c) => c.questionId === "q2")?.outcome).toBe("unaffected");
    expect(db.proposals.map((p) => [p.kind, p.status, p.problems.length])).toEqual([
      ["rewrite", "pending", 0],
      ["new", "pending", 0],
    ]);
    expect(db.questions.find((q) => q.id === "q1")!.status).toBe("hidden");
  });

  it("approve applies a rewrite, and undo restores the original", async () => {
    const db = await runAll(true);
    const p = db.proposals.find((x) => x.kind === "rewrite")!;
    decide(db, p.id, "approve");
    const q1 = db.questions.find((q) => q.id === "q1")!;
    expect(q1.status).toBe("live");
    expect(q1.options[q1.answer]).toBe("Artifact Registry");
    expect(q1.history).toHaveLength(1);
    decide(db, p.id, "undo");
    expect(db.questions.find((q) => q.id === "q1")!.options[0]).toBe("Container Registry");
  });

  it("reject keeps the original question and shows it again", async () => {
    const db = await runAll(true);
    const p = db.proposals.find((x) => x.kind === "rewrite")!;
    decide(db, p.id, "reject");
    expect(db.questions.find((q) => q.id === "q1")!.status).toBe("live");
    expect(p.status).toBe("rejected");
  });

  it("with review off, applies every change that passes the code checks", async () => {
    const db = await runAll(false);
    expect(db.proposals.every((p) => p.status === "applied")).toBe(true);
    expect(db.questions.map((q) => [q.id, q.status])).toEqual([
      ["q1", "live"],
      ["q2", "live"],
      ["q3", "live"],
    ]);
  });

  it("code checks catch a question citing an out-of-date fact or with a bad answer", async () => {
    const db = await runAll(false);
    const ok = db.proposals[0].after;
    expect(checkProposal(db, ok)).toEqual([]);
    expect(checkProposal(db, { ...ok, factIds: ["f1"] })).toContain("Fact f1 is out of date.");
    expect(checkProposal(db, { ...ok, answer: 7 })).toContain("The answer index does not point to an option.");
  });
});
