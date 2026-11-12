# 02 — Installation, CLI, and Project Setup

## Learning goals

Install Playwright correctly, understand browser binaries versus npm packages,
create a maintainable TypeScript project, and run/debug a focused subset with
the CLI. You should be able to explain every common CI install command.

## 1. Bootstrap a project

From an empty directory, run:

```bash
npm init playwright@latest
```

The generator can create a TypeScript configuration, example test, GitHub
Actions workflow, and install supported browser binaries. It installs
`@playwright/test` as a development dependency and creates `playwright.config.ts`.

For an existing Node project:

```bash
npm install -D @playwright/test
npx playwright install
```

The npm package contains Node code and the test runner; browser executables are
downloaded separately. That separation keeps the package manageable and lets
one installed Playwright version select matching browser revisions.

```text
package-lock.json / node_modules     -> runner and Node API
Playwright browser cache             -> Chromium, Firefox, WebKit binaries
playwright.config.ts                 -> test policy and projects
tests/*.spec.ts                      -> discovered test files
```

Do not copy browser cache directories between arbitrary Playwright versions.
Use the install command under the lockfile-resolved version instead.

## 2. Browser installation and paths

```bash
npx playwright install                 # all default supported browsers
npx playwright install chromium        # only one browser
npx playwright install --with-deps     # browser plus Linux system dependencies
npx playwright install-deps            # Linux system dependencies only
```

`--with-deps`/`install-deps` are intended primarily for supported Linux CI
images. They may require elevated system package permission. On a managed CI
image, prefer the official Playwright Docker image or make the image install
these prerequisites once.

`PLAYWRIGHT_BROWSERS_PATH` chooses where Playwright stores or looks up its
browsers:

```bash
# Store binaries locally in this project during installation.
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install

# Use an explicit shared cache location.
PLAYWRIGHT_BROWSERS_PATH="$HOME/pw-browsers" npx playwright install chromium
```

Use the same setting when installing and running. A project-local cache can
make a hermetic build; a shared CI cache can speed installs, provided its cache
key includes OS, architecture, lockfile, and Playwright version.

## 3. Recommended layout

```text
.
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── tests/
│   ├── smoke.spec.ts
│   └── example.spec.ts
├── test-results/             # generated; normally ignored
└── playwright-report/        # generated; normally ignored
```

Keep tests close to the behaviour they prove. The runner discovers files
matching `testMatch` (by default, common `*.spec.*`/`*.test.*` conventions);
`testDir` defines their root. Avoid importing executable test files from other
test files: discovery plus imports can register tests twice.

## 4. TypeScript configuration

Playwright can compile TypeScript tests without a separate build step, but a
`tsconfig.json` gives editors and tooling a shared contract:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "@playwright/test"]
  },
  "include": ["tests", "playwright.config.ts"]
}
```

Choose module settings compatible with the project's Node/package setup. Do
not add `types` casually: specifying it restricts globally included type
packages. `strict` catches unsafe optional values and incorrectly typed
fixtures before a browser run.

## 5. Minimal configuration

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'https://demo.playwright.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

Projects are independent variants of the same suite. A project can set a
browser, device, locale, permissions, storage state, or base URL. Do not use
projects merely as a naming convention: every selected project multiplies test
executions and therefore CI time.

## 6. CLI: essential commands and flags

```bash
npx playwright test                         # run configured projects
npx playwright test tests/cart.spec.ts      # one file
npx playwright test -g "checkout"           # title regex grep
npx playwright test --project=chromium      # one project
npx playwright test --headed                # show browser window
npx playwright test --debug                  # Inspector; headed, serial-style debugging
npx playwright test --ui                     # interactive UI Mode
npx playwright test --workers=1              # constrain concurrency
npx playwright test --retries=2              # override retry policy
npx playwright test --repeat-each=10         # expose intermittent failures
npx playwright test --shard=1/3              # execute one CI shard
npx playwright test --grep=@smoke            # tests carrying a tag
npx playwright test --grep-invert=@slow      # exclude matching tests
npx playwright test --list                   # list discovered tests, do not run
npx playwright test --last-failed            # run prior failures
npx playwright test --trace=on               # collect traces for this run
npx playwright test --reporter=line          # temporary reporter override
npx playwright show-report                   # open HTML report
npx playwright show-trace test-results/.../trace.zip
npx playwright codegen https://example.com   # exploratory locator generation
```

`-g` and `--grep` are aliases for title/tag regular-expression filtering; use
quotes because shells interpret special characters. CLI flags override related
configuration for that invocation, which is useful for diagnosis but should
not become permanent undocumented CI policy.

## 7. Package scripts

Scripts make repeatable commands discoverable:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:chromium": "playwright test --project=chromium",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "report": "playwright show-report"
  }
}
```

