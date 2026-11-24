"use client";

import { diffWords } from "diff";

/** Inline word diff: removed words struck in red, added words in green. */
export function InlineDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <span className="leading-relaxed">
      {parts.map((p, i) =>
        p.added ? (
          <ins key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-900 no-underline">
            {p.value}
          </ins>
        ) : p.removed ? (
          <del key={i} className="rounded bg-rose-100 px-0.5 text-rose-800 decoration-rose-400">
            {p.value}
          </del>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}

/** One side of a diff: highlight only what this side has that the other does not. */
export function SideDiff({ before, after, side }: { before: string; after: string; side: "before" | "after" }) {
  const parts = diffWords(before, after);
  return (
    <span className="leading-relaxed">
      {parts.map((p, i) => {
        if (side === "before" && p.added) return null;
        if (side === "after" && p.removed) return null;
        if (p.removed) return <mark key={i} className="rounded bg-rose-100 px-0.5 text-rose-900">{p.value}</mark>;
        if (p.added) return <mark key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-900">{p.value}</mark>;
        return <span key={i}>{p.value}</span>;
      })}
    </span>
  );
}
