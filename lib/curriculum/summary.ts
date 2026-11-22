/** Pure helpers over the A2Z sheet index (content/a2z-index.json). */

export type RowKind = "problem" | "lesson";
export type RowStatus = "todo" | "draft" | "shipped";

export interface IndexRow {
  sheetNo: number;
  step: number;
  stepTitle: string;
  sheetTitle: string;
  kind: RowKind;
  arena: number;
  slug: string | null;
  status: RowStatus;
}

export interface CurriculumSummary {
  arenas: number;
  problems: number;
  lessons: number;
  shipped: number;
}

export function summarize(rows: readonly IndexRow[]): CurriculumSummary {
  const arenaIds = new Set<number>();
  let problems = 0;
  let lessons = 0;
  let shipped = 0;
  for (const row of rows) {
    arenaIds.add(row.arena);
    if (row.kind === "problem") problems += 1;
    else lessons += 1;
    if (row.status === "shipped") shipped += 1;
  }
  return { arenas: arenaIds.size, problems, lessons, shipped };
}
