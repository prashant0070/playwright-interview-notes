# 14 — Parallelism, Sharding, Retries & Flakes

## Learning goals

Control Playwright execution safely, split suites across CI machines, interpret retries correctly, and remove flakes at their cause rather than normalizing them.

---

## 1. The execution model: workers and isolation

Playwright Test runs tests in **worker processes**. A worker has its own Node.js process and browser instance; each test normally receives a new isolated browser context. This prevents cookies and local storage leaking between tests, but it does **not** isolate shared databases, users, queues, files, or external services.

```ts
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,
});
```

- `workers`: maximum concurrent worker processes. The local default is based on available CPUs; choose an explicit lower value when the environment is constrained.
- `fullyParallel`: allows independent tests in the same file to run in different workers. Without it, files are distributed across workers, while tests within a file normally stay together.
- A failed test may cause Playwright to discard its worker before retrying, helping prevent contaminated process state.

More workers reduce elapsed time only until CPU, browser startup, test data, backend capacity, or rate limits become the bottleneck. Measure instead of blindly using the largest number.

---

## 2. Parallel and serial test groups

`test.describe` controls grouping:

```ts
import { test, expect } from '@playwright/test';

test.describe.parallel('independent preferences', () => {
  test('updates language', async ({ page }) => {
    await page.goto('/preferences');
    // uses isolated, unique test data
  });

  test('updates theme', async ({ page }) => {
    await page.goto('/preferences');
    // independent of the preceding test
  });
});
```

```ts
test.describe.serial('one irreversible workflow', () => {
  test('creates draft', async ({ page }) => { /* ... */ });
  test('submits draft', async ({ page }) => { /* relies on draft */ });
});
```

`serial` is an escape hatch, not a default design. If one serial test fails, subsequent tests in that group are skipped because their prerequisite may not exist. It also reduces parallel capacity and makes test order significant. Prefer each test creating the state it needs through APIs, fixtures, or factories.

At file scope, `test.describe.configure({ mode: 'parallel' })` and `{ mode: 'serial' }` are equivalent ways to set grouping behavior. Do not combine a parallel suite with shared mutable records.

---

## 3. Parallel-safe test design

Tests are parallel-safe when they can run in any order, with copies of the same test, without affecting one another.

```ts
import { test, expect } from '@playwright/test';

test('adds a unique item', async ({ page }, testInfo) => {
  const name = `item-${testInfo.parallelIndex}-${Date.now()}`;
  await page.goto('/items/new');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
});
```

Useful isolation patterns:

- Create data through an API and delete it in teardown.
- Use a unique value derived from `testInfo.parallelIndex`, test title, or a generated ID.
- Allocate one test account per worker with a worker-scoped fixture.
- Mock nondeterministic third-party dependencies.
- Avoid shared download paths and global mutable configuration.

`parallelIndex` identifies the parallel slot; it is useful for allocation, but a retry can run in a new worker. Do not use it as a durable database primary key.

---

## 4. Sharding: split one logical run across machines

Sharding partitions tests across independently running jobs:

```bash
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

Each command receives a distinct portion of discovered tests. Shards are separate processes/machines, so every shard needs the application, secrets, test data strategy, and browsers it requires. Sharding and workers compose: four shards with three workers each can run up to twelve worker processes overall.

Use sharding when one machine cannot deliver acceptable suite duration. First make the suite deterministic and avoid serial dependencies; a brittle suite only fails faster when distributed.

---

## 5. Blob reports and merging shard output

The `blob` reporter preserves results from each shard so a final job can create one combined report.

```ts
// playwright.config.ts
reporter: process.env.CI
  ? [['blob', { outputDir: 'blob-report' }]]
  : [['list'], ['html', { open: 'never' }]],
