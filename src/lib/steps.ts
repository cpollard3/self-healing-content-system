import { z } from "zod";
import { LIBRARY } from "./library";
import { callLlm, pMap } from "./llm";
import { writeDb } from "./store";
import { diffDoc, docText, norm, parseSections, quoteIn, slug } from "./text";
import type { Concept, DB, DocVersion, Fact, LlmCall, Proposal, Question, QuestionCore } from "./types";

// Free API tiers allow only a few requests per minute, so calls run one at a time unless raised.
const CONCURRENCY = Number(process.env.LLM_CONCURRENCY) || 1;
const QUESTION_COUNT = 7;
const MAX_NEW_QUESTIONS = 3;

// ---------------------------------------------------------------- helpers
function loadVersion(docId: string, which: "original" | "updated"): DocVersion | undefined {
  const lib = LIBRARY.find((d) => d.id === docId);
  const v = lib?.[which];
  if (!lib || !v) return undefined;
  return { docId, title: v.title, kind: lib.kind, url: lib.url, sections: parseSections(v.text) };
}

const examGuide = (docs: DocVersion[]) => docs.find((d) => d.kind === "exam_guide");

function examOutline(docs: DocVersion[]): string {
  const g = examGuide(docs);
  if (!g) return "(no exam guide selected)";
  return g.sections.map((s) => `- ${s.id}: ${s.heading}`).join("\n");
}

function pageBlock(d: DocVersion): string {
  return `### ${d.title} (id: ${d.docId})\n${docText(d)}`;
}

function ensureConcept(db: DB, name: string, init: Partial<Concept> = {}): Concept {
  const id = slug(name);
  let c = db.concepts.find((x) => x.id === id);
  if (!c) {
    c = { id, name: name.trim(), kind: "topic", summary: "", examSection: null, ...init };
    db.concepts.push(c);
  }
  return c;
}

function nextId(prefix: string, existing: string[]): string {
  const max = existing.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length)) || 0), 0);
  return `${prefix}${max + 1}`;
}

function factLine(f: Fact): string {
  return `- ${f.id} [${f.conceptIds.join(", ")}]: ${f.statement}`;
}

function questionBlock(q: QuestionCore & { id?: string }): string {
  return [
    `Stem: ${q.stem}`,
    "Options:",
    ...q.options.map((o, i) => `  ${i}. ${o}`),
    `Correct answer: ${q.answer}`,
    `Explanation: ${q.explanation}`,
  ].join("\n");
}

// ---------------------------------------------------------------- schemas
const QuestionSchema = z.object({
  stem: z.string(),
  options: z.array(z.string()),
  answer: z.number().int(),
  explanation: z.string(),
  factIds: z.array(z.string()),
});

const GraphSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["product", "feature", "topic"]),
      summary: z.string(),
      examSection: z.string().nullable(),
    }),
  ),
  facts: z.array(z.object({ statement: z.string(), quote: z.string(), concepts: z.array(z.string()) })),
});

const QuestionsSchema = z.object({ questions: z.array(QuestionSchema) });

const PageUpdateSchema = z.object({
  checks: z.array(
    z.object({
      factId: z.string(),
      verdict: z.enum(["still_true", "changed", "removed"]),
      reason: z.string(),
      newStatement: z.string().nullable(),
      newQuote: z.string().nullable(),
      newConcepts: z.array(z.string()),
    }),
  ),
  newFacts: z.array(z.object({ statement: z.string(), quote: z.string(), concepts: z.array(z.string()) })),
  addedConcepts: z.array(z.object({ name: z.string(), examSection: z.string().nullable() })),
});

const ContentDecisionSchema = z.object({
  decision: z.enum(["keep", "rewrite"]),
  reason: z.string(),
  question: z
    .object({ stem: z.string(), options: z.array(z.string()), answer: z.number().int(), explanation: z.string() })
    .nullable(),
  factIds: z.array(z.string()),
});

// ---------------------------------------------------------------- step runner
export async function runStep(db: DB, n: number) {
  if (db.running) throw new Error("A step is already running.");
  if (n !== db.completed + 1) throw new Error(`Run step ${db.completed + 1} next.`);
  db.error = null;
  db.running = { step: n, startedAt: Date.now() };
  writeDb(db);
  const log = (c: LlmCall) => {
    db.llmCalls.push(c);
    writeDb(db); // so the UI can show calls while the step is still running
  };
  try {
    if (n === 1) step1ChooseDocs(db);
    else if (n === 2) await step2BuildGraph(db, log);
    else if (n === 3) await step3GenerateQuestions(db, log);
    else if (n === 4) step4UpdateDocs(db);
    else if (n === 5) await step5UpdateGraph(db, log);
    else if (n === 6) await step6UpdateContent(db, log);
    db.completed = n;
    if (n === 3) db.snapshot = structuredClone({ concepts: db.concepts, facts: db.facts, questions: db.questions });
  } catch (e) {
    db.error = { step: n, message: (e as Error).message };
  } finally {
    db.running = null;
  }
}

