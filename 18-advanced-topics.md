# 18 — Advanced Playwright Topics

## Learning goals

Recognize advanced Playwright APIs, use them only where they fit, and explain the boundary between powerful browser automation and unsupported or inappropriate testing goals.

---

## 1. Chrome DevTools Protocol sessions

`browserContext.newCDPSession(page)` exposes Chrome DevTools Protocol (CDP) commands for Chromium-based browsers. Use it for a Chromium-specific capability that the standard Playwright API does not expose—not as the normal way to click, inspect DOM, or wait.

```ts
import { test, expect } from '@playwright/test';

test('reads a Chromium performance metric', async ({ page, context }) => {
  await page.goto('/');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const { metrics } = await cdp.send('Performance.getMetrics');

  const taskDuration = metrics.find(metric => metric.name === 'TaskDuration')?.value;
  expect(taskDuration).toBeDefined();
  await cdp.detach();
});
```

CDP is Chromium-only and protocol details can be lower-level and less stable than Playwright's cross-browser APIs. Keep CDP use small, isolated, and documented. Do not use it when a standard locator, route, or browser-context API works.

---

## 2. Clock API: deterministic time

`page.clock` controls time-related browser APIs so tests do not depend on wall-clock timing.

```ts
test('expires a temporary message after five seconds', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/notifications');

  await page.getByRole('button', { name: 'Show message' }).click();
  await expect(page.getByRole('status')).toBeVisible();

  await page.clock.fastForward('00:00:05');
  await expect(page.getByRole('status')).toBeHidden();
});
```

The Clock API is valuable for `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame`, and timer-based UI flows. Install it before the page code that schedules timers runs. It does not magically control server time, external systems, or all browser behavior; design a server-side time seam when the API response itself depends on time.

---

## 3. Component testing

Playwright Component Testing mounts supported framework components in a real browser and interacts through Playwright locators and assertions. It sits between isolated unit tests and full application E2E tests: useful for UI states and interactions without navigating the whole app.

```ts
// Illustrative React component-test shape
import { test, expect } from '@playwright/experimental-ct-react';
import { Counter } from './Counter';

test('increments', async ({ mount }) => {
  const component = await mount(<Counter />);
  await component.getByRole('button', { name: 'Increment' }).click();
  await expect(component.getByRole('status')).toHaveText('1');
});
```

Component testing has framework-specific setup and may be experimental depending on the integration/version. See module 29 for dedicated setup, fixtures, and component-testing trade-offs.

---

## 4. Electron applications

Playwright can automate Electron applications through its Electron support:

```ts
import { test, expect, _electron as electron } from '@playwright/test';

test('opens the main Electron window', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  await expect(window.getByRole('heading')).toBeVisible();
  await app.close();
});
```

Electron automation targets the renderer window with familiar page APIs and can evaluate in the main process when needed. It requires a compatible Electron app/build and is distinct from testing arbitrary native desktop applications. Ensure teardown closes the application even after failure.

---

## 5. Performance smoke checks

Functional E2E tests are poor substitutes for a full performance-testing program: results vary by hardware, load, cache, and network. They can still detect a coarse regression on a controlled runner.

```ts
test('home page has a reasonable first contentful paint smoke metric', async ({ page }) => {
  await page.goto('/');
  const fcp = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint') as PerformanceEntry[];
    return entries.find(entry => entry.name === 'first-contentful-paint')?.startTime;
  });

  expect(fcp).toBeDefined();
  expect(fcp!).toBeLessThan(3_000);
});
```

Use stable environment, broad thresholds, and trends rather than a fragile single hard limit. Measure production-like performance with dedicated tooling such as Lighthouse or load-test systems, and test server capacity outside browser E2E runs.

---

## 6. Service workers

Service workers can intercept requests, cache content, and change how network mocking behaves. Inspect workers on a context:

```ts
const workers = context.serviceWorkers();
for (const worker of workers) {
  console.log(worker.url());
}

const worker = await context.waitForEvent('serviceworker');
console.log('registered:', worker.url());
```

When a route seems ignored, a service worker may be satisfying the request first. Decide whether the test should exercise the real caching behavior, disable/block service workers for a controlled route-mocking scenario, or test the service worker separately. Do not assume every page request reaches `page.route()`.

---

## 7. WebSockets

Playwright can observe and route WebSocket connections in supported scenarios:

```ts
test('shows an incoming update', async ({ page }) => {
  const socketPromise = page.waitForEvent('websocket');
  await page.goto('/live');

  const socket = await socketPromise;
  socket.on('framereceived', event => {
    console.log('received frame:', event.payload);
  });
});
```

