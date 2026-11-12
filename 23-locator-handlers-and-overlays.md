# 23 — Locator Handlers and Overlay Resilience

## Learning goals

Use `page.addLocatorHandler()` deliberately to remove unpredictable UI that blocks real
user actions. Understand its lifecycle, its waiting semantics, and why it is a targeted
escape hatch—not a replacement for normal product flows.

---

## 1. Why overlays create flaky tests

An overlay is UI rendered above or around the intended target: a cookie-consent dialog,
newsletter prompt, chat launcher, sign-in wall, “new feature” coach mark, or modal.
It may be visually obvious, transparent, delayed, A/B-tested, or appear only after a
server-side decision. Consequently, a test can find the intended button but fail during
the click actionability check because another element receives pointer events.

Playwright normally waits for an element to be visible, stable, enabled, and able to
receive events. That is useful: the failure can expose a real product problem. But some
third-party or globally injected UI is irrelevant to every scenario and is legitimately
handled as environmental noise.

Do not “solve” this with `{ force: true }`. A forced click bypasses the receive-events
check, may click through UI a user cannot click through, and hides the reason a test
failed.

---

## 2. The API and the mental model

```ts
import { test, expect, type Page } from '@playwright/test';

async function dismissCookieBanner(page: Page) {
  await page.addLocatorHandler(
    page.getByRole('dialog', { name: /cookies|privacy/i }),
    async () => {
      await page.getByRole('button', { name: /accept all|accept/i }).click();
    },
  );
}

test('can add an item', async ({ page }) => {
  await dismissCookieBanner(page);
  await page.goto('/shop');
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await expect(page.getByRole('status')).toHaveText(/added/i);
});
```

`addLocatorHandler(locator, handler, options?)` registers a handler on one `Page`.
Before Playwright performs an actionability check for an action or auto-retrying
assertion, it can inspect the registered trigger locator. If the trigger is visible,
Playwright runs the handler, then continues toward the original operation.

The handler is not a background browser event listener and does not eagerly poll the DOM.
Think of it as a recovery step integrated into Playwright’s waiting/actionability path.
Therefore, it cannot guarantee that arbitrary application code which does not involve
Playwright is never covered by an overlay.

---

## 3. A robust cookie-banner pattern

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const banner = page.getByRole('dialog', { name: /cookie consent/i });

  await page.addLocatorHandler(banner, async () => {
    await banner.getByRole('button', { name: /accept all cookies/i }).click();
    await expect(banner).toBeHidden();
  });
});

test('searches the catalogue', async ({ page }) => {
  await page.goto('/catalogue');
  await page.getByRole('searchbox', { name: 'Search' }).fill('wireless headphones');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /results/i })).toBeVisible();
});
```

Use a semantic trigger and a semantic dismissal control. The handler asserts that its
own work completed so a second blocked action has a diagnosable cause. Keep the handler
small: a long flow consumes the timeout of the original operation and makes failures
harder to interpret.

If the banner is deterministic, prefer setting its real consent state once: for example,
visit it and dismiss it in a setup project, then save `storageState`. That models the
user decision and avoids work in every test.

---

## 4. One-time dismiss vs recurring interference

### Dismiss once when it is part of the journey

```ts
test('records a cookie decision', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject optional cookies' }).click();
  await expect(page.getByRole('dialog', { name: /cookie/i })).toBeHidden();
});
```

Use a direct action when consent itself is under test, when it is guaranteed to appear,
or when its state matters to later assertions.

### Register a handler when it is incidental and nondeterministic

```ts
await page.addLocatorHandler(
  page.getByRole('dialog', { name: /subscribe to updates/i }),
  async () => {
    await page.getByRole('button', { name: 'Close' }).click();
  },
);
```

This is appropriate for an occasional global prompt that is unrelated to every test in a
suite. The trigger must be narrow enough that the handler never dismisses a dialog that
the test intentionally needs to verify.

---

## 5. Lifecycle, repetitions, and cleanup

The registration returns nothing. By default, a handler may run again every time its
trigger becomes visible during a later Playwright action or assertion. That is suitable
for a recurring chat popup. Use `{ times: 1 }` for a handler that should be invoked only
once.

```ts
const handler = await page.addLocatorHandler(
  page.getByRole('dialog', { name: 'Welcome' }),
  async () => page.getByRole('button', { name: 'Got it' }).click(),
  { times: 1 },
);

// `handler` is void; removal uses the trigger locator.
await page.removeLocatorHandler(page.getByRole('dialog', { name: 'Welcome' }));
```

`removeLocatorHandler(locator)` removes the handler previously registered for that
locator. Use the same locator object/reference where practical. Remove a temporary
handler before a phase that deliberately tests the overlay, and avoid registering broad
handlers in a shared fixture without explaining their scope.

```ts
const upgradeDialog = page.getByRole('dialog', { name: 'Upgrade plan' });
await page.addLocatorHandler(upgradeDialog, async () => {
  await upgradeDialog.getByRole('button', { name: 'Not now' }).click();
});

