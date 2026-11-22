import { describe, expect, it } from "vitest";
import { stepsForFrame } from "./clock";
import { MAX_STEPS_PER_FRAME, TICK_MS } from "./constants";
import { nextRandom, shuffle } from "./rng";

describe("seeded rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const run = (seed: number) => {
      const out: number[] = [];
      let s = seed;
      for (let i = 0; i < 5; i++) {
        const [r, n] = nextRandom(s);
        out.push(r);
        s = n;
      }
      return out;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
    for (const r of run(7)) expect(r >= 0 && r < 1).toBe(true);
  });

  it("shuffles into a permutation without touching the input", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [out] = shuffle(items, 99);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.slice().sort((a, b) => a - b)).toEqual(items);
    expect(shuffle(items, 99)[0]).toEqual(out);
  });
});

describe("stepsForFrame", () => {
  it("emits whole ticks and carries the remainder", () => {
    const r = stepsForFrame(0, TICK_MS * 2.5);
    expect(r.steps).toBe(2);
    expect(r.accMs).toBeCloseTo(TICK_MS * 0.5);
  });
  it("treats negative frame times as zero", () => {
    expect(stepsForFrame(10, -50)).toEqual({ steps: 0, accMs: 10 });
  });
  it("caps catch-up and drops the backlog", () => {
    expect(stepsForFrame(0, 10_000)).toEqual({ steps: MAX_STEPS_PER_FRAME, accMs: 0 });
  });
});
