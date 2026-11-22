/** Towers as requirement sets (GDD §3): each HP segment is tied to one check and falls when that check passes. */
import { HIDDEN_GROUPS, TOWER_HP } from "./constants";
import type { BattleEvent, TowerId, TowerSegment, TowerState } from "./types";

type Towers = Readonly<Record<TowerId, TowerState>>;

function seg(check: string, share: number): TowerSegment {
  return { check, share, done: false };
}

/** Equal integer shares that sum to exactly TOWER_HP; the last segment takes the remainder. */
export function equalShares(count: number): number[] {
  const base = Math.floor(TOWER_HP / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? TOWER_HP - base * (count - 1) : base));
}

export function buildTowers(sampleCount: number): Record<TowerId, TowerState> {
  const samples = equalShares(sampleCount).map((share, i) => seg(`sample:${i}`, share));
  const hidden = equalShares(HIDDEN_GROUPS.length).map((share, i) => seg(`hidden:${HIDDEN_GROUPS[i]}`, share));
  return {
    left: { id: "left", hp: TOWER_HP, segments: [seg("pattern", 50), seg("complexity", 50)] },
    right: { id: "right", hp: TOWER_HP, segments: samples },
    king: { id: "king", hp: TOWER_HP, segments: hidden },
  };
}

/** Which tower owns a check id. */
export function towerFor(check: string): TowerId {
  if (check === "pattern" || check === "complexity") return "left";
  if (check.startsWith("sample:")) return "right";
  return "king";
}

/**
 * Satisfy one check. Idempotent: a check that already landed, or that no segment owns, changes nothing.
 * Returns the new tower map and the events it produced.
 */
export function applyCheck(towers: Towers, check: string): [Towers, BattleEvent[]] {
  const id = towerFor(check);
  const tower = towers[id];
  const index = tower.segments.findIndex((s) => s.check === check && !s.done);
  if (index < 0) return [towers, []];
  const segments = tower.segments.map((s, i) => (i === index ? { ...s, done: true } : s));
  const hp = Math.max(0, tower.hp - tower.segments[index].share);
  const events: BattleEvent[] = [{ type: "towerHit", tower: id, check, hp }];
  if (hp === 0) events.push({ type: "towerDestroyed", tower: id });
  return [{ ...towers, [id]: { ...tower, hp, segments } }, events];
}
