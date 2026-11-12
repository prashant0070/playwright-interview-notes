# 25 — Page, Locator, and Browser API Cheatsheet

## Learning goals

Recognize the Playwright APIs used most often in TypeScript, choose the right abstraction,
and understand the short “why/when” behind each call. This is a reference, not a reason
to replace readable test intent with dense one-liners.

---

## 1. Choose the right object first

```ts
// Browser: a running browser process.
// BrowserContext: isolated cookies, storage, permissions, and pages.
// Page: one tab or popup inside a context.
// Locator: a lazy, retryable description of one or more DOM elements.
```

Most UI tests receive `page` and should interact through locators. Create a context when
you need different session state, permissions, locale, or a second user. Use `browser`
when you must explicitly manage contexts or connect/launch outside the default fixture.

```ts
import { test, expect } from '@playwright/test';

test('uses a locator rather than an element handle', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

---

## 2. `Page`: navigation and document lifecycle

```ts
await page.goto('https://example.test/products', {
  waitUntil: 'domcontentloaded', // commit | domcontentloaded | load | networkidle
  timeout: 30_000,
});
await page.reload({ waitUntil: 'load' });
await page.goBack();
await page.goForward();
await page.url();
await page.title();
await page.content();       // full current HTML; diagnostics/special cases
await page.setContent('<main><h1>Test</h1></main>'); // isolated DOM testing
```

`goto` returns a response or `null` in special navigation cases. Prefer a post-navigation
assertion about visible product state over relying only on `waitUntil: 'networkidle'`;
modern applications can maintain background network traffic forever.

Use `waitForURL` when an action should navigate:

```ts
await Promise.all([
  page.waitForURL('**/orders/**'),
  page.getByRole('link', { name: 'View order' }).click(),
]);
```

For current Playwright versions, starting the wait before the action prevents missing a
fast event. For one-page applications, the destination assertion may be clearer.

---

## 3. `Page`: waits and events

```ts
await page.waitForURL(/\/dashboard$/);
await page.waitForLoadState('domcontentloaded');
await page.waitForResponse(response =>
  response.url().includes('/api/orders') && response.status() === 200,
);
await page.waitForRequest('**/api/orders');
await page.waitForEvent('popup');
await page.waitForEvent('download');
await page.waitForTimeout(250); // debugging only; avoid product synchronization
await page.waitForFunction(() => document.readyState === 'complete');
await page.waitForSelector('[data-testid="ready"]'); // legacy; prefer locator assertions
```

`waitForResponse` and `waitForRequest` are useful to synchronize an action with a known
network contract. Avoid unconditional sleeps: they are slow when the app is fast and
unreliable when it is slow.

```ts
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export CSV' }).click();
const download = await downloadPromise;
await download.saveAs('test-results/report.csv');
```

---

## 4. `Page`: execute page-side code carefully

```ts
const viewport = await page.evaluate(() => ({
  width: window.innerWidth,
  height: window.innerHeight,
}));

const productId = await page.evaluate((selector) => {
  return document.querySelector(selector)?.getAttribute('data-product-id');
}, '[data-testid="product"]');
```

`page.evaluate()` runs a serializable function in the page JavaScript environment and
returns a serializable result. Use it only when no browser-facing Playwright API expresses
the need; it bypasses locator waiting and user-facing semantics.

```ts
const handle = await page.evaluateHandle(() => window);
const location = await handle.evaluate((win: Window) => win.location.href);
await handle.dispose();
```

`evaluateHandle()` returns a `JSHandle` for a non-serializable value or object you need
to use again. Dispose handles when you create many of them. For a particular element,
`locator.evaluate()` and `locator.evaluateAll()` scope code more safely.

---

## 5. `Page`: expose application-facing test hooks

```ts
await page.exposeFunction('getTestClock', () => Date.now());
await page.evaluate(async () => {
  const now = await window.getTestClock();
  console.log(now);
});
```

`exposeFunction(name, callback)` adds an async function to the page's `window`; its
arguments/results must cross the process boundary. Use it for a simple test-provided
capability.

```ts
await page.exposeBinding('recordMetric', async ({ page }, name: string, value: number) => {
  console.log(page.url(), name, value);
});
```

`exposeBinding(name, callback, options?)` is similar but passes a source object (including
the calling page/frame/context) as the first callback argument. Use it when the callback
needs call-site context. These APIs alter the page environment; keep them in dedicated
tests, use collision-resistant names, and never expose secrets.

```ts
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
});
await page.goto('/');
```

`addInitScript` runs after a document is created but before its scripts execute, including
on navigations and child frames. It is for deterministic initialization (for example,
seeding `Math.random`), not ordinary test logic. The evaluation order of multiple init
scripts is not something to depend on.

---

## 6. `Page`: environment and observability

```ts
await page.bringToFront(); // relevant only with multiple visible tabs
await page.setViewportSize({ width: 1280, height: 720 });
await page.emulateMedia({
  media: 'screen',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  forcedColors: 'active',
});
await page.screenshot({ path: 'test-results/home.png', fullPage: true });
await page.pdf({ path: 'test-results/invoice.pdf' }); // Chromium headless only
await page.pause(); // Inspector, only during local debugging
```

Set context/page viewport before navigation when responsive initial rendering matters.
`emulateMedia` verifies CSS media-query behavior without changing the actual operating
system preference.

```ts
await page.coverage.startJSCoverage();
await page.reload();
const entries = await page.coverage.stopJSCoverage();
```

`page.coverage` can collect JS/CSS coverage for diagnostics, primarily Chromium. It is
not a substitute for test coverage and adds execution overhead.

```ts
page.on('console', message => console.log(message.type(), message.text()));
page.on('pageerror', error => console.error(error));
page.on('requestfailed', request => console.error(request.url(), request.failure()));
```

Event listeners help diagnose app failures. Register them early and remove or scope them
so unrelated errors do not leak across tests.

---

## 7. `Page`: routing, frames, dialogs, and popups

```ts
await page.route('**/api/profile', async route => {
  await route.fulfill({ json: { name: 'Ada' } });
});
await page.unroute('**/api/profile');
await page.routeFromHAR('fixtures/profile.har', { update: false });