```

Each shard uploads its `blob-report` directory under a unique artifact name. A dependent merge job downloads all artifacts into one directory and runs:

```bash
npx playwright merge-reports --reporter html ./all-blob-reports
```

The merged HTML report has the whole run rather than four disconnected reports. Retain trace, screenshot, and video attachments with the blobs if failures must be investigated after jobs finish.

---

## 6. Retries: classification, not a cure

```ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  use: { trace: 'on-first-retry' },
});
```

Playwright classifies a test as:

- **passed**: passed on first attempt.
- **flaky**: failed, then passed on a retry.
- **failed**: exhausted all retries.

A retry protects developer feedback from a transient infrastructure event, but a flaky pass is evidence of a defect in the test, product, dependency, or environment. Track flaky outcomes separately, investigate promptly, and do not treat a green retried run as equally healthy as a first-pass run.

Good policy: zero retries locally for fast truth; one or two retries in CI with traces on retry; alert on flakes; periodically reduce retry count as reliability improves.

---

## 7. Repeat a test to expose nondeterminism

```bash
npx playwright test tests/checkout.spec.ts --repeat-each=20 --workers=1
npx playwright test --grep "@suspect" --repeat-each=50
```

`--repeat-each` runs every selected test N times. Start with `--workers=1` to distinguish a local timing issue from shared-state contention, then repeat with normal parallelism to reveal races. Add `--retries=0` while diagnosing so a passing retry does not hide the failure.

---

## 8. Flake root-cause catalog

| Symptom/cause | Evidence | Durable fix |
|---|---|---|
| Fixed sleeps | Tests pass only with `waitForTimeout` | Wait on a user-visible assertion, URL, response, or event. |
| Weak locator | Strict-mode errors or wrong element clicked | Use role/label/test-id locators scoped to meaningful containers. |
| Animation/overlay | Click intercepted or element unstable | Wait for the overlay to disappear; fix UI synchronization; reduce motion only if appropriate. |
| Shared data | Fails only under parallelism | Create isolated records/accounts and cleanup. |
| Event race | Popup/download/response missed | Begin `waitForEvent` or `waitForResponse` before the trigger. |
| Backend eventual consistency | UI arrives late unpredictably | Poll an observable product state or make the test seam deterministic. |
| External dependency | Third-party outages/rate limiting | Mock at the boundary or use a stable controlled substitute. |
| Environment saturation | Only CI fails under load | Reduce workers, provision capacity, or separate load from functional tests. |
| Time/locale state | Date/format assertions vary | Set timezone/locale and control clock/data. |
| Leaked state | Passes alone, fails in suite | Fresh contexts, cleanup, and no module-level mutable state. |

Capture trace, screenshot, video, console, and network evidence before changing timeouts. A longer timeout may alter the symptom while preserving the race.

---

## 9. Quarantine without hiding quality

Quarantine is a short-term containment measure for a confirmed, tracked flaky test. It must be visible and reversible.

```ts
test('@quarantined exports a report', async ({ page }) => {
  // Linked issue, owner, and removal condition belong in a nearby comment.
});
```

Exclude quarantined tests from the required gate:

```ts
grepInvert: /@quarantined/,
```

Then run them separately on a schedule and report failures. A responsible quarantine has an issue link, owner, expiration/review date, failure evidence, and a path back to the main suite. Do not permanently skip tests or turn an unstable test into `test.fixme()` without a tracking decision.

---

## 10. Interview Q&A

### Q1. What is a Playwright worker?
**A:** A worker is a separate process that runs tests and owns browser resources. Workers enable parallel execution, while browser contexts provide test-level web-session isolation.

### Q2. What does `fullyParallel` change?
**A:** It lets tests within the same file run in parallel. It should be enabled only when those tests do not depend on order or shared state.

### Q3. When is `serial` justified?
**A:** Only for a truly sequential workflow where splitting setup would be impractical. It reduces reliability and throughput, so independent tests are preferable.

### Q4. Sharding versus workers?
**A:** Workers parallelize within one machine/job. Sharding partitions the suite across multiple independent jobs or machines. They can be used together.

### Q5. Why use the blob reporter in sharded CI?
**A:** It records shard results in a format Playwright can merge into one unified report, including attached diagnostics.

### Q6. Is a retried pass a success?
**A:** The run may be usable, but the test is classified as flaky. It should be measured and investigated rather than accepted as normal.

### Q7. How do you investigate a flake?
**A:** Reproduce it with retries disabled and `--repeat-each`, vary worker count, inspect traces/logs/network, identify the race or shared dependency, then fix the synchronization or isolation.

### Q8. What makes a quarantine acceptable?
**A:** It is temporary, tracked, owned, excluded transparently from the gate, and exercised separately so it cannot disappear from visibility.

---

## Next

→ [15-visual-accessibility-and-mobile.md](./15-visual-accessibility-and-mobile.md)