await page.getByRole('button', { name: 'Export report' }).click();
await page.removeLocatorHandler(upgradeDialog);

// This assertion now tests the real upgrade dialog rather than auto-dismissing it.
await page.getByRole('button', { name: 'Open upgrade' }).click();
await expect(upgradeDialog).toBeVisible();
```

---

## 6. `noWaitAfter` and post-handler state

After a handler returns, Playwright normally waits for the trigger locator to become
hidden. This prevents the original action from immediately being blocked by the same
overlay. If the handler intentionally leaves the trigger visible, use `noWaitAfter`.

```ts
await page.addLocatorHandler(
  page.getByTestId('floating-help'),
  async () => {
    await page.getByTestId('help-minimize').click();
    // The outer widget remains present and visible.
  },
  { noWaitAfter: true },
);
```

Choose it only when the overlay is genuinely no longer obstructive but still visible.
Otherwise it weakens the useful contract that the handler actually cleared the obstacle.
The handler should usually act on the trigger or make its non-blocking state explicit.

Handlers can change page state and focus. Avoid keeping a focused input, selection,
mouse position, or keyboard modifier state across an operation that may invoke one.
Make the subsequent user action self-contained.

---

## 7. When *not* to use a locator handler

- Do not hide a first-party modal that is the behavior being tested.
- Do not use it to “fix” an incorrect or unstable locator.
- Do not use it for navigation, login, checkout, multi-step onboarding, or critical
  product workflow; model those flows explicitly.
- Do not register a generic `page.locator('dialog')` handler; it can dismiss the wrong
  dialog and invalidate the test.
- Do not use it to permanently conceal a regression where an overlay traps users.
- Do not use it when `storageState`, server test data, a feature flag, or a stable
  environment setting can eliminate the nondeterminism at the source.

Treat registration as an exception with a comment naming the external/infrastructure UI
and why it is outside the scenario.

---

## 8. Troubleshooting checklist

1. Read the actionability error first—it identifies the element intercepting events.
2. Confirm the overlay is irrelevant to the scenario.
3. Prefer a user-facing role/name locator for both trigger and close control.
4. Ensure the handler can run after every navigation where the overlay can return.
5. Assert the close action or wait for the obstructing state to end.
6. Use `trace: 'on-first-retry'` or UI mode to confirm handler timing.
7. Remove the handler when testing the underlying overlay.

---

## 9. Interview Q&A

1. **What problem does `addLocatorHandler` solve?**  
   It handles unexpected, irrelevant UI that blocks Playwright actionability checks.

2. **Does it continuously watch the page?**  
   No. It participates when Playwright is about to act or retry an assertion; it is not
   a general DOM observer.

3. **Why not use `force: true`?**  
   Force bypasses a user-relevant safety check and can hide a blocked interaction.

4. **When should a cookie banner be dismissed directly?**  
   When consent is part of the scenario or its state is intentional and deterministic.

5. **When is a handler better?**  
   For incidental, sporadic global UI that can obstruct unrelated tests.

6. **What happens after a handler finishes by default?**  
   Playwright waits for its trigger to be hidden before resuming the interrupted work.

7. **What is `noWaitAfter` for?**  
   It opts out of that hide wait when the trigger stays visible but no longer blocks.

8. **Can a handler run more than once?**  
   Yes, unless its `times` option limits invocations.

9. **How do you remove one?**  
   Call `page.removeLocatorHandler(triggerLocator)`.

10. **What is the main risk of a broad handler?**  
    It can dismiss or mutate UI the test was supposed to validate, producing false passes.

11. **How would you test the popup itself?**  
    Do not register its handler (or remove it); assert its accessible dialog semantics and
    its explicit user controls.

12. **What is a better long-term solution to a known banner?**  
    Establish its consent/storage state in controlled setup where that represents reality.

---

## 10. Lab — resilient global prompt handling

1. Create a test that visits a page with a delayed cookie dialog.
2. First reproduce the blocked click without `force`.
3. Add a handler targeting only the cookie dialog and click its “Accept” button.
4. Add an assertion in the handler that the dialog becomes hidden.
5. Verify the business assertion still uses a role-based locator.
6. Change the prompt to recur and observe the default repeated behavior.
7. Add `{ times: 1 }`, then explain why it is correct or incorrect for that product.
8. Remove the handler and write a separate test that verifies the consent dialog itself.

## Next

Continue to [24 — ARIA Snapshots](./24-aria-snapshots.md) to test meaningful
accessibility-tree structure instead of only pixels.