Use `npm run test:e2e`, not a globally installed Playwright. `npm exec
playwright` and `npx playwright` resolve the local, lockfile-controlled
version.

## 8. Bundled browsers versus channels

`npx playwright install` downloads Playwright's tested browser builds. This is
the default for reproducibility. A **channel** requests an installed branded
browser, commonly Chrome or Edge:

```ts
projects: [
  { name: 'playwright-chromium', use: { browserName: 'chromium' } },
  { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  { name: 'msedge', use: { browserName: 'chromium', channel: 'msedge' } },
];
```

Channels help validate a release browser used by customers, but their version
changes outside your lockfile. Keep at least one bundled-browser project for
stable, supported automation coverage. Do not confuse `channel: 'chrome'`
with the open-source Chromium binary.

## 9. CI installation pattern

CI should use a clean install and then install matching browsers:

```bash
npm ci
npx playwright install --with-deps
npx playwright test
```

For non-Linux runners, `npx playwright install` is generally the appropriate
browser step. Cache npm and, if justified, the browser path; never cache
`node_modules` across incompatible runtime/lockfile contexts. Upload the HTML
report and `test-results` on failure so diagnostics survive the ephemeral job.

## 10. Tutorial lab

1. Run `npm init playwright@latest`.
2. Replace the sample spec with:

```ts
import { test, expect } from '@playwright/test';

test('@smoke page title', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
});
```

3. Run `npx playwright test --project=chromium --headed`.
4. Run `npx playwright test --grep=@smoke --trace=on`.
5. Open the report with `npx playwright show-report`.

## 11. Pitfalls

* Installing the package but not browsers causes launch errors.
* A global CLI can run a different Playwright version from the project.
* `--headed` is for observation, not a correctness fix.
* `--workers=1` can hide shared-state defects; restore parallelism after
  diagnosis.
* Browser cache configuration must be consistent between installation and run.
* `codegen` is a starting point; review generated locators for accessibility
  and resilience before committing them.

## Interview Q&A

1. **What does `npm init playwright@latest` do?** It scaffolds a Playwright
   Test project and can install browser binaries.
2. **Why run `playwright install` after adding the dependency?** Browser
   executables are separate from the npm package.
3. **What is `PLAYWRIGHT_BROWSERS_PATH` for?** Controlling the browser cache
   location; installation and execution must agree on it.
4. **What is the CI purpose of `--with-deps`?** It installs supported browser
   binaries and required Linux system libraries.
5. **What is a project?** A named configuration variant that executes selected
   tests with specific browser/device/options.
6. **Bundled browser or channel?** Bundled builds are version-pinned with
   Playwright; a channel targets a locally installed branded browser.
7. **How do you run a single file?** `npx playwright test path/to/file.spec.ts`.
8. **How do you filter tests?** `--grep`/`-g` for a regex, and
   `--grep-invert` to exclude matches.
9. **What does `--shard=2/4` mean?** Execute the second deterministic slice of
   a four-way distributed test run.
10. **Why use `npm ci` in CI?** It installs the lockfile-resolved dependency
    tree reproducibly.
11. **What does `--list` help diagnose?** Test discovery and filtering without
    running browser tests.
12. **Why keep scripts in package.json?** They make standard local and CI
    entry points explicit and version-controlled.
13. **When use UI Mode versus `--debug`?** UI Mode supports iterative test
    exploration; `--debug` pauses execution in the Inspector.
14. **What should CI retain on failures?** Report, trace, screenshot/video if
    enabled, and test-result artifacts.

---

Next: [03 — Test anatomy and execution model](./03-test-anatomy-and-execution-model.md)
