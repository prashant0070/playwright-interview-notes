# 15 — Visual, Accessibility & Mobile Testing

## Learning goals

Use visual comparisons intentionally, test accessibility as part of functional quality, and cover responsive mobile web behavior with Playwright's device emulation.

---

## 1. Visual tests are pixel-level regression checks

Visual testing compares a current screenshot with an approved baseline. It catches unintended layout, typography, visibility, and styling changes that DOM assertions may miss. It does not determine whether a flow is semantically correct or usable, so pair it with behavioral assertions.

```ts
import { test, expect } from '@playwright/test';

test('account summary has stable layout', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account summary' })).toBeVisible();
  await expect(page).toHaveScreenshot('account-summary.png', {
    fullPage: true,
  });
});
```

The first accepted run writes a baseline under the configured snapshot path. Later runs compare against it. Update baselines only after reviewing that the visual change is intended:

```bash
npx playwright test --update-snapshots
```

Commit reviewed baselines so CI compares against a shared, versioned expectation.

---

## 2. `toHaveScreenshot` options in depth

`expect(page).toHaveScreenshot()` captures the viewport or full page. `expect(locator).toHaveScreenshot()` is usually more stable for a component region.

```ts
const card = page.getByRole('region', { name: 'Recommendations' });

await expect(card).toHaveScreenshot('recommendations.png', {
  animations: 'disabled',
  caret: 'hide',
  mask: [page.getByTestId('live-clock'), page.getByTestId('rotating-ad')],
  maskColor: '#ff00ff',
  maxDiffPixelRatio: 0.002,
  threshold: 0.2,
});
```

Important options:

- `fullPage`: captures page beyond the viewport. Prefer locator screenshots when full-page content has unrelated dynamic sections.
- `animations: 'disabled'`: fast-forwards finite CSS/Web Animations and cancels infinite animations during capture. It reduces timing noise, but does not prove animation quality.
- `caret: 'hide'`: avoids an input caret causing random pixel differences.
- `mask`: covers dynamic locators with a solid color. Mask only content irrelevant to the visual contract; an overly broad mask creates blind spots.
- `maskColor`: color used for masks; the default is magenta.
- `maxDiffPixels`: absolute number of differing pixels allowed.
- `maxDiffPixelRatio`: differing pixels as a ratio of total pixels; useful across screenshot sizes.
- `threshold`: color-distance sensitivity per pixel (0–1). It does not mean “allow this percentage of changed pixels.”
- `scale`: `css` or `device`, controlling pixel density of the image.
- `style` / `stylePath`: inject temporary CSS to hide a known unstable element. Prefer a product-visible stable state or narrow mask first.
- `timeout`: web-first assertion timeout while Playwright waits for screenshot stability.

Do not increase thresholds until the mismatch is understood. It can conceal a real regression.

---

## 3. Stable visual baselines

Visual output varies with browser engine, operating system fonts, browser version, viewport, color profile, locale, time, data, and animation. Baselines should be generated and checked in a controlled environment.

```ts
export default defineConfig({
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'visual-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
        locale: 'en-US',
        timezoneId: 'UTC',
      },
    },
  ],
});
```

Pin the Playwright version and run visual CI in a consistent container/runner. Seed deterministic data, freeze time where the application supports it, disable or mask only unrelated dynamic content, and avoid asserting enormous pages when a component screenshot answers the question.

---

## 4. Accessibility: start with semantics

The most durable accessibility check is building semantic UI: correct native elements, labels, headings, landmark structure, keyboard support, contrast, and accurate accessible names. Role locators reinforce this because they query the same accessibility model a user of assistive technology relies on.

```ts
await page.getByRole('button', { name: 'Save changes' }).click();
await expect(page.getByRole('status')).toHaveText('Changes saved');
await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
```

If a role locator is difficult to write, inspect whether the control lacks a meaningful accessible name or uses an inappropriate element. A `data-testid` can still be valid for ambiguous UI, but it should not replace accessible design.

---

## 5. Automated checks with `@axe-core/playwright`

Playwright does not bundle axe rules. `@axe-core/playwright` integrates axe-core scans with a page.

