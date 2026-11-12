# 07 — Fixtures, Hooks, and TestInfo

## Learning goals

Understand Playwright Test's fixture-based dependency-injection model, choose appropriate fixture scope, use hooks deliberately, and use `TestInfo` for diagnostics and metadata.

---

## 1. Fixtures are Playwright Test's dependency injection system

A fixture is a named dependency that Playwright Test creates, provides to a test, and disposes at the correct time. Built-in fixtures include `page`, `context`, `browser`, `request`, `browserName`, and `baseURL`.

```ts
import { test, expect } from '@playwright/test';

test('uses built-in fixtures', async ({ page, context, request, baseURL }) => {
  await page.goto(baseURL!);
  await expect(page).toHaveTitle(/Example/);
  console.log(await context.cookies());
  console.log((await request.get('/health')).status());
});
```

The test callback declares what it needs. This is dependency injection: a test does not manually create a browser, context, and page. Playwright resolves and manages them.

Fixtures improve tests because they are typed, composable, lazily initialized, isolated by default, and have guaranteed teardown. A fixture that no test requests is normally not created.

---

## 2. Extend `test` to define custom fixtures

Create a project-level `test` by extending the built-in test object. Export it and import it from tests instead of importing directly from `@playwright/test`.

```ts
// tests/fixtures.ts
import { test as base, expect, type Page } from '@playwright/test';
import { SignInPage } from './pages/sign-in-page';

type AppFixtures = {
  signInPage: SignInPage;
  signedInPage: Page;
};

export const test = base.extend<AppFixtures>({
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },

  signedInPage: async ({ page }, use) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');

    await use(page);
  },
});

export { expect };
```

```ts
// tests/dashboard.spec.ts
import { test, expect } from './fixtures';

test('shows the dashboard', async ({ signedInPage }) => {
  await expect(signedInPage.getByRole('heading', { name: 'Dashboard' }))
    .toBeVisible();
});
```

Use a fixture when the dependency has setup, teardown, configuration, or needs to be reused across files. Do not create a fixture merely to wrap a one-line constructor with no lifecycle or configuration benefit.

---

## 3. The `use()` lifecycle

A fixture body has three phases:

1. Code before `await use(value)` is setup.
2. The value passed to `use` is available to the test and dependent fixtures.
3. Code after `use` is teardown.

```ts
type Fixtures = { temporaryDirectory: string };

export const test = base.extend<Fixtures>({
  temporaryDirectory: async ({}, use, testInfo) => {
    const directory = testInfo.outputPath('scratch');
    await fs.promises.mkdir(directory, { recursive: true });

    await use(directory);

    await fs.promises.rm(directory, { recursive: true, force: true });
  },
});
```

Conceptually, `use` behaves like the boundary in a `try/finally` block. Teardown runs after the test and after fixtures that depend on this fixture have finished. Put cleanup after `use`, not in the test body.

For a fixture with no value, call `await use()`:

```ts
auditLog: async ({}, use, testInfo) => {
  console.log(`Starting: ${testInfo.title}`);
  await use();
  console.log(`Finished: ${testInfo.status}`);
},
```

---

## 4. Fixture dependencies form a DAG

Fixtures can request other fixtures. Playwright builds a directed acyclic graph (DAG), starts dependencies before dependents, and tears them down in reverse dependency order.

```ts
type Fixtures = {
  account: { email: string; password: string };
  authenticatedPage: Page;
  ordersPage: OrdersPage;
};

export const test = base.extend<Fixtures>({
  account: async ({}, use) => {
    await use({ email: 'user@example.test', password: 'not-a-real-secret' });
  },

  authenticatedPage: async ({ page, account }, use) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await use(page);
  },

  ordersPage: async ({ authenticatedPage }, use) => {
    await use(new OrdersPage(authenticatedPage));
  },
});
```

Here, requesting `ordersPage` causes Playwright to resolve `account`, then `authenticatedPage`, then `ordersPage`. It does not initialize unrelated fixtures. Circular fixture dependencies are invalid.

---

## 5. Test-scoped versus worker-scoped fixtures

Fixture scope determines lifetime:

| Scope | Created | Shared by | Typical use |
|---|---|---|---|
| `test` (default) | for each test | no other test | pages, records, temporary data |
| `worker` | once per worker process | tests executed by that worker | expensive service client, unique worker account |

