/**
 * Drives the pure sim from real frame times (ARCH §4): fixed 30 Hz steps, interpolation alpha for the renderer,
 * and hit-stop, which freezes the sim (not the effects) for a beat when a tower is struck.
 */
import { stepsForFrame } from "@/lib/battle/clock";
import { TICK_MS } from "@/lib/battle/constants";
import { createBattle, step } from "@/lib/battle/sim";
import type { BattleConfig, BattleInput, BattleState, TimedInput } from "@/lib/battle/types";
import { advanceFx, createFx, ingest, type FxState } from "./fx";

export interface RunnerState {
  prev: BattleState;
  curr: BattleState;
  fx: FxState;
  accMs: number;
  timeMs: number;
  pending: readonly TimedInput[];
  reducedMotion: boolean;
}

export function createRunner(config: BattleConfig, seed: number, script: readonly TimedInput[], reducedMotion: boolean): RunnerState {
  const start = createBattle(config, seed);
  return { prev: start, curr: start, fx: createFx(), accMs: 0, timeMs: 0, pending: script, reducedMotion };
}

/** Queue a live input for the next sim tick. */
export function queueInput(runner: RunnerState, input: BattleInput): RunnerState {
  return { ...runner, pending: [...runner.pending, { tick: runner.curr.tick, input }] };
}

export function advanceRunner(runner: RunnerState, frameMs: number): RunnerState {
  const timeMs = runner.timeMs + Math.max(0, frameMs);
  let fx = advanceFx(runner.fx, frameMs);
  if (fx.hitstopMs > 0) return { ...runner, fx, timeMs };
  const { steps, accMs } = stepsForFrame(runner.accMs, frameMs);
  let { prev, curr, pending } = runner;
  for (let i = 0; i < steps && curr.phase !== "ended"; i++) {
    const tick = curr.tick;
    const inputs = pending.filter((p) => p.tick <= tick).map((p) => p.input);
    pending = pending.filter((p) => p.tick > tick);
    prev = curr;
    curr = step(curr, inputs);
    fx = ingest(fx, curr.events, runner.reducedMotion);
    // Hit-stop: drop the rest of this frame's steps so the impact holds still.
    if (fx.hitstopMs > 0) return { ...runner, prev, curr, fx, pending, accMs: 0, timeMs };
  }
  return { ...runner, prev, curr, fx, pending, accMs, timeMs };
}

/** How far between prev and curr the renderer should draw, 0..1. */
export function alphaOf(runner: RunnerState): number {
  return Math.min(1, Math.max(0, runner.accMs / TICK_MS));
}