Use WebSocket events to verify connection lifecycle or diagnose frames. For deterministic UI tests, control the backend or route the WebSocket where appropriate instead of depending on live timing. Network-idle waiting is often unsuitable for applications with persistent sockets.

---

## 8. File chooser and upload flows

`setInputFiles` is the simplest approach when the file input is accessible:

```ts
await page.getByLabel('Upload receipt').setInputFiles('fixtures/receipt.pdf');
```

For a custom control that opens a browser file chooser, start waiting **before** the triggering action:

```ts
const chooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Choose file' }).click();
const chooser = await chooserPromise;
await chooser.setFiles({
  name: 'note.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('example'),
});
```

Use `setInputFiles([])` to clear. Playwright supplies files directly to the browser; it does not interact with the operating system's native file-dialog UI.

---

## 9. Browser extensions and persistent contexts

Extensions generally require a persistent Chromium context because they are loaded at browser launch:

```ts
import { chromium } from '@playwright/test';

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});
```

Persistent contexts use a user-data directory and preserve browser profile state. They are useful for extension testing and some browser-profile scenarios, but weaker for test isolation. Give each parallel test/worker a unique profile directory and close it reliably. Extension support and headless behavior can vary by Chromium version.

---

## 10. Remote Chromium with `connectOverCDP`

`chromium.connectOverCDP(endpointURL)` attaches Playwright to a running Chromium instance exposing a CDP endpoint:

```ts
import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];
await page.getByRole('button', { name: 'Refresh' }).click();
```

This is Chromium-only and may offer lower fidelity than a Playwright-created connection. It is useful for specialized remote-debugging scenarios, not routine isolated tests. See module 27 for connection-model detail if present.

---

## 11. `addLocatorHandler` for unavoidable overlays

`page.addLocatorHandler()` registers code Playwright can invoke when a locator such as a cookie consent or unexpected sign-in overlay appears:

```ts
await page.addLocatorHandler(
  page.getByRole('button', { name: 'Accept cookies' }),
  async () => {
    await page.getByRole('button', { name: 'Accept cookies' }).click();
  },
);
```

This is an advanced escape hatch for genuinely unpredictable, blocking UI. It can obscure application behavior and add invisible actions to a test, so prefer deterministic setup (for example, a consent cookie) or explicit test steps. See module 23 for focused handler guidance if present.

---

## 12. Limits of Playwright

Playwright is excellent for browser and browser-hosted application automation. It is not:

- a native Android/iOS application automation framework;
- a load-testing or capacity-testing platform;
- a replacement for unit, contract, security, or manual usability testing;
- a guarantee that emulation equals every physical device/browser/assistive technology;
- able to bypass browser security, CAPTCHA policy, MFA, third-party terms, or unavailable test seams safely.

Use the right layer of testing. A small number of high-value E2E checks plus lower-level tests is typically more reliable than attempting to validate every condition through the UI.

---

## Interview Q&A

### Q1. When would you use a CDP session?
**A:** Only for a Chromium-specific capability not exposed by Playwright's standard API, such as a specialized DevTools domain. Normal browser tests should use cross-browser Playwright APIs.

### Q2. What problem does the Clock API solve?
**A:** It makes browser timer and date-based tests deterministic by installing and advancing a controlled clock. Server time still needs its own control point.

### Q3. Is a performance assertion in E2E a complete performance strategy?
**A:** No. It is a controlled smoke signal. Reliable performance engineering needs dedicated measurement, stable infrastructure, trends, and load/capacity testing.

### Q4. Why can service workers complicate network mocks?
**A:** A service worker can intercept or fulfill a request before page routing sees it. The test must deliberately choose whether to test or neutralize that layer.

### Q5. Why is a persistent context risky in parallel tests?
**A:** It preserves profile state. Shared profile folders leak cookies, caches, and extension state, so each worker needs an isolated profile.

### Q6. When is `addLocatorHandler` appropriate?
**A:** For an unavoidable, intermittent blocking overlay. It should be narrowly scoped and not replace deterministic test setup or explicit product behavior.

### Q7. What is the major limitation of `connectOverCDP`?
**A:** It is Chromium-only and attaches to an existing browser, so it offers less isolation and can have lower fidelity than a browser launched by Playwright.

---

## Next

For advanced APIs introduced after this overview, continue with
[23 — Locator handlers and overlays](./23-locator-handlers-and-overlays.md),
[24 — ARIA snapshots](./24-aria-snapshots.md),
[27 — Remote browsers, CDP, and connect](./27-remote-browsers-cdp-and-connect.md),
[28 — Custom reporters](./28-custom-reporters.md), and
[29 — Component testing deep dive](./29-component-testing-deep-dive.md).

→ [19-interview-qa-bank.md](./19-interview-qa-bank.md)
