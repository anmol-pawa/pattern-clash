/**
 * PixiJS arena renderer (ARCH §4, GDD §8). It reads RunnerState and never mutates the sim: units are interpolated
 * between the previous and current tick, and every effect comes from the pure fx state in lib/arena/fx.ts.
 */
import { Application, Container, Graphics, Text, type TextStyleOptions } from "pixi.js";
import { BURST_MS, LABEL_MS, projectileT, shakeOffset, type Burst, type Projectile } from "@/lib/arena/fx";
import { computeLayout, lerp, unitPoint, type ArenaLayout, type Point } from "@/lib/arena/layout";
import { alphaOf, type RunnerState } from "@/lib/arena/runner";
import { FOCUS_MAX, OVERTIME_TICKS, REGULATION_TICKS, TICK_HZ, TICKS_PER_FOCUS } from "@/lib/battle/constants";
import { resultOf } from "@/lib/battle/sim";
import type { TowerId } from "@/lib/battle/types";
import { COLORS, drawStatic, drawTower, drawUnit, formatClock } from "./draw";

const TOWER_IDS: readonly TowerId[] = ["king", "left", "right"];
const FONT: TextStyleOptions = { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontWeight: "800" };
const NO_OFFSET: Point = { x: 0, y: 0 };
const BURST_COLOR = { crown: COLORS.gold, counter: COLORS.cyan, leak: COLORS.magenta } as const;

export class ArenaRenderer {
  private readonly staticG = new Graphics();
  private readonly dynamicG = new Graphics();
  private readonly fxG = new Graphics();
  private readonly labelLayer = new Container();
  private readonly crownsText = new Text({ text: "", style: { ...FONT, fill: COLORS.gold } });
  private readonly clockText = new Text({ text: "", style: { ...FONT, fill: COLORS.ink } });
  private readonly bannerText = new Text({ text: "", style: { ...FONT, fill: COLORS.magenta } });
  private readonly labelTexts = new Map<number, Text>();
  private readonly unitPos = new Map<number, Point>();
  private layout: ArenaLayout = computeLayout(1, 1);

  private constructor(private readonly app: Application) {
    this.clockText.anchor.set(1, 0);
    this.bannerText.anchor.set(0.5);
    app.stage.addChild(this.staticG, this.dynamicG, this.fxG, this.labelLayer, this.crownsText, this.clockText, this.bannerText);
  }

