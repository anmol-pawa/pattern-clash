/**
 * Juice that communicates state (GDD §8), as pure data: the renderer only draws what this module says is alive.
 * Reduced-motion mode keeps every cue but drops hit-stop and shake and marks bursts as calm (no flash, no particles).
 */
import type { BattleEvent, TowerId } from "@/lib/battle/types";

export const HITSTOP_MS = 60;
export const SHAKE_MS = 320;
export const SHAKE_PX = 6;
export const PROJECTILE_MS = 360;
export const BURST_MS = 760;
export const LABEL_MS = 1600;

export type BurstKind = "crown" | "counter" | "leak";

export interface Projectile {
  id: number;
  target: TowerId;
  repelled: boolean;
  ageMs: number;
}

export interface Burst {
  id: number;
  kind: BurstKind;
  /** A tower, or a unit uid whose last drawn position the renderer remembers. */
  tower?: TowerId;
  uid?: number;
  calm: boolean;
  ageMs: number;
}

export interface UnitLabel {
  uid: number;
  text: string;
  ageMs: number;
}

export interface FxState {
  hitstopMs: number;
  shakes: Partial<Record<TowerId, number>>;
  projectiles: readonly Projectile[];
  bursts: readonly Burst[];
  labels: readonly UnitLabel[];
  nextId: number;
}

export function createFx(): FxState {
  return { hitstopMs: 0, shakes: {}, projectiles: [], bursts: [], labels: [], nextId: 1 };
}

function addProjectile(fx: FxState, target: TowerId, repelled: boolean): FxState {
  return { ...fx, projectiles: [...fx.projectiles, { id: fx.nextId, target, repelled, ageMs: 0 }], nextId: fx.nextId + 1 };
}

function addBurst(fx: FxState, burst: Omit<Burst, "id" | "ageMs">): FxState {
  return { ...fx, bursts: [...fx.bursts, { ...burst, id: fx.nextId, ageMs: 0 }], nextId: fx.nextId + 1 };
}

function hit(fx: FxState, tower: TowerId, reducedMotion: boolean): FxState {
  if (reducedMotion) return fx;
  return { ...fx, hitstopMs: Math.max(fx.hitstopMs, HITSTOP_MS), shakes: { ...fx.shakes, [tower]: SHAKE_MS } };
}

function ingestOne(fx: FxState, event: BattleEvent, reducedMotion: boolean): FxState {
  switch (event.type) {
    case "deploy":
      return addProjectile(fx, "left", !event.correct);
    case "towerHit":
      // A pattern hit already has its projectile from the deploy; every other check fires one of its own.
      return hit(event.check === "pattern" ? fx : addProjectile(fx, event.tower, false), event.tower, reducedMotion);
    case "towerDestroyed":
      return addBurst(fx, { kind: "crown", tower: event.tower, calm: reducedMotion });
    case "unitSpawn":
      return { ...fx, labels: [...fx.labels, { uid: event.uid, text: event.label, ageMs: 0 }] };
    case "unitCountered":
      return addBurst(fx, { kind: "counter", uid: event.uid, calm: reducedMotion });
    case "unitLeak":
      return addBurst(fx, { kind: "leak", uid: event.uid, calm: reducedMotion });
    default:
      return fx;
  }
}

export function ingest(fx: FxState, events: readonly BattleEvent[], reducedMotion: boolean): FxState {
  return events.reduce((acc, e) => ingestOne(acc, e, reducedMotion), fx);
}

/** Age every effect by real frame time and drop the finished ones. */
export function advanceFx(fx: FxState, dtMs: number): FxState {
  const dt = Math.max(0, dtMs);
  const shakes: Partial<Record<TowerId, number>> = {};
  for (const [id, left] of Object.entries(fx.shakes) as [TowerId, number][]) {
    if (left - dt > 0) shakes[id] = left - dt;
  }
  return {
    ...fx,
    hitstopMs: Math.max(0, fx.hitstopMs - dt),
    shakes,
    projectiles: fx.projectiles.map((p) => ({ ...p, ageMs: p.ageMs + dt })).filter((p) => p.ageMs < PROJECTILE_MS),
    bursts: fx.bursts.map((b) => ({ ...b, ageMs: b.ageMs + dt })).filter((b) => b.ageMs < BURST_MS),
    labels: fx.labels.map((l) => ({ ...l, ageMs: l.ageMs + dt })).filter((l) => l.ageMs < LABEL_MS),
  };
}

/** Decaying shake offset for a tower; zero when it is not shaking. */
export function shakeOffset(remainingMs: number | undefined, timeMs: number): { x: number; y: number } {
  if (!remainingMs || remainingMs <= 0) return { x: 0, y: 0 };
  const amp = SHAKE_PX * Math.min(1, remainingMs / SHAKE_MS);
  return { x: Math.sin(timeMs * 0.09) * amp, y: Math.cos(timeMs * 0.11) * amp };
}

/** Repelled shots fly halfway and come back; landing shots travel the full path. Returns 0..1 along the path. */
export function projectileT(p: Projectile): number {
  const t = Math.min(1, p.ageMs / PROJECTILE_MS);
  return p.repelled ? (t < 0.5 ? t : 1 - t) : t;
}
