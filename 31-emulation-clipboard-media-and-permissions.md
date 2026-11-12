# 31 — Emulation, Clipboard, Media, and Permissions

## Learning goals

Create browser contexts that emulate user environment traits, grant and reset permissions safely, test clipboard flows, control connectivity and media preferences, and understand the distinction between emulation and testing on a physical device.

> Supported options vary by browser and evolve over time. Check [playwright.dev](https://playwright.dev/docs/emulation) for current API and browser support.

---

## 1. Context options are the emulation boundary

Most emulation belongs on a browser context. A context is isolated: its viewport, locale, permissions, cookies, and storage do not leak into another fresh context.

```ts
import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});

test('formats the date for the selected user environment', async ({ page }) => {
  await page.goto('/delivery');
  await expect(page.getByText('19 August 2026')).toBeVisible();
});
```

Set an option at the narrowest useful scope: globally for a product-wide project, with `test.use()` for a describe block, or with `browser.newContext()` for a special multi-user case. Do not alter process globals such as `TZ` in one test and expect parallel workers to remain isolated.

---

## 2. Device descriptors, viewport, touch, and mobile

`devices` supplies a named descriptor with an appropriate viewport, user agent, device scale factor, touch support, and mobile flag:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
```

Override a descriptor after spreading it:

```ts
{
  name: 'Mobile Safari - dark',
  use: {
    ...devices['iPhone 13'],
    colorScheme: 'dark',
    locale: 'en-US',
  },
}
```

Individual properties are useful for focused compatibility cases:

```ts
test.use({
  viewport: { width: 375, height: 667 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'ExampleApp/1.0 mobile test',
});
```

`isMobile`, `hasTouch`, viewport, and a user agent emulate browser signals; they do not create a real iOS or Android device. Run a small set of release-critical flows on real devices or a suitable device cloud when actual OS/browser behavior matters.

---

## 3. Geolocation and permissions

Geolocation requires both a location value and permission:

```ts
test.use({
  geolocation: { latitude: 28.6139, longitude: 77.2090, accuracy: 30 },
  permissions: ['geolocation'],
});

test('shows location-aware collection options', async ({ page }) => {
  await page.goto('/stores');
  await expect(page.getByRole('heading', { name: 'Stores near you' }))
    .toBeVisible();
});
```

For a context created manually:

```ts
const context = await browser.newContext({
  geolocation: { latitude: 51.5072, longitude: -0.1276 },
});
await context.grantPermissions(['geolocation'], { origin: 'https://example.test' });

const page = await context.newPage();
await page.goto('https://example.test/stores');
```

Limit grants to an `origin` when possible. It models the browser permission boundary and avoids accidentally making unrelated pages permissive. Reset grants after a scenario that changes permission state:

```ts
await context.clearPermissions();
```

To update a location at runtime:

```ts
await context.setGeolocation({ latitude: 40.7128, longitude: -74.006 });
```

Test both granted and denied UI paths. “Denied” can mean a user declined, the browser policy blocked access, or no permission was granted, so assertions should focus on the application's visible fallback rather than a browser-specific native prompt.

---

## 4. Locale, timezone, and color preferences

`locale` influences browser locale behavior such as `navigator.language` and formatting APIs. `timezoneId` controls browser timezone behavior:

```ts
test.use({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});

test('formats amount and date using browser environment', async ({ page }) => {
  await page.goto('/receipt');
  await expect(page.getByTestId('total')).toHaveText('1.234,50 €');
});
```

Test a small matrix of purposeful combinations rather than every locale/timezone pair. For date-sensitive backend responses, make server time and localization deterministic too; client-side timezone emulation cannot change server rendering already produced in a response.

Color and contrast preferences:

```ts
test.use({
  colorScheme: 'dark',       // 'light' | 'dark' | 'no-preference'
  forcedColors: 'active',    // 'active' | 'none'
  reducedMotion: 'reduce',   // 'reduce' | 'no-preference'
});

test('honors accessibility preferences', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByTestId('theme')).toHaveAttribute('data-mode', 'dark');
});
```

`reducedMotion` is a strong choice for screenshot stabilization and for testing a product's motion-reduction behavior. It does not guarantee that application animations stop unless the application correctly responds to the media query.

---

## 5. Clipboard read and write

Clipboard APIs are permission-gated browser features. Grant read/write permissions for the test origin before triggering the user flow:

```ts
import { test, expect } from '@playwright/test';

