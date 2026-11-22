/**
 * The battle-stage micro loop (GDD §4) as a pure reducer. Each action returns the next stage state plus the sim
 * inputs it causes, so the UI only forwards inputs to the runner and never decides battle outcomes itself.
 */
import { shuffle } from "@/lib/battle/rng";
import type { BattleInput, HiddenGroup } from "@/lib/battle/types";
import type { ComponentProgress, StageAction, StageProblem, StageState } from "./types";

export const SCOUT_SECONDS = 30;
export const RUBRIC = ["Approach", "Why it is correct", "Time and space", "Edge cases"] as const;
const CONFIDENCE_LEVELS = 4;

export interface StageResult {
  state: StageState;
  inputs: BattleInput[];
}

/** Line orders come from a stream derived from the battle seed, so a replayed battle shows the same Parsons puzzle. */
export function createStages(problem: StageProblem, seed: number): StageState {
  let rng = (seed ^ 0x5bd1e995) >>> 0;
  const order = problem.components.map((c) => {
    const [shuffled, next] = shuffle(
      c.lines.map((_, i) => i),
      rng,
    );
    rng = next;
    return shuffled;
  });
  return {
    stage: "scout",
    scout: { picks: [], correctAtTick: null, timedOut: false },
    brute: null,
    build: { index: 0, step: "place", order, progress: problem.components.map(() => ({ placed: 0, mistakes: 0, why: null })) },
    prove: { step: "complexity", time: null, space: null, derivation: null, text: "", confidence: null, revealed: false, rubric: RUBRIC.map(() => false) },
    followups: [],
    phase: "regulation",
  };
}

/** A component counts as cleanly built when its lines went in without a misplacement and its "why" was right. */
export function isClean(problem: StageProblem, state: StageState, index: number): boolean {
  const p = state.build.progress[index];
  return p.mistakes === 0 && p.why === problem.components[index].why.answer;
}

const none = (state: StageState): StageResult => ({ state, inputs: [] });

function withProgress(state: StageState, patch: Partial<ComponentProgress>, step = state.build.step): StageState {
  const progress = state.build.progress.map((p, i) => (i === state.build.index ? { ...p, ...patch } : p));
  return { ...state, build: { ...state.build, progress, step } };
}

function placeLine(state: StageState, problem: StageProblem, line: number): StageResult {
  const p = state.build.progress[state.build.index];
  const lines = problem.components[state.build.index].lines;
  if (line < p.placed || line >= lines.length) return none(state);
  if (line !== p.placed) return none(withProgress(state, { mistakes: p.mistakes + 1 }));
  const placed = p.placed + 1;
  return none(withProgress(state, { placed }, placed === lines.length ? "why" : "place"));
}

function answerWhy(state: StageState, problem: StageProblem, option: number): StageResult {
  const next = withProgress(state, { why: option }, "review");
  const component = problem.components[state.build.index];
  return { state: next, inputs: [{ type: "component", componentId: component.id, correct: isClean(problem, next, state.build.index) }] };
}

/** Moving past the last component runs the samples: the assembled reference passes all of them. */
function nextComponent(state: StageState, problem: StageProblem): StageResult {
  const index = state.build.index + 1;
  if (index < problem.components.length) return none({ ...state, build: { ...state.build, index, step: "place" } });
  const inputs: BattleInput[] = problem.samples.map((_, i) => ({ type: "sample", index: i, passed: true }));
  return { state: { ...state, stage: "prove" }, inputs };
}

/** Submitting proves complexity and runs the hidden groups; the edge group passes only if every edge guard was clean. */
function submitProve(state: StageState, problem: StageProblem): StageResult {
  const { time, space } = problem.complexity;
  const complexityRight = state.prove.time === time.answer && state.prove.space === space.answer;
  const edgeClean = problem.components.every((c, i) => !c.edge || isClean(problem, state, i));
  const group = (g: HiddenGroup, passed: boolean): BattleInput => ({ type: "hidden", group: g, passed, optimal: true });
  const inputs: BattleInput[] = [
    { type: "complexity", correct: complexityRight },
    group("basic", true),
    group("edge", edgeClean),
    group("random", true),
    group("perf", true),
    { type: "finishRegulation" },
  ];
  return { state: { ...state, stage: problem.followups.length > 0 ? "overtime" : "results" }, inputs };
}

