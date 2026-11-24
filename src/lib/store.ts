import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SELECTION } from "./library";
import type { DB } from "./types";

// A single JSON file. Swap this module for Supabase/Postgres in production.
function dataDir() {
  return process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/fidelis" : path.join(process.cwd(), ".data"));
}
function dbPath() {
  return path.join(dataDir(), "db.json");
}

export function emptyDb(): DB {
  return {
    completed: 0,
    selectedDocIds: [...DEFAULT_SELECTION],
    docsVersion: "original",
    docs: [],
    originalDocs: [],
    docChanges: [],
    concepts: [],
    facts: [],
    factChecks: [],
    questions: [],
    contentChecks: [],
    proposals: [],
    llmCalls: [],
    settings: { review: true },
    error: null,
    running: null,
    snapshot: null,
  };
}

export function readDb(): DB {
  try {
    return { ...emptyDb(), ...JSON.parse(fs.readFileSync(dbPath(), "utf8")) };
  } catch {
    return emptyDb();
  }
}

export function writeDb(db: DB) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = dbPath() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dbPath());
}

// Serialize mutations inside one server process.
let chain: Promise<unknown> = Promise.resolve();
export function mutate<T>(fn: (db: DB) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    const db = readDb();
    try {
      return await fn(db);
    } finally {
      writeDb(db);
    }
  });
  chain = run.catch(() => undefined);
  return run;
}
