"use client";

import Link from "next/link";
import { TICK_HZ } from "@/lib/battle/constants";
import type { CardDef, Phase } from "@/lib/battle/types";
import { isClean, RUBRIC, SCOUT_SECONDS } from "@/lib/stages/machine";
import { patternName } from "@/lib/stages/patterns";
import type { StageAction, StageProblem, StageState } from "@/lib/stages/types";
import styles from "./battle.module.css";
import { Choices } from "./Choices";

/** What the panels need from the running sim, refreshed a few times a second. */
export interface SimSnapshot {
  tick: number;
  phase: Phase;
  focus: number;
  hand: readonly CardDef[];
  crowns: number;
  outcome: string;
  leaks: number;
  followupsCorrect: number;
}

type PanelProps = {
  problem: StageProblem;
  stage: StageState;
  sim: SimSnapshot;
  dispatch: (action: StageAction) => void;
};

const CONFIDENCE = ["Guessing", "Unsure", "Fairly sure", "Certain"] as const;

function Statement({ problem }: { problem: StageProblem }) {
  return (
    <section aria-label="Problem">
      <h2 className={styles.problemTitle}>{problem.title}</h2>
      <p className={styles.text}>{problem.statement}</p>
      <ul className={styles.constraints}>
        {problem.constraints.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {problem.samples.map((s) => (
        <p key={s.input} className={styles.sample}>
          <code>{s.input}</code> → <code>{s.output}</code>
        </p>
      ))}
    </section>
  );
}

export function ScoutPanel({ problem, stage, sim, dispatch }: PanelProps) {
  const left = Math.max(0, Math.ceil(SCOUT_SECONDS - sim.tick / TICK_HZ));
  const last = stage.scout.picks.at(-1);
  return (
    <>
      <p className={styles.stageHead}>
        Scout · pick the pattern <span className={styles.timer}>{left}s</span>
      </p>
      <Statement problem={problem} />
      {last && last !== problem.pattern && <p className={styles.warn}>Repelled: that pattern does not fit. Its focus is spent.</p>}
      <div className={styles.hand} role="group" aria-label="Your hand">
        {sim.hand.map((card, i) => (
          <button
            key={card.id}
            type="button"
            className={styles.card}
            disabled={sim.focus < card.cost}
            aria-label={`${patternName(card.id)}, costs ${card.cost} focus`}
            onClick={() => dispatch({ type: "pickCard", cardId: card.id, handIndex: i, tick: sim.tick })}
          >
            <span className={styles.cardName}>{patternName(card.id)}</span>
            <span className={styles.cardCost}>{card.cost}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function BrutePanel({ problem, dispatch }: PanelProps) {
  return (
    <>
      <p className={styles.stageHead}>Brute force first</p>
      <Choices legend={problem.brute.prompt} options={problem.brute.options} selected={null} onPick={(option) => dispatch({ type: "answerBrute", option })} />
    </>
  );
}

function ReviewNote({ problem, stage }: { problem: StageProblem; stage: StageState }) {
  const i = stage.build.index;
  const clean = isClean(problem, stage, i);
  const last = i === problem.components.length - 1;
  return (
    <div className={styles.review}>
      <p className={clean ? styles.good : styles.warn}>{clean ? "Clean build: this component holds its lane." : "Not clean: a misplaced line or a wrong reason lets threats through."}</p>
      <p className={styles.text}>Common mistake: {problem.components[i].mistake}</p>
      <p className={styles.dim}>{last ? "Next: run the samples." : "Next component."}</p>
    </div>
  );
}

export function BuildPanel({ problem, stage, dispatch }: PanelProps) {
  const { index, step, order, progress } = stage.build;
  const comp = problem.components[index];
  const p = progress[index];
  const pool = order[index].filter((line) => line >= p.placed);
  const last = index === problem.components.length - 1;
  return (
    <>
      <p className={styles.stageHead}>
        Build · {index + 1}/{problem.components.length} {comp.title}
      </p>
      {stage.brute !== null && <p className={styles.dim}>{problem.brute.note}</p>}
      <pre className={styles.code} aria-label="Placed lines">
        {comp.lines.slice(0, p.placed).join("\n") || " "}
      </pre>
      {step === "place" && (
        <div className={styles.pool} role="group" aria-label="Lines to place">
          {pool.map((line) => (
            <button key={line} type="button" className={styles.line} onClick={() => dispatch({ type: "placeLine", line })}>
              {comp.lines[line]}
            </button>
          ))}
          {p.mistakes > 0 && <p className={styles.warn}>Misplaced: {p.mistakes}. Which line has to come first?</p>}
        </div>
      )}
      {step === "why" && <Choices legend={comp.why.prompt} options={comp.why.options} selected={p.why} onPick={(option) => dispatch({ type: "answerWhy", option })} />}
      {step === "review" && (
        <>
          <ReviewNote problem={problem} stage={stage} />
          <button type="button" className={styles.primary} onClick={() => dispatch({ type: "nextComponent" })}>
            {last ? "Run samples" : "Next component"}
          </button>
        </>
      )}
    </>
  );
}

function ExplainStep({ problem, stage, dispatch }: PanelProps) {
  const { prove } = stage;
  return (
    <>
      <label className={styles.legend} htmlFor="explain">
        Explain your approach in under a minute
      </label>
      <textarea id="explain" className={styles.textarea} value={prove.text} readOnly={prove.revealed} onChange={(e) => dispatch({ type: "setExplanation", text: e.target.value })} />
      <Choices legend="How sure are you?" options={CONFIDENCE} selected={prove.confidence === null ? null : prove.confidence - 1} isLocked={prove.revealed} onPick={(i) => dispatch({ type: "setConfidence", level: i + 1 })} />
      {!prove.revealed ? (
        <button type="button" className={styles.primary} disabled={prove.confidence === null} onClick={() => dispatch({ type: "revealModel" })}>
          Show model answer
        </button>
      ) : (
        <>
          <p className={styles.model}>{problem.explanation}</p>
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>Grade yourself: did you cover…</legend>
            {RUBRIC.map((row, i) => (
              <label key={row} className={styles.check}>
                <input type="checkbox" checked={prove.rubric[i]} onChange={() => dispatch({ type: "toggleRubric", index: i })} />
                {row}
              </label>
            ))}
          </fieldset>
          <button type="button" className={styles.primary} onClick={() => dispatch({ type: "submitProve" })}>
            Submit
          </button>
        </>
      )}
    </>
  );
}

export function ProvePanel(props: PanelProps) {
  const { problem, stage, dispatch } = props;
  const { prove } = stage;
  if (prove.step === "explain") {
    return (
      <>
        <p className={styles.stageHead}>Explain</p>
        <ExplainStep {...props} />
      </>
    );
  }
  const ready = prove.time !== null && prove.space !== null && prove.derivation !== null;
  const { time, space, derivation } = problem.complexity;
  return (
    <>
      <p className={styles.stageHead}>Prove the complexity</p>
      <Choices legend={time.prompt} options={time.options} selected={prove.time} onPick={(option) => dispatch({ type: "answerComplexity", field: "time", option })} />
      <Choices legend={space.prompt} options={space.options} selected={prove.space} onPick={(option) => dispatch({ type: "answerComplexity", field: "space", option })} />
      <Choices legend={derivation.prompt} options={derivation.options} selected={prove.derivation} onPick={(option) => dispatch({ type: "answerComplexity", field: "derivation", option })} />
      <button type="button" className={styles.primary} disabled={!ready} onClick={() => dispatch({ type: "toExplain" })}>
        Continue
      </button>
    </>
  );
}

export function OvertimePanel({ problem, stage, dispatch }: PanelProps) {
  const index = stage.followups.length;
  const prev = index > 0 ? problem.followups[index - 1] : null;
  const prevRight = prev !== null && stage.followups[index - 1] === prev.answer;
  const current = problem.followups[index];
  return (
    <>
      <p className={styles.stageHead}>
        Overtime · follow-up {Math.min(index + 1, problem.followups.length)}/{problem.followups.length}
      </p>
      {prev && <p className={prevRight ? styles.good : styles.warn}>{prev.note}</p>}
      {current && <Choices legend={current.prompt} options={current.options} selected={null} onPick={(option) => dispatch({ type: "answerFollowup", option })} />}
    </>
  );
}

type ResultsProps = PanelProps & { onRestart: () => void };

export function ResultsPanel({ problem, stage, sim, onRestart }: ResultsProps) {
  const clean = problem.components.filter((_, i) => isClean(problem, stage, i)).length;
  const scoutSec = stage.scout.correctAtTick === null ? null : (stage.scout.correctAtTick / TICK_HZ).toFixed(1);
  const proveRight = stage.prove.time === problem.complexity.time.answer && stage.prove.space === problem.complexity.space.answer;
  const graded = stage.prove.rubric.filter(Boolean).length;
  const rows: [string, string][] = [
    ["Pattern", `${patternName(problem.pattern)}${scoutSec ? `, found in ${scoutSec}s` : ", missed"}`],
    ["Wrong cards played", String(stage.scout.picks.filter((p) => p !== problem.pattern).length)],
    ["Brute force growth", stage.brute === problem.brute.answer ? "right" : "missed"],
    ["Clean components", `${clean}/${problem.components.length}`],
    ["Complexity", proveRight ? "right" : "missed"],
    ["Confidence vs self-grade", `${stage.prove.confidence === null ? "–" : CONFIDENCE[stage.prove.confidence - 1]} · ${graded}/${RUBRIC.length}`],
    ["Follow-ups", `${sim.followupsCorrect}/${problem.followups.length}`],
    ["Threats that got through", String(sim.leaks)],
  ];
  return (
    <>
      <p className={styles.stageHead}>Result</p>
      <p className={styles.result}>
        {sim.outcome.toUpperCase()} · {sim.crowns}/3 crowns
      </p>
      <dl className={styles.summary}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onRestart}>
          Battle again
        </button>
        <Link className={styles.secondary} href="/">
          Home
        </Link>
      </div>
    </>
  );
}
