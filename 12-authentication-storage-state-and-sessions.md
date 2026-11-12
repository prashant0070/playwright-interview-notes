# 12 — Authentication, Storage State, and Sessions

## Learning goals

Reuse authenticated browser state with Playwright's official setup-project pattern, model roles and guest sessions safely, and design authentication for parallel execution.

---

## 1. Why authentication needs a test strategy

Logging in through the UI at the beginning of every test is sometimes appropriate, but it is often slow and fragile. It may depend on redirects, email, multi-factor verification, rate limits, or test accounts whose state changes.

The goal is not to skip authentication coverage. Keep focused login tests. For tests whose purpose is an authenticated feature, reuse an authenticated browser state so they can spend time proving that feature.

---

## 2. What `storageState` saves

`BrowserContext.storageState()` saves the session state that Playwright can restore in a future browser context. It includes cookies and origin storage, including local storage. This commonly restores cookie-based authenticated sessions.

```ts
await page.context().storageState({
  path: 'playwright/.auth/user.json',
});
```

Restore it through the project or a new context:

```ts
test.use({ storageState: 'playwright/.auth/user.json' });

const context = await browser.newContext({
  storageState: 'playwright/.auth/user.json',
});
```

Storage state is sensitive: it can contain credentials equivalent to a logged-in session. Keep it out of source control and do not attach it to public logs or reports.

```gitignore
playwright/.auth/
```

---

## 3. The official setup-project pattern

Playwright's recommended pattern is a setup project that authenticates and writes a state file. Other projects declare a dependency on it.

```ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

The dependency makes the runner execute the setup project first. Unlike a standalone script, it participates in Playwright reporting and uses normal Playwright Test fixtures.

---

## 4. Setup project versus `globalSetup`

Both can prepare a session, but they fit different jobs.

| Characteristic | Setup project | `globalSetup` |
|---|---|---|
| Uses Playwright Test fixtures | yes | no |
| Appears in test reporting | yes | no |
| Project dependencies/order | yes | no |
| Best for | browser authentication and test prerequisites | run-wide external bootstrap |

For browser authentication, prefer a setup project because the login flow is naturally a Playwright test operation. Use `globalSetup` for run-wide work that does not need a test project's browser fixtures, such as starting an external dependency.

---

## 5. Authentication expiry and validation

A storage file is a snapshot. Cookies can expire, be revoked, or be invalid for a different environment. Generate state per run or at a controlled interval rather than committing a long-lived state file.

The setup test should wait for a clear sign of successful authentication before saving state. A URL change alone may be insufficient when an application redirects through several pages or displays an error in the final route.

```ts
await page.waitForURL('**/dashboard');
await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
await page.context().storageState({ path: authFile });
```

If a session fails in CI, fail with a focused authentication diagnostic rather than allowing every dependent feature test to fail ambiguously.

---

## 6. Multiple roles with projects

Generate a separate state file for each role and assign it to a dedicated project.

```ts
projects: [
  { name: 'setup-user', testMatch: /user\.setup\.ts/ },
  { name: 'setup-admin', testMatch: /admin\.setup\.ts/ },
  {
    name: 'user-chromium',
    dependencies: ['setup-user'],
    use: { storageState: 'playwright/.auth/user.json' },
  },
  {
    name: 'admin-chromium',
    dependencies: ['setup-admin'],
    use: { storageState: 'playwright/.auth/admin.json' },
  },
],
```

Run role-specific tests with project selection or annotations. Keep the role visible in the project name and test design; avoid an opaque “current user” global that makes permissions unclear.

---

## 7. A fresh guest state

Guest tests should not inherit a signed-in state. Declare an empty storage state explicitly:

```ts
test.use({
  storageState: { cookies: [], origins: [] },
});

test('guest sees sign-in call to action', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});
```

You can also model guests as a separate project with no `storageState` configured. Explicitly clearing the state is useful when a file-level default may otherwise inject authentication.

---

## 8. Cookie injection as a generic technique

When a test obtains valid session cookies through an approved setup mechanism, it can inject them into a context before navigation.

```ts
await context.addCookies([{
  name: 'session',
  value: process.env.TEST_SESSION_COOKIE!,
  domain: 'example.test',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
}]);

