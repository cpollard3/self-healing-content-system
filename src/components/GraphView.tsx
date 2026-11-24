"use client";

import { useMemo, useState } from "react";
import type { Concept, DB, Fact } from "@/lib/types";
import { Badge, cx, Quote } from "./ui";

const W = 1100;

const SECTION_COLORS: Record<string, string> = {
  "section-1": "#6366f1",
  "section-2": "#0ea5e9",
  "section-3": "#14b8a6",
  "section-4": "#f59e0b",
  "section-5": "#ec4899",
  "section-6": "#8b5cf6",
};

const FACT_COLORS = {
  original: "#a8a29e",
  changed: "#f59e0b",
  removed: "#e11d48",
  revised: "#0284c7",
  new: "#059669",
};

function wrap(name: string, max = 20): string[] {
  if (name.length <= max) return [name];
  const words = name.split(" ");
  let a = "";
  while (words.length && (a + " " + words[0]).trim().length <= max) a = (a + " " + words.shift()).trim();
  return [a || words.shift()!, words.join(" ")].filter(Boolean);
}

type Node = { x: number; y: number; id: string; type: "concept" | "fact" | "section"; ref: string; label?: string };
type Link = { source: Node; target: Node; kind: "about" | "replaces" };

function factColor(f: Fact, update: boolean) {
  if (!update) return FACT_COLORS.original;
  if (f.status === "changed") return FACT_COLORS.changed;
  if (f.status === "removed") return FACT_COLORS.removed;
  if (f.origin === "revised") return FACT_COLORS.revised;
  if (f.origin === "new") return FACT_COLORS.new;
  return FACT_COLORS.original;
}

