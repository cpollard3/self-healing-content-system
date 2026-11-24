# Fidelis — self-healing exam content

A working proof of concept for keeping generated learning content correct when its sources change.

You choose the source of truth (documentation pages). An LLM turns it into a **knowledge graph** of concepts and facts, each fact backed by a quote from the page, then generates practice questions **from the graph**. When the documentation is updated, the LLM re-checks every fact against the new docs, and questions built on facts that changed are rewritten. New facts get new questions. A person can review every change, with the old fact and quote next to the new ones.

The scenario is the Google Cloud Professional Cloud Architect exam before and after a (simulated) Google Cloud Next: Container Registry → Artifact Registry, Cloud Functions → Cloud Run functions, Deployment Manager → Infrastructure Manager, BigQuery flat-rate → editions, Gemini Cloud Assist launched, Cloud Storage reorganized with soft delete now on by default, and a reworded Pub/Sub page.

## Run it

Requires Node 22+ and an LLM key. Any OpenAI-compatible API works; the default is Google Gemini's free tier (get a key at https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local     # then paste your key after LLM_API_KEY=
npm run dev                    # http://localhost:3000
```

The demo starts with only **Cloud Storage** selected: about 7 LLM calls and 30 seconds on the free tier. Select every page for the full scenario: about 20 calls, 1–3 minutes.

```bash
npm test               # 16 tests, no key needed: a scripted mock model stands in for the LLM
npm run run-all        # run steps 1–6 headless against the real LLM and print every verdict (DOCS=all for every page)
npm run typecheck
```

## The demo (6 steps)

| Step | Layer | LLM | What you see |
| --- | --- | --- | --- |
| 1. Choose the source of truth | Docs | – | Pick the exam guide and docs pages; preview each |
| 2. Build knowledge graph | Graph | ✓ | Concepts and facts per page, laid out by exam section; every quote verified in the page by code |
| 3. Generate questions | Content | ✓ | The 7 most important questions, each linked to the facts it was built from |
| 4. Docs updated | Docs | – | Each changed page with a word-level diff |
| 5. Update graph | Graph | ✓ | Each fact: still true / changed / removed, old and new quote side by side; new facts |
| 6. Update content and review | Content | ✓ | Only questions on changed facts are re-checked; rewrites and new questions, old beside new, with cited facts before and after; approve / reject / undo |

Every step has an **LLM calls** panel showing the exact system prompt, input and validated JSON response.

**A typical run** (Gemini 3.1 Flash-Lite; results vary a little run to run):

| | Cloud Storage only (default) | All 8 pages |
| --- | --- | --- |
| LLM calls | 7 | 21 |
| Fact checks | 1 changed (deletion is no longer permanent: soft delete), the rest still true despite the reorganized page | 8 changed, the rest still true |
| New facts | 4 (soft delete, Autoclass, Gemini Cloud Assist) | 11 |
| Questions rewritten | 1 of 7 (soft delete) | 4 of 7: Container Registry, Cloud Functions, Deployment Manager, flat-rate pricing |
| New questions | 3 | 3 |

## How it works

The docs are HTML pages in `docs/`; open them in a browser: [design](docs/design.html) for the design and its decisions, [codebase](docs/codebase.html) for a tour of the code, and [how it was built](docs/ai-collaboration.html) with AI and where I steered it.

```
src/lib/library.ts   the documentation: original and updated version of each page
src/lib/steps.ts     the 6 steps, prompts and schemas, review actions
src/lib/llm.ts       one LLM entry point: prompt + zod schema → validated JSON
src/lib/text.ts      section parsing, page diff, quote verification
src/lib/store.ts     JSON-file store (swap for Postgres in production)
src/components/      the demo UI (step rail, graph view, diffs, review)
```

## Notes

- Source pages are paraphrased snapshots of real Google Cloud pages, labelled simulated; the changes mirror real announcements, dates illustrative.
- State lives in `.data/db.json`. "Reset demo" clears it.
- On Vercel the store is in `/tmp` and does not persist between instances; fine for a demo, use Postgres for anything real.