const page = await context.newPage();
await page.goto('https://example.test/account');
```

This is fast but has trade-offs: cookies expire, their domain and security attributes must match, and authentication may also require local storage, CSRF state, or redirects. Prefer a storage-state setup project when it reflects the real browser session more completely.

---

## 9. Testing with OTP or multi-factor authentication

Do not automate a production-like MFA challenge by scraping a real user's phone or trying to bypass security controls. Use a safe, supported test strategy:

1. Dedicated test accounts with a controlled test-only verification path.
2. A test email inbox or authenticator mechanism approved for non-production environments.
3. A backend test seam that supplies a known verification code only in the test environment.
4. Mock the verification endpoint for UI behavior tests, while keeping separate integration coverage.

The chosen method should be documented, access-controlled, and limited to non-production testing. The test should still cover the UX around valid, invalid, expired, and cancelled verification where that behavior matters.

---

## 10. Parallel user isolation is more than browser isolation

Contexts isolate browser cookies and local storage, but they do not isolate shared server-side records. Two parallel tests using the same account can overwrite a profile, consume the same inventory, or conflict over a single workflow.

Safer patterns:

- Create a unique user or resource per test via API.
- Allocate one distinct account per worker with a worker-scoped fixture.
- Reserve and release a test account through a controlled allocator.
- Use immutable or read-only seeded data where possible.
- Clean up state created by the test in fixture teardown.

```ts
type WorkerFixtures = { account: { email: string; password: string } };

export const test = base.extend<{}, WorkerFixtures>({
  account: [async ({}, use, workerInfo) => {
    const account = await createOrAcquireTestAccount(workerInfo.workerIndex);
    try {
      await use(account);
    } finally {
      await releaseTestAccount(account);
    }
  }, { scope: 'worker' }],
});
```

Worker-scoped accounts reduce collisions within a worker, but tests in the same worker must still avoid destructive shared state or reset it deliberately.

---

## 11. Authentication in a multi-user test

Role-specific projects are ideal for independent tests. One scenario that requires two people interacting needs two contexts.

```ts
test('recipient receives a shared item', async ({ browser }) => {
  const sender = await browser.newContext({
    storageState: 'playwright/.auth/sender.json',
  });
  const recipient = await browser.newContext({
    storageState: 'playwright/.auth/recipient.json',
  });

  try {
    const senderPage = await sender.newPage();
    const recipientPage = await recipient.newPage();

    await senderPage.goto('/items/42');
    await senderPage.getByRole('button', { name: 'Share' }).click();

    await recipientPage.goto('/shared-with-me');
    await expect(recipientPage.getByText('Item 42')).toBeVisible();
  } finally {
    await Promise.all([sender.close(), recipient.close()]);
  }
});
```

Never open the sender and recipient in two pages of one context. They would share a single session and cannot prove authorization behavior.

---

## 12. Interview Q&A

### How do you avoid logging in before every test?

Authenticate once in a Playwright setup project, save `storageState`, and configure dependent projects to use that state. Keep separate tests for the login journey itself.

### What does `storageState` contain?

It serializes cookies and origin storage, including local storage, from a browser context so another context can restore the session.

### Why use a setup project instead of `globalSetup` for login?

A setup project uses normal fixtures, participates in the project dependency graph, and is visible in Playwright reporting. It fits browser login naturally.

### Is it safe to commit a storage-state file?

Generally no. It can contain live authenticated session material. Add the auth directory to `.gitignore` and generate it securely at runtime.

### How do you run tests for multiple roles?

Create one setup state per role and define dependent Playwright projects whose `use.storageState` points to the relevant file. Use separate contexts for roles interacting in one scenario.

### How do you test a guest user?

Run without an auth state or explicitly configure `{ cookies: [], origins: [] }`. Do not rely on a prior test having logged out.

### How do you deal with OTP or MFA?

Use an approved non-production test seam or controlled test account mechanism. Do not automate a real production user's second factor as a general CI strategy.

### Why can authentication still cause flaky parallel tests after storage state?

Storage state isolates browser sessions but not backend account data. Parallel tests can still collide when they mutate the same account or associated server-side resources.

### When would cookie injection be appropriate?

When valid test-only cookies are safely obtained and the application's authentication model is cookie-based. It is fast, but a complete storage state is often more representative.

---

## Next

→ [13-configuration-projects-and-environments.md](./13-configuration-projects-and-environments.md)
