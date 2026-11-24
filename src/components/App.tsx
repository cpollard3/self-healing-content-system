"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/api";
import type { LibraryDoc } from "@/lib/library";
import { STEP_META, type StepMeta } from "@/lib/stepMeta";
import { LlmCalls } from "./LlmCalls";
import { Step1, Step2, Step3, Step4, Step5, Step6 } from "./StepViews";
import { Badge, Button, cx, Spinner, Switch } from "./ui";

const LAST = STEP_META.length;

async function post(url: string, body?: unknown): Promise<Snapshot> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function App({ initial, library }: { initial: Snapshot; library: LibraryDoc[] }) {
  const [snap, setSnap] = useState(initial);
  const [view, setView] = useState(Math.min(LAST, initial.db.completed + 1));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const autoRun = useRef(false);
  const { db, llm } = snap;
  const running = db.running?.step ?? null;

  // Poll while a step runs, so LLM calls appear as they finish.
  useEffect(() => {
    if (!busy && !running) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/state", { cache: "no-store" });
      setSnap(await r.json());
    }, 900);
    return () => clearInterval(t);
  }, [busy, running]);

  const act = useCallback(async (fn: () => Promise<Snapshot>) => {
    setBusy(true);
    try {
      const s = await fn();
      setSnap(s);
      return s;
    } catch (e) {
      setToast((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const runStep = useCallback(
    async (n: number) => {
      setView(n);
      const s = await act(() => post("/api/step", { n }));
      return !!s && !s.db.error;
    },
    [act],
  );

  const runAll = async () => {
    autoRun.current = true;
    for (let n = db.completed + 1; n <= LAST && autoRun.current; n++) {
      const ok = await runStep(n);
      if (!ok) break;
    }
    autoRun.current = false;
  };

  const next = db.completed + 1;
  const meta = STEP_META[view - 1];
  const stepCalls = db.llmCalls.filter((c) => c.step === view);

  return (
    <div className="flex h-screen flex-col">
      <Header snap={snap} busy={busy} onReview={(v) => act(() => post("/api/settings", { review: v }))} onReset={() => (autoRun.current = false, act(() => post("/api/reset")).then(() => setView(1)))} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          db={db}
          view={view}
          running={running}
          busy={busy}
          onView={setView}
          onRunNext={() => runStep(next)}
          onRunAll={runAll}
        />
        <main className="scroll-thin min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 py-8">
            <StepHeader meta={meta} />
            {db.error?.step === view && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <div className="font-semibold">This step failed</div>
                <div className="mt-1">{db.error.message}</div>
              </div>
            )}
            {running === view ? (
              <RunningCard meta={meta} startedAt={db.running!.startedAt} calls={stepCalls.length} />
            ) : view > db.completed && view !== 1 ? (
              <NotYet meta={meta} next={next} busy={busy} onRun={() => runStep(view)} onGo={() => setView(next)} />
            ) : null}
            {view === 1 && (
              <>
                {db.completed === 0 && running !== 1 && (
                  <div className="mb-5 flex items-center gap-3">
                    <Button variant="primary" size="lg" disabled={busy || !db.selectedDocIds.length} onClick={() => runStep(1)}>
                      Load {db.selectedDocIds.length} selected {db.selectedDocIds.length === 1 ? "page" : "pages"} →
                    </Button>
                    <span className="text-sm text-stone-500">or use “Run all steps” in the sidebar for the full walkthrough.</span>
                  </div>
                )}
                <Step1 db={db} library={library} onSelect={(ids) => act(() => post("/api/select", { docIds: ids }))} />
              </>
            )}
            {view === 2 && db.completed >= 2 && <Step2 db={db} />}
            {view === 3 && db.completed >= 3 && <Step3 db={db} />}
            {view === 4 && db.completed >= 4 && <Step4 db={db} />}
            {view === 5 && db.completed >= 5 && <Step5 db={db} />}
            {view === 6 && db.completed >= 6 && (
              <Step6 db={db} busy={busy} onDecide={(id, action) => act(() => post(`/api/proposals/${id}`, { action }))} />
            )}
            {meta.llm && <LlmCalls calls={stepCalls} running={running === view} />}
          </div>
        </main>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-xl">
          <div className="flex gap-3">
            <span className="flex-1">{toast}</span>
            <button onClick={() => setToast(null)} className="text-stone-400 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ header
function Header({
  snap,
  busy,
  onReview,
  onReset,
}: {
  snap: Snapshot;
  busy: boolean;
  onReview: (v: boolean) => void;
  onReset: () => void;
}) {
  const { llm, db } = snap;
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-stone-200 bg-white px-5">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">F</div>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight text-stone-900">Fidelis</div>
          <div className="text-[11px] text-stone-500">Self-healing exam content</div>
        </div>
      </div>
      <div className="ml-4 hidden items-center gap-2 text-xs text-stone-500 md:flex">
        <Badge tone="violet">Google Cloud Professional Cloud Architect</Badge>
        <span>{db.docsVersion === "updated" ? "Docs: after Google Cloud Next" : "Docs: before Google Cloud Next"}</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <Badge tone={llm.ready ? "green" : "red"}>
          <span className={cx("h-1.5 w-1.5 rounded-full", llm.ready ? "bg-emerald-500" : "bg-rose-500")} />
          {llm.ready ? `LLM: ${llm.model}` : "No LLM key: set LLM_API_KEY in .env.local"}
        </Badge>
        <div title="On: changes wait for a person in step 6. Off: changes that pass the code checks apply automatically (and can still be undone).">
          <Switch checked={db.settings.review} onChange={onReview} label="Human review" />
        </div>
        <Button size="sm" variant="ghost" disabled={busy && !db.running} onClick={onReset}>
          Reset demo
        </Button>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ sidebar
function Sidebar({
  db,
  view,
  running,
  busy,
  onView,
  onRunNext,
  onRunAll,
}: {
  db: Snapshot["db"];
  view: number;
  running: number | null;
  busy: boolean;
  onView: (n: number) => void;
  onRunNext: () => void;
  onRunAll: () => void;
}) {
  const next = db.completed + 1;
  const acts = ["Build", "Docs change"] as const;
  const nextMeta = STEP_META[next - 1];
  const live = db.questions.filter((q) => q.status === "live").length;
  return (
    <aside className="scroll-thin flex w-80 shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-white">
      <nav className="flex-1 px-3 py-4">
        {acts.map((act) => (
          <div key={act} className="mb-4">
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {act === "Build" ? "Build: from the source of truth" : "Google Cloud Next: docs change"}
            </div>
            {STEP_META.filter((s) => s.act === act).map((s) => {
              const done = db.completed >= s.n;
              const isRunning = running === s.n;
              const isNext = !done && s.n === next;
              return (
                <button
                  key={s.n}
                  onClick={() => onView(s.n)}
                  className={cx(
                    "group mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                    view === s.n ? "bg-indigo-50" : "hover:bg-stone-50",
                  )}
                >
                  <span
                    className={cx(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      isRunning ? "bg-indigo-600 text-white pulse-ring" : done ? "bg-emerald-500 text-white" : isNext ? "bg-indigo-600 text-white" : "bg-stone-200 text-stone-500",
                    )}
                  >
                    {isRunning ? <Spinner className="h-3 w-3" /> : done ? "✓" : s.n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block text-sm font-medium", view === s.n ? "text-indigo-900" : "text-stone-800")}>{s.title}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
                      {s.layer} layer{s.llm && <span className="rounded bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-700">LLM</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-stone-200 p-4">
        {next <= LAST ? (
          <>
            <Button variant="primary" size="lg" className="w-full" disabled={busy || !!running} onClick={onRunNext}>
              {running ? <Spinner /> : null}
              {running ? `Running step ${running}…` : `Run step ${next}: ${nextMeta.runLabel}`}
            </Button>
            <Button className="w-full" disabled={busy || !!running} onClick={onRunAll}>
              Run all remaining steps
            </Button>
          </>
        ) : (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">All steps have run. Review changes in step {LAST}, or reset to start again.</div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-2 text-center">
          <MiniStat label="facts" value={db.facts.filter((f) => f.status === "current").length} />
          <MiniStat label="live Qs" value={live} />
          <MiniStat label="to review" value={db.proposals.filter((p) => p.status === "pending").length} />
        </div>
      </div>
    </aside>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-stone-50 py-1.5">
      <div className="text-base font-semibold tabular-nums text-stone-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
}

// ------------------------------------------------------------------ main pieces
function StepHeader({ meta }: { meta: StepMeta }) {
  const layers = ["Docs", "Graph", "Content"] as const;
  return (
    <div className="mb-7">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Step {meta.n} of {LAST}</span>
        <div className="flex items-center gap-1 text-[11px]">
          {layers.map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              <span
                className={cx(
                  "rounded-md px-2 py-0.5 font-medium",
                  l === meta.layer ? "bg-stone-900 text-white" : "bg-stone-200/70 text-stone-500",
                )}
              >
                {l}
              </span>
              {i < 2 && <span className="text-stone-300">→</span>}
            </span>
          ))}
        </div>
        {meta.llm ? <Badge tone="indigo">uses the LLM</Badge> : <Badge>plain code</Badge>}
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">{meta.title}</h1>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-stone-600">{meta.what}</p>
      <div className="mt-4 flex max-w-3xl gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
        <span className="text-base">👀</span>
        <div>
          <span className="font-semibold">What to notice: </span>
          {meta.notice}
        </div>
      </div>
    </div>
  );
}

function RunningCard({ meta, startedAt, calls }: { meta: StepMeta; startedAt: number; calls: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mb-6 flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <Spinner className="h-6 w-6 text-indigo-600" />
      <div>
        <div className="font-semibold text-indigo-950">Running: {meta.title}</div>
        <div className="text-sm text-indigo-800">
          {((now - startedAt) / 1000).toFixed(0)}s elapsed{meta.llm ? ` · ${calls} LLM ${calls === 1 ? "response" : "responses"} received so far` : ""}
        </div>
      </div>
    </div>
  );
}

function NotYet({ meta, next, busy, onRun, onGo }: { meta: StepMeta; next: number; busy: boolean; onRun: () => void; onGo: () => void }) {
  const isNext = meta.n === next;
  return (
    <div className="mb-6 rounded-xl border border-dashed border-stone-300 bg-white/60 p-8 text-center">
      {isNext ? (
        <>
          <div className="mb-3 text-sm text-stone-600">This step hasn&apos;t run yet.</div>
          <Button variant="primary" size="lg" disabled={busy} onClick={onRun}>
            {meta.runLabel} →
          </Button>
        </>
      ) : (
        <>
          <div className="mb-3 text-sm text-stone-600">Run step {next} first.</div>
          <Button onClick={onGo}>Go to step {next}</Button>
        </>
      )}
    </div>
  );
}