```bash
npm install -D @axe-core/playwright
```

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('checkout has no serious accessibility violations', async ({ page }) => {
  await page.goto('/checkout');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

Scope scans for faster, more actionable results:

```ts
const results = await new AxeBuilder({ page })
  .include('[data-testid="payment-form"]')
  .disableRules(['color-contrast']) // only with documented justification
  .analyze();
```

Automated rules find only a subset of accessibility problems. They cannot reliably judge meaningful alt text, logical focus order, keyboard interaction quality, or whether content makes sense when announced. Use manual keyboard and assistive-technology testing for important workflows.

---

## 6. ARIA snapshots

Playwright can assert an accessibility tree representation with `toMatchAriaSnapshot`, which is useful for compact checks of roles, names, and hierarchy:

```ts
await expect(page.getByRole('navigation')).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Settings"
`);
```

This is complementary to axe and behavioral checks, not a complete accessibility audit. See module 24 for dedicated ARIA snapshot coverage if that module is present in your curriculum.

---

## 7. Mobile web emulation

Playwright emulates browser/device characteristics for **mobile web**, not native Android or iOS applications. Device descriptors include a viewport, user agent, device scale factor, touch capability, and mobile flag.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone-15',
      use: { ...devices['iPhone 15'] },
    },
  ],
});
```

Descriptors are a starting point. Test the exact breakpoints and browser engines that matter; an emulated Chromium mobile profile is not identical to WebKit on a physical iPhone.

---

## 8. Tap versus click and touch-aware tests

Use `tap()` when the interaction being tested is specifically touch input:

```ts
test('mobile navigation opens by touch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await expect(page.getByRole('navigation', { name: 'Mobile menu' })).toBeVisible();
});
```

`click()` is appropriate for general activation; it is not necessary to rewrite all tests as taps merely because they run in a mobile project. Test gestures such as touch drag or multi-touch only when the product depends on them, using the appropriate touch/page APIs and a real-device layer when risk warrants it.

---

## 9. Responsive strategy and color schemes

Cover representative widths where layout switches, not every possible resolution:

```ts
test.describe('responsive layout', () => {
  for (const viewport of [
    { name: 'narrow', width: 375, height: 812 },
    { name: 'wide', width: 1440, height: 900 },
  ]) {
    test(`${viewport.name} navigation`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('navigation')).toBeVisible();
    });
  }
});
```

Test dark-mode behavior through context emulation:

```ts
test.use({ colorScheme: 'dark' });

test('uses dark theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading')).toBeVisible();
});
```

Use projects for stable, broad device/browser coverage; use `page.setViewportSize()` sparingly for a focused breakpoint test. Include orientation, text zoom/reflow, keyboard access, and real-device checks when they are product risks.

---

## Interview Q&A

### Q1. What does visual regression testing catch?
**A:** Pixel-level changes to a defined UI region or page. It is strong for unexpected layout/style changes but should complement functional and accessibility testing.

### Q2. How do you make screenshot tests stable?
**A:** Pin browser/runtime versions, fix viewport/locale/timezone/data, disable animations, use narrow locator screenshots, and mask only truly irrelevant dynamic elements.

### Q3. What is the difference between `threshold` and `maxDiffPixelRatio`?
**A:** Threshold controls how different two individual pixel colors may be before they count as different. The ratio limits how many pixels may differ overall.

### Q4. Does axe guarantee WCAG compliance?
**A:** No. It automates detectable rules only. Manual review of keyboard behavior, semantics, reading order, and user experience remains necessary.

### Q5. Why prefer `getByRole`?
**A:** It targets what users and assistive technologies perceive. It also encourages accessible names and semantic controls, producing more resilient tests.

### Q6. Does Playwright emulate native mobile apps?
**A:** No. It emulates mobile web browser characteristics. Native app testing requires other tooling.

### Q7. When should you use `tap()`?
**A:** For a behavior specifically dependent on touch input. For ordinary activation, `click()` remains suitable across desktop and mobile web.

---

## Next

→ [16-debugging-trace-ui-mode-and-codegen.md](./16-debugging-trace-ui-mode-and-codegen.md)
