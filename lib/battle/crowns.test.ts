import { describe, expect, it } from "vitest";
import { earnedCrowns, finalCrowns, isDestroyed, outcome } from "./crowns";
import type { TowerId, TowerState } from "./types";

const tower = (id: TowerId, hp: number): TowerState => ({ id, hp, segments: [] });
const towers = (left: number, right: number, king: number) => ({
  left: tower("left", left),
  right: tower("right", right),
  king: tower("king", king),
});

describe("isDestroyed", () => {
  it.each([
    [0, true],
    [-5, true],
    [1, false],
    [100, false],
  ])("hp %i -> %s", (hp, expected) => {
    expect(isDestroyed(tower("left", hp))).toBe(expected);
  });
});

describe("earnedCrowns", () => {
  it("is 0 with every tower standing", () => {
    expect(earnedCrowns(towers(100, 100, 100))).toBe(0);
  });
  it("counts the left tower alone", () => {
    expect(earnedCrowns(towers(0, 50, 100))).toBe(1);
  });
  it("counts the right tower alone", () => {
    expect(earnedCrowns(towers(50, 0, 100))).toBe(1);
  });
  it("counts both side towers", () => {
    expect(earnedCrowns(towers(0, 0, 100))).toBe(2);
  });
  it("gives three crowns when the king falls, whatever the side towers show", () => {
    expect(earnedCrowns(towers(100, 100, 0))).toBe(3);
    expect(earnedCrowns(towers(0, 0, 0))).toBe(3);
  });
});

describe("finalCrowns", () => {
  it("subtracts one crown per leaked unit", () => {
    expect(finalCrowns(3, 1)).toBe(2);
  });
  it("keeps every crown when nothing leaked", () => {
    expect(finalCrowns(2, 0)).toBe(2);
  });
  it("never goes below zero", () => {
    expect(finalCrowns(1, 4)).toBe(0);
  });
});

describe("outcome", () => {
  it.each([
    [0, "lost"],
    [1, "won"],
    [2, "won"],
    [3, "mastered"],
  ] as const)("%i crowns -> %s", (crowns, expected) => {
    expect(outcome(crowns)).toBe(expected);
  });
});
