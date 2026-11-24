// Client-safe step descriptions used by the UI.
export interface StepMeta {
  n: number;
  title: string;
  layer: "Docs" | "Graph" | "Content";
  llm: boolean;
  act: "Build" | "Docs change";
  what: string;
  notice: string;
  runLabel: string;
}

export const STEP_META: StepMeta[] = [
  {
    n: 1,
    title: "Choose the source of truth",
    layer: "Docs",
    llm: false,
    act: "Build",
    what: "Choose the source of truth the question bank is built from: the Professional Cloud Architect exam guide and a set of Google Cloud docs pages.",
    notice: "Everything downstream (the graph, the questions, every later fix) traces back to these pages.",
    runLabel: "Load the source of truth",
  },
  {
    n: 2,
    title: "Build knowledge graph",
    layer: "Graph",
    llm: true,
    act: "Build",
    what: "The LLM reads each page and extracts concepts (products, features, topics) and short checkable facts, each with a quote copied from the page. Concepts are mapped to exam guide sections.",
    notice: "Every fact carries its quote, and plain code verifies the quote really appears in the page. This is the layer that gets checked later.",
    runLabel: "Build the graph",
  },
  {
    n: 3,
    title: "Generate questions",
    layer: "Content",
    llm: true,
    act: "Build",
    what: "From the graph, not the raw docs, the LLM proposes the most important practice questions. Each question records the facts it was built from.",
    notice: "The question → fact links are what make healing possible: when a fact changes, we know exactly which questions depend on it.",
    runLabel: "Generate questions",
  },
  {
    n: 4,
    title: "Docs updated",
    layer: "Docs",
    llm: false,
    act: "Docs change",
    what: "Google Cloud Next happens. New versions of the chosen pages arrive, plus a brand-new page. Plain code shows what changed, word by word.",
    notice: "No LLM yet. Depending on the pages chosen, look for deprecations (Container Registry, Deployment Manager, flat-rate pricing), a rename (Cloud Functions), the reorganized Cloud Storage page with Autoclass and soft delete now on by default, a reworded Pub/Sub page, and the new Gemini Cloud Assist page.",
    runLabel: "Publish updated docs",
  },
  {
    n: 5,
    title: "Update graph",
    layer: "Graph",
    llm: true,
    act: "Docs change",
    what: "For every fact, the LLM asks one question against the updated docs: still true, changed, or removed? Changed facts get a corrected fact with a new quote, and facts the update added are recorded as new (code drops any whose quote was already in the old page).",
    notice: "One simple check covers every kind of change. Renames and deprecations come back as changed; the reworded Pub/Sub page should come back still true.",
    runLabel: "Check every fact",
  },
  {
    n: 6,
    title: "Update content and review",
    layer: "Content",
    llm: true,
    act: "Docs change",
    what: "Only questions built on a changed or removed fact go back to the LLM, which judges the whole question and proposes a rewrite if needed. New facts that no question covers get new questions. A person can approve, reject or undo each change, with the evidence side by side.",
    notice: "Unaffected questions cost nothing. Every proposal passes simple code checks first. With review on, changes wait for a person and questions on changed facts are hidden from learners meanwhile; with review off, changes that pass the checks apply at once. Anything applied can be undone.",
    runLabel: "Update the questions",
  },
];
