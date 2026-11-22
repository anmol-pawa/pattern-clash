import { describe, expect, it } from "vitest";
import { LANE_LENGTH, TICK_MS } from "@/lib/battle/constants";
import { replay } from "@/lib/battle/sim";
import { DEMO_CONFIG, demoScript, demoSeed } from "./demo";
import {
  advanceFx,
  BURST_MS,
  createFx,
  HITSTOP_MS,
  ingest,
  LABEL_MS,
  PROJECTILE_MS,
  projectileT,
  SHAKE_MS,
  shakeOffset,
} from "./fx";
import { computeLayout, DESIGN_HEIGHT, DESIGN_WIDTH, unitPoint } from "./layout";
import { advanceRunner, alphaOf, createRunner, queueInput } from "./runner";

describe("layout", () => {
  it("fits the design frame inside an iPhone 14 portrait viewport, centred", () => {
    const l = computeLayout(390, 664);
    expect(l.frame.w).toBeLessThanOrEqual(390);
    expect(l.frame.h).toBeLessThanOrEqual(664);
    expect(l.frame.x).toBeCloseTo((390 - l.frame.w) / 2);
    expect(l.scale).toBeCloseTo(664 / DESIGN_HEIGHT);
  });

  it("letterboxes a wide desktop viewport and keeps the arena portrait", () => {
    const l = computeLayout(1280, 720);
    expect(l.frame.h).toBeCloseTo(720);
    expect(l.frame.w).toBeCloseTo(DESIGN_WIDTH * (720 / DESIGN_HEIGHT));
    expect(l.frame.x).toBeGreaterThan(0);
  });

  it("puts the enemy towers above the river and walks units from enemy to player", () => {
    const l = computeLayout(390, 700);
    expect(l.towers.king.y).toBeLessThan(l.towers.left.y);
    expect(l.towers.left.y).toBeLessThan(l.riverY);
    expect(unitPoint(l, "left", 0)).toEqual({ x: l.laneX.left, y: l.enemyY });
    expect(unitPoint(l, "right", LANE_LENGTH)).toEqual({ x: l.laneX.right, y: l.playerY });
    expect(unitPoint(l, "left", LANE_LENGTH * 9).y).toBe(l.playerY);
    expect(unitPoint(l, "left", -5).y).toBe(l.enemyY);
  });

  it("survives a zero-size viewport", () => {
    expect(computeLayout(0, 0).scale).toBeGreaterThan(0);
  });
});

