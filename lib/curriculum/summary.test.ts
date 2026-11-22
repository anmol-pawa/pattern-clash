import { describe, expect, it } from "vitest";
import index from "@/content/a2z-index.json";
import { summarize, type IndexRow } from "./summary";

const row = (over: Partial<IndexRow>): IndexRow => ({
  sheetNo: 1,
  step: 1,
  stepTitle: "s",
  sheetTitle: "t",
  kind: "problem",
  arena: 1,
  slug: null,
  status: "todo",
  ...over,
});

describe("summarize", () => {
  it("returns zeros for an empty index", () => {
    expect(summarize([])).toEqual({ arenas: 0, problems: 0, lessons: 0, shipped: 0 });
  });

  it("counts distinct arenas, kinds and shipped rows", () => {
    const rows = [
      row({ arena: 1, kind: "lesson" }),
      row({ arena: 1, status: "shipped" }),
      row({ arena: 3 }),
    ];
    expect(summarize(rows)).toEqual({ arenas: 2, problems: 2, lessons: 1, shipped: 1 });
  });

  it("matches the shipped sheet index: 18 arenas, 455 rows", () => {
    const s = summarize(index as IndexRow[]);
    expect(s.arenas).toBe(18);
    expect(s.problems + s.lessons).toBe(455);
    expect(s.lessons).toBe(31);
  });
});
