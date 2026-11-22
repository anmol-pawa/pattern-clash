/** Battle simulation types (ARCH §4). Everything here is plain data: serialisable, comparable, replayable. */

export type Lane = "left" | "right";
export type TowerId = "left" | "right" | "king";
export type Phase = "regulation" | "overtime" | "ended";
export type HiddenGroup = "basic" | "edge" | "random" | "perf";
export type UnitKind = "juggernaut" | "void" | "twin" | "subzero" | "overflow" | "deepdiver";

export interface CardDef {
  id: string;
  cost: number;
}

/** One enemy unit from a package's constraint script (`recognition.json` → `threats`). */
export interface Threat {
  id: string;
  kind: UnitKind;
  lane: Lane;
  spawnAtSec: number;
  /** What neutralises it: a component id, or `test:<group>` for a passing hidden-test group. */
  counter: string;
}

export interface BattleConfig {
  deck: readonly CardDef[];
  correctPattern: string;
  sampleCount: number;
  threats: readonly Threat[];
  followupCount: number;
}

export interface TowerSegment {
  check: string;
  share: number;
  done: boolean;
}

export interface TowerState {
  id: TowerId;
  hp: number;
  segments: readonly TowerSegment[];
}

export interface UnitState {
  uid: number;
  threatId: string;
  kind: UnitKind;
  lane: Lane;
  counter: string;
  progress: number;
}

export type BattleInput =
  | { type: "playCard"; handIndex: number }
  | { type: "complexity"; correct: boolean }
  | { type: "sample"; index: number; passed: boolean }
  | { type: "hidden"; group: HiddenGroup; passed: boolean; optimal: boolean }
  | { type: "component"; componentId: string; correct: boolean }
  | { type: "followup"; index: number; correct: boolean };

export interface TimedInput {
  tick: number;
  input: BattleInput;
}

export type BattleEvent =
  | { type: "deploy"; cardId: string; correct: boolean }
  | { type: "repel"; cardId: string }
  | { type: "notEnoughFocus"; cardId: string; focus: number }
  | { type: "towerHit"; tower: TowerId; check: string; hp: number }
  | { type: "towerDestroyed"; tower: TowerId }
  | { type: "perfNotOptimal" }
  | { type: "unitSpawn"; uid: number; kind: UnitKind; lane: Lane; label: string }
  | { type: "unitCountered"; uid: number; counter: string }
  | { type: "unitLeak"; uid: number; kind: UnitKind }
  | { type: "overtime" }
  | { type: "followup"; index: number; correct: boolean }
  | { type: "end"; crowns: number };

export interface BattleState {
  config: BattleConfig;
  /** Threats sorted by spawn tick; `nextThreat` indexes the next one to spawn. */
  threatOrder: readonly Threat[];
  nextThreat: number;
  tick: number;
  phase: Phase;
  phaseTick: number;
  focusTicks: number;
  hand: readonly CardDef[];
  queue: readonly CardDef[];
  towers: Readonly<Record<TowerId, TowerState>>;
  counters: readonly string[];
  units: readonly UnitState[];
  nextUid: number;
  leaks: number;
  followupsAnswered: readonly number[];
  followupsCorrect: number;
  rng: number;
  /** Events produced by the most recent step only. */
  events: readonly BattleEvent[];
}