page.on('dialog', dialog => dialog.accept());
const frame = page.frame({ url: /payment/ });
const payment = page.frameLocator('iframe[title="Payment"]');

const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Terms' }).click();
const popup = await popupPromise;
await popup.waitForLoadState();
```

Route before the request can occur; route handlers run in registration order. Prefer
`frameLocator` for frame UI—its locators retain auto-waiting. A dialog must be accepted
or dismissed; otherwise the page action stalls.

---

## 8. Locator construction and composition

```ts
const save = page.getByRole('button', { name: 'Save' });
page.getByLabel('Email');
page.getByPlaceholder('Search');
page.getByText('Welcome', { exact: true });
page.getByAltText('Company logo');
page.getByTitle('Close');
page.getByTestId('order-row');
page.locator('form#login'); // CSS only when a user-facing locator is unsuitable
```

Locators are lazy: they resolve immediately before each operation, avoiding stale
element references. User-facing role/name locators are normally the most resilient.

```ts
const row = page.getByRole('row').filter({ hasText: 'Ada Lovelace' });
const activeSave = page.getByRole('button', { name: 'Save' })
  .and(page.locator(':not([disabled])'));
const action = page.getByRole('button', { name: 'Save' })
  .or(page.getByRole('link', { name: 'Save' })).first();

