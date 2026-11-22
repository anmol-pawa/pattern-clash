/** Battle-stage types (GDD §4). A provisional problem shape: P1.4 replaces it with the full package format (GDD §6). */
import type { CardDef, Phase, Threat } from "@/lib/battle/types";
import type { FunctionSpec } from "@/lib/judge/harness/driver";

export interface Choice {
  prompt: string;
  options: readonly string[];
  answer: number;
}

export interface Sample {
  input: string;
  output: string;
  note?: string;
}

export interface ComponentCard {
  id: string;
  title: string;
  /** The component's lines in their correct order. */
  lines: readonly string[];
  /** Edge-guard components must be placed cleanly for the edge hidden group to pass. */
  edge: boolean;
  why: Choice;
  mistake: string;
}

export interface Followup extends Choice {
  note: string;
}

export interface StageProblem {
  slug: string;
  title: string;
  statement: string;
  constraints: readonly string[];
  samples: readonly Sample[];
  /** The LeetCode-style signature the judge harness wraps (lib/judge/harness/driver.ts). */
  driver: FunctionSpec;
  /** Card id of the pattern that cracks this problem. */
  pattern: string;
  deck: readonly CardDef[];
  threats: readonly Threat[];
  brute: Choice & { note: string };
  components: readonly ComponentCard[];
  complexity: { time: Choice; space: Choice; derivation: Choice };
  explanation: string;
  followups: readonly Followup[];
}

export type StageName = "scout" | "brute" | "build" | "prove" | "overtime" | "results";
export type BuildStep = "place" | "why" | "review";
export type ProveStep = "complexity" | "explain";

export interface ComponentProgress {
  placed: number;
  mistakes: number;
  why: number | null;
}

export interface StageState {
  stage: StageName;
  scout: { picks: string[]; correctAtTick: number | null; timedOut: boolean };
  brute: number | null;
  build: {
    index: number;
    step: BuildStep;
    /** Display order of each component's lines (indices into `lines`), shuffled from the battle seed. */
    order: readonly (readonly number[])[];
    progress: readonly ComponentProgress[];
  };
  prove: {
    step: ProveStep;
    time: number | null;
    space: number | null;
    derivation: number | null;
    text: string;
    confidence: number | null;
    revealed: boolean;
    rubric: readonly boolean[];
  };
  followups: readonly number[];
  phase: Phase;
}

export type StageAction =
  | { type: "pickCard"; cardId: string; handIndex: number; tick: number }
  | { type: "scoutTimeout" }
  | { type: "answerBrute"; option: number }
  | { type: "placeLine"; line: number }
  | { type: "answerWhy"; option: number }
  | { type: "nextComponent" }
  | { type: "answerComplexity"; field: "time" | "space" | "derivation"; option: number }
  | { type: "toExplain" }
  | { type: "setExplanation"; text: string }
  | { type: "setConfidence"; level: number }
  | { type: "revealModel" }
  | { type: "toggleRubric"; index: number }
  | { type: "submitProve" }
  | { type: "answerFollowup"; option: number }
  | { type: "phaseChanged"; phase: Phase };
