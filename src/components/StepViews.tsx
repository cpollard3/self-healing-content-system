"use client";

import { useState } from "react";
import type { LibraryDoc } from "@/lib/library";
import type { DB, Fact, Proposal, Question } from "@/lib/types";
import { InlineDiff } from "./Diff";
import { GraphView } from "./GraphView";
import { FactChip, QuestionBody } from "./QuestionView";
import { Badge, Button, Card, Collapsible, cx, Empty, Quote, SectionTitle, Stat } from "./ui";

// ======================================================= 1. Choose the source of truth
export function Step1({
  db,
  library,
  onSelect,
}: {
  db: DB;
  library: LibraryDoc[];
  onSelect: (ids: string[]) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const loaded = db.completed >= 1;
  const docs = library.filter((d) => d.original);
  const toggle = (id: string) =>
    onSelect(db.selectedDocIds.includes(id) ? db.selectedDocIds.filter((x) => x !== id) : [...db.selectedDocIds, id]);
  const shown = preview ? docs.find((d) => d.id === preview) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="grid gap-3 sm:grid-cols-2">
        {docs.map((d) => {
          const on = db.selectedDocIds.includes(d.id);
          const sections = d.original!.text.split("\n").filter((l) => l.startsWith("## ")).length;
          return (
            <div
              key={d.id}
              onClick={() => setPreview(d.id)}
              className={cx(
                "cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition hover:shadow",
                on ? "border-indigo-300 ring-1 ring-indigo-200" : "border-stone-200 opacity-60",
                preview === d.id && "ring-2 ring-indigo-500",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={loaded}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle(d.id)}
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-stone-900">{d.original!.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                    <Badge tone={d.kind === "exam_guide" ? "violet" : "neutral"}>{d.kind === "exam_guide" ? "exam guide" : "docs page"}</Badge>
                    {sections} sections
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Card className="h-fit p-4">
        {shown ? (
          <>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Preview · original version</div>
            <div className="mb-3 font-semibold">{shown.original!.title}</div>
            <div className="scroll-thin max-h-[30rem] space-y-3 overflow-auto pr-1 text-[13px] leading-relaxed text-stone-700">
              {shown.original!.text.split("\n\n").map((block, i) => {
                const [h, ...rest] = block.split("\n");
                return (
                  <div key={i}>
                    <div className="font-semibold text-stone-900">{h.replace(/^## /, "")}</div>
                    <div>{rest.join(" ")}</div>
                  </div>
                );
              })}
            </div>
            <a href={shown.url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-indigo-600 hover:underline">
              Real page this is based on ↗
            </a>
          </>
        ) : (
          <div className="text-sm text-stone-500">
            Click a page to read it. Pages are paraphrased snapshots of real Google Cloud docs; the update in step 4 mirrors real announcements.
          </div>
        )}
      </Card>
    </div>
  );
}

// The state as it was right after the content was built, before the docs changed.
function before(db: DB): DB {
  if (!db.snapshot) return db;
  return {
    ...db,
    ...db.snapshot,
    docs: db.originalDocs.length ? db.originalDocs : db.docs,
    originalDocs: [],
    factChecks: [],
  };
}

// ======================================================= 2. Graph
export function Step2({ db: live }: { db: DB }) {
  const db = before(live);
  const facts = db.facts.filter((f) => f.origin === "original");
  const verified = facts.filter((f) => f.quoteFound).length;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="concepts" value={db.concepts.length} tone="indigo" />
        <Stat label="facts" value={facts.length} />
        <Stat label="quotes verified in page" value={`${verified}/${facts.length}`} tone={verified === facts.length ? "green" : "amber"} />
        <Stat label="concepts on the exam" value={db.concepts.filter((c) => c.examSection).length} />
      </div>
      <GraphView db={db} />
      <SectionTitle hint="Grouped by page">Facts and their quotes</SectionTitle>
      <div className="space-y-2">
        {db.docs
          .filter((d) => d.kind === "docs")
          .map((d) => {
            const fs = facts.filter((f) => f.docId === d.docId);
            return (
              <Card key={d.docId} className="px-4 py-2">
                <Collapsible title={d.title} right={<Badge>{fs.length} facts</Badge>}>
                  <div className="space-y-3">
                    {fs.map((f) => (
                      <div key={f.id}>
                        <div className="mb-1 text-sm text-stone-800">
                          <span className="mr-1 font-mono text-xs text-stone-400">{f.id}</span>
                          {f.statement}
                          {!f.quoteFound && <Badge tone="amber" className="ml-2">quote not found</Badge>}
                        </div>
                        <Quote>{f.quote}</Quote>
                      </div>
                    ))}
                  </div>
                </Collapsible>
              </Card>
            );
          })}
      </div>
    </>
  );
}

// ======================================================= 3. Questions
export function QuestionCard({ q, db, footer }: { q: Question; db: DB; footer?: React.ReactNode }) {
  const statusTone = q.status === "live" ? "green" : "amber";
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-stone-500">{q.id}</span>
        {q.origin === "new" && <Badge tone="green">new</Badge>}
        {q.history.length > 0 && <Badge tone="sky">rewritten</Badge>}
        <Badge tone={statusTone} className="ml-auto">
          {q.status === "live" ? "shown to learners" : "hidden while in review"}
        </Badge>
      </div>
      <QuestionBody q={q} />
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3 text-xs text-stone-500">
        Built from
        {q.factIds.map((id) => (
          <FactChip key={id} fact={db.facts.find((f) => f.id === id)} db={db} />
        ))}
      </div>
      {footer}
    </Card>
  );
}

export function Step3({ db: live }: { db: DB }) {
  const db = before(live);
  const qs = db.questions.filter((q) => q.origin === "original");
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="questions generated" value={qs.length} tone="indigo" />
        <Stat label="facts used" value={new Set(qs.flatMap((q) => q.factIds)).size} />
        <Stat label="concepts covered" value={new Set(qs.flatMap((q) => q.factIds.flatMap((id) => db.facts.find((f) => f.id === id)?.conceptIds ?? []))).size} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {qs.map((q) => (
          <QuestionCard key={q.id} q={q} db={db} />
        ))}
      </div>
    </>
  );
}

// ======================================================= 4. Docs updated
const PAGE_TONE = { unchanged: "neutral", changed: "amber", new_page: "green", removed_page: "red" } as const;

export function Step4({ db }: { db: DB }) {
  const changed = db.docChanges.filter((c) => c.status !== "unchanged");
  const unchanged = db.docChanges.filter((c) => c.status === "unchanged");
  const count = (k: string) => db.docChanges.filter((c) => c.status === k).length;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="pages changed" value={count("changed")} tone="amber" />
        <Stat label="new pages" value={count("new_page")} tone="green" />
        <Stat label="pages unchanged" value={unchanged.length} />
      </div>
      <div className="space-y-4">
        {changed.map((c) => (
          <Card key={c.docId} className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-semibold text-stone-900">{c.title}</span>
              {c.oldTitle && c.oldTitle !== c.title && <span className="text-xs text-stone-500">(was “{c.oldTitle}”)</span>}
              <Badge tone={PAGE_TONE[c.status]} className="ml-auto">{c.status.replace("_", " ")}</Badge>
            </div>
            <div className="whitespace-pre-wrap text-[13px] text-stone-700">
              <InlineDiff before={c.before} after={c.after} />
            </div>
          </Card>
        ))}
        {unchanged.length > 0 && (
          <div className="text-sm text-stone-500">Unchanged: {unchanged.map((c) => c.title).join(", ")}</div>
        )}
      </div>
    </>
  );
}

// ======================================================= 5. Graph update
function FactCheckRow({ db, fact }: { db: DB; fact: Fact }) {
  const chk = db.factChecks.find((c) => c.factId === fact.id);
  const nf = fact.replacedBy ? db.facts.find((f) => f.id === fact.replacedBy) : null;
  const verdict = chk?.verdict ?? "still_true";
  const tone = verdict === "changed" ? "amber" : verdict === "removed" ? "red" : "green";
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge tone={tone}>{verdict.replace("_", " ")}</Badge>
        <span className="text-xs text-stone-500">{[...db.originalDocs, ...db.docs].find((d) => d.docId === fact.docId)?.title}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Before · {fact.id}</div>
          <div className="mb-1.5 text-sm text-stone-800">{fact.statement}</div>
          <Quote tone={verdict === "still_true" ? "neutral" : "old"}>{fact.quote}</Quote>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">After{nf ? ` · ${nf.id}` : ""}</div>
          {nf ? (
            <>
              <div className="mb-1.5 text-sm text-stone-800">{nf.statement}</div>
              <Quote tone="new">{nf.quote}</Quote>
              {!nf.quoteFound && <Badge tone="amber" className="mt-1">quote not found in updated docs</Badge>}
            </>
          ) : verdict === "removed" ? (
            <div className="text-sm text-rose-700">No longer supported by the docs.</div>
          ) : (
            <div className="text-sm text-emerald-700">Still supported.</div>
          )}
        </div>
      </div>
      {chk && <div className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-600"><span className="font-semibold">LLM:</span> {chk.reason}</div>}
    </Card>
  );
}

export function Step5({ db }: { db: DB }) {
  const original = db.facts.filter((f) => f.origin === "original");
  const changed = original.filter((f) => f.status !== "current");
  const still = original.filter((f) => f.status === "current");
  const newFacts = db.facts.filter((f) => f.origin === "new");
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="facts still true" value={still.length} tone="green" />
        <Stat label="facts changed" value={original.filter((f) => f.status === "changed").length} tone="amber" />
        <Stat label="facts removed" value={original.filter((f) => f.status === "removed").length} tone="red" />
        <Stat label="new facts" value={newFacts.length} tone="sky" />
      </div>
      <GraphView db={db} update />
      <SectionTitle hint="Before and after, with the quote each side rests on">Facts that changed</SectionTitle>
      <div className="space-y-3">
        {changed.length ? changed.map((f) => <FactCheckRow key={f.id} db={db} fact={f} />) : <Empty>No facts changed.</Empty>}
      </div>
      {newFacts.length > 0 && (
        <>
          <SectionTitle>New facts from the updated docs</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {newFacts.map((f) => (
              <Card key={f.id} className="p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="green">{f.id}</Badge>
                  <span className="text-xs text-stone-500">{db.docs.find((d) => d.docId === f.docId)?.title}</span>
                </div>
                <div className="mb-1.5 text-sm text-stone-800">{f.statement}</div>
                <Quote tone="new">{f.quote}</Quote>
              </Card>
            ))}
          </div>
        </>
      )}
      <SectionTitle>Facts still true</SectionTitle>
      <Card className="px-4 py-2">
        <Collapsible title={`${still.length} facts confirmed against the updated docs`}>
          <div className="space-y-2">
            {still.map((f) => (
              <div key={f.id} className="text-sm text-stone-700">
                <span className="mr-1 font-mono text-xs text-stone-400">{f.id}</span>
                {f.statement}
                <div className="text-xs text-stone-500">{db.factChecks.find((c) => c.factId === f.id)?.reason}</div>
              </div>
            ))}
          </div>
        </Collapsible>
      </Card>
    </>
  );
}

// ======================================================= 6 + 7. Proposals
const KIND_LABEL = { rewrite: "Rewrite", new: "New question" } as const;
const KIND_TONE = { rewrite: "sky", new: "green" } as const;
const STATUS_LABEL = {
  pending: { text: "waiting for review", tone: "amber" },
  applied: { text: "applied", tone: "green" },
  rejected: { text: "rejected", tone: "neutral" },
  undone: { text: "undone", tone: "neutral" },
} as const;

function FactsEvidence({ db, ids, side }: { db: DB; ids: string[]; side: "before" | "after" }) {
  return (
    <div className="space-y-2">
      {ids.map((id) => {
        const f = db.facts.find((x) => x.id === id);
        if (!f) return <div key={id} className="text-xs text-rose-700">Unknown fact {id}</div>;
        const tone = side === "before" && f.status !== "current" ? "old" : side === "after" ? "new" : "neutral";
        return (
          <div key={id}>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-stone-600">
              <FactChip fact={f} db={db} />
              <span>{f.statement}</span>
            </div>
            <Quote tone={tone}>{f.quote}</Quote>
          </div>
        );
      })}
    </div>
  );
}

export function ProposalCard({
  p,
  db,
  onDecide,
  busy,
}: {
  p: Proposal;
  db: DB;
  onDecide?: (id: string, action: "approve" | "reject" | "undo") => void;
  busy?: boolean;
}) {
  const st = STATUS_LABEL[p.status];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-2.5">
        <Badge tone={KIND_TONE[p.kind]}>{KIND_LABEL[p.kind]}</Badge>
        <span className="font-mono text-xs font-semibold text-stone-500">{p.questionId}</span>
        <Badge tone={st.tone}>
          {st.text}
          {p.decidedBy === "auto" && p.status === "applied" ? " automatically" : ""}
        </Badge>
        <div className="ml-auto flex gap-2">
          {onDecide && p.status === "pending" && (
            <>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => onDecide(p.id, "reject")}>
                Reject
              </Button>
              <Button size="sm" variant="success" disabled={busy} onClick={() => onDecide(p.id, "approve")}>
                Approve
              </Button>
            </>
          )}
          {onDecide && p.status === "applied" && (
            <Button size="sm" disabled={busy} onClick={() => onDecide(p.id, "undo")}>
              Undo
            </Button>
          )}
        </div>
      </div>
      <div className="px-4 pt-3 text-sm text-stone-700">
        <span className="font-semibold text-stone-500">Why: </span>
        {p.reason}
      </div>
      {p.problems.length > 0 && (
        <div className="mx-4 mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">
          <div className="font-semibold">Code checks failed, so this needs a person:</div>
          <ul className="ml-4 list-disc">
            {p.problems.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <div className={cx("grid gap-4 p-4", p.before && "md:grid-cols-2")}>
        {p.before && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Before</div>
            <QuestionBody q={p.before} compareTo={p.after} side="before" />
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Cited facts · before</div>
              <FactsEvidence db={db} ids={p.before.factIds} side="before" />
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{p.before ? "After" : "Proposed question"}</div>
          <QuestionBody q={p.after} compareTo={p.before} side="after" />
          <div className="rounded-lg border border-emerald-200 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Cited facts · after</div>
            <FactsEvidence db={db} ids={p.after.factIds} side="after" />
          </div>
        </div>
      </div>
    </Card>
  );
}

const STATUS_ORDER = { pending: 0, applied: 1, rejected: 2, undone: 3 } as const;

export function Step6({
  db,
  onDecide,
  busy,
}: {
  db: DB;
  onDecide: (id: string, action: "approve" | "reject" | "undo") => void;
  busy: boolean;
}) {
  const count = (o: string) => db.contentChecks.filter((c) => c.outcome === o).length;
  const proposals = [...db.proposals].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const pending = db.proposals.filter((p) => p.status === "pending").length;
  const qs = db.questions;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="questions unaffected" value={count("unaffected")} />
        <Stat label="re-checked, still correct" value={count("still_correct")} tone="green" />
        <Stat label="rewrites" value={db.proposals.filter((p) => p.kind === "rewrite").length} tone="sky" />
        <Stat label="new questions" value={db.proposals.filter((p) => p.kind === "new").length} tone="green" />
        <Stat label="waiting for review" value={pending} tone="amber" />
      </div>
      <SectionTitle
        hint={
          db.settings.review
            ? "Review is on: changes wait for a person, and questions on changed facts are hidden meanwhile"
            : "Review is off: changes that pass the code checks were applied, and each can be undone"
        }
      >
        Proposed changes
      </SectionTitle>
      <div className="space-y-4">
        {proposals.length ? (
          proposals.map((p) => <ProposalCard key={p.id} p={p} db={db} onDecide={onDecide} busy={busy} />)
        ) : (
          <Empty>No changes needed.</Empty>
        )}
      </div>
      <SectionTitle>Every question, and why it was or wasn&apos;t changed</SectionTitle>
      <Card className="divide-y divide-stone-100">
        {db.contentChecks.map((c) => {
          const q = db.questions.find((x) => x.id === c.questionId);
          const tone = c.outcome === "unaffected" ? "neutral" : c.outcome === "still_correct" ? "green" : "amber";
          const label = c.outcome === "unaffected" ? "facts unchanged" : c.outcome === "still_correct" ? "re-checked: still correct" : "change proposed";
          return (
            <div key={c.questionId} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <span className="w-8 font-mono text-xs font-semibold text-stone-500">{c.questionId}</span>
              <span className="flex-1 text-stone-700">
                {q?.history[0]?.stem ?? q?.stem}
                <span className="block text-xs text-stone-500">{c.reason}</span>
              </span>
              <Badge tone={tone}>{label}</Badge>
            </div>
          );
        })}
      </Card>
      <SectionTitle hint="What learners see right now">Question bank</SectionTitle>
      <Card className="px-4 py-2">
        <Collapsible title={`${qs.filter((q) => q.status === "live").length} shown to learners · ${qs.filter((q) => q.status === "hidden").length} hidden while in review`}>
          <div className="grid gap-4 xl:grid-cols-2">
            {qs.map((q) => (
              <QuestionCard key={q.id} q={q} db={db} />
            ))}
          </div>
        </Collapsible>
      </Card>
    </>
  );
}
