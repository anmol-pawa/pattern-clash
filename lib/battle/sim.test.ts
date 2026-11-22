import { describe, expect, it } from "vitest";
import {
  FOCUS_MAX,
  FOCUS_START,
  LANE_LENGTH,
  OVERTIME_TICKS,
  REGULATION_TICKS,
  TICKS_PER_FOCUS,
  UNIT_KINDS,
} from "./constants";
import { battleWithCardInHand, handIndexOf, makeConfig, PATTERNS, seedWithCardInHand } from "./fixtures";
import { createBattle, focusOf, replay, resultOf, step } from "./sim";
import type { BattleInput, BattleState, TimedInput } from "./types";

const run = (state: BattleState, ticks: number, inputs: BattleInput[] = []): BattleState => {
  let s = step(state, inputs);
  for (let i = 1; i < ticks; i++) s = step(s);
  return s;
};
const types = (s: BattleState) => s.events.map((e) => e.type);
const ALL_HIDDEN: BattleInput[] = (["basic", "edge", "random", "perf"] as const).map((group) => ({
  type: "hidden",
  group,
  passed: true,
  optimal: true,
}));

describe("createBattle", () => {
  it("deals a hand of 4 and queues the other 4 of the deck", () => {
    const s = createBattle(makeConfig(), 7);
    expect(s.hand).toHaveLength(4);
    expect(s.queue).toHaveLength(4);
    expect([...s.hand, ...s.queue].map((c) => c.id).sort()).toEqual([...PATTERNS].sort());
    expect(focusOf(s)).toBe(FOCUS_START);
    expect([s.towers.left.hp, s.towers.right.hp, s.towers.king.hp]).toEqual([100, 100, 100]);
    expect(s.phase).toBe("regulation");
  });

  it("deals in a seed-determined order", () => {
    const hands = Array.from({ length: 10 }, (_, seed) => createBattle(makeConfig(), seed).hand.map((c) => c.id).join());
    expect(new Set(hands).size).toBeGreaterThan(1);
    expect(createBattle(makeConfig(), 3).hand).toEqual(createBattle(makeConfig(), 3).hand);
  });

  it.each([
    ["a 7-card deck", { deck: makeConfig().deck.slice(0, 7) }],
    ["duplicate card ids", { deck: makeConfig().deck.map((c) => ({ ...c, id: "same" })) }],
    ["a zero-cost card", { deck: makeConfig().deck.map((c, i) => ({ ...c, cost: i === 0 ? 0 : c.cost })) }],
    ["no samples", { sampleCount: 0 }],
    ["negative follow-ups", { followupCount: -1 }],
    ["a threat after regulation", { threats: [{ id: "late", kind: "void", lane: "left", spawnAtSec: 200, counter: "x" }] }],
    ["a NaN spawn time", { threats: [{ id: "nan", kind: "void", lane: "left", spawnAtSec: Number.NaN, counter: "x" }] }],
  ] as const)("rejects %s", (_, over) => {
    expect(() => createBattle(makeConfig(over as never), 1)).toThrow();
  });
});

describe("focus", () => {
  it("gains one point every 2.8 s and caps at 10", () => {
    const s0 = createBattle(makeConfig({ threats: [] }), 1);
    expect(focusOf(run(s0, TICKS_PER_FOCUS))).toBe(FOCUS_START + 1);
    expect(focusOf(run(s0, TICKS_PER_FOCUS * 20))).toBe(FOCUS_MAX);
  });

  it("refills twice as fast in overtime", () => {
    const s = run(createBattle(makeConfig({ threats: [] }), 1), REGULATION_TICKS);
    expect(s.phase).toBe("overtime");
    const drained = { ...s, focusTicks: 0 };
    expect(focusOf(run(drained, TICKS_PER_FOCUS / 2))).toBe(1);
  });
});

describe("pattern cards", () => {
  it("a correct card pays focus, cycles, and knocks half off the left tower", () => {
    const s0 = battleWithCardInHand("hashing");
    const i = handIndexOf(s0, "hashing");
    const card = s0.hand[i];
    const s1 = step(s0, [{ type: "playCard", handIndex: i }]);
    expect(types(s1)).toEqual(["deploy", "towerHit"]);
    expect(s1.towers.left.hp).toBe(50);
    expect(s1.hand[i]).toEqual(s0.queue[0]);
    expect(s1.queue.at(-1)).toEqual(card);
    expect(s1.focusTicks).toBe(s0.focusTicks - card.cost * TICKS_PER_FOCUS + 1);
  });

  it("a wrong card is repelled and its focus is lost", () => {
    const s0 = createBattle(makeConfig(), 1);
    const i = s0.hand.findIndex((c) => c.id !== "hashing");
    const s1 = step(s0, [{ type: "playCard", handIndex: i }]);
    expect(types(s1)).toEqual(["deploy", "repel"]);
    expect(s1.towers.left.hp).toBe(100);
    expect(s1.focusTicks).toBeLessThan(s0.focusTicks);
  });

  it("refuses a card the player cannot afford and keeps the hand", () => {
    const s0 = { ...createBattle(makeConfig(), 1), focusTicks: 0 };
    const s1 = step(s0, [{ type: "playCard", handIndex: 0 }]);
    expect(types(s1)).toEqual(["notEnoughFocus"]);
    expect(s1.hand).toEqual(s0.hand);
  });

  it("ignores a hand index that does not exist", () => {
    const s0 = createBattle(makeConfig(), 1);
    const s1 = step(s0, [{ type: "playCard", handIndex: 9 }]);
    expect(s1.events).toEqual([]);
    expect(s1.hand).toEqual(s0.hand);
  });
});