  static async create(host: HTMLElement): Promise<ArenaRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: COLORS.bg,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
    });
    app.canvas.setAttribute("aria-label", "Battle arena");
    host.appendChild(app.canvas);
    return new ArenaRenderer(app);
  }

  /** Calls `cb` once per display frame with the real elapsed time. */
  onFrame(cb: (dtMs: number) => void): void {
    this.app.ticker.add((ticker) => cb(ticker.deltaMS));
  }

  render(r: RunnerState): void {
    this.syncLayout();
    const g = this.dynamicG;
    g.clear();
    for (const id of TOWER_IDS) {
      const offset = r.reducedMotion ? NO_OFFSET : shakeOffset(r.fx.shakes[id], r.timeMs);
      drawTower(g, this.layout.towers[id], r.curr.towers[id], offset, this.layout.scale);
    }
    this.drawUnits(r);
    this.drawFocus(r);
    this.drawFx(r);
    this.drawLabels(r);
    this.drawHud(r);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }

  private syncLayout(): void {
    const { width, height } = this.app.screen;
    if (width === this.layout.width && height === this.layout.height) return;
    this.layout = computeLayout(width, height);
    drawStatic(this.staticG, this.layout);
    const size = Math.max(14, 20 * this.layout.scale);
    this.crownsText.style.fontSize = size;
    this.clockText.style.fontSize = size;
    this.bannerText.style.fontSize = Math.max(18, 30 * this.layout.scale);
    for (const t of this.labelTexts.values()) t.style.fontSize = this.labelSize();
  }

  private labelSize(): number {
    return Math.max(11, 12 * this.layout.scale);
  }

  private drawUnits(r: RunnerState): void {
    const alpha = alphaOf(r);
    const before = new Map(r.prev.units.map((u) => [u.uid, u.progress]));
    const live = new Set<number>();
    for (const u of r.curr.units) {
      const progress = lerp(before.get(u.uid) ?? u.progress, u.progress, alpha);
      const p = unitPoint(this.layout, u.lane, progress);
      this.unitPos.set(u.uid, p);
      live.add(u.uid);
      drawUnit(this.dynamicG, u.kind, p, this.layout.scale);
    }
    // Keep positions only while something still needs them (a live unit, a burst or a label).
    const wanted = new Set([...live, ...r.fx.bursts.map((b) => b.uid), ...r.fx.labels.map((l) => l.uid)]);
    for (const uid of this.unitPos.keys()) if (!wanted.has(uid)) this.unitPos.delete(uid);
  }

  private drawFocus(r: RunnerState): void {
    const { frame, scale, playerY } = this.layout;
    const pad = 16 * scale;
    const w = (frame.w - pad * 2) / FOCUS_MAX;
    const y = playerY + 22 * scale;
    const value = r.curr.focusTicks / TICKS_PER_FOCUS;
    for (let i = 0; i < FOCUS_MAX; i++) {
      const fill = Math.max(0, Math.min(1, value - i));
      const x = frame.x + pad + i * w;
      this.dynamicG.roundRect(x + 2, y, w - 4, 10 * scale, 3 * scale).stroke({ width: 1, color: COLORS.lime, alpha: 0.5 });
      if (fill > 0) this.dynamicG.roundRect(x + 2, y, (w - 4) * fill, 10 * scale, 3 * scale).fill({ color: COLORS.lime, alpha: fill === 1 ? 1 : 0.45 });
    }
  }

  private drawFx(r: RunnerState): void {
    this.fxG.clear();
    for (const p of r.fx.projectiles) this.drawProjectile(p);
    for (const b of r.fx.bursts) this.drawBurst(b);
  }

  private drawProjectile(p: Projectile): void {
    const l = this.layout;
    const target = l.towers[p.target];
    const from = { x: p.target === "king" ? l.frame.x + l.frame.w / 2 : l.laneX[p.target], y: l.playerY };
    const t = projectileT(p);
    const at = (k: number) => ({ x: lerp(from.x, target.x, k), y: lerp(from.y, target.y, k) });
    const head = at(t);
    const tail = at(Math.max(0, t - 0.18));
    const color = p.repelled ? COLORS.magenta : COLORS.cyan;
    this.fxG.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 4 * l.scale, color, alpha: 0.55, cap: "round" });
    this.fxG.circle(head.x, head.y, 5 * l.scale).fill({ color });
  }

  private drawBurst(b: Burst): void {
    const l = this.layout;
    const spot = b.tower ? l.towers[b.tower] : b.uid !== undefined ? this.unitPos.get(b.uid) : undefined;
    if (!spot) return;
    const center = b.kind === "leak" ? { x: spot.x, y: l.playerY } : spot;
    const k = b.ageMs / BURST_MS;
    const base = b.tower ? l.towers[b.tower].radius : 14 * l.scale;
    const color = BURST_COLOR[b.kind];
    if (b.calm) {
      this.fxG.circle(center.x, center.y, base * 1.25).stroke({ width: 3 * l.scale, color, alpha: 1 - k });
      return;
    }
    this.fxG.circle(center.x, center.y, base * (1 + 1.6 * k)).stroke({ width: 4 * l.scale * (1 - k) + 1, color, alpha: 1 - k });
    if (b.kind !== "crown") return;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const r0 = base * (1 + k);
      const r1 = base * (1 + 1.9 * k);
      this.fxG.moveTo(center.x + Math.cos(a) * r0, center.y + Math.sin(a) * r0).lineTo(center.x + Math.cos(a) * r1, center.y + Math.sin(a) * r1);
    }
    this.fxG.stroke({ width: 3 * l.scale, color: COLORS.lime, alpha: 1 - k });
  }

  private drawLabels(r: RunnerState): void {
    const alive = new Set<number>();
    for (const label of r.fx.labels) {
      const p = this.unitPos.get(label.uid);
      if (!p) continue;
      alive.add(label.uid);
      let text = this.labelTexts.get(label.uid);
      if (!text) {
        text = new Text({ text: label.text, style: { ...FONT, fill: COLORS.ink, fontSize: this.labelSize() } });
        text.anchor.set(0.5, 1);
        this.labelTexts.set(label.uid, text);
        this.labelLayer.addChild(text);
      }
      text.position.set(p.x, p.y - 18 * this.layout.scale);
      text.alpha = 1 - label.ageMs / LABEL_MS;
    }
    for (const [uid, text] of this.labelTexts) {
      if (alive.has(uid)) continue;
      text.destroy();
      this.labelTexts.delete(uid);
    }
  }

  private drawHud(r: RunnerState): void {
    const { frame, scale, riverY } = this.layout;
    const s = r.curr;
    const { crowns, outcome } = resultOf(s);
    this.crownsText.text = `Crowns ${crowns}/3`;
    this.crownsText.position.set(frame.x + 12 * scale, frame.y + 10 * scale);
    const limit = s.phase === "overtime" ? OVERTIME_TICKS : REGULATION_TICKS;
    this.clockText.text = s.phase === "ended" ? "0:00" : formatClock((limit - s.phaseTick) / TICK_HZ);
    this.clockText.position.set(frame.x + frame.w - 12 * scale, frame.y + 10 * scale);
    this.bannerText.position.set(frame.x + frame.w / 2, riverY);
    if (s.phase === "overtime") {
      this.bannerText.text = "OVERTIME";
      this.bannerText.alpha = r.reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(r.timeMs / 160);
    } else if (s.phase === "ended") {
      this.bannerText.text = outcome.toUpperCase();
      this.bannerText.alpha = 1;
    } else {
      this.bannerText.text = "";
    }
  }
}
