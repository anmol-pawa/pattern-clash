/** Battle tuning (GDD §2, §3). All time is counted in fixed 30 Hz ticks so the sim stays integer and deterministic. */
import type { UnitKind } from "./types";

export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;
export const REGULATION_TICKS = 180 * TICK_HZ;
export const OVERTIME_TICKS = 60 * TICK_HZ;

export const FOCUS_MAX = 10;
export const FOCUS_START = 5;
/** One focus point every 2.8 s at 30 Hz. */
export const TICKS_PER_FOCUS = 84;
export const FOCUS_TICKS_MAX = FOCUS_MAX * TICKS_PER_FOCUS;

export const DECK_SIZE = 8;
export const HAND_SIZE = 4;

export const TOWER_HP = 100;
export const HIDDEN_GROUPS = ["basic", "edge", "random", "perf"] as const;

/** Lane progress runs from the enemy towers (0) to the player's side (LANE_LENGTH). */
export const LANE_LENGTH = 6000;

/** Lane progress per tick and the edge case each unit names when it spawns. */
export const UNIT_KINDS: Record<UnitKind, { speed: number; label: string }> = {
  juggernaut: { speed: 6, label: "n = 1e5" },
  void: { speed: 15, label: "empty input" },
  twin: { speed: 10, label: "duplicates" },
  subzero: { speed: 10, label: "negatives" },
  overflow: { speed: 8, label: "int overflow" },
  deepdiver: { speed: 8, label: "deep recursion" },
};

/** Cap on catch-up steps per rendered frame so a stalled tab cannot spiral. */
export const MAX_STEPS_PER_FRAME = 5;
