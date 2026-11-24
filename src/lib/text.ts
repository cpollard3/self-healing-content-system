import type { DocChange, DocVersion, Section } from "./types";

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Collapse whitespace and unify quotes so quote matching is forgiving about formatting only. */
export function norm(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Split "## Heading" markdown into sections. */
export function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of markdown.split("\n")) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      if (current) sections.push(current);
      const exam = m[1].match(/^Section (\d+)\b/);
      current = { id: exam ? `section-${exam[1]}` : slug(m[1]), heading: m[1].trim(), text: "" };
    } else if (current) {
      current.text += (current.text ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
  return sections.map((s) => ({ ...s, text: s.text.trim() }));
}

export function docText(doc: DocVersion): string {
  return doc.sections.map((s) => `## ${s.heading}\n${s.text}`).join("\n\n");
}

/** Is the quote word for word in one of the pages? An elided quote ("A [...] B") counts if every piece appears, in order, on the same page. */
export function quoteIn(quote: string, docs: DocVersion[]): boolean {
  const parts = norm(quote)
    .split(/\s*(?:\[\.\.\.\]|\[…\]|\.\.\.|…)\s*/)
    .filter(Boolean);
  if (!parts.length) return false;
  return docs.some((d) => {
    const text = norm(docText(d));
    let at = 0;
    for (const part of parts) {
      const i = text.indexOf(part, at);
      if (i < 0) return false;
      at = i + part.length;
    }
    return true;
  });
}

/** Compare two versions of one page as whole texts; the UI shows a word diff. */
export function diffDoc(oldDoc: DocVersion | undefined, newDoc: DocVersion | undefined): DocChange {
  const base = (newDoc ?? oldDoc)!;
  const before = oldDoc ? docText(oldDoc) : "";
  const after = newDoc ? docText(newDoc) : "";
  const status = !oldDoc
    ? "new_page"
    : !newDoc
      ? "removed_page"
      : norm(before) === norm(after) && oldDoc.title === newDoc.title
        ? "unchanged"
        : "changed";
  return { docId: base.docId, title: base.title, oldTitle: oldDoc?.title ?? null, status, before, after };
}
