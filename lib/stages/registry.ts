/** Problems the battle route can serve. P1.4 replaces this with the package loader. */
import { createBattle } from "@/lib/battle/sim";
import type { BattleConfig } from "@/lib/battle/types";
import { PAIR_TO_TARGET } from "./demoProblem";
import type { StageProblem } from "./types";

const PROBLEMS: Readonly<Record<string, StageProblem>> = { [PAIR_TO_TARGET.slug]: PAIR_TO_TARGET };

export function problemSlugs(): string[] {
  return Object.keys(PROBLEMS);
}

export function getProblem(slug: string): StageProblem | undefined {
  return Object.hasOwn(PROBLEMS, slug) ? PROBLEMS[slug] : undefined;
}

export function battleConfig(problem: StageProblem): BattleConfig {
  return {
    deck: problem.deck,
    correctPattern: problem.pattern,
    sampleCount: problem.samples.length,
    threats: problem.threats,
    followupCount: problem.followups.length,
  };
}

/**
 * First seed at or after `from` whose opening hand holds the problem's pattern card. Until deck building (P2.4)
 * lets players bring the right cards, every battle is dealt a hand where the answer is reachable.
 */
export function seedWithPattern(problem: StageProblem, from: number): number {
  const config = battleConfig(problem);
  for (let seed = from; seed < from + 1000; seed++) {
    if (createBattle(config, seed).hand.some((c) => c.id === problem.pattern)) return seed;
  }
  return from;
}
