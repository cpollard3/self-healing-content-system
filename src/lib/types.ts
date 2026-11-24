// ---------- Docs layer ----------
export interface Section {
  id: string; // stable slug of the heading
  heading: string;
  text: string;
}

export interface DocVersion {
  docId: string;
  title: string;
  kind: "exam_guide" | "docs";
  url: string;
  sections: Section[];
}

export interface DocChange {
  docId: string;
  title: string;
  oldTitle: string | null;
  status: "unchanged" | "changed" | "new_page" | "removed_page";
  before: string; // whole page text, "" for a new page
  after: string; // whole page text, "" for a removed page
}

// ---------- Graph layer ----------
export interface Concept {
  id: string; // slug of the name
  name: string;
  kind: "product" | "feature" | "topic";
  summary: string;
  examSection: string | null; // exam guide section id
}

export type FactStatus = "current" | "changed" | "removed";

export interface Fact {
  id: string; // f1, f2...
  statement: string;
  quote: string;
  docId: string;
  conceptIds: string[];
  status: FactStatus; // changed/removed = no longer current
  origin: "original" | "revised" | "new"; // revised = replaces an older fact; new = added from updated docs
  replaces: string | null; // id of the fact this one supersedes
  replacedBy: string | null;
  quoteFound: boolean; // code check: is the quote really in the doc?
}

export interface FactCheck {
  factId: string;
  verdict: "still_true" | "changed" | "removed";
  reason: string;
  newFactId: string | null;
}

// ---------- Content layer ----------
export interface QuestionCore {
  stem: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
}

export interface Question extends QuestionCore {
  id: string;
  factIds: string[];
  status: "live" | "hidden"; // hidden = a rewrite is waiting for review
  origin: "original" | "new";
  history: (QuestionCore & { factIds: string[]; replacedAt: string })[];
}

export interface ContentCheck {
  questionId: string;
  outcome: "unaffected" | "still_correct" | "proposal";
  reason: string;
}

export type ProposalKind = "rewrite" | "new";
export type ProposalStatus = "pending" | "applied" | "rejected" | "undone";

export interface Proposal {
  id: string;
  kind: ProposalKind;
  questionId: string; // for "new", the id the question gets when applied
  reason: string;
  before: (QuestionCore & { factIds: string[] }) | null; // null for a new question
  after: QuestionCore & { factIds: string[] };
  problems: string[]; // code checks that failed; any problem forces review
  status: ProposalStatus;
  decidedBy: "auto" | "reviewer" | null;
}

// ---------- LLM log ----------
export interface LlmCall {
  id: string;
  step: number;
  label: string;
  model: string;
  system: string;
  prompt: string;
  response: unknown;
  ms: number;
  error?: string;
}

// ---------- Whole state ----------
export interface DB {
  completed: number; // last completed step, 0 = none
  selectedDocIds: string[];
  docsVersion: "original" | "updated";
  docs: DocVersion[]; // current versions of the selected docs (+ new pages after update)
  originalDocs: DocVersion[]; // kept after the update, for diffs and "before" quotes
  docChanges: DocChange[];
  concepts: Concept[];
  facts: Fact[];
  factChecks: FactCheck[];
  questions: Question[];
  contentChecks: ContentCheck[];
  proposals: Proposal[];
  llmCalls: LlmCall[];
  settings: { review: boolean };
  error: { step: number; message: string } | null;
  running: { step: number; startedAt: number } | null;
  // The graph and questions as they were before the docs changed, so steps 2-3 can be revisited.
  snapshot: { concepts: Concept[]; facts: Fact[]; questions: Question[] } | null;
}
