/**
 * Pure, deterministic battle simulation (ARCH §4, GDD §3). `step(state, inputs)` advances exactly one 30 Hz tick.
 * Same config + seed + input log always yields the same states and events, which is what replays rely on.
 */
import {
  DECK_SIZE,
  FOCUS_MAX,
  FOCUS_START,
  FOCUS_TICKS_MAX,
  HAND_SIZE,
  LANE_LENGTH,
  OVERTIME_TICKS,
  REGULATION_TICKS,
  TICK_HZ,
  TICKS_PER_FOCUS,
  UNIT_KINDS,
} from "./constants";
import { earnedCrowns, finalCrowns, isDestroyed, outcome, type Outcome } from "./crowns";
import { shuffle } from "./rng";
import { applyCheck, buildTowers } from "./towers";
import type { BattleConfig, BattleEvent, BattleInput, BattleState, Threat, TimedInput, UnitState } from "./types";

export function spawnTick(threat: Threat): number {
  return Math.round(threat.spawnAtSec * TICK_HZ);
}

/** Reject configs the sim cannot run fairly. Called once, at battle creation. */
export function validateConfig(config: BattleConfig): void {
  const ids = new Set(config.deck.map((c) => c.id));
  if (config.deck.length !== DECK_SIZE || ids.size !== DECK_SIZE) {
    throw new Error(`deck must hold exactly ${DECK_SIZE} distinct cards`);
  }
  if (config.deck.some((c) => !Number.isInteger(c.cost) || c.cost < 1 || c.cost > FOCUS_MAX)) {
    throw new Error(`card costs must be integers in 1..${FOCUS_MAX}`);
  }
  if (!Number.isInteger(config.sampleCount) || config.sampleCount < 1) throw new Error("sampleCount must be >= 1");
  if (!Number.isInteger(config.followupCount) || config.followupCount < 0) throw new Error("followupCount must be >= 0");
  const late = config.threats.find((t) => !(t.spawnAtSec >= 0) || spawnTick(t) >= REGULATION_TICKS);
  if (late) throw new Error(`threat ${late.id} must spawn within regulation time`);
}

export function createBattle(config: BattleConfig, seed: number): BattleState {
  validateConfig(config);
  const [deck, rng] = shuffle(config.deck, seed >>> 0);
  const threatOrder = config.threats.slice().sort((a, b) => spawnTick(a) - spawnTick(b) || a.id.localeCompare(b.id));
  return {
    config,
    threatOrder,
    nextThreat: 0,
    tick: 0,
    phase: "regulation",
    phaseTick: 0,
    focusTicks: FOCUS_START * TICKS_PER_FOCUS,
    hand: deck.slice(0, HAND_SIZE),
    queue: deck.slice(HAND_SIZE),
    towers: buildTowers(config.sampleCount),
    counters: [],
    units: [],
    nextUid: 1,
    leaks: 0,
    followupsAnswered: [],
    followupsCorrect: 0,
    rng,
    events: [],
  };
}

export function focusOf(state: BattleState): number {
  return Math.floor(state.focusTicks / TICKS_PER_FOCUS);
}

function emit(state: BattleState, ...events: BattleEvent[]): BattleState {
  return events.length === 0 ? state : { ...state, events: [...state.events, ...events] };
}

function satisfy(state: BattleState, check: string): BattleState {
  const [towers, events] = applyCheck(state.towers, check);
  return emit({ ...state, towers }, ...events);
}

/** Record a counter and neutralise every live unit it answers. */
function counter(state: BattleState, id: string): BattleState {
  const counters = state.counters.includes(id) ? state.counters : [...state.counters, id];
  const hit = state.units.filter((u) => u.counter === id);
  const units = state.units.filter((u) => u.counter !== id);
  return emit({ ...state, counters, units }, ...hit.map((u): BattleEvent => ({ type: "unitCountered", uid: u.uid, counter: id })));
}

/** Pay focus, cycle the card to the back of the queue, then resolve it against the problem's pattern. */
function playCard(state: BattleState, handIndex: number): BattleState {
  const card = state.hand[handIndex];
  if (!card) return state;
  const focus = focusOf(state);
  if (focus < card.cost) return emit(state, { type: "notEnoughFocus", cardId: card.id, focus });
  const hand = state.hand.map((c, i) => (i === handIndex ? state.queue[0] : c));
  const queue = [...state.queue.slice(1), card];
  const paid = { ...state, hand, queue, focusTicks: state.focusTicks - card.cost * TICKS_PER_FOCUS };
  if (card.id !== state.config.correctPattern) {
    return emit(paid, { type: "deploy", cardId: card.id, correct: false }, { type: "repel", cardId: card.id });
  }
  return satisfy(emit(paid, { type: "deploy", cardId: card.id, correct: true }), "pattern");
}

function answerFollowup(state: BattleState, index: number, correct: boolean): BattleState {
  const inRange = Number.isInteger(index) && index >= 0 && index < state.config.followupCount;
  if (!inRange || state.followupsAnswered.includes(index)) return state;
  const next = {
    ...state,
    followupsAnswered: [...state.followupsAnswered, index],
    followupsCorrect: state.followupsCorrect + (correct ? 1 : 0),
  };
  return emit(next, { type: "followup", index, correct });
}

