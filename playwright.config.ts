import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  // The frame-time probe needs the CPU to itself: in parallel, WebKit's software WebGL starves Chromium's rAF.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone-14", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    // Current flagship on Safari's engine (WebKit), the closest headless stand-in for a real iPhone.
    { name: "iphone-17-pro", use: { ...devices["iPhone 17 Pro"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
