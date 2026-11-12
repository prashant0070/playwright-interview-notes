# 08 — Browser, Context, Page, and Multi-Tab Testing

## Learning goals

Learn the isolation hierarchy behind Playwright, configure browser contexts accurately, test multiple users and tabs safely, and collect browser-level evidence.

---

## 1. The browser hierarchy

```
Browser
└── BrowserContext (isolated browser session)
    ├── Page (tab or popup)
    ├── Page
    └── Page
```

A `Browser` is a running browser process. A `BrowserContext` is an isolated session inside that browser: it has its own cookies, permissions, cache, and storage. A `Page` is a tab, popup, or window in one context.

Playwright Test's standard fixtures follow this hierarchy:

- `browser`: shared browser instance used to make contexts.
- `context`: a fresh isolated context for a test.
- `page`: the primary tab created in that context.

The isolation boundary is the context, not the page. Opening two pages from the same context means they share login state. Creating two contexts means two independent users.

---

## 2. Why contexts are central to reliable tests

Creating a new browser process for every test is slow. Reusing one browser profile across tests leaks state. Contexts are the practical middle ground: lightweight, isolated sessions running in a browser process.

```ts
test('starts signed out in a fresh context', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://example.test');
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await context.close();
});
```

When Playwright Test provides the `context` fixture, it closes the context automatically. If a test manually creates a context, it should close it in a `finally` block or fixture teardown.

---

## 3. Configure a new context

`browser.newContext()` controls the environment visible to the application.

```ts
const context = await browser.newContext({
  baseURL: 'https://example.test',
  viewport: { width: 1440, height: 900 },
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  geolocation: { latitude: 51.5072, longitude: -0.1276 },
  permissions: ['geolocation'],
  extraHTTPHeaders: { 'X-Test-Run': 'e2e' },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();
```

Most shared settings belong in `use` in `playwright.config.ts`. Create a custom context only when one scenario needs a different session or environment.

```ts
export default defineConfig({
  use: {
    baseURL: 'https://example.test',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },
});
```

`ignoreHTTPSErrors: true` accepts invalid TLS certificates. It is appropriate for a known test environment with an untrusted certificate, not as a default way to hide production certificate defects.

---

## 4. Multiple users: create multiple contexts

Two roles interacting in the same scenario need separate contexts, even if they run in one test.

```ts
test('a recipient sees a shared document', async ({ browser }) => {
  const authorContext = await browser.newContext({ storageState: 'playwright/.auth/author.json' });
  const recipientContext = await browser.newContext({ storageState: 'playwright/.auth/recipient.json' });

  try {
    const authorPage = await authorContext.newPage();
    const recipientPage = await recipientContext.newPage();

    await authorPage.goto('/documents/new');
    await authorPage.getByLabel('Title').fill('Release notes');
    await authorPage.getByRole('button', { name: 'Share' }).click();

    await recipientPage.goto('/shared');
    await expect(recipientPage.getByText('Release notes')).toBeVisible();
  } finally {
    await Promise.all([authorContext.close(), recipientContext.close()]);
  }
});
```

Do not model two users with two pages from the same context: they share cookies and local storage, so the second page is not another independent session.

---

## 5. Pages, new tabs, and popups

A link with `target="_blank"` often creates a new `Page` in the same context. Start listening before the user action so a fast event cannot be missed.

```ts
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.getByRole('link', { name: 'Open policy' }).click(),
]);

await newPage.waitForLoadState();
await expect(newPage).toHaveURL(/policy/);
await expect(newPage.getByRole('heading')).toContainText('Policy');
```

For a popup opened by `window.open`, wait on the opener page:

```ts
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.getByRole('button', { name: 'Open help' }).click(),
]);

await popup.waitForLoadState('domcontentloaded');
await expect(popup).toHaveTitle(/Help/);
```

`context.waitForEvent('page')` catches any new page in the context. `page.waitForEvent('popup')` expresses that a particular page opened it. Pick the one matching the behavior being tested.

---

## 6. Inspect or coordinate existing pages

Use `context.pages()` when a flow creates or already owns multiple tabs.

```ts
const pages = context.pages();
console.log(`There are ${pages.length} open tabs`);

const confirmationPage = pages.find((candidate) =>
  candidate.url().includes('/confirmation'),
);
```

Prefer capturing the specific new page through an event rather than guessing from an array after the action. Event-based code is less race-prone and communicates intent.

---

## 7. Permissions and geolocation

Permissions apply to a context and can optionally be scoped to an origin.

