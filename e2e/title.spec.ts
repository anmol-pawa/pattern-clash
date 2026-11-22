import { expect, test } from "@playwright/test";

// Vercel Analytics / Speed Insights scripts only exist on Vercel; locally they 404.
const IGNORED = /_vercel\/(insights|speed-insights)|Failed to load resource/;

test("title screen renders, fits the viewport and logs no errors", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /pattern clash/i })).toBeVisible();
  const play = page.getByRole("button", { name: "Battle" });
  await expect(play).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const box = await play.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);

  await page.screenshot({ path: `test-results/title-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
