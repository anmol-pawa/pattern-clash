/** Fixed-step accumulator: turns variable frame times into whole 30 Hz sim steps for the renderer (ARCH §4). */
import { MAX_STEPS_PER_FRAME, TICK_MS } from "./constants";

export interface FrameSteps {
  steps: number;
  /** Leftover time to carry into the next frame; the renderer interpolates with accMs / TICK_MS. */
  accMs: number;
}

/** When the catch-up cap is hit the backlog is dropped, so a background tab never fast-forwards the battle. */
export function stepsForFrame(accMs: number, frameMs: number): FrameSteps {
  const total = accMs + Math.max(0, frameMs);
  const due = Math.floor(total / TICK_MS);
  if (due >= MAX_STEPS_PER_FRAME) return { steps: MAX_STEPS_PER_FRAME, accMs: 0 };
  return { steps: due, accMs: total - due * TICK_MS };
}