test('copies an order reference', async ({ context, page }) => {
  await context.grantPermissions(
    ['clipboard-read', 'clipboard-write'],
    { origin: 'https://example.test' },
  );

  await page.goto('https://example.test/orders/42');
  await page.getByRole('button', { name: 'Copy order reference' }).click();

  await expect(page.getByRole('status')).toHaveText('Copied');
  await expect.poll(() =>
    page.evaluate(() => navigator.clipboard.readText()),
  ).toBe('ORD-42');
});
```

The preferred test proves both the user-facing confirmation and, only when necessary, the clipboard content. Do not use `page.evaluate()` to call the application's internal copy function; click the actual control. Browser and headless-mode support can differ, so run clipboard cases on the intended CI browser and use current official guidance for browser-specific limitations.

To test a paste interaction:

```ts
test('accepts a pasted voucher', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'https://example.test',
  });
  await page.goto('https://example.test/checkout');

  await page.evaluate(() => navigator.clipboard.writeText('SAVE10'));
  await page.getByLabel('Voucher code').press(process.platform === 'darwin'
    ? 'Meta+V'
    : 'Control+V');

  await expect(page.getByLabel('Voucher code')).toHaveValue('SAVE10');
});
```

The platform conditional is a test-runner concern. If a project only runs on one OS, state that constraint rather than assuming a keyboard shortcut is universal.

---

## 6. Offline mode

`offline` creates a context with network connectivity disabled:

```ts
test('shows an offline fallback', async ({ context, page }) => {
  await page.goto('/catalog'); // Load the application first if needed.
  await context.setOffline(true);

  await page.getByRole('link', { name: 'Refresh catalog' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'You appear to be offline. Try again when connected.',
  );

  await context.setOffline(false);
});
```

Offline mode is not equivalent to a slow or failing service. Use `page.route()` to model a specific timeout, status, or payload. Use offline mode to validate the user's disconnected experience and client-side caching behavior.

---

## 7. Media emulation

`page.emulateMedia()` changes media type and supported preference values for one page:

```ts
test('prints the invoice without navigation chrome', async ({ page }) => {
  await page.goto('/invoices/42');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('navigation')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Invoice' })).toBeVisible();
});
```

It can also control color, motion, contrast, and forced-color preferences:

```ts
await page.emulateMedia({
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  forcedColors: 'active',
});
```

Use context-level `use` options for a default environment shared by the test and any pages it opens. Use `page.emulateMedia()` for a single page that intentionally switches media behavior.

---

## 8. User agent caution

`userAgent` changes the browser's HTTP and JavaScript-facing user agent string:

```ts
test.use({
  userAgent: 'Mozilla/5.0 ExampleCompatibilityTest/1.0',
});
```

It does not turn Chromium into Safari, and user-agent sniffing is usually a fragile product behavior. Prefer testing responsive or capability-based features through actual project browsers and context options. Change the user agent only when the application has a defined compatibility policy that must be verified.

---

## 9. A purposeful project matrix

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium-light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'webkit-mobile-dark',
      use: {
        ...devices['iPhone 13'],
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
  ],
});
```

Every project has a runtime cost. Start from browsers and environments required by product support, then add a focused test or project for a documented risk. A huge combinatorial matrix produces slow feedback and makes failures harder to interpret.

---

## Interview Q&A

**Q: Is a Playwright device descriptor a real mobile device?**  
A: No. It emulates browser characteristics such as viewport, user agent, touch, and mobile flags. Real-device coverage is still required for OS-specific release risks.

**Q: Why grant geolocation permission and set geolocation separately?**  
A: The location supplies coordinates; permission allows page code to access them. Both are needed to model a granted user flow.

**Q: How do you test copy-to-clipboard?**  
A: Grant clipboard permissions for the test origin, click the visible copy control, assert user feedback, and read `navigator.clipboard` only when the copied value itself is important.

**Q: When should you use offline mode instead of route mocking?**  
A: Offline mode models disconnection. Route mocking models a specific response, error, or latency. They answer different product questions.

**Q: Does setting a user agent emulate another browser engine?**  
A: No. It only changes the UA string. Use actual Playwright browser projects for engine coverage.
