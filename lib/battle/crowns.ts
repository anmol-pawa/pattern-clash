/** Crown rules (GDD §3). Kept tiny and separate so they can be held to 100% branch coverage. */
import type { TowerId, TowerState } from "./types";

export type Outcome = "mastered" | "won" | "lost";

export function isDestroyed(tower: TowerState): boolean {
  return tower.hp <= 0;
}

/** The king falling is a full three-crown result; otherwise one crown per fallen side tower. */
export function earnedCrowns(towers: Readonly<Record<TowerId, TowerState>>): number {
  if (isDestroyed(towers.king)) return 3;
  let crowns = 0;
  if (isDestroyed(towers.left)) crowns += 1;
  if (isDestroyed(towers.right)) crowns += 1;
  return crowns;
}

/** Every enemy unit that leaked through costs one crown, never below zero. */
export function finalCrowns(earned: number, leaks: number): number {
  return Math.max(0, earned - leaks);
}

export function outcome(crowns: number): Outcome {
  if (crowns >= 3) return "mastered";
  if (crowns >= 1) return "won";
  return "lost";
}
