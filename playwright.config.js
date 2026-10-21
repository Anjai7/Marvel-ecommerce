import { defineConfig, devices } from "@playwright/test";

const browserChannel =
  process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "chrome" : undefined);

// The API listens on PORT (default 5000) and Vite proxies /api to it, so a
// locally-run e2e suite exercises the real API. When the database schema is not
// applied the DB-dependent specs skip; the rest of the suite still runs.
const API_PORT = process.env.PORT || 5000;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }]],
  // Every page load fans out to ONE Express API process (content, settings,
  // menu, products), and each of those calls waits on a round trip to
  // Supabase. The default worker count is half the cores, so on a many-core
  // machine sixteen browsers queue behind one API and content assertions time
  // out for reasons that have nothing to do with the code under test. Six
  // workers still saturate the machine and keep the suite quick.
  workers: process.env.CI ? 2 : 6,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // A page load makes several API calls; under load they queue behind each
    // other. These assertions check WHAT is rendered, not how fast it arrives,
    // so give them room rather than making them flaky.
    expect: { timeout: 15000 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: [
    {
      // The API listens on PORT (default 5000) and Vite proxies /api to it, so a
      // locally-run e2e suite exercises the real API. When the database schema is
      // not applied the API still starts, the DB-backed specs skip with a reason,
      // and the rest of the suite still runs.
      command: "npm run api",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // The built app, not the dev server: the dev server transforms ~3000
      // modules on the first request and a parallel run against it times out
      // intermittently. `vite preview` also proxies /api to the API above.
      // The build is a separate step (`npm run test:e2e` runs it first) so
      // Playwright manages exactly one server process.
      command: "npm run preview -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
