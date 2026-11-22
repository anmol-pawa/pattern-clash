/** Shared test fixtures for the battle sim. Not imported by app code. */
import { createBattle } from "./sim";
import type { BattleConfig, BattleState } from "./types";

export const PATTERNS = [
  "two-pointers",
  "sliding-window",
  "prefix-sum",
  "hashing",
  "binary-search",
  "monotonic-stack",
  "heap-top-k",
  "bfs",
] as const;

export function makeConfig(over: Partial<BattleConfig> = {}): BattleConfig {
  return {
    deck: PATTERNS.map((id, i) => ({ id, cost: 2 + (i % 3) })),
    correctPattern: "hashing",
    sampleCount: 3,
    threats: [
      { id: "empty", kind: "void", lane: "left", spawnAtSec: 2, counter: "guard-empty" },
      { id: "dupes", kind: "twin", lane: "right", spawnAtSec: 5, counter: "test:edge" },
      { id: "scale", kind: "juggernaut", lane: "left", spawnAtSec: 1, counter: "test:perf" },
    ],
    followupCount: 2,
    ...over,
  };
}

/** First seed in 1..500 whose opening hand holds `cardId` (the shuffle is seeded, so this is stable). */
export function seedWithCardInHand(cardId: string, config: BattleConfig = makeConfig()): number {
  for (let seed = 1; seed <= 500; seed++) {
    if (createBattle(config, seed).hand.some((c) => c.id === cardId)) return seed;
  }
  throw new Error(`no seed puts ${cardId} in the opening hand`);
}

export function battleWithCardInHand(cardId: string, config: BattleConfig = makeConfig()): BattleState {
  return createBattle(config, seedWithCardInHand(cardId, config));
}

export function handIndexOf(state: BattleState, cardId: string): number {
  const index = state.hand.findIndex((c) => c.id === cardId);
  if (index < 0) throw new Error(`${cardId} is not in hand`);
  return index;
}