function answerFollowup(state: StageState, problem: StageProblem, option: number): StageResult {
  const index = state.followups.length;
  if (index >= problem.followups.length) return none(state);
  const followups = [...state.followups, option];
  const stage = followups.length === problem.followups.length ? "results" : "overtime";
  return { state: { ...state, followups, stage }, inputs: [{ type: "followup", index, correct: option === problem.followups[index].answer }] };
}

function reduceProve(state: StageState, action: StageAction, problem: StageProblem): StageResult {
  const prove = state.prove;
  switch (action.type) {
    case "answerComplexity":
      return prove.step === "complexity" ? none({ ...state, prove: { ...prove, [action.field]: action.option } }) : none(state);
    case "toExplain": {
      const ready = prove.time !== null && prove.space !== null && prove.derivation !== null;
      return ready ? none({ ...state, prove: { ...prove, step: "explain" } }) : none(state);
    }
    case "setExplanation":
      return prove.revealed ? none(state) : none({ ...state, prove: { ...prove, text: action.text } });
    case "setConfidence": {
      const valid = Number.isInteger(action.level) && action.level >= 1 && action.level <= CONFIDENCE_LEVELS;
      return valid && !prove.revealed ? none({ ...state, prove: { ...prove, confidence: action.level } }) : none(state);
    }
    case "revealModel":
      // Confidence is stated before the model answer is shown, so calibration is honest.
      return prove.step === "explain" && prove.confidence !== null ? none({ ...state, prove: { ...prove, revealed: true } }) : none(state);
    case "toggleRubric": {
      if (!prove.revealed || action.index < 0 || action.index >= prove.rubric.length) return none(state);
      return none({ ...state, prove: { ...prove, rubric: prove.rubric.map((v, i) => (i === action.index ? !v : v)) } });
    }
    case "submitProve":
      return prove.revealed ? submitProve(state, problem) : none(state);
    default:
      return none(state);
  }
}

function reduceBuild(state: StageState, action: StageAction, problem: StageProblem): StageResult {
  const step = state.build.step;
  if (action.type === "placeLine" && step === "place") return placeLine(state, problem, action.line);
  if (action.type === "answerWhy" && step === "why") return answerWhy(state, problem, action.option);
  if (action.type === "nextComponent" && step === "review") return nextComponent(state, problem);
  return none(state);
}

/** The sim's clock can end regulation or the battle at any time; the stages follow it. */
function syncPhase(state: StageState, phase: StageState["phase"]): StageState {
  if (phase === "ended") return { ...state, phase, stage: "results" };
  if (phase === "overtime" && state.stage !== "results") return { ...state, phase, stage: "overtime" };
  return { ...state, phase };
}

export function reduceStage(state: StageState, action: StageAction, problem: StageProblem): StageResult {
  if (action.type === "phaseChanged") return none(syncPhase(state, action.phase));
  switch (state.stage) {
    case "scout":
      if (action.type === "scoutTimeout") return none({ ...state, stage: "brute", scout: { ...state.scout, timedOut: true } });
      if (action.type !== "pickCard") return none(state);
      return {
        state: {
          ...state,
          stage: action.cardId === problem.pattern ? "brute" : "scout",
          scout: {
            ...state.scout,
            picks: [...state.scout.picks, action.cardId],
            correctAtTick: action.cardId === problem.pattern ? action.tick : state.scout.correctAtTick,
          },
        },
        inputs: [{ type: "playCard", handIndex: action.handIndex }],
      };
    case "brute":
      return action.type === "answerBrute" ? none({ ...state, brute: action.option, stage: "build" }) : none(state);
    case "build":
      return reduceBuild(state, action, problem);
    case "prove":
      return reduceProve(state, action, problem);
    case "overtime":
      return action.type === "answerFollowup" ? answerFollowup(state, problem, action.option) : none(state);
    case "results":
      return none(state);
  }
}