describe("fx", () => {
  it("a tower hit fires a projectile, shakes the tower and starts hit-stop", () => {
    const fx = ingest(createFx(), [{ type: "towerHit", tower: "right", check: "sample:0", hp: 66 }], false);
    expect(fx.projectiles).toHaveLength(1);
    expect(fx.projectiles[0]).toMatchObject({ target: "right", repelled: false });
    expect(fx.shakes.right).toBe(SHAKE_MS);
    expect(fx.hitstopMs).toBe(HITSTOP_MS);
  });

  it("a pattern hit reuses the deploy projectile instead of firing twice", () => {
    const fx = ingest(createFx(), [
      { type: "deploy", cardId: "hashing", correct: true },
      { type: "towerHit", tower: "left", check: "pattern", hp: 50 },
    ], false);
    expect(fx.projectiles).toHaveLength(1);
  });

  it("a wrong card's projectile is repelled: it turns back halfway", () => {
    const fx = ingest(createFx(), [{ type: "deploy", cardId: "bfs", correct: false }], false);
    const p = fx.projectiles[0];
    expect(p.repelled).toBe(true);
    expect(projectileT({ ...p, ageMs: PROJECTILE_MS * 0.25 })).toBeCloseTo(0.25);
    expect(projectileT({ ...p, ageMs: PROJECTILE_MS * 0.75 })).toBeCloseTo(0.25);
    expect(projectileT({ ...p, repelled: false, ageMs: PROJECTILE_MS * 2 })).toBe(1);
  });

  it("reduced motion keeps the cues but drops hit-stop and shake and calms bursts", () => {
    const fx = ingest(createFx(), [
      { type: "towerHit", tower: "left", check: "complexity", hp: 0 },
      { type: "towerDestroyed", tower: "left" },
      { type: "unitCountered", uid: 3, counter: "x" },
    ], true);
    expect(fx.hitstopMs).toBe(0);
    expect(fx.shakes).toEqual({});
    expect(fx.projectiles).toHaveLength(1);
    expect(fx.bursts.map((b) => [b.kind, b.calm])).toEqual([["crown", true], ["counter", true]]);
  });

  it("spawns name their edge case and leaks burst at the unit", () => {
    const fx = ingest(createFx(), [
      { type: "unitSpawn", uid: 1, kind: "void", lane: "left", label: "empty input" },
      { type: "unitLeak", uid: 1, kind: "void" },
      { type: "end", crowns: 1 },
    ], false);
    expect(fx.labels).toEqual([{ uid: 1, text: "empty input", ageMs: 0 }]);
    expect(fx.bursts[0]).toMatchObject({ kind: "leak", uid: 1, calm: false });
  });

  it("ages and expires every effect", () => {
    let fx = ingest(createFx(), [
      { type: "towerHit", tower: "king", check: "hidden:basic", hp: 75 },
      { type: "towerDestroyed", tower: "king" },
      { type: "unitSpawn", uid: 2, kind: "twin", lane: "right", label: "duplicates" },
    ], false);
    fx = advanceFx(fx, 100);
    expect(fx.hitstopMs).toBe(0);
    expect(fx.shakes.king).toBe(SHAKE_MS - 100);
    fx = advanceFx(fx, Math.max(BURST_MS, LABEL_MS, SHAKE_MS, PROJECTILE_MS));
    expect(fx.projectiles).toEqual([]);
    expect(fx.bursts).toEqual([]);
    expect(fx.labels).toEqual([]);
    expect(fx.shakes).toEqual({});
    expect(advanceFx(fx, -10).hitstopMs).toBe(0);
  });

  it("shake decays to nothing", () => {
    expect(shakeOffset(undefined, 5)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(0, 5)).toEqual({ x: 0, y: 0 });
    const strong = shakeOffset(SHAKE_MS, 17);
    const weak = shakeOffset(SHAKE_MS / 4, 17);
    expect(Math.abs(weak.x)).toBeLessThan(Math.abs(strong.x));
  });
});

describe("runner", () => {
  it("steps the sim at 30 Hz from frame time and reports interpolation alpha", () => {
    let r = createRunner(DEMO_CONFIG, demoSeed(), [], false);
    r = advanceRunner(r, TICK_MS * 1.5);
    expect(r.curr.tick).toBe(1);
    expect(alphaOf(r)).toBeCloseTo(0.5);
    expect(r.prev.tick).toBe(0);
  });

  it("freezes the sim during hit-stop but keeps effects ageing", () => {
    let r = createRunner(DEMO_CONFIG, demoSeed(), [{ tick: 0, input: { type: "sample", index: 0, passed: true } }], false);
    r = advanceRunner(r, TICK_MS * 3);
    expect(r.curr.tick).toBe(1);
    expect(r.fx.hitstopMs).toBe(HITSTOP_MS);
    const frozen = advanceRunner(r, 16);
    expect(frozen.curr.tick).toBe(1);
    expect(frozen.fx.hitstopMs).toBe(HITSTOP_MS - 16);
    const resumed = advanceRunner(advanceRunner(frozen, 50), TICK_MS);
    expect(resumed.curr.tick).toBeGreaterThan(1);
  });

  it("live inputs land on the next tick", () => {
    let r = createRunner(DEMO_CONFIG, demoSeed(), [], true);
    r = queueInput(r, { type: "complexity", correct: true });
    r = advanceRunner(r, TICK_MS);
    expect(r.curr.towers.left.hp).toBe(50);
    expect(r.pending).toEqual([]);
  });

  it("the demo script plays a full battle: every tower falls and one unguarded unit leaks", () => {
    const { state, events } = replay(DEMO_CONFIG, demoSeed(), demoScript());
    const kinds = events.map((e) => e.event.type);
    expect(kinds).toContain("repel");
    expect(kinds.filter((k) => k === "towerDestroyed")).toHaveLength(3);
    expect(state.leaks).toBe(1);
    expect(state.phase).toBe("ended");
  });
});
