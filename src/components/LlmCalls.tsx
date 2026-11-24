"use client";

import { useState } from "react";
import type { LlmCall } from "@/lib/types";
import { Badge, cx } from "./ui";

function CallRow({ c }: { c: LlmCall }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"prompt" | "response" | "system">("response");
  return (
    <div className="border-b border-stone-200 last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50">
        <span className={cx("text-stone-400 transition", open && "rotate-90")}>▸</span>
        <span className="flex-1 text-sm text-stone-800">{c.label}</span>
        {c.error ? <Badge tone="red">failed</Badge> : <Badge tone="green">{c.model}</Badge>}
        <span className="w-14 text-right text-xs tabular-nums text-stone-500">
          {(c.ms / 1000).toFixed(1)}s
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="mb-2 flex gap-1">
            {(["system", "prompt", "response"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                  tab === t ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100",
                )}
              >
                {t === "prompt" ? "input" : t}
              </button>
            ))}
          </div>
          {c.error && <div className="mb-2 rounded-md bg-rose-50 p-2 text-xs text-rose-700">{c.error}</div>}
          <pre className="scroll-thin max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-stone-900 p-3 font-mono text-[11.5px] leading-relaxed text-stone-100">
            {tab === "system" ? c.system : tab === "prompt" ? c.prompt : JSON.stringify(c.response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function LlmCalls({ calls, running }: { calls: LlmCall[]; running?: boolean }) {
  if (!calls.length && !running) return null;
  return (
    <div className="mt-10">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">LLM calls in this step</h3>
        <span className="text-xs text-stone-500">
          Every prompt and structured response, exactly as sent and received. Responses are validated against a schema.
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {calls.map((c) => (
          <CallRow key={c.id} c={c} />
        ))}
        {running && <div className="px-4 py-3 text-sm text-stone-500">Waiting for more responses…</div>}
      </div>
    </div>
  );
}
