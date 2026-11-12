# 01 — Playwright Fundamentals

## Learning goals

By the end of this module, you can explain Playwright's purpose, its process
architecture, the browser/context/page model, and why test isolation is a
design principle. You will also know where the automation library ends and
the Playwright Test runner begins.

---

## 1. What Playwright is

Playwright is an open-source browser automation library for Chromium, Firefox,
and WebKit. It provides one asynchronous TypeScript/JavaScript API for
controlling pages, observing UI state, handling network traffic, and working
with multiple tabs and frames.

`@playwright/test` is the associated test runner. It adds test discovery,
fixtures, retrying assertions, parallel workers, projects, reporters, retries,
and artifacts. Most interview questions about “Playwright” mean this runner.

| Surface | Main purpose |
|---|---|
| `playwright` | Browser automation in a script or another runner |
| `@playwright/test` | A complete E2E test framework built on the library |

```ts
import { test, expect } from '@playwright/test';

test('TodoMVC exposes its heading', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  await expect(page.getByRole('heading', { name: 'todos' })).toBeVisible();
});
```

This is more than “open a browser and click.” The locator describes a
user-facing target, the action/expectation waits for the relevant state, and
the runner creates the browser session lifecycle around the test.

## 2. Why browser automation needs a modern model

Modern applications render asynchronously. A click may trigger a request;
client code may later add an element; an animation may temporarily cover it;
and a popup or iframe may appear. Tests built from immediate DOM snapshots and
guessed sleeps fail according to timing rather than product behaviour.

Playwright addresses this with:

1. **Locators** that are resolved when an action or assertion runs, rather than
   keeping a stale DOM element reference.
2. **Auto-waiting** for actionability and **web-first assertions** that retry
   until an expected observable state or timeout.
3. **Browser contexts**: cheap, isolated browser sessions suitable for one
   independent test each.
4. **Cross-engine support** through a consistent API.
5. **Diagnostics** such as traces, screenshots, videos, and rich call logs.

These features reduce accidental timing dependencies. They do not repair an
application with genuinely nondeterministic behaviour, shared test data, or
unreliable third-party services.

## 3. Architecture: test to browser engine

Your Node.js test process calls the Playwright API. A Playwright driver/server
layer manages browser processes and maps common commands to the automation
protocol required by a particular engine.

```text
TypeScript test + Playwright Test runner
                  |
                  | asynchronous Playwright API
                  v
         Playwright driver / transport
          /             |             \
         v              v              v
 Chromium process   Firefox process   WebKit process
         |              |              |
      contexts       contexts       contexts
         |              |              |
       pages          pages          pages
         |
  main document, child frames, DOM, network
```

The engine protocols are not identical. Chromium automation is CDP-derived,
while Firefox and WebKit use their own integrations. Playwright abstracts that
work, which is why `page.locator(...).click()` can be portable. Direct CDP
usage is intentionally an advanced Chromium-specific escape hatch, not the
normal cross-browser API.

### Library versus runner

The library lets you manage all lifetimes explicitly:

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'en-GB' });
const page = await context.newPage();
await page.goto('https://example.com');
await context.close();
await browser.close();
```

The runner normally manages a browser, fresh context, and fresh page through
fixtures:

```ts
import { test } from '@playwright/test';

test('uses built-in fixtures', async ({ browser, context, page }) => {
  // browser is a running engine for this worker.
  // context and page are isolated for this test.
  await page.goto('https://example.com');
});
```

Managing fixtures manually in ordinary tests usually weakens isolation and
makes cleanup less reliable. Use explicit browser creation when writing a
standalone script or when a carefully designed custom fixture needs it.

## 4. Browser, context, page, and frame

These are different resources with different costs and scopes:

```text
Browser process (Chromium, Firefox, or WebKit)
├── BrowserContext A: visitor one
│   ├── Page: application tab
│   └── Page: popup tab
└── BrowserContext B: visitor two
    └── Page: application tab
```

* A **Browser** is a running browser engine process.
* A **BrowserContext** is an isolated, incognito-like session within that
  process. Cookies, cache, storage, permissions, and pages are scoped here.
* A **Page** is a browser tab or popup inside a context.
* A **Frame** is a document embedded in a page, typically via an iframe.

Contexts are cheaper than complete browser launches while giving the isolation
that tests require. A popup is another page in the *same* context and therefore
shares that context's authenticated session. A newly created context does not.

## 5. Isolation model

By default, Playwright Test gives every test a new context and page. The
browser can be reused per worker, but session state is not. This lets a test
run alone, in a different order, in a retry, or on another worker.

```ts
test('visitor creates a browser-local preference', async ({ page }) => {
  await page.goto('https://example.com');
  await page.evaluate(() => localStorage.setItem('colourScheme', 'dark'));
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('colourScheme')),
  ).toBe('dark');
});