```ts
type WorkerFixtures = { workerUser: { email: string } };

export const test = base.extend<{}, WorkerFixtures>({
  workerUser: [async ({}, use, workerInfo) => {
    const user = { email: `worker-${workerInfo.workerIndex}@example.test` };
    await use(user);
  }, { scope: 'worker' }],
});
```

Worker scope is a performance tool, not permission to share mutable state carelessly. Tests may run in different workers, retries can use a new worker, and state changed by one test can affect the next test in the same worker. Prefer test-scoped data for mutable resources; use a worker-scoped unique identity when sharing is intentional.

---

## 6. Option fixtures: typed configuration that tests can override

An option fixture supplies a default and can be overridden in the config, a `describe`, or a test.

```ts
type Options = {
  role: 'reader' | 'editor';
};

export const test = base.extend<Options>({
  role: ['reader', { option: true }],
});
```

```ts
// playwright.config.ts
export default defineConfig({
  use: { role: 'editor' },
});

// A whole describe block:
test.describe('editor capabilities', () => {
  test.use({ role: 'editor' });
  test('can publish', async ({ role }) => {
    expect(role).toBe('editor');
  });
});
```

Options are useful for declarative variation such as locale, account role, feature mode, or an API base URL. Keep an option value descriptive rather than making it a bag of unrelated flags.

---

## 7. Automatic fixtures

An automatic fixture runs even if it is not listed in the test callback. It is appropriate for cross-cutting behavior such as logging, collecting diagnostics, or enforcing cleanup.

```ts
export const test = base.extend({
  testLogger: [async ({}, use, testInfo) => {
    console.log(`→ ${testInfo.title}`);
    await use();
    console.log(`← ${testInfo.status}`);
  }, { auto: true }],
});
```

Use automatic fixtures sparingly. Hidden setup makes execution harder to understand and can increase every test's cost. They should not silently perform business actions such as signing in as an administrator.

---

## 8. `TestInfo`: runtime facts and artifacts

`TestInfo` is the second argument to a test callback and to fixture functions. It describes the currently executing test attempt.

```ts
test('records useful evidence', async ({ page }, testInfo) => {
  console.log({
    title: testInfo.title,
    project: testInfo.project.name,
    retry: testInfo.retry,
    worker: testInfo.workerIndex,
    outputDir: testInfo.outputDir,
    tags: testInfo.tags,
  });

  await page.goto('/');
  await testInfo.attach('home-page', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
```

Useful members include:

- `title`, `file`, `line`, and `column` identify the test.
- `project` describes the active configured project.
- `retry` is zero for the first attempt and increases for retries.
- `outputDir` is the test attempt's output directory.
- `outputPath(...segments)` produces a path inside that directory.
- `status` and `expectedStatus` are useful during fixture teardown.
- `workerIndex` and `parallelIndex` help diagnose parallel execution.
- `tags` contains tags declared in the test title or details.

Use `testInfo.outputPath()` instead of a shared fixed filename so parallel tests cannot overwrite one another.

```ts
const logPath = testInfo.outputPath('browser-console.txt');
await fs.promises.writeFile(logPath, messages.join('\n'));
await testInfo.attach('browser-console', {
  path: logPath,
  contentType: 'text/plain',
});
```

### Attachments and annotations

Attachments appear in supported reporters such as the HTML report.

```ts
await testInfo.attach('request-payload', {
  body: JSON.stringify({ plan: 'monthly' }, null, 2),
  contentType: 'application/json',
});
```

Annotations add structured metadata:

```ts
test('requires external dependency', {
  annotation: { type: 'issue', description: 'Tracked by issue system' },
  tag: '@integration',
}, async ({ page }) => {
  await page.goto('/');
});
```

At runtime, a fixture may inspect or add annotations through `testInfo.annotations`. Tags are primarily test-selection metadata; annotations are explanatory metadata. Neither is a replacement for a clear test name.

---

## 9. Hooks: local sequencing tools

Hooks run code around tests in a file or `describe` block.

```ts
test.describe('profile settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/profile');
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('failure-screenshot', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });

  test('updates display name', async ({ page }) => {
    await page.getByLabel('Display name').fill('Avery');
    await page.getByRole('button', { name: 'Save' }).click();
  });
});
```

