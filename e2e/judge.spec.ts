import { expect, test } from "@playwright/test";

const BARE_SOLUTION = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};
`;

// The toolchain is ~100 MB and a cold compile takes several seconds; one browser project is enough.
test.describe.configure({ timeout: 240_000 });

test("dev judge compiles, runs and judges pair-sum in workers", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "toolchain smoke runs once, in desktop Chromium");

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/dev/judge");
  const log = page.locator("#log");

  await page.locator("#go").click();
  await expect(log).toContainText("compile OK", { timeout: 200_000 });
  await expect(log).toContainText("run ok");
  await expect(log).toContainText("0 1");

  await page.getByLabel("source").fill(BARE_SOLUTION);
  await page.locator("#judge").click();
  await expect(log).toContainText("verdict AC", { timeout: 120_000 });

  await page.screenshot({ path: `test-results/judge-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