// ---------------------------------------------------------------- 1. choose the source of truth
function step1ChooseDocs(db: DB) {
  if (!db.selectedDocIds.length) throw new Error("Choose at least one page.");
  db.docs = db.selectedDocIds.map((id) => loadVersion(id, "original")).filter((d): d is DocVersion => !!d);
  db.docsVersion = "original";
}

// ---------------------------------------------------------------- 2. build graph
async function step2BuildGraph(db: DB, log: (c: LlmCall) => void) {
  const pages = db.docs.filter((d) => d.kind === "docs");
  const outline = examOutline(db.docs);
  const results = await pMap(pages, CONCURRENCY, (page) =>
    callLlm({
      step: 2,
      label: `Extract concepts and facts: ${page.title}`,
      system:
        "You build a knowledge graph for certification exam prep from technical documentation. State only what the page says.",
      prompt: `Exam: Google Cloud Professional Cloud Architect.
Exam guide sections:
${outline}

Documentation page "${page.title}" (id: ${page.docId}):
<<<
${docText(page)}
>>>

Extract:
1. concepts: the Google Cloud products, features or topics this page covers (at most 5).
   name = the official name as written on the page; kind = product | feature | topic;
   summary = one sentence; examSection = the id of the exam guide section where it is tested, or null.
2. facts: 2 to 5 short, checkable facts an exam candidate should know from this page.
   statement = one sentence in your own words;
   quote = a sentence or clause copied word for word from the page that supports it;
   concepts = names of the concepts (from your list) the fact is about.`,
      schema: GraphSchema,
      log,
    }),
  );

  results.forEach((res, i) => {
    const page = pages[i];
    for (const c of res.concepts) {
      const concept = ensureConcept(db, c.name, { kind: c.kind, summary: c.summary });
      if (!concept.summary) concept.summary = c.summary;
      if (!concept.examSection && c.examSection) concept.examSection = c.examSection;
    }
    for (const f of res.facts) {
      db.facts.push({
        id: nextId("f", db.facts.map((x) => x.id)),
        statement: f.statement,
        quote: f.quote,
        docId: page.docId,
        conceptIds: f.concepts.map((name) => ensureConcept(db, name).id),
        status: "current",
        origin: "original",
        replaces: null,
        replacedBy: null,
        quoteFound: quoteIn(f.quote, [page]),
      });
    }
  });
}

// ---------------------------------------------------------------- 3. generate questions
function graphListing(db: DB, onlyCurrent = true): string {
  const concepts = db.concepts
    .map((c) => `- ${c.id} · ${c.name} (${c.kind}${c.examSection ? `, exam ${c.examSection}` : ""}): ${c.summary}`)
    .join("\n");
  const facts = db.facts.filter((f) => !onlyCurrent || f.status === "current").map(factLine).join("\n");
  return `Concepts:\n${concepts}\n\nFacts:\n${facts}`;
}

async function step3GenerateQuestions(db: DB, log: (c: LlmCall) => void) {
  const res = await callLlm({
    step: 3,
    label: `Propose the ${QUESTION_COUNT} most important questions`,
    system: "You write certification practice questions. Every question must be answerable from the given facts alone.",
    prompt: `Exam: Google Cloud Professional Cloud Architect.
Exam guide sections:
${examOutline(db.docs)}

Knowledge graph:
${graphListing(db)}

Write the ${QUESTION_COUNT} most important multiple-choice questions for this exam, using only these facts.
Prefer concepts the exam guide covers, spread the questions across different concepts, and use short scenarios like the real exam.
Each question: stem; exactly 4 options; answer = index (0-3) of the correct option;
explanation = one or two sentences on why the answer is right and the others are not;
factIds = ids of the 1 or 2 facts the question is built from.`,
    schema: QuestionsSchema,
    log,
  });
  for (const q of res.questions) {
    db.questions.push({
      id: nextId("q", db.questions.map((x) => x.id)),
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      factIds: q.factIds.filter((id) => db.facts.some((f) => f.id === id)),
      status: "live",
      origin: "original",
      history: [],
    });
  }
}

