import { expect, test, type Page } from "@playwright/test";
import { PAIR_TO_TARGET as P } from "../lib/stages/demoProblem";

test.describe.configure({ timeout: 120_000 });

const stage = (page: Page, name: string) => expect(page.locator(`main[data-stage=${name}]`)).toBeVisible();
const pick = (page: Page, legend: string, option: string) =>
  page.getByRole("group", { name: legend }).getByRole("button", { name: option, exact: true }).click();

test("one problem plays end to end: scout, brute, build, prove, explain, overtime, results", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/_vercel|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const shot = (name: string) => page.screenshot({ path: `test-results/battle-${info.project.name}-${name}.png`, fullPage: false });

  await page.goto("/");
  await page.getByRole("link", { name: "Battle" }).click();
  await stage(page, "scout");
  await page.waitForSelector("[data-ready=true]");
  await expect(page.getByRole("heading", { name: P.title })).toBeVisible();
  await shot("scout");

  // Scout: play the right pattern card from the hand.
  await page.getByRole("button", { name: /^Hashing, costs/ }).click();
  await stage(page, "brute");
  await pick(page, P.brute.prompt, P.brute.options[P.brute.answer]);

  // Build: tap each component's lines into order, answer its why, move on.
  await stage(page, "build");
  for (const [i, comp] of P.components.entries()) {
    for (const line of comp.lines) {
      await page.getByRole("group", { name: "Lines to place" }).getByRole("button", { name: line.trim(), exact: true }).click();
    }
    if (i === 2) await shot("build");
    await pick(page, comp.why.prompt, comp.why.options[comp.why.answer]);
    await expect(page.getByText("Clean build")).toBeVisible();
    await page.getByRole("button", { name: i === P.components.length - 1 ? "Run samples" : "Next component" }).click();
  }

  // Prove and explain.
  await stage(page, "prove");
  const { time, space, derivation } = P.complexity;
  await pick(page, time.prompt, time.options[time.answer]);
  await pick(page, space.prompt, space.options[space.answer]);
  await pick(page, derivation.prompt, derivation.options[derivation.answer]);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Explain your approach in under a minute").fill("One pass. Map each seen value to its index and look up target minus the current value before inserting it.");
  await pick(page, "How sure are you?", "Fairly sure");
  await page.getByRole("button", { name: "Show model answer" }).click();
  await page.getByRole("checkbox", { name: "Approach" }).check();
  await page.getByRole("checkbox", { name: "Time and space" }).check();
  await shot("prove");
  await page.getByRole("button", { name: "Submit" }).click();

  // Overtime follow-ups.
  await stage(page, "overtime");
  for (const f of P.followups) await pick(page, f.prompt, f.options[f.answer]);

  await stage(page, "results");
  await expect(page.getByText("MASTERED · 3/3 crowns")).toBeVisible();
  await expect(page.getByText(`${P.followups.length}/${P.followups.length}`)).toBeVisible();
  await shot("results");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("an unknown battle slug shows the not-found page", async ({ page }) => {
  // With Cache Components the shell may already be streaming (200) when notFound() runs, so check what renders.
  await page.goto("/battle/no-such-problem");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.locator("main[data-stage]")).toHaveCount(0);
});