```ts
await context.grantPermissions(['geolocation'], {
  origin: 'https://example.test',
});
await context.setGeolocation({
  latitude: 40.7128,
  longitude: -74.006,
});

await page.goto('/');
await page.getByRole('button', { name: 'Find nearby locations' }).click();
await expect(page.getByText('Nearby locations')).toBeVisible();
```

```ts
await context.clearPermissions();
```

Set both permission and location when testing geolocation. A location without permission may cause the application's location request to fail. Test denied permission as a separate scenario rather than assuming it behaves like missing coordinates.

---

## 8. Locale, timezone, color scheme, and motion

Environmental settings reveal bugs that hard-coded tests miss:

```ts
test.use({
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});

test('formats a date for the selected locale', async ({ page }) => {
  await page.goto('/events');
  await expect(page.getByText('19 août 2026')).toBeVisible();
});
```

The application must actually derive dates or translations from browser settings for these options to affect it. Do not assert a localized string unless the selected locale and date source make the expectation deterministic.

---

## 9. Viewport and device emulation

A viewport changes CSS layout. A device descriptor additionally configures a realistic user agent, touch capability, mobile mode, and device scale factor.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
```

Device emulation is valuable, but it is not identical to testing on physical hardware. Use it for broad regression coverage and add real-device testing when hardware-specific behavior matters.

---

## 10. Cookies and storage

The context owns cookies.

```ts
await context.addCookies([{
  name: 'consent',
  value: 'accepted',
  domain: 'example.test',
  path: '/',
  sameSite: 'Lax',
}]);

const cookies = await context.cookies();
await context.clearCookies({ name: 'consent' });
```

`storageState` serializes cookies and per-origin local storage so a new context can restore a session.

```ts
await context.storageState({ path: 'playwright/.auth/user.json' });

const restoredContext = await browser.newContext({
  storageState: 'playwright/.auth/user.json',
});
```

Local storage is origin-specific. If a test needs to set it before the application loads, use `context.addInitScript()` rather than `page.evaluate()` after navigation.

```ts
await context.addInitScript(() => {
  localStorage.setItem('onboarding-complete', 'true');
});
```

---

## 11. Headers and HTTPS behavior

Set headers for every request from a context:

```ts
await context.setExtraHTTPHeaders({
  'X-Client-Mode': 'test',
  'Accept-Language': 'en-US',
});
```

Headers passed through `context.setExtraHTTPHeaders` apply to pages in that context. For a single navigation or request that needs different behavior, use the relevant page or request API. Do not place credentials in source-controlled headers; load secrets from the environment or an approved secret store.

---

## 12. Console errors, page errors, and failed requests

Attach event listeners before navigation if initial load errors matter.

```ts
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => {
  console.warn('Request failed:', request.url(), request.failure()?.errorText);
});

await page.goto('/');
```

`console` events report browser console messages. `pageerror` reports uncaught exceptions in the page. `requestfailed` means the request failed at the network layer; an HTTP 500 is a successful network request with an unsuccessful HTTP response, so it does not emit `requestfailed`.

Avoid failing every test on any console error without an allow-list; many applications emit benign third-party errors. Capture evidence and enforce a deliberate policy.

---

## 13. Interview Q&A

### What is the difference between a browser, context, and page?

A browser is the running browser process. A context is an isolated browser session with its own storage and permissions. A page is one tab or popup within a context.

### Why use a context per test?

It gives each test a clean session without the cost of launching a separate browser process. It prevents cookie, local-storage, and cache leakage between tests.

### How do you test two logged-in users?

Create two distinct contexts, usually with different storage states, then create a page in each context. Two pages in one context would share a session.

### How do you handle a popup reliably?

Register `page.waitForEvent('popup')` before the triggering click with `Promise.all`, then await the popup's needed load state or UI condition.

### What is the difference between `context.waitForEvent('page')` and `page.waitForEvent('popup')`?

The context event observes any new page in that context. The page event observes a popup opened by that particular page.

### How do you test geolocation?

Configure geolocation and grant geolocation permission on the context before the application requests it. Test the denied-permission path separately.

### What does `storageState` contain?

It contains cookies and local-storage values for origins in the context. It is commonly used to restore an authenticated session.

### Can pages in separate contexts share cookies?

No. Context isolation is specifically designed to prevent that. To reuse a session intentionally, create both contexts from the same storage state.

### When should `ignoreHTTPSErrors` be used?

Only for a known environment with an intentionally untrusted certificate. It should not mask certificate problems in a quality-sensitive environment.

---

## Next

→ [09-page-object-model-and-design-patterns.md](./09-page-object-model-and-design-patterns.md)
