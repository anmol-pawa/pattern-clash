import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { replay } from "@/lib/battle/sim";
import type { BattleInput, TimedInput } from "@/lib/battle/types";
import { judgeProblem, type JudgeDeps } from "@/lib/judge/judge";
import { assemble, sampleToHarness } from "./assemble";
import { PAIR_TO_TARGET as P } from "./demoProblem";
import { createStages, isClean, reduceStage, RUBRIC } from "./machine";
import { patternName } from "./patterns";
import type { StageAction, StageState } from "./types";

/** Apply actions in order, collecting every sim input they emit. */
function play(actions: StageAction[], start: StageState = createStages(P, 7)): { state: StageState; inputs: BattleInput[] } {
  let state = start;
  const inputs: BattleInput[] = [];
  for (const a of actions) {
    const r = reduceStage(state, a, P);
    state = r.state;
    inputs.push(...r.inputs);
  }
  return { state, inputs };
}

/** Place every line of the current component in order, then answer its why. */
const buildComponent = (i: number, why = P.components[i].why.answer): StageAction[] => [
  ...P.components[i].lines.map((_, line): StageAction => ({ type: "placeLine", line })),
  { type: "answerWhy", option: why },
  { type: "nextComponent" },
];

const SCOUT_AND_BRUTE: StageAction[] = [
  { type: "pickCard", cardId: "hashing", handIndex: 1, tick: 120 },
  { type: "answerBrute", option: P.brute.answer },
];
const PROVE: StageAction[] = [
  { type: "answerComplexity", field: "time", option: P.complexity.time.answer },
  { type: "answerComplexity", field: "space", option: P.complexity.space.answer },
  { type: "answerComplexity", field: "derivation", option: P.complexity.derivation.answer },
  { type: "toExplain" },
  { type: "setExplanation", text: "one pass with a value-to-index map" },
  { type: "setConfidence", level: 3 },
  { type: "revealModel" },
  { type: "toggleRubric", index: 0 },
  { type: "submitProve" },
];
const ALL_BUILD = P.components.flatMap((_, i) => buildComponent(i));