test('another visitor has no preference', async ({ page }) => {
  await page.goto('https://example.com');
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('colourScheme')),
  ).toBeNull();
});
```

Context isolation is client-side isolation, not a database transaction. Tests
still collide if they use the same account, edit the same server record, or
consume the same email. Use unique data, API seeding/cleanup, or
worker-scoped resources. Serial execution is a last resort, not a solution for
shared-state design.

## 6. Promises and completion conditions

Playwright APIs are asynchronous. Always `await` interactions that establish a
precondition for the next line.

```ts
// Incorrect: the next command is not ordered after navigation.
page.goto('https://example.com');

// Correct.
await page.goto('https://example.com');
```

An awaited action does not mean every background task in the application has
ended. It means that operation reached its documented completion condition.
After a click that triggers an API call, assert the visible result or wait for
the specific URL/response that expresses your requirement. Avoid treating
`networkidle` or an arbitrary sleep as universal application readiness.

## 7. Comparison teaser

Selenium WebDriver standardizes browser commands through the WebDriver
protocol and driver ecosystem. Playwright uses its own multi-engine automation
layer, ships its own runner, and provides locator/action/assertion semantics as
one coherent system. Cypress has a browser-centric command queue model;
Playwright uses normal JavaScript promises and supports multiple isolated
contexts naturally. None of these statements makes a tool universally better:
existing infrastructure, target browsers, team skills, and product risk affect
the choice.

## 8. When not to use Playwright

An E2E browser test is usually slower and more expensive than lower-level
coverage. Do not test pure calculations, domain rules, or HTTP contracts only
through a browser when a unit or API test proves them more directly.

Also consider another solution for native mobile applications, hardware
workflows, unsupported legacy browsers, desktop applications, or flows blocked
by CAPTCHA/real external payment controls. Browser tests should validate
high-value user journeys and integrations—not replace every other test type.

## 9. Tutorial lab: observe isolation

Create `tests/fundamentals.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('adds a TodoMVC item', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  const input = page.getByPlaceholder('What needs to be done?');
  await input.fill('learn contexts');
  await input.press('Enter');
  await expect(page.getByRole('listitem')).toHaveText('learn contexts');
});

test('starts from a separate browser session', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  await expect(page.getByRole('listitem')).toHaveCount(0);
});
```

Run `npx playwright test tests/fundamentals.spec.ts`. If the second test
starts empty, the result comes from its fresh context, not an accidental
cleanup in the first test.

## 10. Pitfalls

* Calling `browser.newPage()` uses a default context; use an explicit context
  when managing session lifetime yourself.
* Reusing a signed-in context across unrelated tests leaks state and defeats
  retry independence.
* `await` is necessary but does not make an application globally idle.
* Do not use arbitrary `waitForTimeout()` to mask a missing readiness signal.
* A Chromium-only run is not cross-browser validation.
* A locator is a query with retry semantics, not an element snapshot.

## Interview Q&A

1. **What is Playwright?** A browser automation library for Chromium, Firefox,
   and WebKit; Playwright Test is its integrated test runner.
2. **Why distinguish library and runner?** The library automates browsers;
   the runner adds tests, fixtures, worker scheduling, assertions, and reports.
3. **What does the driver layer do?** It maps the common API to the
   engine-specific automation integration.
4. **Why avoid direct CDP in portable tests?** CDP is Chromium-specific;
   Playwright APIs work across the supported engines.
5. **What is a browser context?** An isolated browser session within a browser
   process, similar to an incognito profile.
6. **What state does a context isolate?** Cookies, storage, cache,
   permissions, and pages; it does not isolate shared backend data.
7. **Why create a context per test?** It prevents state leakage by design and
   enables ordering, retry, and parallel independence.
8. **Does Playwright launch one browser per test?** Usually no: a worker can
   reuse a browser while each test receives a fresh context and page.
9. **What is a page?** A tab or popup belonging to one browser context.
10. **How does a popup relate to authentication?** It shares its creator
    context, so it sees the same session state.
11. **What does `await page.goto()` guarantee?** Navigation reaches the API's
    selected completion condition; not that all future async work is finished.
12. **Why are locators preferable to element handles?** Locators re-resolve
    when used and integrate auto-waiting, reducing stale DOM references.
13. **Can isolated contexts eliminate database races?** No; test data must
    still be unique or safely scoped on the server.
14. **Why is an E2E test not the default for every requirement?** It is slower,
    costlier, and less focused than unit/API coverage for many behaviours.
15. **What reduces flakiness in Playwright?** Isolation, locators,
    actionability checks, retrying assertions, and explicit meaningful waits.
16. **When is Playwright unsuitable?** When the target is not a supported web
    browser workflow or a lower-level test can prove the behaviour better.

---

Next: [02 — Installation, CLI, and project setup](./02-installation-cli-and-project-setup.md)
