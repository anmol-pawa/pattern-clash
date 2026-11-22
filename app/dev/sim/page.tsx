"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/usePrefersReducedMotion";
import { DEMO_CONFIG, demoScript, demoSeed } from "@/lib/arena/demo";
import { advanceRunner, createRunner, type RunnerState } from "@/lib/arena/runner";
import styles from "./page.module.css";

const RESTART_AFTER_MS = 2500;

function freshRunner(reducedMotion: boolean): RunnerState {
  const seed = demoSeed();
  return createRunner(DEMO_CONFIG, seed, demoScript(DEMO_CONFIG, seed), reducedMotion);
}

/** Review page for the arena renderer (ARCH §2 `/dev/*`): plays the scripted demo battle on a loop. */
export default function DevSim() {
  const hostRef = useRef<HTMLDivElement>(null);
  const systemReduced = usePrefersReducedMotion();
  const [override, setOverride] = useState<boolean | null>(null);
  const [restarts, setRestarts] = useState(0);
  const isReduced = override ?? systemReduced;

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
      let runner = freshRunner(isReduced);
      let endedMs = 0;
      renderer.onFrame((dtMs) => {
        runner = advanceRunner(runner, dtMs);
        if (runner.curr.phase === "ended") {
          endedMs += dtMs;
          if (endedMs > RESTART_AFTER_MS) {
            runner = freshRunner(isReduced);
            endedMs = 0;
          }
        }
        renderer.render(runner);
        host.dataset.tick = String(runner.curr.tick);
        host.dataset.phase = runner.curr.phase;
      });
      host.dataset.ready = "true";
    });
    return () => {
      cancelled = true;
      destroy?.();
      delete host.dataset.ready;
    };
  }, [isReduced, restarts]);

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <h1 className={styles.title}>Arena preview</h1>
        <label className={styles.toggle}>
          <input type="checkbox" checked={isReduced} onChange={(e) => setOverride(e.target.checked)} />
          Reduced motion
        </label>
        <button type="button" className={styles.button} onClick={() => setRestarts((n) => n + 1)}>
          Restart
        </button>
      </header>
      <div ref={hostRef} className={styles.arena} data-reduced={isReduced ? "true" : "false"} />
    </main>
  );
}