describe("tower checks", () => {
  it("pattern plus complexity destroys the left tower", () => {
    const s0 = battleWithCardInHand("hashing");
    const s1 = step(s0, [{ type: "playCard", handIndex: handIndexOf(s0, "hashing") }, { type: "complexity", correct: true }]);
    expect(s1.towers.left.hp).toBe(0);
    expect(types(s1)).toContain("towerDestroyed");
    expect(resultOf(s1).crowns).toBe(1);
  });

  it("a wrong complexity pick does nothing", () => {
    expect(step(createBattle(makeConfig(), 1), [{ type: "complexity", correct: false }]).towers.left.hp).toBe(100);
  });

  it("splits the right tower into equal sample shares and ignores repeats, failures and unknown samples", () => {
    let s = createBattle(makeConfig(), 1);
    s = step(s, [{ type: "sample", index: 0, passed: true }, { type: "sample", index: 1, passed: true }]);
    expect(s.towers.right.hp).toBe(34);
    s = step(s, [
      { type: "sample", index: 0, passed: true },
      { type: "sample", index: 2, passed: false },
      { type: "sample", index: 7, passed: true },
    ]);
    expect(s.towers.right.hp).toBe(34);
    s = step(s, [{ type: "sample", index: 2, passed: true }]);
    expect(s.towers.right.hp).toBe(0);
  });

  it("a perf group only lands at optimal complexity", () => {
    const s0 = createBattle(makeConfig(), 1);
    const slow = step(s0, [{ type: "hidden", group: "perf", passed: true, optimal: false }]);
    expect(types(slow)).toEqual(["perfNotOptimal"]);
    expect(slow.towers.king.hp).toBe(100);
    const fast = step(s0, [{ type: "hidden", group: "perf", passed: true, optimal: true }]);
    expect(fast.towers.king.hp).toBe(75);
  });

  it("a failing hidden group does nothing", () => {
    expect(step(createBattle(makeConfig(), 1), [{ type: "hidden", group: "basic", passed: false, optimal: true }]).towers.king.hp).toBe(100);
  });
});

describe("enemy units", () => {
  const voidOnly = makeConfig({
    followupCount: 0,
    threats: [{ id: "empty", kind: "void", lane: "left", spawnAtSec: 2, counter: "guard-empty" }],
  });
  const ticksToLeak = Math.ceil(LANE_LENGTH / UNIT_KINDS.void.speed);

  it("spawns on schedule, names its edge case, and leaks for a crown penalty", () => {
    const { state, events } = replay(voidOnly, 1, []);
    const spawn = events.find((e) => e.event.type === "unitSpawn");
    expect(spawn).toEqual({ tick: 60, event: { type: "unitSpawn", uid: 1, kind: "void", lane: "left", label: "empty input" } });
    const leak = events.find((e) => e.event.type === "unitLeak");
    expect(leak?.tick).toBe(60 + ticksToLeak - 1);
    expect(state.leaks).toBe(1);
  });

  it("a counter played before the spawn kills the unit as it appears", () => {
    const { state, events } = replay(voidOnly, 1, [{ tick: 0, input: { type: "component", componentId: "guard-empty", correct: true } }]);
    expect(events.map((e) => e.event.type)).toEqual(["unitSpawn", "unitCountered", "end"]);
    expect(state.leaks).toBe(0);
  });

  it("a counter played while the unit walks removes it", () => {
    const s = run(createBattle(voidOnly, 1), 70);
    expect(s.units).toHaveLength(1);
    const s1 = step(s, [{ type: "component", componentId: "guard-empty", correct: true }]);
    expect(types(s1)).toEqual(["unitCountered"]);
    expect(s1.units).toEqual([]);
  });

  it("a wrong component does not counter", () => {
    const s = run(createBattle(voidOnly, 1), 70);
    expect(step(s, [{ type: "component", componentId: "guard-empty", correct: false }]).units).toHaveLength(1);
  });

  it("a passing hidden group counters units keyed to it", () => {
    const s = run(createBattle(makeConfig(), 1), 160);
    expect(s.units.some((u) => u.counter === "test:edge")).toBe(true);
    const s1 = step(s, [{ type: "hidden", group: "edge", passed: true, optimal: false }]);
    expect(s1.units.some((u) => u.counter === "test:edge")).toBe(false);
    expect(s1.towers.king.hp).toBe(75);
  });

  it("spawns threats in time order whatever order the script lists them", () => {
    const s = run(createBattle(makeConfig(), 1), 61);
    expect(s.units.map((u) => u.threatId)).toEqual(["scale", "empty"]);
  });
});

