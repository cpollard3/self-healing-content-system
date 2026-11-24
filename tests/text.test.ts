import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/library";
import { diffDoc, parseSections, quoteIn } from "@/lib/text";
import type { DocVersion } from "@/lib/types";

function version(id: string, which: "original" | "updated"): DocVersion | undefined {
  const d = LIBRARY.find((x) => x.id === id)!;
  const v = d[which];
  return v ? { docId: id, title: v.title, kind: d.kind, url: d.url, sections: parseSections(v.text) } : undefined;
}

describe("parseSections", () => {
  it("gives exam guide sections short stable ids, even when the weight in the heading changes", () => {
    expect(version("exam-guide", "original")!.sections.map((s) => s.id)).toEqual([
      "section-1", "section-2", "section-3", "section-4", "section-5", "section-6",
    ]);
    expect(version("exam-guide", "updated")!.sections[0].id).toBe("section-1");
  });
});

describe("diffDoc", () => {
  const diff = (id: string) => diffDoc(version(id, "original"), version(id, "updated"));

  it("reports a changed page with its old and new text", () => {
    const d = diff("container-registry");
    expect(d.status).toBe("changed");
    expect(d.before).toMatch(/private registry for Docker container images/);
    expect(d.after).toMatch(/Container Registry is deprecated/);
  });

  it("keeps the old title when a page is renamed", () => {
    const d = diff("cloud-functions");
    expect(d.oldTitle).toBe("Cloud Functions");
    expect(d.title).toBe("Cloud Run functions");
  });

  it("leaves an identical page unchanged", () => {
    expect(diff("cloud-sql").status).toBe("unchanged");
  });

  it("reports a page that did not exist before as new", () => {
    expect(diff("gemini-cloud-assist").status).toBe("new_page");
  });

});

describe("quoteIn", () => {
  it("matches quotes regardless of whitespace and case, but not paraphrases", () => {
    const docs = [version("container-registry", "original")!];
    expect(quoteIn("controls access with   IAM", docs)).toBe(true);
    expect(quoteIn("access is controlled with IAM", docs)).toBe(false);
  });

  it("accepts an elided quote only when every piece is in the page, in order", () => {
    const docs = [version("container-registry", "original")!];
    expect(quoteIn("Container Registry is Google Cloud's private registry [...] controls access with IAM", docs)).toBe(true);
    expect(quoteIn("controls access with IAM … Container Registry is Google Cloud's private registry", docs)).toBe(false);
    expect(quoteIn("Container Registry is Google Cloud's private registry [...] access is controlled with IAM", docs)).toBe(false);
  });
});
