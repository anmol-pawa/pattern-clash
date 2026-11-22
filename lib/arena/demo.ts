/**
 * A scripted demo battle for the /dev/sim review page: a wrong card, the right card, components, samples and hidden
 * groups land on a timeline so every effect shows within ~20 s. One unguarded unit leaks to show the penalty.
 */
import { TICK_HZ } from "@/lib/battle/constants";
import { createBattle } from "@/lib/battle/sim";
import type { BattleConfig, BattleInput, TimedInput } from "@/lib/battle/types";

export const DEMO_CONFIG: BattleConfig = {
  deck: [
    { id: "two-pointers", cost: 3 },
    { id: "sliding-window", cost: 3 },
    { id: "prefix-sum", cost: 2 },
    { id: "hashing", cost: 3 },
    { id: "binary-search", cost: 2 },
    { id: "monotonic-stack", cost: 4 },
    { id: "heap-top-k", cost: 4 },
    { id: "bfs", cost: 3 },
  ],
  correctPattern: "hashing",
  sampleCount: 3,
  threats: [
    { id: "scale", kind: "juggernaut", lane: "left", spawnAtSec: 1, counter: "test:perf" },
    { id: "empty", kind: "void", lane: "right", spawnAtSec: 2, counter: "guard-empty" },
    { id: "dupes", kind: "twin", lane: "right", spawnAtSec: 4, counter: "test:edge" },
    { id: "neg", kind: "subzero", lane: "left", spawnAtSec: 6, counter: "guard-negative" },
    { id: "gap", kind: "void", lane: "left", spawnAtSec: 0.5, counter: "guard-never" },
  ],
  followupCount: 0,
};

/** The first seed whose opening hand holds the correct card, so the scripted play is always legal. */
export function demoSeed(config: BattleConfig = DEMO_CONFIG): number {
  for (let seed = 1; seed <= 1000; seed++) {
    if (createBattle(config, seed).hand.some((c) => c.id === config.correctPattern)) return seed;
  }
  throw new Error("no demo seed deals the correct card");
}

const at = (sec: number, input: BattleInput): TimedInput => ({ tick: Math.round(sec * TICK_HZ), input });

/** Playing the wrong slot first only replaces that slot, so the correct card keeps its index. */
export function demoScript(config: BattleConfig = DEMO_CONFIG, seed: number = demoSeed(config)): TimedInput[] {
  const hand = createBattle(config, seed).hand;
  const right = hand.findIndex((c) => c.id === config.correctPattern);
  const wrong = hand.findIndex((c) => c.id !== config.correctPattern);
  return [
    at(1, { type: "playCard", handIndex: wrong }),
    at(3, { type: "playCard", handIndex: right }),
    at(5, { type: "complexity", correct: true }),
    at(6, { type: "component", componentId: "guard-empty", correct: true }),
    at(8, { type: "component", componentId: "guard-negative", correct: true }),
    at(10, { type: "sample", index: 0, passed: true }),
    at(11, { type: "sample", index: 1, passed: true }),
    at(12, { type: "sample", index: 2, passed: true }),
    at(14, { type: "hidden", group: "basic", passed: true, optimal: true }),
    at(15, { type: "hidden", group: "edge", passed: true, optimal: true }),
    at(16, { type: "hidden", group: "random", passed: true, optimal: true }),
    at(18, { type: "hidden", group: "perf", passed: true, optimal: true }),
  ];
}
