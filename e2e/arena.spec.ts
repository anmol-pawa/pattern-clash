import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

/** Sample rAF intervals for `frames` frames; returns [median, p95] in ms. */
async function frameTimes(page: Page, frames: number): Promise<[number, number]> {
  const deltas = await page.evaluate(
    (n) =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = performance.now();
        const tick = (t: number) => {
          out.push(t - last);
          last = t;
          if (out.length < n) requestAnimationFrame(tick);
          else resolve(out.slice(5)); // drop warm-up frames
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
  const sorted = deltas.slice().sort((a, b) => a - b);
  return [sorted[Math.floor(sorted.length / 2)], sorted[Math.floor(sorted.length * 0.95)]];
}

async function waitForTick(page: Page, tick: number, timeout = 40_000) {
  await page.waitForFunction(
    (t) => Number(document.querySelector("[data-tick]")?.getAttribute("data-tick") ?? 0) >= t,
    tick,
    { timeout },
  );
}

test("arena renders the demo battle at 60 fps and fits the viewport", async ({ page, browserName }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  await page.goto("/dev/sim");
  await page.waitForSelector("[data-ready=true]");
  await waitForTick(page, 60);

  const [median, p95] = await frameTimes(page, 125);
  info.annotations.push({ type: "frame-time", description: `median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms` });
  if (browserName === "webkit") {
    // Headless WebKit on Windows draws WebGL in software (no GPU), so it cannot stand in for a real iPhone's
    // frame rate; record it and only require that the arena is animating. Real-device fps is the P0.6 check.
    expect(median).toBeLessThan(100);
  } else {
    expect(median).toBeLessThan(17.5);
    expect(p95).toBeLessThan(25);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.getByRole("button", { name: "Restart" }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  // Mid-battle: units walking, labels up, left tower down, right tower taking sample hits.
  await waitForTick(page, 312);
  await page.screenshot({ path: `test-results/arena-${info.project.name}-mid.png` });
  await page.waitForSelector("[data-phase=ended]", { timeout: 40_000 });
  await page.screenshot({ path: `test-results/arena-${info.project.name}-end.png` });
  expect(errors).toEqual([]);
});

test("reduced motion is on by default when the system asks for it", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "one project is enough for the media query");
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${info.project.use.baseURL}/dev/sim`);
  await expect(page.locator("[data-reduced]")).toHaveAttribute("data-reduced", "true");
  await expect(page.getByRole("checkbox", { name: "Reduced motion" })).toBeChecked();
  await context.close();
});
