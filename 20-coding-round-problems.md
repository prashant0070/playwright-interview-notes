# 20 — Coding Round Problems

Twenty-five interview exercises for [TodoMVC](https://demo.playwright.dev/todomvc) or an equivalent generic demo application. Problems **21–25** are harder senior/principal drills (races, OAuth popup, iframes, flake harnesses, fixture cleanup). Adapt visible labels and test IDs to the application under test; do not invent APIs during an interview.

## How to use this guide

Read the prompt, time-box yourself, then explain locator choice, synchronization, test-data isolation, and failure diagnosis aloud. A good solution is small, executable, and uses Playwright's waiting model rather than sleeps.

## 1. Todo CRUD — Easy, 20 minutes

**Prompt:** Add three todos, complete the second, clear completed items, and assert the remaining two.

```ts
test('maintains todos', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  const input = page.getByPlaceholder('What needs to be done?');
  for (const title of ['Plan', 'Build', 'Review']) {
    await input.fill(title);
    await input.press('Enter');
  }
  const review = page.getByTestId('todo-item').filter({ hasText: 'Review' });
  await review.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(page.getByTestId('todo-item')).toHaveCount(2);
});
```

**Rubric (10):** semantic locators 3; web-first assertions 3; no sleep/nth 2; readable flow 2.

## 2. Auth setup project — Easy–Medium, 25 minutes

**Prompt:** Create a setup test that logs in, verifies a signed-in marker, saves `storageState`, then configure a dependent project that opens a protected page without UI login.

**Expected solution:** a `tests/setup/auth.setup.ts` test calls `page.context().storageState({ path })`; the path is ignored by Git; the browser project has `dependencies: ['setup']` and `use.storageState`.

**Rubric:** validates login before saving 3; project dependency 3; credential hygiene 2; explains expiry and role separation 2.

## 3. Table-row operation — Medium, 20 minutes

**Prompt:** In a generic orders table, cancel order `ORD-1002` and assert its status changes.

```ts
const row = page.getByRole('row').filter({ hasText: 'ORD-1002' });
await row.getByRole('button', { name: 'Cancel' }).click();
await page.getByRole('button', { name: 'Confirm cancellation' }).click();
await expect(row).toContainText('Cancelled');
```

**Rubric:** scopes to a row 4; handles confirmation 2; assertions retry 2; avoids positional selection 2.

## 4. Route a cart response — Medium, 25 minutes

**Prompt:** Before opening `/cart`, mock its cart endpoint with one item and assert name and total. Add a second test for a 500 error state.

**Expected solution:** register `page.route('**/api/cart', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cart) }))` before `goto`. For the error case fulfill status 500 and assert the visible recovery UI.

**Rubric:** route registered early 3; realistic response 2; UI assertion 3; no unnecessary response waits 2.

## 5. Popup checkout — Medium, 25 minutes

**Prompt:** A generic payment page opens in a popup. Complete the stubbed form and assert confirmation in the opener.

```ts
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.getByRole('button', { name: 'Pay' }).click(),
]);
await popup.getByLabel('Card number').fill('4111111111111111');
await popup.getByRole('button', { name: 'Confirm payment' }).click();
await expect(page.getByRole('status')).toContainText('Payment successful');
```

**Rubric:** arms event first 4; locates in the correct page 3; validates end state 3.

## 6. Iframe form — Medium, 20 minutes

**Prompt:** Enter a verification code inside `#secure-frame`, submit it, and confirm the parent page changes.

**Expected solution:** `const secure = page.frameLocator('#secure-frame');` then use `secure.getByLabel(...)`. Explain why `page.locator()` cannot see inside an iframe.

**Rubric:** `frameLocator` 4; no frame sleep 2; parent-side success assertion 2; secure-data caution 2.

## 7. Download and inspect CSV — Medium, 25 minutes

**Prompt:** Export a generic report and assert the first CSV line contains `order_id`.

```ts
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export CSV' }).click(),
]);
await download.saveAs(testInfo.outputPath(await download.suggestedFilename()));
```

**Rubric:** event race avoided 3; writes only to output directory 2; parses/asserts content 3; avoids fixed filesystem paths 2.

## 8. Accessible form errors — Easy, 15 minutes

**Prompt:** Submit an empty registration form, soft-assert four errors, then hard-assert focus is on the first invalid field.

**Expected solution:** use `expect.soft(...)` for all error messages and `await expect(page.getByLabel('Email')).toBeFocused()` as the hard assertion.

**Rubric:** correct soft/hard distinction 4; label-based locator 3; checks user-visible feedback 3.

## 9. Refactor a raw spec — Medium, 30 minutes

**Prompt:** Refactor an 80-line login-and-purchase spec into `LoginPage`, `CatalogPage`, and a thin specification.

**Expected solution:** page objects hold locators and screen actions; the spec retains business intent and assertions. Do not hide every assertion or add a wrapper for `click`.

**Rubric:** useful boundaries 4; tests remain readable 3; locators not duplicated 2; no over-abstraction 1.

## 10. Parallel-safe data — Medium–Hard, 25 minutes

**Prompt:** Create a unique coupon for each worker and clean it up even after a failure.

**Expected solution:** use an API fixture and `testInfo.workerIndex`/`testInfo.testId` in the identifier. Explain that a timestamp alone can collide and that a shared coupon creates cross-test interference.

**Rubric:** isolation 4; teardown 3; API setup over slow UI setup 2; explains collision risk 1.

## 11. Fix a response race — Medium, 15 minutes

**Prompt:** Correct code that clicks “Place order” and only then calls `waitForResponse`.

```ts
const responsePromise = page.waitForResponse(
  response => response.url().includes('/api/orders') && response.request().method() === 'POST',
);
await page.getByRole('button', { name: 'Place order' }).click();
await expect((await responsePromise).ok()).toBeTruthy();
```

**Rubric:** wait armed before trigger 5; response predicate specific 3; UI outcome also asserted 2.

## 12. Visual component check — Medium, 20 minutes

**Prompt:** Snapshot a header while masking a dynamic avatar and disabling animations.

**Expected solution:** `await expect(header).toHaveScreenshot('header.png', { animations: 'disabled', mask: [avatar] })`; describe review of baseline diffs and pinning the CI browser/OS environment.

**Rubric:** controls nondeterminism 4; localized screenshot 3; safe baseline review 3.

## 13. API seed, UI verify — Medium, 25 minutes

**Prompt:** Create a product through a test API, search for it through the UI, and remove it in teardown.

**Rubric:** authenticated `request` fixture 3; unique seed 2; UI validates user outcome 3; idempotent cleanup 2.

## 14. Two-user collaboration — Hard, 35 minutes

**Prompt:** Customer A creates a shared list; customer B sees it. Use two isolated browser contexts and role-specific states.

**Rubric:** creates separate contexts 4; uses distinct users 3; coordinates an observable update 2; closes contexts 1.

## 15. Diagnose a flaky test — Hard, 30 minutes

**Prompt:** Given a test containing `waitForTimeout`, `.nth(0)`, `networkidle`, a shared account, and a non-retrying `textContent()` assertion, identify and correct every defect.

**Rubric:** identifies all five 5; proposes observable waits 3; protects data isolation 2.

## 16. Project matrix — Medium, 25 minutes

**Prompt:** Configure Chromium `@smoke`, Firefox nightly, a mobile-web device project, and an auth setup dependency.

**Rubric:** projects reflect execution differences 3; tags selected by grep 2; setup dependency 3; does not multiply projects per feature 2.

## 17. Custom option fixture — Medium, 25 minutes

**Prompt:** Implement `test.use({ role: 'customer' | 'support' })` that supplies the matching storage state.

**Rubric:** option fixture types 3; states are role-specific 3; context lifecycle correct 2; discusses state expiry 2.

## 18. Poll a delayed state — Medium, 20 minutes

**Prompt:** Poll an order-status API until it becomes `DELIVERED`, then assert the UI badge.

**Expected solution:** use `expect.poll(async () => fetchStatus(...), { timeout: 30_000 }).toBe('DELIVERED')`, then a locator assertion. Do not poll the UI through fixed sleeps.

**Rubric:** bounded poll 4; clear predicate 2; final UI check 2; explains eventual consistency 2.

## 19. Locator alternatives — Medium, 20 minutes

**Prompt:** A page may show either a “Sign in” button or an already-signed-in account menu. Write a robust assertion and explain why `locator.or()` can become strict.

**Rubric:** uses `locator.or()` intentionally 4; handles the two-match case 2; avoids branching on stale element handles 2; validates required state 2.

## 20. Trace-led incident explanation — Hard, 20 minutes

**Prompt:** A trace shows that a click timed out because a newsletter overlay remained visible. Narrate the evidence, root cause, immediate test repair, and longer-term product fix.

**Rubric:** evidence before conclusion 3; no `force: true` 2; tests overlay dismissal/readiness 2; proposes product ownership/selector contract 3.

## 21. Network race under intermittent latency — Hard, 35 minutes

**Prompt:** The app clicks “Save,” then navigates when `POST /api/profile` returns 200. Under latency, a naive test either misses the response or asserts the old heading. Write a race-safe test that still fails on 500s, and explain how you would reproduce flakes with tooling.

**Sketched solution:**

```ts
test('saves profile and shows confirmation', async ({ page }) => {
  await page.goto('/profile');

  const saveResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/profile') &&
      res.request().method() === 'POST',
  );

  await page.getByLabel('Display name').fill('Pat Candidate');
  await page.getByRole('button', { name: 'Save' }).click();

  const response = await saveResponse;
  expect(response.ok()).toBeTruthy();

  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});
```

Optional diagnosis harness: `page.route('**/api/profile', async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue(); })` to force the race locally; run `--retries=0 --repeat-each=20`.

**Rubric:** arm wait before click 4; assert HTTP + UI 3; no `waitForTimeout`/`networkidle` 2; explains flake reproduction 1.

## 22. Multi-tab OAuth-style popup — Hard, 40 minutes

**Prompt:** “Continue with Partner” opens a popup, user approves, popup closes, opener shows signed-in state. Automate it with two pages and no fixed sleeps. Discuss how this differs from same-tab redirects and from `storageState` reuse.

**Sketched solution:**

```ts
test('completes partner OAuth popup', async ({ page, context }) => {
  await page.goto('/sign-in');

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Continue with Partner' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  await popup.getByLabel('Email').fill(process.env.E2E_OAUTH_EMAIL!);
  await popup.getByLabel('Password').fill(process.env.E2E_OAUTH_PASSWORD!);
  await popup.getByRole('button', { name: 'Approve' }).click();

  await popup.waitForEvent('close');
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
});
```

Notes for the interviewer: arm `waitForEvent('page')` before the click; use `context` pages, not `window` handles; prefer test IdP in non-prod; once stable, capture `storageState` in a setup project so most tests skip the popup.

**Rubric:** popup promise before trigger 4; approve + close synchronization 3; opener assertion 2; discusses setup/storageState tradeoff 1.

## 23. Iframe shopping cart — Hard, 35 minutes

**Prompt:** Product listing lives in the main frame; cart drawer is a cross-origin or same-origin iframe (`iframe[title="Cart"]`). Add an item, assert cart count in the frame, then checkout button returns focus to the parent thank-you page.

**Sketched solution:**

```ts
test('adds item through cart iframe', async ({ page }) => {
  await page.goto('/store');

  await page.getByRole('button', { name: 'Add Widget' }).click();

  const cart = page.frameLocator('iframe[title="Cart"]');
  await expect(cart.getByTestId('cart-count')).toHaveText('1');
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
});
```

If you need a `Frame` for events: `const frame = page.frame({ name: 'cart' })`—but prefer `frameLocator` for locator-based auto-waiting. Explain strictness still applies inside the frame.

**Rubric:** `frameLocator` 4; parent vs frame assertions correct 3; no `elements()[0]` frame hacks 2; discusses origin limits honestly 1.

## 24. Flake reproduction harness — Hard, 40 minutes

**Prompt:** You inherit a flaky checkout test. Build a minimal harness/script strategy (not a full product) that (a) runs with retries disabled, (b) repeats N times, (c) toggles workers, (d) forces trace/video on, and (e) optionally injects latency via `route`. Explain how you’d interpret outcomes.

**Sketched solution (commands + optional code):**

```bash
npx playwright test tests/checkout.spec.ts:42 --retries=0 --repeat-each=30 --workers=1 --trace on --video on
npx playwright test tests/checkout.spec.ts:42 --retries=0 --repeat-each=30 --workers=4 --trace on
```

```ts
// tests/support/latency.fixture.ts (optional toggle via env)
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.E2E_INJECT_LATENCY === '1') {
      await page.route('**/api/**', async (route) => {
        await new Promise((r) => setTimeout(r, Number(process.env.E2E_LATENCY_MS ?? 1000)));
        await route.continue();
      });
    }
    await use(page);
  },
});
```

Interpretation: fails with workers=1 → sync/selector/env; only with workers>1 → isolation; only with injected latency → race; passes only with retries → hidden flake.

**Rubric:** retries off + repeat-each 3; workers bisect 2; artifacts on 2; latency injection optional but reasoned 2; clear decision tree 1.

## 25. Custom fixture with auto-cleanup — Hard, 40 minutes

**Prompt:** Implement a `coupon` fixture that creates a unique percent-off coupon via API, yields `{ id, code }` to the test, deletes the coupon after the test even when assertions fail, and stays parallel-safe across workers. Type it correctly in TypeScript.

**Sketched solution:**

```ts
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

type Coupon = { id: string; code: string };

type Fixtures = {
  couponsApi: {
    create: (percentOff: number, code: string) => Promise<Coupon>;
    delete: (id: string) => Promise<void>;
  };
  coupon: Coupon;
};

export const test = base.extend<Fixtures>({
  couponsApi: async ({ request }, use) => {
    await use({
      create: async (percentOff, code) => {
        const res = await request.post('/api/coupons', { data: { percentOff, code } });
        expect(res.ok()).toBeTruthy();
        return res.json();
      },
      delete: async (id) => {
        const res = await request.delete(`/api/coupons/${id}`);
        if (res.status() !== 404) expect(res.ok()).toBeTruthy();
      },
    });
  },

  coupon: async ({ couponsApi }, use, testInfo) => {
    const code = `E2E-${testInfo.workerIndex}-${randomUUID().slice(0, 8)}`;
    const created = await couponsApi.create(10, code);
    await use(created);
    await couponsApi.delete(created.id);
  },
});

export { expect };

test('applies coupon in checkout', async ({ page, coupon }) => {
  await page.goto('/checkout');
  await page.getByLabel('Coupon').fill(coupon.code);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('discount')).toBeVisible();
});
```

**Rubric:** create before `use` / delete after 4; unique code 2; idempotent 404 handling 2; TypeScript fixture typing 2.

## Interview scorecard

| Dimension | Look for |
|---|---|
| Correctness | Executable API usage and a verified outcome |
| Playwright idioms | Locators, auto-waiting, web-first assertions |
| Isolation | Unique data, contexts, cleanup, no hidden dependencies |
| Debugging | Events armed early, artifacts, observable conditions |
| Communication | States assumptions and tradeoffs clearly |

## Next

→ [21-framework-design-for-interviews.md](./21-framework-design-for-interviews.md)
· [33-test-data-factories-and-determinism.md](./33-test-data-factories-and-determinism.md)
· [34-flake-rca-playbook.md](./34-flake-rca-playbook.md)
