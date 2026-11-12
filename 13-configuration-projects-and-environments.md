# 13 — Configuration, Projects & Environments

## Learning goals

Configure Playwright Test deliberately: understand every high-value `defineConfig` option, model browsers and environments with projects, and keep local and CI behavior predictable.

---

## 1. Why configuration matters

`playwright.config.ts` is the runner's contract. It answers:

- Where are tests and artifacts?
- Which browsers and device profiles run?
- What URLs, timeouts, retries, and reporters apply?
- What must start or run before the suite?

Keep it declarative. Prefer projects and environment variables over `if` statements inside tests.

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

`defineConfig` is not required at runtime, but it gives TypeScript validation and editor completion. It is the recommended form.

---

## 2. High-value `defineConfig` options catalog

| Option | Purpose | Practical guidance |
|---|---|---|
| `testDir` | Test discovery root | Use one clear root, such as `./tests`. |
| `testMatch` / `testIgnore` | Include/exclude file patterns | Keep generated and helper files out of discovery. |
| `outputDir` | Per-test artifacts | Gitignore it; never rely on it as a permanent archive. |
| `timeout` | Whole-test time limit | Keep it realistic; increase only for known slow workflows. |
| `expect.timeout` | Web-first assertion limit | Usually shorter than test timeout. |
| `actionTimeout` | Default action limit | Optional; use when actions must fail fast. |
| `navigationTimeout` | Default navigation limit | Useful when navigation has distinct SLOs. |
| `fullyParallel` | Parallelizes tests within a file | Requires isolated data and state. |
| `workers` | Number of worker processes | Limit constrained environments; omit locally for the default. |
| `retries` | Re-run failed tests | Diagnostic safety net, not a reliability fix. |
| `forbidOnly` | Rejects focused tests | Enable in CI to prevent accidental partial runs. |
| `maxFailures` | Stops after N failures | Useful to save CI capacity during widespread outages. |
| `reporter` | Result output | Use multiple reporters when machines and humans need different formats. |
| `projects` | Named test configurations | Model browsers, devices, setup, or suites. |
| `use` | Default fixture options | Browser/context/page defaults, inherited by projects. |
| `webServer` | Starts an app for tests | Good for local app-under-test lifecycles. |
| `globalSetup` / `globalTeardown` | One-time script hooks | Use for runner-wide external preparation/cleanup. |
| `grep` / `grepInvert` | Filters by test title/tag | Useful for focused suites, but preserve a full-suite job. |

CLI arguments can override many values: `--project=chromium`, `--workers=1`, `--grep @smoke`, and `--retries=0`.

---

## 3. `use`: browser, context, and page defaults

`use` sets fixture options inherited by every project and test unless overridden.

```ts
use: {
  baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
  headless: true,
  viewport: { width: 1440, height: 900 },
  locale: 'en-US',
  timezoneId: 'UTC',
  colorScheme: 'light',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
  ignoreHTTPSErrors: false,
}
```

Common `use` options:

- `browserName`, `channel`, and `launchOptions`: browser selection and launch behavior.
- `viewport`, `deviceScaleFactor`, `isMobile`, `hasTouch`: emulated device characteristics.
- `locale`, `timezoneId`, `geolocation`, `permissions`: deterministic regional/browser state.
- `storageState`, `extraHTTPHeaders`, `httpCredentials`: authenticated/request state.
- `baseURL`: resolves relative `page.goto()` URLs and `request` URLs.
- `trace`, `video`, `screenshot`: diagnostic artifact policy.

Do not put credentials directly in this file. Read them from the environment and fail with a helpful error if a required value is absent.

---

## 4. Projects: a test matrix, not duplicate configs

A project is a named configuration overlay. It inherits top-level settings and overrides only what differs.

```ts
export default defineConfig({
  use: { baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
```

Run a single project with `npx playwright test --project=webkit`; omit `--project` to run all configured projects.

Projects can also represent setup dependencies or suite slices:

```ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'authenticated-chromium',
    dependencies: ['setup'],
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/user.json',
    },
  },
]
```

Avoid multiplying every browser by every environment in one routine run unless that coverage is intentional; matrices grow quickly and hide slow feedback.

---

## 5. `baseURL` and generic environment strategy

With `baseURL`, use relative paths:

```ts
await page.goto('/account');
await page.getByRole('button', { name: 'Save' }).click();
```

Centralize configuration parsing so invalid environment input fails early:

```ts
// tests/support/env.ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export const env = {
  baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
  apiToken: process.env.API_TOKEN, // optional in tests that do not need it
  adminUser: process.env.ADMIN_USER,
  adminPassword: process.env.ADMIN_PASSWORD,
  require,
};
```

