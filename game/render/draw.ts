/** Stateless Pixi drawing helpers for the arena: original neon-geometric shapes, all drawn in code (GDD §8). */
import type { Graphics } from "pixi.js";
import type { ArenaLayout, Point, TowerSpot } from "@/lib/arena/layout";
import type { TowerState, UnitKind } from "@/lib/battle/types";

export const COLORS = {
  bg: 0x0b1020,
  grid: 0x1b2547,
  lane: 0x3ef0ff,
  river: 0x15325a,
  cyan: 0x3ef0ff,
  magenta: 0xff4fd8,
  lime: 0xb6ff3e,
  gold: 0xffd84d,
  ink: 0xe8ecff,
  dim: 0x4a5378,
} as const;

/** Background grid, river band, two lanes and the player's edge. Drawn once per resize. */
export function drawStatic(g: Graphics, l: ArenaLayout): void {
  g.clear();
  const { x, y, w, h } = l.frame;
  const step = 26 * l.scale;
  for (let gx = x; gx <= x + w + 0.5; gx += step) g.moveTo(gx, y).lineTo(gx, y + h);
  for (let gy = y; gy <= y + h + 0.5; gy += step) g.moveTo(x, gy).lineTo(x + w, gy);
  g.stroke({ width: 1, color: COLORS.grid, alpha: 0.6 });
  g.rect(x, l.riverY - 14 * l.scale, w, 28 * l.scale).fill({ color: COLORS.river, alpha: 0.55 });
  for (const lx of [l.laneX.left, l.laneX.right]) {
    g.moveTo(lx, l.enemyY).lineTo(lx, l.playerY).stroke({ width: 3 * l.scale, color: COLORS.lane, alpha: 0.18 });
    g.moveTo(lx, l.enemyY).lineTo(lx, l.playerY).stroke({ width: 1, color: COLORS.lane, alpha: 0.5 });
  }
  g.moveTo(x + 12 * l.scale, l.playerY).lineTo(x + w - 12 * l.scale, l.playerY).stroke({ width: 2, color: COLORS.magenta, alpha: 0.5 });
}

/** Layered hex tower with an HP ring; a fallen tower goes dark and cracked. */
export function drawTower(g: Graphics, spot: TowerSpot, tower: TowerState, offset: Point, scale: number): void {
  const cx = spot.x + offset.x;
  const cy = spot.y + offset.y;
  const r = spot.radius;
  if (tower.hp <= 0) {
    g.regularPoly(cx, cy, r, 6, 0).stroke({ width: 2 * scale, color: COLORS.dim });
    g.moveTo(cx - r * 0.5, cy - r * 0.5).lineTo(cx + r * 0.1, cy).lineTo(cx - r * 0.2, cy + r * 0.5).stroke({ width: 2 * scale, color: COLORS.dim });
    return;
  }
  g.regularPoly(cx, cy, r, 6, 0).fill({ color: COLORS.cyan, alpha: 0.08 }).stroke({ width: 3 * scale, color: COLORS.cyan });
  g.regularPoly(cx, cy, r * 0.55, 6, Math.PI / 6).stroke({ width: 2 * scale, color: COLORS.magenta, alpha: 0.9 });
  const start = -Math.PI / 2;
  const ring = r + 7 * scale;
  // Start a fresh sub-path at the arc's first point; otherwise Pixi joins it to the previous path's pen position.
  g.moveTo(cx + Math.cos(start) * ring, cy + Math.sin(start) * ring);
  g.arc(cx, cy, ring, start, start + (Math.PI * 2 * tower.hp) / 100).stroke({ width: 4 * scale, color: COLORS.lime, cap: "round" });
}

/** Each unit's body reads as its edge case: Void is a hollow ring, Twin a mirrored pair, Juggernaut a heavy stack. */
export function drawUnit(g: Graphics, kind: UnitKind, p: Point, scale: number): void {
  const s = 11 * scale;
  switch (kind) {
    case "void":
      g.circle(p.x, p.y, s).stroke({ width: 3 * scale, color: COLORS.magenta });
      return;
    case "twin":
      g.circle(p.x - s * 0.7, p.y, s * 0.6).fill({ color: COLORS.magenta });
      g.circle(p.x + s * 0.7, p.y, s * 0.6).fill({ color: COLORS.magenta });
      return;
    case "juggernaut":
      for (let i = 0; i < 3; i++) g.rect(p.x - s * 1.2, p.y - s * 1.2 + i * s * 0.85, s * 2.4, s * 0.7).fill({ color: COLORS.magenta, alpha: 1 - i * 0.2 });
      return;
    case "subzero":
      g.poly([p.x - s, p.y - s * 0.7, p.x + s, p.y - s * 0.7, p.x, p.y + s]).fill({ color: COLORS.magenta });
      return;
    case "overflow":
      g.rect(p.x - s, p.y - s, s * 2, s * 2).stroke({ width: 3 * scale, color: COLORS.magenta });
      g.moveTo(p.x - s, p.y + s).lineTo(p.x + s, p.y - s).stroke({ width: 2 * scale, color: COLORS.magenta });
      return;
    case "deepdiver":
      g.poly([p.x, p.y - s, p.x + s, p.y, p.x, p.y + s, p.x - s, p.y]).fill({ color: COLORS.magenta });
      return;
  }
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