describe("stage machine", () => {
  it("shuffles each component's lines deterministically from the seed", () => {
    const a = createStages(P, 11).build.order;
    expect(createStages(P, 11).build.order).toEqual(a);
    a.forEach((order, i) => expect([...order].sort()).toEqual(P.components[i].lines.map((_, k) => k)));
  });

  it("a wrong card is played but keeps the player scouting; the right one moves on", () => {
    const { state, inputs } = play([
      { type: "pickCard", cardId: "greedy", handIndex: 0, tick: 30 },
      { type: "pickCard", cardId: "hashing", handIndex: 2, tick: 90 },
    ]);
    expect(inputs).toEqual([{ type: "playCard", handIndex: 0 }, { type: "playCard", handIndex: 2 }]);
    expect(state.stage).toBe("brute");
    expect(state.scout).toEqual({ picks: ["greedy", "hashing"], correctAtTick: 90, timedOut: false });
  });

  it("scout timeout moves on without a pattern hit", () => {
    const { state, inputs } = play([{ type: "scoutTimeout" }]);
    expect(state.stage).toBe("brute");
    expect(state.scout.timedOut).toBe(true);
    expect(inputs).toEqual([]);
  });

  it("a misplaced line counts a mistake and is not placed; a clean component counters its threat", () => {
    const { state, inputs } = play([...SCOUT_AND_BRUTE, ...buildComponent(0), { type: "placeLine", line: 1 }, { type: "placeLine", line: 0 }, { type: "placeLine", line: 0 }]);
    expect(state.build.progress[1]).toMatchObject({ placed: 1, mistakes: 1 });
    expect(inputs).toContainEqual({ type: "component", componentId: "declare-seen", correct: true });
  });

  it("a component with mistakes or a wrong why does not counter", () => {
    const sloppy = play([...SCOUT_AND_BRUTE, { type: "placeLine", line: 0 }, { type: "answerWhy", option: 2 }]);
    expect(sloppy.inputs.at(-1)).toEqual({ type: "component", componentId: "declare-seen", correct: false });
    expect(isClean(P, sloppy.state, 0)).toBe(false);
  });

  it("finishing the build runs every sample", () => {
    const { state, inputs } = play([...SCOUT_AND_BRUTE, ...ALL_BUILD]);
    expect(state.stage).toBe("prove");
    expect(inputs.filter((i) => i.type === "sample")).toHaveLength(P.samples.length);
  });

  it("prove needs all three picks, then confidence before the model answer, then submits", () => {
    const base = play([...SCOUT_AND_BRUTE, ...ALL_BUILD]).state;
    expect(play([{ type: "toExplain" }], base).state.prove.step).toBe("complexity");
    expect(play([{ type: "answerComplexity", field: "time", option: 2 }, { type: "toExplain" }], base).state.prove.step).toBe("complexity");
    const early = play([...PROVE.slice(0, 5), { type: "revealModel" }], base).state;
    expect(early.prove.revealed).toBe(false);
    const { state, inputs } = play(PROVE, base);
    expect(state.prove.rubric).toEqual([true, false, false, false]);
    expect(state.stage).toBe("overtime");
    expect(inputs).toEqual([
      { type: "complexity", correct: true },
      { type: "hidden", group: "basic", passed: true, optimal: true },
      { type: "hidden", group: "edge", passed: true, optimal: true },
      { type: "hidden", group: "random", passed: true, optimal: true },
      { type: "hidden", group: "perf", passed: true, optimal: true },
      { type: "finishRegulation" },
    ]);
  });

  it("a sloppy edge guard fails the edge group, and a wrong complexity misses the left tower", () => {
    const sloppyEdge = [...buildComponent(0), ...buildComponent(1), { type: "placeLine", line: 2 } as StageAction, ...buildComponent(2), ...buildComponent(3)];
    const wrongTime = PROVE.map((a) => (a.type === "answerComplexity" && a.field === "time" ? { ...a, option: 0 } : a));
    const { inputs } = play([...SCOUT_AND_BRUTE, ...sloppyEdge, ...wrongTime]);
    expect(inputs).toContainEqual({ type: "hidden", group: "edge", passed: false, optimal: true });
    expect(inputs).toContainEqual({ type: "complexity", correct: false });
  });

  it("follow-ups are answered in order and end on the results screen", () => {
    const base = play([...SCOUT_AND_BRUTE, ...ALL_BUILD, ...PROVE]).state;
    const { state, inputs } = play([{ type: "answerFollowup", option: 0 }, { type: "answerFollowup", option: 1 }, { type: "answerFollowup", option: 0 }], base);
    expect(state.stage).toBe("results");
    expect(inputs).toEqual([{ type: "followup", index: 0, correct: true }, { type: "followup", index: 1, correct: false }]);
  });

  it("the sim clock overrides the stage: overtime and the final whistle", () => {
    expect(play([{ type: "phaseChanged", phase: "overtime" }]).state.stage).toBe("overtime");
    expect(play([{ type: "phaseChanged", phase: "ended" }]).state.stage).toBe("results");
    const done = play([{ type: "phaseChanged", phase: "ended" }, { type: "phaseChanged", phase: "overtime" }]).state;
    expect(done.stage).toBe("results");
  });

  it("ignores actions that do not belong to the current stage", () => {
    const s = createStages(P, 7);
    for (const a of [{ type: "answerBrute", option: 0 }, { type: "placeLine", line: 0 }, { type: "submitProve" }, { type: "answerFollowup", option: 0 }] as StageAction[]) {
      expect(reduceStage(s, a, P)).toEqual({ state: s, inputs: [] });
    }
  });

  it("a perfect run, fed to the sim, is a three-crown mastery with no leaks", () => {
    const { inputs } = play([...SCOUT_AND_BRUTE.slice(1), ...ALL_BUILD, ...PROVE, { type: "answerFollowup", option: 0 }, { type: "answerFollowup", option: 0 }], {
      ...createStages(P, 7),
      stage: "brute",
    });
    const config = { deck: P.deck, correctPattern: P.pattern, sampleCount: P.samples.length, threats: P.threats, followupCount: P.followups.length };
    const log: TimedInput[] = inputs.map((input, i) => ({ tick: 10 + i, input }));
    const { state } = replay(config, 7, log);
    expect(state.phase).toBe("ended");
    expect(state.towers.king.hp).toBe(0);
    expect(state.leaks).toBe(0);
    expect(state.followupsCorrect).toBe(2);
  });

  it("names every deck card and has four rubric rows", () => {
    for (const c of P.deck) expect(patternName(c.id)).not.toBe(c.id);
    expect(patternName("mystery")).toBe("mystery");
    expect(RUBRIC).toHaveLength(4);
  });
});

describe("demo problem content", () => {
  const dir = mkdtempSync(join(tmpdir(), "pc-stages-"));
  let n = 0;
  const deps: JudgeDeps = {
    async compile(source) {
      const base = join(dir, `s${n++}`);
      writeFileSync(`${base}.cpp`, source);
      const r = spawnSync("g++", ["-std=c++20", "-fno-exceptions", "-O1", `${base}.cpp`, "-o", base], { encoding: "utf8" });
      return { ok: r.status === 0, wasm: r.status === 0 ? new TextEncoder().encode(base) : undefined, diagnostics: r.stderr, timings: {} };
    },
    async run(handle, stdin, timeoutMs) {
      const r = spawnSync(new TextDecoder().decode(handle), [], { input: stdin, encoding: "utf8", timeout: timeoutMs });
      // MinGW binaries write CRLF on Windows; the browser's WASI runner writes LF.
      const stdout = (r.stdout ?? "").replace(/\r\n/g, "\n");
      return { status: r.status === 0 ? "ok" : "RE", exitCode: r.status ?? -1, stdout, stderr: r.stderr ?? "", wallMs: 1, detail: "", memPages: 0 };
    },
  };

  it("parses display samples into harness lines", () => {
    expect(sampleToHarness("nums = [3, 8, 5, 12], target = 17")).toBe("[3,8,5,12]\n17");
  });

  it("the components assemble into a solution that passes every sample (outputs come from running code)", async () => {
    const tests = P.samples.map((s) => ({ input: sampleToHarness(s.input), expected: s.output.replace(/\s+/g, "") }));
    const result = await judgeProblem(P.driver, assemble(P), tests, { timeLimitMs: 5000 }, deps);
    expect(result.diagnostics ?? "").toBe("");
    expect(result.verdict).toBe("AC");
  });
});
