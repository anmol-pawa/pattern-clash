"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceRunner, createRunner, queueInput, type RunnerState } from "@/lib/arena/runner";
import { TICK_HZ } from "@/lib/battle/constants";
import { createBattle, focusOf, resultOf } from "@/lib/battle/sim";
import type { BattleState } from "@/lib/battle/types";
import { createStages, reduceStage, SCOUT_SECONDS } from "@/lib/stages/machine";
import { battleConfig, seedWithPattern } from "@/lib/stages/registry";
import type { StageAction, StageProblem } from "@/lib/stages/types";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import styles from "./battle.module.css";
import { BrutePanel, BuildPanel, OvertimePanel, ProvePanel, ResultsPanel, ScoutPanel, type SimSnapshot } from "./StagePanels";

/** Panels refresh from the sim at ~10 Hz; the arena itself draws every frame. */
const SNAPSHOT_EVERY_FRAMES = 6;

function snapshotOf(s: BattleState): SimSnapshot {
  const { crowns, outcome } = resultOf(s);
  return { tick: s.tick, phase: s.phase, focus: focusOf(s), hand: s.hand, crowns, outcome, leaks: s.leaks, followupsCorrect: s.followupsCorrect };
}

type BattleProps = { problem: StageProblem; seed: number; onRestart: () => void };

function Battle({ problem, seed, onRestart }: BattleProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<RunnerState | null>(null);
  const [stage, setStage] = useState(() => createStages(problem, seed));
  const stageRef = useRef(stage);
  const [sim, setSim] = useState(() => snapshotOf(createBattle(battleConfig(problem), seed)));
  const isReduced = usePrefersReducedMotion();
  const reducedRef = useRef(isReduced);

  useEffect(() => {
    reducedRef.current = isReduced;
  }, [isReduced]);

  /** Advance the stage machine and forward the sim inputs it emits to the runner's next tick. */
  const dispatch = useCallback(
    (action: StageAction) => {
      const { state, inputs } = reduceStage(stageRef.current, action, problem);
      stageRef.current = state;
      setStage(state);
      let runner = runnerRef.current;
      if (!runner) return;
      for (const input of inputs) runner = queueInput(runner, input);
      runnerRef.current = runner;
    },
    [problem],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    void import("@/game/render/ArenaRenderer").then(async ({ ArenaRenderer }) => {
      const renderer = await ArenaRenderer.create(host);
      if (cancelled) {
        renderer.destroy();
        return;
      }
      destroy = () => renderer.destroy();
      runnerRef.current = createRunner(battleConfig(problem), seed, [], reducedRef.current);
      let frame = 0;
      renderer.onFrame((dtMs) => {
        const before = runnerRef.current;
        if (!before) return;
        const runner = advanceRunner(before, dtMs);
        runnerRef.current = runner;
        renderer.render(runner);
        const s = runner.curr;
        if (s.phase !== before.curr.phase) dispatch({ type: "phaseChanged", phase: s.phase });
        if (stageRef.current.stage === "scout" && s.tick >= SCOUT_SECONDS * TICK_HZ) dispatch({ type: "scoutTimeout" });
        frame += 1;
        if (frame % SNAPSHOT_EVERY_FRAMES === 0 || s.phase !== before.curr.phase) setSim(snapshotOf(s));
      });
      host.dataset.ready = "true";
    });
    return () => {
      cancelled = true;
      destroy?.();
      runnerRef.current = null;
    };
  }, [problem, seed, dispatch]);

  const props = { problem, stage, sim, dispatch };
  return (
    <main className={styles.screen} data-stage={stage.stage}>
      <div ref={hostRef} className={styles.arena} />
      <section className={styles.panel} aria-live="polite">
        {stage.stage === "scout" && <ScoutPanel {...props} />}
        {stage.stage === "brute" && <BrutePanel {...props} />}
        {stage.stage === "build" && <BuildPanel {...props} />}
        {stage.stage === "prove" && <ProvePanel {...props} />}
        {stage.stage === "overtime" && <OvertimePanel {...props} />}
        {stage.stage === "results" && <ResultsPanel {...props} onRestart={onRestart} />}
      </section>
    </main>
  );
}

/** One battle per problem; "Battle again" remounts it with the next seed so every bit of state resets. */
export default function BattleScreen({ problem }: { problem: StageProblem }) {
  const [round, setRound] = useState(0);
  const seed = seedWithPattern(problem, 1 + round * 1000);
  return <Battle key={round} problem={problem} seed={seed} onRestart={() => setRound((r) => r + 1)} />;
}
