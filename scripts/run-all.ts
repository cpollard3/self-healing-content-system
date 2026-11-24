// Run every step headlessly against the configured LLM and print what changed.
//   npm run run-all                 the demo's default selection
//   DOCS=all npm run run-all        every page
//   REVIEW=0 npm run run-all        review off: changes that pass the code checks apply
import { emptyDb, readDb, writeDb } from "../src/lib/store";
import { runStep } from "../src/lib/steps";
import { ALL_ORIGINAL } from "../src/lib/library";

async function main() {
  const db = emptyDb();
  db.settings.review = process.env.REVIEW !== "0";
  // DOCS=all runs every page; DOCS=a,b picks pages; default = the demo's default selection.
  if (process.env.DOCS === "all") db.selectedDocIds = [...ALL_ORIGINAL];
  else if (process.env.DOCS) db.selectedDocIds = process.env.DOCS.split(",");
  writeDb(db);
  for (let n = 1; n <= 6; n++) {
    const t = Date.now();
    const cur = readDb();
    await runStep(cur, n);
    writeDb(cur);
    if (cur.error) {
      console.error(`step ${n} failed: ${cur.error.message}`);
      process.exit(1);
    }
    const calls = cur.llmCalls.filter((c) => c.step === n);
    console.log(`step ${n} done in ${((Date.now() - t) / 1000).toFixed(1)}s, ${calls.length} LLM calls`);
  }
  const db2 = readDb();
  console.log(`concepts ${db2.concepts.length}, facts ${db2.facts.length}, questions ${db2.questions.length}, proposals ${db2.proposals.length}`);
  for (const c of db2.factChecks) if (c.verdict !== "still_true") console.log(`  fact ${c.factId}: ${c.verdict} -> ${c.newFactId ?? "-"} (${c.reason})`);
  for (const p of db2.proposals) console.log(`  ${p.id} ${p.kind} ${p.questionId} [${p.status}] ${p.problems.join("; ")} :: ${p.reason}`);
}
main();