export function GraphView({ db, update = false }: { db: DB; update?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const facts = useMemo(() => (update ? db.facts : db.facts.filter((f) => f.origin === "original")), [db.facts, update]);
  const concepts = useMemo(() => {
    const used = new Set(facts.flatMap((f) => f.conceptIds));
    return db.concepts.filter((c) => used.has(c.id));
  }, [db.concepts, facts]);

  const layout = useMemo(() => {
    // Deterministic layout: one column per exam section (plus "not on the exam").
    // Concepts stack down their column; each concept's facts fan out around it.
    const guide = db.docs.find((d) => d.kind === "exam_guide");
    const cols = [...(guide?.sections ?? []).map((s) => ({ key: s.id, label: s.heading.replace(/\s*\(.*\)$/, "") })), { key: "none", label: "Not on the exam" }];
    const colOf = (c: Concept) => {
      const i = cols.findIndex((x) => x.key === c.examSection);
      return i < 0 ? cols.length - 1 : i;
    };
    const colW = (W - 20) / cols.length;
    const colX = (i: number) => 10 + colW * (i + 0.5);
    const ROW = 104;
    const TOP = 96;
    const rows = cols.map(() => 0);
    const nodes: Node[] = cols.map((c, i) => ({ id: "s:" + c.key, type: "section" as const, ref: c.key, label: c.label, x: colX(i), y: 26 }));
    const pos = new Map<string, { x: number; y: number }>();
    for (const c of concepts) {
      const i = colOf(c);
      const p = { x: colX(i), y: TOP + rows[i]++ * ROW };
      pos.set(c.id, p);
      nodes.push({ id: "c:" + c.id, type: "concept", ref: c.id, label: c.name, ...p });
    }
    const owned = new Map<string, Fact[]>();
    for (const f of facts) {
      const owner = f.conceptIds.find((id) => pos.has(id));
      if (!owner) continue;
      owned.set(owner, [...(owned.get(owner) ?? []), f]);
    }
    for (const [cid, fs] of owned) {
      const p = pos.get(cid)!;
      const radius = fs.length > 6 ? 38 : 31;
      // fan from upper-left round to upper-right, leaving room for the label underneath
      const a0 = (200 * Math.PI) / 180;
      const a1 = (-20 * Math.PI) / 180;
      fs.forEach((f, k) => {
        const t = fs.length === 1 ? 0.5 : k / (fs.length - 1);
        const a = a0 + (a1 - a0) * t;
        nodes.push({ id: "f:" + f.id, type: "fact", ref: f.id, x: p.x + Math.cos(a) * radius * 1.35, y: p.y - Math.sin(a) * radius });
      });
    }
    const ids = new Set(nodes.map((n) => n.id));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: Link[] = [];
    const add = (a: string, b: string, kind: Link["kind"]) => ids.has(a) && ids.has(b) && links.push({ source: byId.get(a)!, target: byId.get(b)!, kind });
    for (const f of facts) for (const cid of f.conceptIds) add("f:" + f.id, "c:" + cid, "about");
    if (update) for (const f of facts) if (f.replacedBy) add("f:" + f.id, "f:" + f.replacedBy, "replaces");
    const H = TOP + Math.max(...rows, 1) * ROW - 30;
    return { nodes, links, H, colW, cols };
  }, [concepts, facts, update, db.docs]);

  const focus = hover ?? selected;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const l of layout.links) {
      if (l.source.id === focus) s.add(l.target.id);
      if (l.target.id === focus) s.add(l.source.id);
    }
    return s;
  }, [focus, layout.links]);

  const conceptById = (id: string) => db.concepts.find((c) => c.id === id);
  const factById = (id: string) => db.facts.find((f) => f.id === id);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <svg viewBox={`0 0 ${W} ${layout.H}`} className="h-auto w-full select-none" onClick={() => setSelected(null)}>
          <defs>
            <marker id="arr2" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#0284c7" />
            </marker>
          </defs>
          {layout.cols.map((c, i) => (
            <rect key={c.key} x={10 + layout.colW * i + 3} y={8} width={layout.colW - 6} height={layout.H - 16} rx={10} fill={i % 2 ? "#fafaf9" : "#f5f5f4"} />
          ))}
          {layout.links.map((l, i) => {
            const dim = neighbours && !(neighbours.has(l.source.id) && neighbours.has(l.target.id));
            const style =
              l.kind === "about"
                ? { stroke: Math.abs(l.target.x - l.source.x) > layout.colW * 0.6 ? "#ece9e6" : "#d6d3d1", width: 1 }
                : { stroke: "#0284c7", width: 1.5, dash: "3 3", marker: "url(#arr2)" };
            const dx = l.target.x - l.source.x;
            const dy = l.target.y - l.source.y;
            const len = Math.hypot(dx, dy) || 1;
            const pad = l.kind === "replaces" ? 7 : 0;
            return (
              <line
                key={i}
                x1={l.source.x}
                y1={l.source.y}
                x2={l.target.x - (dx / len) * pad}
                y2={l.target.y - (dy / len) * pad}
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
                markerEnd={style.marker}
                opacity={dim ? 0.12 : 1}
              />
            );
          })}
          {layout.nodes.map((n) => {
            const dim = neighbours && !neighbours.has(n.id);
            const isSel = selected === n.id;
            if (n.type === "section") {
              const color = SECTION_COLORS[n.ref] ?? "#78716c";
              const num = n.ref.replace("section-", "");
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                  <title>{n.label}</title>
                  <text textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>{n.ref === "none" ? "Not on exam" : `Exam §${num}`}</text>
                  <text y={15} textAnchor="middle" fontSize={9.5} fill="#78716c">{n.ref === "none" ? "" : (n.label ?? "").replace(/^Section \d+:\s*/, "").slice(0, 26) + ((n.label ?? "").length > 37 ? "…" : "")}</text>
                </g>
              );
            }
            if (n.type === "fact") {
              const f = factById(n.ref)!;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={dim ? 0.15 : 1}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => (e.stopPropagation(), setSelected(n.id))}
                >
                  <circle r={isSel ? 8 : 6} fill={factColor(f, update)} stroke="white" strokeWidth={1.5} />
                  {f.status === "removed" && update && <path d="M-4 -4L4 4M4 -4L-4 4" stroke="white" strokeWidth={1.6} />}
                </g>
              );
            }
            const c = conceptById(n.ref)!;
            const fill = c.examSection ? SECTION_COLORS[c.examSection] ?? "#78716c" : "#a8a29e";
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer"
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => (e.stopPropagation(), setSelected(n.id))}
              >
                <circle r={15} fill={fill} fillOpacity={0.9} stroke={isSel ? "#1c1917" : "white"} strokeWidth={2} />
                <text y={31} textAnchor="middle" fontSize={11} fontWeight={600} fill="#292524" style={{ paintOrder: "stroke" }} stroke="white" strokeWidth={3}>
                  {wrap(c.name).map((line, i) => (
                    <tspan key={i} x={0} dy={i ? 12 : 0}>{line}</tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
        <Legend update={update} />
      </div>
      <DetailPanel db={db} selected={selected} onSelect={setSelected} />
    </div>
  );
}

function Legend({ update }: { update: boolean }) {
  const dot = (color: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 bg-stone-50 px-4 py-2 text-[11px] text-stone-600">
      <span className="font-semibold text-stone-500">Column = exam section · circle = concept · dot = fact</span>
      {update ? (
        <>
          {dot(FACT_COLORS.original, "fact still true")}
          {dot(FACT_COLORS.changed, "fact changed")}
          {dot(FACT_COLORS.revised, "corrected fact")}
          {dot(FACT_COLORS.removed, "fact removed")}
          {dot(FACT_COLORS.new, "new fact")}
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-sky-600" />corrected by</span>
        </>
      ) : (
        Object.entries(SECTION_COLORS).map(([k, v]) => <span key={k}>{dot(v, k.replace("section-", "Exam §"))}</span>)
      )}
    </div>
  );
}

function DetailPanel({ db, selected, onSelect }: { db: DB; selected: string | null; onSelect: (id: string) => void }) {
  // Node ids are "f:<fact id>" or "c:<concept id>".
  const [type, id] = selected?.split(":") ?? [];
  const f = type === "f" ? db.facts.find((x) => x.id === id) : undefined;
  const c = type === "c" ? db.concepts.find((x) => x.id === id) : undefined;
  if (!f && !c) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-5 text-sm text-stone-500">
        Click a concept or a fact to see what the graph knows about it, including the quote each fact rests on. Hover to highlight its links.
      </div>
    );
  }
  if (f) {
    const doc = [...db.docs, ...db.originalDocs].find((d) => d.docId === f.docId);
    const chk = db.factChecks.find((c) => c.factId === f.id);
    return (
      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Badge>fact {f.id}</Badge>
          {f.status !== "current" && <Badge tone={f.status === "changed" ? "amber" : "red"}>{f.status}</Badge>}
          {f.origin === "revised" && <Badge tone="sky">corrected</Badge>}
          {f.origin === "new" && <Badge tone="green">new</Badge>}
        </div>
        <div className="text-sm font-medium text-stone-900">{f.statement}</div>
        <Quote>{f.quote}</Quote>
        <div className="text-xs text-stone-500">
          From <span className="font-medium text-stone-700">{doc?.title ?? f.docId}</span>
          {f.quoteFound ? " · quote verified in the page ✓" : " · quote NOT found in the page ⚠"}
        </div>
        {chk && <div className="rounded-md bg-stone-50 p-2 text-xs text-stone-600">LLM check: {chk.reason}</div>}
        <div className="flex flex-wrap gap-1">
          {f.conceptIds.map((cid) => (
            <button key={cid} onClick={() => onSelect("c:" + cid)}>
              <Badge tone="indigo">{db.concepts.find((c) => c.id === cid)?.name ?? cid}</Badge>
            </button>
          ))}
        </div>
        {f.replacedBy && (
          <button onClick={() => onSelect("f:" + f.replacedBy)} className="text-xs font-medium text-sky-700 hover:underline">
            Replaced by {f.replacedBy} →
          </button>
        )}
        {f.replaces && (
          <button onClick={() => onSelect("f:" + f.replaces)} className="text-xs font-medium text-amber-700 hover:underline">
            ← Corrects {f.replaces}
          </button>
        )}
      </div>
    );
  }
  if (!c) return null;
  const facts = db.facts.filter((x) => x.conceptIds.includes(c.id));
  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-stone-900">{c.name}</span>
        <Badge>{c.kind}</Badge>
      </div>
      {c.summary && <div className="text-sm text-stone-700">{c.summary}</div>}
      <div className="text-xs text-stone-500">Exam section: {c.examSection ?? "not mapped"}</div>
      <div className="space-y-1.5">
        {facts.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect("f:" + f.id)}
            className={cx("block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-stone-50", f.status !== "current" && "text-stone-400 line-through")}
          >
            <span className="font-mono text-stone-400">{f.id}</span> {f.statement}
          </button>
        ))}
      </div>
    </div>
  );
}
