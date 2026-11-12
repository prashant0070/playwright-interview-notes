# 03 — Test Anatomy and Execution Model

## Learning goals

Understand how Playwright discovers and schedules tests, precisely when hooks
run, what a worker owns, and why independent tests are the prerequisite for
parallel execution and retries.

## 1. A test is a registered callback

Test files are evaluated to register `test()` and `test.describe()` calls. The
runner then selects tests by project/grep and executes their async callbacks.
Keep registration synchronous; do not fetch data or conditionally create tests
from asynchronous work at module scope.

```ts
import { test, expect } from '@playwright/test';

test('adds a TodoMVC item', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  await page.getByPlaceholder('What needs to be done?').fill('review hooks');
  await page.getByPlaceholder('What needs to be done?').press('Enter');
  await expect(page.getByRole('listitem')).toHaveText('review hooks');
});
```

The callback receives fixtures such as `page`; it is not executed when the
file is initially imported. A test title plus nested describe titles identify
the test in reports and are searchable with `--grep`.

## 2. Describe groups and hook order

`test.describe` groups related tests and can apply configuration or hooks. It
does not itself create isolation. Within one file/worker, the normal ordering
is:

```text
file evaluation → outer beforeAll
  → outer beforeEach → inner beforeEach → test body
  → inner afterEach  → outer afterEach
  ... repeat for next test ...
  → inner afterAll → outer afterAll
```

```ts
test.describe('TodoMVC', () => {
  test.beforeAll(async () => { /* suite setup in this worker */ });
  test.afterAll(async () => { /* suite teardown in this worker */ });

  test.beforeEach(async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus)
      await testInfo.attach('failure-url', { body: page.url() });
  });

  test('creates an item', async ({ page }) => { /* ... */ });
});
```

Use `beforeEach` for a per-test precondition. A failing `beforeEach` fails the
test; cleanup in `afterEach` should be defensive because the setup/test may
already have failed.

### The `beforeAll` per-worker nuance

`beforeAll` and `afterAll` run once per worker process **that executes tests
from that file/group**, not necessarily once for the entire CI run. If a worker
is restarted after a failure, the hooks can run again. In fully parallel mode,
separate workers can each run them. Never use `beforeAll` for a global,
single-use mutable resource unless it is made idempotent and safe across
workers. Use project/global setup deliberately, or provision worker-specific
data through a worker-scoped fixture.

## 3. Workers, files, and isolation

A worker is an OS process that runs test code. Workers are independent: they
do not share Node globals or browser contexts. Playwright can reuse worker
resources, while its built-in `context` and `page` fixtures are test-scoped.

```text
worker 1: browser → test A context/page → test B context/page
worker 2: browser → test C context/page → test D context/page
```

When a test fails, Playwright discards that worker and starts a new one before
continuing. This prevents leaked in-memory state from corrupting subsequent
tests, but means `beforeAll` may execute in the replacement worker.

Tests must not depend on execution order, earlier browser state, shared files,
or a common account. Those dependencies explain suites that pass with one
worker yet fail in CI.

## 4. Parallel and serial groups

Files may run in parallel by default. `fullyParallel: true` permits tests in a
file to run independently too. `test.describe.parallel` asks the runner to
execute tests in that group concurrently; every test must therefore have
independent data and setup.

```ts
test.describe.parallel('read-only pages', () => {
  test('home', async ({ page }) => { /* ... */ });
  test('help', async ({ page }) => { /* ... */ });
});
```

`test.describe.serial` forces ordered execution. If one test fails, later
tests in that group are skipped, and retries restart the group. It is
appropriate only for a genuinely indivisible workflow; a sequence of dependent
tests is usually an anti-pattern. Make the workflow one test, or seed each
test independently.

## 5. Modifiers, annotations, and tags