// ---------------------------------------------------------------- 4. docs updated
function step4UpdateDocs(db: DB) {
  const newPages = LIBRARY.filter((d) => !d.original && d.updated).map((d) => d.id);
  const ids = [...db.selectedDocIds, ...newPages.filter((id) => !db.selectedDocIds.includes(id))];
  db.originalDocs = db.docs;
  db.docs = ids.map((id) => loadVersion(id, "updated")).filter((d): d is DocVersion => !!d);
  db.docsVersion = "updated";
  db.docChanges = ids.map((id) =>
    diffDoc(
      db.originalDocs.find((d) => d.docId === id),
      db.docs.find((d) => d.docId === id),
    ),
  );
}

// ---------------------------------------------------------------- 5. update graph
async function step5UpdateGraph(db: DB, log: (c: LlmCall) => void) {
  const pageIds = db.docChanges.filter((c) => c.docId !== examGuide(db.docs)?.docId).map((c) => c.docId);
  const conceptNames = db.concepts.map((c) => c.name).join(", ");

  const pageResults = await pMap(pageIds, CONCURRENCY, (docId) => {
    const oldPage = db.originalDocs.find((d) => d.docId === docId);
    const newPage = db.docs.find((d) => d.docId === docId);
    const facts = db.facts.filter((f) => f.docId === docId && f.status === "current");
    const others = db.docs.filter((d) => d.docId !== docId && d.kind === "docs");
    const title = newPage?.title ?? oldPage?.title ?? docId;
    return callLlm({
      step: 5,
      label: `Check facts against updated docs: ${title}`,
      system:
        "You keep a knowledge graph accurate when documentation changes. Judge only from the updated documentation, not from memory.",
      prompt: `Facts currently in the graph from the page "${oldPage?.title ?? title}" (id: ${docId}):
${facts.length ? facts.map((f) => `- ${f.id}: ${f.statement}\n  quote: "${f.quote}"`).join("\n") : "(none: this page is new)"}

Previous version of this page:
<<<
${oldPage ? docText(oldPage) : "(none: this page is new)"}
>>>

Updated version of this page:
<<<
${newPage ? docText(newPage) : "(this page was removed)"}
>>>

Other updated pages, for context (a change can be announced on a different page):
${others.map(pageBlock).join("\n\n")}

Known concepts: ${conceptNames}

Exam guide sections:
${examOutline(db.docs)}

Tasks:
1. checks: for EVERY fact listed above, decide using the updated documentation:
   still_true = the updated docs still support it (rewording is fine);
   changed = no longer accurate; give newStatement (the corrected fact), newQuote (copied word for word from the updated docs) and newConcepts (concept names it is about);
   removed = the updated docs no longer support it and there is nothing to replace it.
   reason = one sentence. For still_true and removed, newStatement and newQuote are null and newConcepts is empty.
2. newFacts: important facts that the UPDATE ADDED: things the updated version of THIS page states and the previous version did not.
   Do not include anything the previous version already said, even in other words, even if it is missing from the facts above.
   Do not repeat your corrections from task 1. statement, quote (word for word from the updated page), concepts (names). Leave empty if there are none.
3. addedConcepts: every concept name you used above that is not in the known list, with examSection = the exam guide section id where it is tested, or null.`,
      schema: PageUpdateSchema,
      log,
    });
  });

  // Apply page results in a fixed order so ids are deterministic.
  pageResults.forEach((res, i) => {
    const docId = pageIds[i];
    for (const c of res.addedConcepts) {
      const concept = ensureConcept(db, c.name);
      if (!concept.examSection && c.examSection) concept.examSection = c.examSection;
    }
    for (const chk of res.checks) {
      const old = db.facts.find((f) => f.id === chk.factId && f.status === "current");
      if (!old) continue;
      let newFactId: string | null = null;
      if (chk.verdict === "changed" && chk.newStatement && chk.newQuote) {
        newFactId = nextId("f", db.facts.map((x) => x.id));
        db.facts.push({
          id: newFactId,
          statement: chk.newStatement,
          quote: chk.newQuote,
          docId,
          conceptIds: (chk.newConcepts.length ? chk.newConcepts.map((n) => ensureConcept(db, n).id) : old.conceptIds),
          status: "current",
          origin: "revised",
          replaces: old.id,
          replacedBy: null,
          quoteFound: quoteIn(chk.newQuote, db.docs),
        });
        old.status = "changed";
        old.replacedBy = newFactId;
      } else if (chk.verdict !== "still_true") {
        old.status = "removed";
      }
      db.factChecks.push({ factId: old.id, verdict: chk.verdict, reason: chk.reason, newFactId });
    }
    const oldPage = db.originalDocs.find((d) => d.docId === docId);
    for (const f of res.newFacts) {
      // Code check: a quote the previous version already contained is not new, whatever the LLM says.
      if (oldPage && quoteIn(f.quote, [oldPage])) continue;
      db.facts.push({
        id: nextId("f", db.facts.map((x) => x.id)),
        statement: f.statement,
        quote: f.quote,
        docId,
        conceptIds: f.concepts.map((n) => ensureConcept(db, n).id),
        status: "current",
        origin: "new",
        replaces: null,
        replacedBy: null,
        quoteFound: quoteIn(f.quote, db.docs),
      });
    }
  });
  // Facts the LLM forgot to judge stay current; record that honestly.
  for (const f of db.facts.filter((x) => x.origin === "original")) {
    if (!db.factChecks.some((c) => c.factId === f.id)) {
      db.factChecks.push({ factId: f.id, verdict: "still_true", reason: "Not judged by the LLM; left unchanged.", newFactId: null });
    }
  }
}

