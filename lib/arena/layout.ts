/**
 * Portrait arena geometry (GDD §8). Pure: maps sim coordinates (lane + progress) to screen points for any viewport.
 * Everything is authored in a 390×600 design space and scaled uniformly, centred, so it reads at 375 px wide.
 */
import { LANE_LENGTH } from "@/lib/battle/constants";
import type { Lane, TowerId } from "@/lib/battle/types";

export interface Point {
  x: number;
  y: number;
}

export interface TowerSpot extends Point {
  radius: number;
}

export interface ArenaLayout {
  width: number;
  height: number;
  scale: number;
  /** The scaled design rectangle inside the viewport. */
  frame: { x: number; y: number; w: number; h: number };
  laneX: Record<Lane, number>;
  /** Lane progress 0 sits just below the enemy towers; LANE_LENGTH is the player's edge. */
  enemyY: number;
  playerY: number;
  riverY: number;
  towers: Record<TowerId, TowerSpot>;
}

export const DESIGN_WIDTH = 390;
/** Kept short enough that the arena still reads at about half scale in the top ~45% of a phone screen. */
export const DESIGN_HEIGHT = 600;

const DESIGN = {
  laneX: { left: 100, right: 290 },
  enemyY: 196,
  playerY: 548,
  riverY: 372,
  towers: {
    left: { x: 100, y: 150, radius: 34 },
    right: { x: 290, y: 150, radius: 34 },
    king: { x: 195, y: 72, radius: 44 },
  },
} as const;

export function computeLayout(width: number, height: number): ArenaLayout {
  const w0 = Math.max(1, width);
  const h0 = Math.max(1, height);
  const scale = Math.min(w0 / DESIGN_WIDTH, h0 / DESIGN_HEIGHT);
  const fw = DESIGN_WIDTH * scale;
  const fh = DESIGN_HEIGHT * scale;
  const frame = { x: (w0 - fw) / 2, y: (h0 - fh) / 2, w: fw, h: fh };
  const sx = (x: number) => frame.x + x * scale;
  const sy = (y: number) => frame.y + y * scale;
  const tower = (t: { x: number; y: number; radius: number }): TowerSpot => ({ x: sx(t.x), y: sy(t.y), radius: t.radius * scale });
  return {
    width: w0,
    height: h0,
    scale,
    frame,
    laneX: { left: sx(DESIGN.laneX.left), right: sx(DESIGN.laneX.right) },
    enemyY: sy(DESIGN.enemyY),
    playerY: sy(DESIGN.playerY),
    riverY: sy(DESIGN.riverY),
    towers: { left: tower(DESIGN.towers.left), right: tower(DESIGN.towers.right), king: tower(DESIGN.towers.king) },
  };
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Where a unit at `progress` along `lane` is drawn. */
export function unitPoint(layout: ArenaLayout, lane: Lane, progress: number): Point {
  const t = clamp01(progress / LANE_LENGTH);
  return { x: layout.laneX[lane], y: lerp(layout.enemyY, layout.playerY, t) };
}