Use `process.env` as the source of deployment-specific values; inject them from the shell, CI secret store, or a local ignored `.env` loader if your project chooses one. Validate URLs, booleans, and numeric values rather than assuming strings are correct. Never commit real secret values or generated storage-state files.

---

## 6. Tags, `grep`, and `grepInvert`

Tags are ordinary text in titles, so they remain visible in reports:

```ts
import { test, expect } from '@playwright/test';

test('@smoke a user can open the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Home/);
});

test('@visual page header matches baseline', async ({ page }) => {
  // ...
});
```

Configure a project or run from the CLI:

```ts
grep: /@smoke/,
grepInvert: /@quarantined/,
```

```bash
npx playwright test --grep "@smoke"
npx playwright test --grep-invert "@quarantined"
```

`grep` and `grepInvert` combine: the title must match `grep` and must not match `grepInvert`. Filtering is valuable for fast feedback, but scheduled full coverage should not quietly exclude work forever.

---

## 7. `webServer`

Use `webServer` when Playwright should start a local application and wait for it to become reachable.

```ts
webServer: {
  command: 'npm run dev',
  url: 'http://127.0.0.1:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  stdout: 'pipe',
  stderr: 'pipe',
},
```

`url` is the readiness check. `reuseExistingServer` makes local iteration convenient but should normally be false in CI so a run is isolated. For multiple services, supply an array of server definitions.

---

## 8. Global setup and teardown

`globalSetup` runs once before all projects; `globalTeardown` runs once after them. Each points to a module exporting a default async function.

```ts
// playwright.config.ts
globalSetup: require.resolve('./tests/support/global-setup'),
globalTeardown: require.resolve('./tests/support/global-teardown'),
```

```ts
// tests/support/global-setup.ts
import type { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  console.log(`Running against ${config.projects[0].use.baseURL}`);
  // Create a short-lived test resource or validate required configuration.
}
```

Use these hooks for runner-wide work that does not belong to a test project. Prefer a setup project when the preparation is itself test-like (for example, generating `storageState`): it appears in reports and participates in project dependencies. Put cleanup in `finally`-safe paths; teardown is not a substitute for tests that must clean up their own resources.

---

## 9. Reporters

Reporters can run together:

```ts
reporter: [
  ['list'],
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ['junit', { outputFile: 'test-results/junit.xml' }],
  ['blob', { outputDir: 'blob-report' }],
],
```

- `list`, `line`, and `dot`: terminal feedback.
- `html`: interactive report for people; includes attachments.
- `junit`: XML for CI systems that ingest test cases.
- `json`: machine-readable custom processing.
- `blob`: shard-friendly compressed result format; merge later with `npx playwright merge-reports --reporter html blob-report`.

Keep artifact directories ignored by Git and upload them in CI only when useful.

---

## 10. Local versus CI patterns

Use CI detection for behavior, not for hidden business logic:

```ts
const isCI = !!process.env.CI;

export default defineConfig({
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  forbidOnly: isCI,
  reporter: isCI
    ? [['blob'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
  },
});
```

CI should be reproducible: install with the lockfile, pin browser/tooling versions, set explicit `BASE_URL`, and retain evidence for failures. Local settings should optimize diagnosis, not silently change the product under test.

---

## Interview Q&A

### Q1. What does `defineConfig` provide?
**A:** It is Playwright's typed configuration helper. It validates options and makes the config easier to maintain; it does not create a separate runtime configuration system.

### Q2. How do projects differ from environments?
**A:** A project is a named Playwright configuration overlay, often a browser or device. An environment is usually supplied through values such as `BASE_URL` and secrets. They can be combined, but should not be confused.

### Q3. Why use `baseURL`?
**A:** Tests can navigate with relative paths, avoiding repeated hostnames and making the target deployable through environment configuration.

### Q4. When would you use `globalSetup` instead of a setup project?
**A:** Use global setup for runner-wide scripting. Use a setup project for preparation that benefits from test fixtures, project dependencies, and visibility in the test report.

### Q5. What is the risk of `reuseExistingServer`?
**A:** A developer's stale server can make tests run against unexpected code. It is convenient locally but generally not appropriate for isolated CI jobs.

### Q6. How should secrets reach tests?
**A:** Inject them through environment variables from a secret manager or CI platform, validate presence at runtime, and keep them out of config files, logs, reports, and Git.

### Q7. What is the best reporter for sharded runs?
**A:** `blob` is designed for this. Each shard produces a blob report, then a final job merges all blobs into one HTML or other report.

### Q8. Should every project run in every pull request?
**A:** Not necessarily. Run a fast, representative gate on pull requests and schedule broader browser/device coverage based on risk and feedback-time requirements.

---

## Next

→ [14-parallelism-sharding-retries-and-flakes.md](./14-parallelism-sharding-retries-and-flakes.md)