Available hooks are `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`. `beforeAll` and `afterAll` have lifecycle constraints under parallelism: they are not an isolated per-test setup mechanism. Do not use them to create state that every test mutates.

---

## 10. Hooks versus fixtures

Use hooks for concise setup that is clearly local to a file or feature. Use fixtures for reusable, typed, configurable dependencies with lifecycle management.

| Need | Better default |
|---|---|
| Open one route before tests in one describe | `beforeEach` |
| Reuse an authenticated page across many files | fixture or `storageState` |
| Create and clean isolated test data | fixture |
| Inject a page object | fixture |
| Add a one-off assertion after a test | `afterEach` |
| Capture diagnostics for every test | automatic fixture |

Avoid a large `beforeEach` that authenticates, seeds data, creates objects, and navigates through multiple screens. It hides dependencies and makes test variation difficult. Model those capabilities as fixtures instead.

---

## 11. Global setup versus fixtures

`globalSetup` is a config-level function that runs once for an entire invocation. Fixtures run inside the Playwright Test execution model.

| Concern | Global setup | Fixture |
|---|---|---|
| Lifetime | once per test run | test or worker |
| Test metadata/reporting | limited | integrated |
| Built-in `page` fixture | no | yes |
| Best use | external prerequisite/bootstrap | test dependencies and cleanup |

A setup project is often preferable when setup itself is test-like, needs browser fixtures, or should appear in reports. Authentication setup projects are a canonical example. Use `globalSetup` for run-wide tasks that do not naturally belong to a test project, such as starting an external local service.

---

## 12. Page objects as fixtures

Page objects represent UI behavior; fixtures construct and inject them.

```ts
import { type Page } from '@playwright/test';

export class SettingsPage {
  constructor(private readonly page: Page) {}

  readonly saveButton = this.page.getByRole('button', { name: 'Save changes' });

  async open() {
    await this.page.goto('/settings');
  }
}

type Fixtures = { settingsPage: SettingsPage };

export const test = base.extend<Fixtures>({
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});
```

The test remains explicit about behavior:

```ts
test('saves settings', async ({ settingsPage }) => {
  await settingsPage.open();
  await settingsPage.saveButton.click();
  await expect(settingsPage.saveButton).toBeEnabled();
});
```

---

## 13. Interview Q&A

### What is a Playwright fixture?

A fixture is a named, typed dependency with managed setup and teardown. Tests request it by destructuring it from the callback argument.

### Explain `await use(value)`.

It exposes `value` to the test and dependent fixtures. Code before it is setup; code after it is teardown, so it provides a reliable lifecycle boundary.

### What is the difference between test and worker scope?

Test-scoped fixtures are isolated for each test. Worker-scoped fixtures are created once per worker process and may be shared by tests assigned to that worker, so their state must be designed carefully.

### Why are fixtures better than a large `beforeEach`?

Fixtures are reusable across files, typed, composable through dependencies, lazily created, configurable, and can own teardown. A local hook is still simpler for small local setup.

### When would you use an automatic fixture?

For truly cross-cutting work such as diagnostics or logging that every test needs. I would avoid using it for hidden functional setup because it obscures what a test depends on.

### How are fixture dependencies resolved?

Playwright builds a dependency graph, initializes prerequisites first, initializes only requested fixtures except automatic ones, and tears down in reverse dependency order.

### What are option fixtures?

They are fixtures declared with `{ option: true }`. Their values can be overridden from config or with `test.use`, making environment or role variation typed and declarative.

### What can `TestInfo` provide?

It provides the current title, project, retry number, worker information, output directory, status, annotations, tags, and attachment APIs. It is especially useful for per-attempt artifacts.

### How would you capture evidence only when a test fails?

Use an `afterEach` hook or fixture teardown, compare `testInfo.status` with `testInfo.expectedStatus`, then save and attach a screenshot, logs, or other diagnostics.

### When should global setup be used instead of fixtures?

Use global setup for an invocation-wide external prerequisite. For dependencies that need a page, test metadata, reporter visibility, or per-worker/per-test lifecycle, use fixtures or a setup project.

---

## Next

→ [08-browser-context-page-and-multi-tab.md](./08-browser-context-page-and-multi-tab.md)