await row.getByRole('button', { name: 'Edit' }).click();
await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Pro' }) });
await page.locator('article').filter({ hasNotText: 'Archived' });
```

`filter` narrows a locator relative to each candidate; its inner locator must target a
descendant, not a document-global element. `and` requires both locators to match the same
element. `or` combines alternatives; it can violate strictness when both match, so use
`.first()` only when either is valid.

```ts
const card = page.getByTestId('product-card').describe('featured product card');
const field = card.locator('input').nth(0);
const embeddedPage = page.locator('iframe[name="preview"]').contentFrame();
```

`describe()` adds a readable label to traces/errors. `contentFrame()` converts an iframe
locator to a `FrameLocator`; use `frameLocator`/`contentFrame` rather than querying inside
the outer document.

---

## 9. Locator actions

All locator actions re-resolve the element and perform actionability checks unless their
specific options say otherwise:

```ts
await locator.click({ button: 'left', modifiers: ['Control'] });
await locator.dblclick();
await locator.tap();                         // touch-style tap
await locator.hover();
await locator.focus();
await locator.blur();
await locator.fill('ada@example.test');
await locator.clear();
await locator.press('Enter');
await locator.pressSequentially('Ada');      // keyboard-event-sensitive controls
await locator.check();
await locator.uncheck();
await locator.setChecked(true);
await locator.selectOption({ label: 'Canada' });
await locator.setInputFiles('fixtures/avatar.png');
await locator.dragTo(target);
await locator.scrollIntoViewIfNeeded();
await locator.screenshot({ path: 'test-results/control.png' });
await locator.dispatchEvent('input', { bubbles: true });
```

`fill` is the normal text-input API; `pressSequentially` is exceptional because it types
character by character. `selectOption` is for native `<select>`, while custom comboboxes
should be operated through their role semantics. `dispatchEvent` bypasses normal user
input and is usually reserved for difficult browser-event cases.

---

## 10. Locator query and inspection methods

```ts
await locator.count();
await locator.all();               // snapshot list of locators; dynamic lists need care
await locator.allTextContents();
await locator.allInnerTexts();
await locator.textContent();
await locator.innerText();
await locator.innerHTML();
await locator.getAttribute('aria-label');
await locator.getByRole('button', { name: 'Edit' }); // descendant locator
await locator.boundingBox();
await locator.inputValue();
await locator.isChecked();
await locator.isDisabled();
await locator.isEditable();
await locator.isEnabled();
await locator.isHidden();
await locator.isVisible();
await locator.isFocused();
await locator.evaluate(element => element.tagName);
await locator.evaluateAll(elements => elements.map(element => element.id));
await locator.elementHandle();     // avoid unless an API demands ElementHandle
```

These are immediate queries, not assertions. For example, `isVisible()` answers the state
now; it does not wait. In tests, prefer `await expect(locator).toBeVisible()` when the
state is expected to arrive. `all()` and `allTextContents()` do not wait for a dynamic
list to stabilize—assert count or an item first.

---

## 11. `BrowserContext`: isolation and controls

```ts
const context = await browser.newContext({
  baseURL: 'https://example.test',
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  viewport: { width: 1440, height: 900 },
  geolocation: { latitude: 51.5072, longitude: -0.1276 },
  permissions: ['geolocation'],
  storageState: 'playwright/.auth/user.json',
  extraHTTPHeaders: { 'X-Test-Run': 'local' },
  offline: false,
});
const page = await context.newPage();
```

Contexts are cheap, isolated browser profiles. Use one per test by default; do not share
cookies or page objects between parallel tests.

```ts
await context.addCookies([{ name: 'theme', value: 'dark', domain: 'example.test', path: '/' }]);
await context.cookies();
await context.clearCookies();
await context.storageState({ path: 'playwright/.auth/user.json' });
await context.setDefaultTimeout(10_000);
await context.setDefaultNavigationTimeout(20_000);
await context.setExtraHTTPHeaders({ 'X-Trace': 'abc' });
await context.setGeolocation({ latitude: 40.7128, longitude: -74.006 });
await context.grantPermissions(['clipboard-read']);
await context.clearPermissions();
await context.setOffline(true);
await context.route('**/api/**', route => route.continue());
await context.unroute('**/api/**');
await context.close();
```

Context-level routing covers every page in that context. `storageState` is the supported
way to save/reuse signed-in browser storage; keep authenticated state files out of source
control.

---

## 12. `Browser` and `BrowserType`

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://example.test');
await browser.close();
```

```ts
await browser.contexts();
await browser.isConnected();
await browser.newContext();
await browser.newPage(); // convenience: creates a context and page; close page/context
await browser.close();
```

`BrowserType` is `chromium`, `firefox`, or `webkit`. Its key lifecycle APIs are
`launch`, `launchPersistentContext`, `connect`, `connectOverCDP`, and `launchServer`.
Use Playwright Test's built-in browser/context/page fixtures for normal tests; direct
launching is primarily library, tooling, and special-environment work.

---

## 13. Interview Q&A

1. **Why are locators safer than `ElementHandle`s?**  
   They resolve at action time and retain Playwright auto-waiting, avoiding stale DOM refs.
2. **Does `locator.isVisible()` wait?**  
   No; use `expect(locator).toBeVisible()` for a retrying condition.
3. **When use `evaluateHandle`?**  
   For non-serializable page objects that need repeated page-side operations.
4. **What is `addInitScript` timing?**  
   After document creation and before page scripts execute.
5. **`exposeFunction` versus `exposeBinding`?**  
   A binding receives caller source context; a function is the simpler callback bridge.
6. **Why start event waits before clicking?**  
   A fast popup, download, or response could otherwise be missed.
7. **`filter` versus `and`?**  
   Filter narrows candidates by descendants/text; `and` requires the same element match.
8. **Why avoid `waitForTimeout`?**  
   It guesses timing instead of synchronizing to a meaningful condition.
9. **Context route vs page route?**  
   Context route applies to all context pages; page route is scoped to one page.
10. **Why use `storageState`?**  
    It reuses deliberate authenticated state without UI login in every test.
## 14. Lab — two users and a mocked endpoint

1. Create two browser contexts: buyer and seller.
2. Give each a distinct saved `storageState`.
3. Register a context route for a seller-only inventory response before navigation.
4. Use role locators to edit an item and wait for the actual update response.
5. In the buyer context, assert the item is visible without the seller session leaking.
## Next

Continue to [26 — Complete Assertions Reference](./26-assertions-complete-reference.md).