// ---------------------------------------------------------------- 6. update content
export function checkProposal(db: DB, after: QuestionCore & { factIds: string[] }): string[] {
  const problems: string[] = [];
  if (!after.stem.trim()) problems.push("The question has no stem.");
  if (!after.explanation.trim()) problems.push("The question has no explanation.");
  if (after.options.length !== 4) problems.push(`Expected 4 options, got ${after.options.length}.`);
  if (new Set(after.options.map(norm)).size !== after.options.length) problems.push("Two options are identical.");
  if (!(after.answer >= 0 && after.answer < after.options.length)) problems.push("The answer index does not point to an option.");
  if (!after.factIds.length) problems.push("The question is not linked to any fact.");
  for (const id of after.factIds) {
    const f = db.facts.find((x) => x.id === id);
    if (!f) problems.push(`Fact ${id} does not exist.`);
    else if (f.status !== "current") problems.push(`Fact ${id} is out of date.`);
    else if (!f.quoteFound) problems.push(`The quote for fact ${id} is not in the updated docs.`);
  }
  return problems;
}

function addProposal(db: DB, p: Omit<Proposal, "id" | "status" | "decidedBy" | "problems">) {
  const problems = checkProposal(db, p.after);
  const proposal: Proposal = { ...p, id: nextId("p", db.proposals.map((x) => x.id)), problems, status: "pending", decidedBy: null };
  db.proposals.push(proposal);
  const q = db.questions.find((x) => x.id === p.questionId);
  // A question built on a fact that is no longer true is hidden while it waits.
  if (q && p.kind === "rewrite") q.status = "hidden";
  if (!db.settings.review && problems.length === 0) applyProposal(db, proposal, "auto");
}

