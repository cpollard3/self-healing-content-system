"use client";

import { useState } from "react";
import type { DB, Fact, QuestionCore } from "@/lib/types";
import { SideDiff } from "./Diff";
import { Badge, cx, Quote } from "./ui";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function FactChip({ fact, db }: { fact: Fact | undefined; db: DB }) {
  const [open, setOpen] = useState(false);
  if (!fact) return null;
  const doc = [...db.docs, ...db.originalDocs].find((d) => d.docId === fact.docId);
  const tone = fact.status === "changed" ? "amber" : fact.status === "removed" ? "red" : fact.origin === "new" ? "green" : fact.origin === "revised" ? "sky" : "neutral";
  return (
    <span className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="focus:outline-none">
        <Badge tone={tone}>
          {fact.id}
          {fact.status !== "current" && <span className="opacity-70">· {fact.status}</span>}
        </Badge>
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-30 w-[22rem] rounded-xl border border-stone-200 bg-white p-3 text-left shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">
              Fact {fact.id} · {doc?.title ?? fact.docId}
            </span>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700">✕</button>
          </div>
          <div className="mb-2 text-sm text-stone-800">{fact.statement}</div>
          <Quote>{fact.quote}</Quote>
        </div>
      )}
    </span>
  );
}

export function QuestionBody({
  q,
  compareTo,
  side,
}: {
  q: QuestionCore;
  compareTo?: QuestionCore | null;
  side?: "before" | "after";
}) {
  const diff = (a: string, b: string | undefined) =>
    compareTo && side && b !== undefined ? (
      <SideDiff before={side === "before" ? a : b} after={side === "before" ? b : a} side={side} />
    ) : (
      a
    );
  return (
    <div className="space-y-3">
      <div className="text-[15px] font-medium leading-snug text-stone-900">{diff(q.stem, compareTo?.stem)}</div>
      <ol className="space-y-1.5">
        {q.options.map((o, i) => {
          const correct = i === q.answer;
          return (
            <li
              key={i}
              className={cx(
                "flex gap-2 rounded-lg px-2.5 py-1.5 text-sm",
                correct ? "bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-200" : "bg-stone-50 text-stone-700",
              )}
            >
              <span className={cx("font-semibold", correct ? "text-emerald-700" : "text-stone-400")}>{LETTERS[i]}</span>
              <span className="flex-1">{diff(o, compareTo?.options[i])}</span>
              {correct && <span className="text-emerald-600">✓</span>}
            </li>
          );
        })}
      </ol>
      <div className="text-[13px] leading-relaxed text-stone-600">
        <span className="font-semibold text-stone-500">Why: </span>
        {diff(q.explanation, compareTo?.explanation)}
      </div>
    </div>
  );
}