function applyHidden(state: BattleState, input: Extract<BattleInput, { type: "hidden" }>): BattleState {
  if (!input.passed) return state;
  // The perf group only proves anything when the solution is at optimal complexity (GDD §3).
  if (input.group === "perf" && !input.optimal) return emit(state, { type: "perfNotOptimal" });
  return counter(satisfy(state, `hidden:${input.group}`), `test:${input.group}`);
}

/** Regulation takes every input except follow-up answers; overtime takes only follow-up answers. */
export function applyInput(state: BattleState, input: BattleInput): BattleState {
  if (state.phase === "overtime") {
    return input.type === "followup" ? answerFollowup(state, input.index, input.correct) : state;
  }
  if (state.phase !== "regulation") return state;
  switch (input.type) {
    case "playCard":
      return playCard(state, input.handIndex);
    case "complexity":
      return input.correct ? satisfy(state, "complexity") : state;
    case "sample":
      return input.passed ? satisfy(state, `sample:${input.index}`) : state;
    case "hidden":
      return applyHidden(state, input);
    case "component":
      return input.correct ? counter(state, input.componentId) : state;
    case "followup":
      return state;
    case "finishRegulation":
      // Land on the last regulation tick so this step's clock advance triggers the normal transition.
      return { ...state, phaseTick: Math.max(state.phaseTick, REGULATION_TICKS - 1) };
  }
}

/** Spawn every scripted threat due by now. A threat whose counter already landed spawns, names itself, and falls. */
function spawnThreats(state: BattleState): BattleState {
  let s = state;
  while (s.nextThreat < s.threatOrder.length && spawnTick(s.threatOrder[s.nextThreat]) <= s.phaseTick) {
    const t = s.threatOrder[s.nextThreat];
    const unit: UnitState = { uid: s.nextUid, threatId: t.id, kind: t.kind, lane: t.lane, counter: t.counter, progress: 0 };
    const spawned = { ...s, nextThreat: s.nextThreat + 1, nextUid: s.nextUid + 1 };
    const shown = emit(spawned, { type: "unitSpawn", uid: unit.uid, kind: t.kind, lane: t.lane, label: UNIT_KINDS[t.kind].label });
    s = s.counters.includes(t.counter)
      ? emit(shown, { type: "unitCountered", uid: unit.uid, counter: t.counter })
      : { ...shown, units: [...shown.units, unit] };
  }
  return s;
}

function moveUnits(state: BattleState): BattleState {
  const moved = state.units.map((u) => ({ ...u, progress: u.progress + UNIT_KINDS[u.kind].speed }));
  const leaked = moved.filter((u) => u.progress >= LANE_LENGTH);
  const units = moved.filter((u) => u.progress < LANE_LENGTH);
  const events = leaked.map((u): BattleEvent => ({ type: "unitLeak", uid: u.uid, kind: u.kind }));
  return emit({ ...state, units, leaks: state.leaks + leaked.length }, ...events);
}

function regenFocus(state: BattleState): BattleState {
  const rate = state.phase === "overtime" ? 2 : 1;
  return { ...state, focusTicks: Math.min(FOCUS_TICKS_MAX, state.focusTicks + rate) };
}

function end(state: BattleState): BattleState {
  const crowns = finalCrowns(earnedCrowns(state.towers), state.leaks);
  return emit({ ...state, phase: "ended", units: [] }, { type: "end", crowns });
}

function transition(state: BattleState): BattleState {
  if (state.phase === "regulation") {
    const over = state.phaseTick >= REGULATION_TICKS || isDestroyed(state.towers.king);
    if (!over) return state;
    if (state.config.followupCount === 0) return end(state);
    return emit({ ...state, phase: "overtime", phaseTick: 0, units: [] }, { type: "overtime" });
  }
  const done = state.phaseTick >= OVERTIME_TICKS || state.followupsAnswered.length === state.config.followupCount;
  return done ? end(state) : state;
}

/** Advance one tick: inputs, then spawns and movement (regulation only), focus, clock, phase change. */
export function step(state: BattleState, inputs: readonly BattleInput[] = []): BattleState {
  if (state.phase === "ended") return state.events.length === 0 ? state : { ...state, events: [] };
  let s: BattleState = inputs.reduce(applyInput, { ...state, events: [] });
  if (s.phase === "regulation") s = moveUnits(spawnThreats(s));
  s = regenFocus(s);
  s = { ...s, tick: s.tick + 1, phaseTick: s.phaseTick + 1 };
  return transition(s);
}

export interface ReplayResult {
  state: BattleState;
  events: { tick: number; event: BattleEvent }[];
}

/** Rebuild a battle from its seed and input log (ghost duels, tests). Inputs stamped with a past tick are ignored. */
export function replay(
  config: BattleConfig,
  seed: number,
  log: readonly TimedInput[],
  maxTicks = REGULATION_TICKS + OVERTIME_TICKS + 1,
): ReplayResult {
  const byTick = new Map<number, BattleInput[]>();
  for (const { tick, input } of log) byTick.set(tick, [...(byTick.get(tick) ?? []), input]);
  let state = createBattle(config, seed);
  const events: ReplayResult["events"] = [];
  while (state.phase !== "ended" && state.tick < maxTicks) {
    const tick = state.tick;
    state = step(state, byTick.get(tick) ?? []);
    for (const event of state.events) events.push({ tick, event });
  }
  return { state, events };
}

export function resultOf(state: BattleState): { crowns: number; outcome: Outcome } {
  const crowns = finalCrowns(earnedCrowns(state.towers), state.leaks);
  return { crowns, outcome: outcome(crowns) };
}