async function step6UpdateContent(db: DB, log: (c: LlmCall) => void) {
  const allFacts = db.facts.filter((f) => f.status === "current").map(factLine).join("\n");
  const allDocs = db.docs.filter((d) => d.kind === "docs").map(pageBlock).join("\n\n");
  const live = db.questions.filter((q) => q.status === "live");
  const affected = live.filter((q) => q.factIds.some((id) => db.facts.find((f) => f.id === id)?.status !== "current"));

  const decisions = await pMap(affected, CONCURRENCY, (q) => {
    const factNotes = q.factIds
      .map((id) => {
        const f = db.facts.find((x) => x.id === id)!;
        const chk = db.factChecks.find((c) => c.factId === id);
        if (f.status === "current") return `- ${f.id} (still true): ${f.statement}`;
        const nf = f.replacedBy ? db.facts.find((x) => x.id === f.replacedBy) : null;
        return [
          `- ${f.id} (${f.status.toUpperCase()}): ${f.statement}`,
          `  old quote: "${f.quote}"`,
          nf ? `  now ${nf.id}: ${nf.statement}\n  new quote: "${nf.quote}"` : "  no replacement fact",
          chk ? `  reason: ${chk.reason}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");
    return callLlm({
      step: 6,
      label: `Check question ${q.id}`,
      system: "You maintain certification practice questions so they stay correct when the documentation changes.",
      prompt: `Question ${q.id}:
${questionBlock(q)}

It was built from these facts, which have been checked against the updated documentation:
${factNotes}

Current facts in the knowledge graph (use these ids):
${allFacts}

Updated documentation:
${allDocs}

Decide, judging the WHOLE question (correct answer, wrong options, explanation) against the updated documentation:
- keep = it is still fully correct as written;
- rewrite = give the corrected question (stem, exactly 4 options, answer index 0-3, explanation) and factIds (ids of current facts it is now built from). Change as little as needed and keep testing the same skill; if what it tests no longer exists, test its replacement.
reason = one or two sentences for a human reviewer. For keep, question is null and factIds is empty.`,
      schema: ContentDecisionSchema,
      log,
    });
  });

  affected.forEach((q, i) => {
    const d = decisions[i];
    if (d.decision !== "rewrite" || !d.question) {
      db.contentChecks.push({ questionId: q.id, outcome: "still_correct", reason: d.reason });
      return;
    }
    db.contentChecks.push({ questionId: q.id, outcome: "proposal", reason: d.reason });
    const before = { stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, factIds: q.factIds };
    addProposal(db, { kind: "rewrite", questionId: q.id, reason: d.reason, before, after: { ...d.question, factIds: d.factIds } });
  });

  for (const q of live.filter((x) => !affected.includes(x))) {
    db.contentChecks.push({ questionId: q.id, outcome: "unaffected", reason: "All of its facts are still true." });
  }

  // New questions for new or revised facts that no question covers yet.
  const covered = new Set<string>();
  for (const q of db.questions) q.factIds.forEach((id) => covered.add(id));
  for (const p of db.proposals) p.after?.factIds.forEach((id) => covered.add(id));
  const uncovered = db.facts.filter((f) => f.status === "current" && f.origin !== "original" && !covered.has(f.id));
  if (!uncovered.length) return;

  const existing = db.questions
    .map((q) => {
      const p = db.proposals.find((x) => x.questionId === q.id && x.kind === "rewrite");
      return `- ${q.id}: ${p?.after?.stem ?? q.stem}`;
    })
    .join("\n");
  const res = await callLlm({
    step: 6,
    label: "Propose new questions",
    system: "You write certification practice questions. Every question must be answerable from the given facts alone.",
    prompt: `Exam: Google Cloud Professional Cloud Architect.
Updated exam guide sections:
${examOutline(db.docs)}

Facts that are new since the docs were updated and not covered by any question:
${uncovered.map(factLine).join("\n")}

Existing questions (do not duplicate them):
${existing}

Propose up to ${MAX_NEW_QUESTIONS} new multiple-choice questions on the most exam-relevant of these facts.
Each question: stem; exactly 4 options; answer = index (0-3); explanation; factIds = ids from the list above.
Return an empty list if none are worth adding.`,
    schema: QuestionsSchema,
    log,
  });
  let n = Math.max(0, ...db.questions.map((q) => Number(q.id.slice(1)) || 0));
  for (const q of res.questions.slice(0, MAX_NEW_QUESTIONS)) {
    n += 1;
    addProposal(db, {
      kind: "new",
      questionId: `q${n}`,
      reason: `Covers ${q.factIds.join(", ")}, which no existing question tests.`,
      before: null,
      after: q,
    });
  }
}

// ---------------------------------------------------------------- review actions
export function applyProposal(db: DB, p: Proposal, by: "auto" | "reviewer") {
  const q = db.questions.find((x) => x.id === p.questionId);
  if (p.kind === "rewrite" && q && p.after) {
    q.history.push({ stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, factIds: q.factIds, replacedAt: new Date().toISOString() });
    Object.assign(q, { stem: p.after.stem, options: p.after.options, answer: p.after.answer, explanation: p.after.explanation, factIds: p.after.factIds });
    q.status = "live";
  } else if (p.kind === "new" && p.after && !q) {
    const nq: Question = { id: p.questionId, ...p.after, status: "live", origin: "new", history: [] };
    db.questions.push(nq);
  }
  p.status = "applied";
  p.decidedBy = by;
}

export function decide(db: DB, proposalId: string, action: "approve" | "reject" | "undo") {
  const p = db.proposals.find((x) => x.id === proposalId);
  if (!p) throw new Error("No such proposal.");
  const q = db.questions.find((x) => x.id === p.questionId);
  if (action === "approve") {
    if (p.status !== "pending") throw new Error("Only pending proposals can be approved.");
    applyProposal(db, p, "reviewer");
  } else if (action === "reject") {
    if (p.status !== "pending") throw new Error("Only pending proposals can be rejected.");
    if (q && q.status === "hidden") q.status = "live";
    p.status = "rejected";
    p.decidedBy = "reviewer";
  } else {
    if (p.status !== "applied") throw new Error("Only applied proposals can be undone.");
    if (p.kind === "rewrite" && q) {
      const prev = q.history.pop();
      if (prev) Object.assign(q, { stem: prev.stem, options: prev.options, answer: prev.answer, explanation: prev.explanation, factIds: prev.factIds });
      q.status = "live";
    } else if (p.kind === "new") {
      db.questions = db.questions.filter((x) => x.id !== p.questionId);
    }
    p.status = "undone";
    p.decidedBy = "reviewer";
  }
}