describe("phases", () => {
  it("ends after regulation when there are no follow-ups", () => {
    const { state, events } = replay(makeConfig({ threats: [], followupCount: 0 }), 1, []);
    expect(state.phase).toBe("ended");
    expect(state.tick).toBe(REGULATION_TICKS);
    expect(events.at(-1)).toEqual({ tick: REGULATION_TICKS - 1, event: { type: "end", crowns: 0 } });
  });

  it("toppling the king ends regulation at once with three crowns", () => {
    const { state } = replay(makeConfig({ threats: [], followupCount: 0 }), 1, ALL_HIDDEN.map((input) => ({ tick: 0, input })));
    expect(state.tick).toBe(1);
    expect(resultOf(state)).toEqual({ crowns: 3, outcome: "mastered" });
  });

  it("goes to overtime for follow-ups, which accepts only follow-up answers", () => {
    let s = run(createBattle(makeConfig({ threats: [] }), 1), REGULATION_TICKS);
    expect(s.phase).toBe("overtime");
    s = step(s, [{ type: "sample", index: 0, passed: true }, { type: "followup", index: 0, correct: true }]);
    expect(s.towers.right.hp).toBe(100);
    expect(types(s)).toEqual(["followup"]);
    s = step(s, [
      { type: "followup", index: 0, correct: false },
      { type: "followup", index: 5, correct: true },
    ]);
    expect(s.followupsAnswered).toEqual([0]);
    s = step(s, [{ type: "followup", index: 1, correct: false }]);
    expect(s.phase).toBe("ended");
    expect(s.followupsCorrect).toBe(1);
  });

  it("finishing regulation early goes straight to overtime, or ends without follow-ups", () => {
    const withFollowups = step(createBattle(makeConfig(), 1), [{ type: "finishRegulation" }]);
    expect(withFollowups.phase).toBe("overtime");
    expect(withFollowups.units).toEqual([]);
    const without = step(createBattle(makeConfig({ followupCount: 0 }), 1), [{ type: "finishRegulation" }]);
    expect(without.phase).toBe("ended");
  });

  it("ignores follow-up answers during regulation", () => {
    const s = step(createBattle(makeConfig(), 1), [{ type: "followup", index: 0, correct: true }]);
    expect(s.followupsAnswered).toEqual([]);
  });

  it("overtime runs out after one minute", () => {
    const s = run(createBattle(makeConfig({ threats: [] }), 1), REGULATION_TICKS + OVERTIME_TICKS);
    expect(s.phase).toBe("ended");
  });

  it("an ended battle no longer changes", () => {
    const { state } = replay(makeConfig({ threats: [], followupCount: 0 }), 1, []);
    const once = step(state, [{ type: "sample", index: 0, passed: true }]);
    expect(once.events).toEqual([]);
    expect(once.towers).toBe(state.towers);
    expect(step(once)).toBe(once);
  });
});

describe("replays", () => {
  const log: TimedInput[] = [
    { tick: 0, input: { type: "playCard", handIndex: 0 } },
    { tick: 15, input: { type: "playCard", handIndex: 1 } },
    { tick: 40, input: { type: "complexity", correct: true } },
    { tick: 90, input: { type: "component", componentId: "guard-empty", correct: true } },
    { tick: 200, input: { type: "sample", index: 0, passed: true } },
    { tick: 200, input: { type: "sample", index: 1, passed: true } },
    { tick: 400, input: { type: "hidden", group: "edge", passed: true, optimal: false } },
    { tick: 900, input: { type: "playCard", handIndex: 2 } },
  ];

  it("same seed and input log give identical states and events", () => {
    const a = replay(makeConfig(), 12345, log);
    const b = replay(makeConfig(), 12345, JSON.parse(JSON.stringify(log)) as TimedInput[]);
    expect(b).toEqual(a);
    expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state);
  });

  it("stepping by hand matches the replay exactly", () => {
    const { state } = replay(makeConfig(), 99, log, 1000);
    let s = createBattle(makeConfig(), 99);
    for (let t = 0; t < 1000; t++) s = step(s, log.filter((l) => l.tick === t).map((l) => l.input));
    expect(s).toEqual(state);
  });

  it("a full clean solve is mastered with no leaks", () => {
    const config = makeConfig({ followupCount: 0 });
    const seed = seedWithCardInHand("hashing", config);
    const hashing = handIndexOf(createBattle(config, seed), "hashing");
    const cleanLog: TimedInput[] = [
      { tick: 0, input: { type: "playCard", handIndex: hashing } },
      { tick: 0, input: { type: "complexity", correct: true } },
      { tick: 0, input: { type: "component", componentId: "guard-empty", correct: true } },
      ...[0, 1, 2].map((index): TimedInput => ({ tick: 10, input: { type: "sample", index, passed: true } })),
      ...ALL_HIDDEN.map((input): TimedInput => ({ tick: 20, input })),
    ];
    const { state } = replay(config, seed, cleanLog);
    expect(resultOf(state)).toEqual({ crowns: 3, outcome: "mastered" });
    expect(state.leaks).toBe(0);
  });
});