```ts
test.skip('known unsupported browser behaviour', async ({ page }) => {});
test.fixme('blocked by product defect', async ({ page }) => {});
test.fail('documents an expected failure', async ({ page }) => {});
test.slow('requires a documented longer budget', async ({ page }) => {});

test('@smoke renders example', async ({ page }) => {});
test('renders example', { tag: ['@smoke', '@public'] }, async ({ page }) => {});
```

`skip` does not test anything; attach a reason and avoid permanent skips.
`fixme` communicates an expected inability to run. `fail` inverts the
expected status: an unexpected pass is reported as a failure. `slow` triples
the test timeout, so use it for justified exceptional flows, not routine
slowness.

A title tag is text embedded in the title and can be found by grep. The `tag`
property is structured metadata (supported in modern Playwright Test) and is
also searchable with `--grep=@smoke`; it appears in `testInfo.tags`. Prefer
the property for machine-readable tagging, while retaining clear human titles.

## 6. Steps and timeout overview

`test.step` gives reports and traces meaningful phases:

```ts
await test.step('add an item', async () => {
  await page.getByPlaceholder('What needs to be done?').fill('learn steps');
  await page.getByPlaceholder('What needs to be done?').press('Enter');
});
```

Steps improve diagnosis; they do not create retries or transactions. Time
budgets form layers: test timeout covers the complete test/hooks; expect
timeout covers a retrying assertion; action/navigation timeouts constrain an
operation. Configuration and per-test overrides are covered in the next
modules. Avoid compensating for poor synchronization by raising every timeout.

## 7. Tutorial lab

```ts
test.describe('filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    for (const text of ['one', 'two']) {
      await page.getByPlaceholder('What needs to be done?').fill(text);
      await page.getByPlaceholder('What needs to be done?').press('Enter');
    }
  });

  test('@smoke completes one', async ({ page }) => {
    await test.step('complete first item', async () => {
      await page.getByRole('listitem').first().getByRole('checkbox').check();
    });
    await expect(page.getByRole('listitem').first()).toHaveClass(/completed/);
  });
});
```

Run once with normal workers and once with `--workers=1`. It should mean the
same thing in both runs. If it does not, locate the shared state.

## 8. Pitfalls

* Putting test data in mutable module globals shares it between tests in one
  worker and behaves differently with multiple workers.
* Reusing `page` from `beforeAll` breaks test isolation.
* Calling serial a “fix” only conceals shared-state coupling.
* Using hooks to hide long business workflows makes failure location obscure.
* Giving every test `slow` trades a useful failure signal for slower feedback.

## Interview Q&A

1. **When is a test callback executed?** After discovery and selection, by a
   worker; file-level registration occurs earlier.
2. **What is a worker?** An independent OS process that executes test code.
3. **Do workers share Node memory?** No.
4. **Why can `beforeAll` run more than once?** Each relevant worker runs it,
   and worker restart after failure can run it again.
5. **What does `beforeEach` suit?** A reliable precondition needed by every
   individual test.
6. **What happens after a test failure?** The worker is discarded so later
   tests run in a fresh worker.
7. **What does fully parallel mean?** Tests can be scheduled independently,
   including within a file where configured.
8. **When use serial mode?** Only for one inseparable ordered workflow; prefer
   independent tests.
9. **What is `test.step` for?** Readable reporting and trace grouping.
10. **`skip` versus `fixme`?** Skip deliberately omits a test; fixme marks it
    as not expected to run successfully, usually with a defect reason.
11. **What does `test.fail` prove?** A known failing behaviour; an unexpected
    pass is surfaced rather than silently accepted.
12. **How are title tags different from tag metadata?** Title tags are text;
    `tag` is structured metadata exposed to the runner and `testInfo`.
13. **Why shouldn't a test rely on a previous test?** Order, retries, shards,
    and parallel workers make that dependency invalid.
14. **What timeout includes hooks?** The test timeout; expectations/actions
    have their own narrower budgets.

---

Next: [04 — Locators deep dive](./04-locators-deep-dive.md)
