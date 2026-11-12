# 05 — Actions, Auto-Waiting, and Timeouts

## Learning goals

Use actions as a user would, understand what Playwright waits for before
acting, coordinate navigation/popups/downloads correctly, and set timeouts as
explicit budgets rather than hiding failures.

## 1. Actionability is purposeful synchronization

Before `locator.click()`, Playwright repeatedly resolves the locator and checks
that it resolves to one element, is visible, stable (not moving), receives
events at the intended point, and is enabled. `check()` similarly requires a
stable, visible, enabled target that receives events. `fill()` requires a
visible, enabled, editable control. Playwright then scrolls the target into
view as needed.

```ts
await page.getByRole('button', { name: 'Save changes' }).click();
```

This is why an immediate click can be reliable while a raw DOM click or sleep
is not. Auto-waiting does **not** know your business completion condition:
after clicking Save, assert the confirmation, URL, or changed data that the
user should observe.

## 2. Major actions

```ts
await page.getByLabel('Email').fill('ada@example.com'); // replaces value
await page.getByLabel('Email').clear();
await page.getByLabel('Search').press('Enter');
await page.getByRole('checkbox', { name: 'Terms' }).check();
await page.getByRole('option', { name: 'Blue' }).selectOption('blue');
await page.getByText('Item').hover();
await page.getByRole('button', { name: 'Delete' }).dblclick();
await page.getByLabel('Avatar').setInputFiles('fixtures/avatar.png');
```

`fill()` is normally the right way to set form content: it focuses the input
and replaces its value. `pressSequentially()` sends individual key events,
which is slower but useful when the application intentionally responds to each
keystroke (masking, autocomplete, typeahead).

```ts
await page.getByRole('combobox').pressSequentially('play', { delay: 40 });
```

## 3. Force and trial

`force: true` bypasses selected actionability checks. It can click through an
overlay and create a false-positive test, so use it only when the requirement
is explicitly a low-level interaction and document why.

`trial: true` performs actionability checks without performing the action:

```ts
await page.getByRole('button', { name: 'Publish' }).click({ trial: true });
```

It is useful to test readiness or investigate a failure. It is not a normal
assertion replacement.

## 4. Navigation and meaningful waits

`page.goto(url, { waitUntil })` defaults to `load`. Valid milestones include
`'commit'`, `'domcontentloaded'`, `'load'`, and `'networkidle'`. Choose the
earliest milestone that supports the immediate next assertion. `networkidle`
means no network connections for a short period; polling, analytics, and
long-lived connections make it a poor universal readiness signal.

```ts
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
await expect(page.getByRole('heading')).toBeVisible();

await page.getByRole('link', { name: 'Account' }).click();
await page.waitForURL(/\/account$/);
```

For a specific API dependency, create the wait **before** triggering it:

```ts
const responsePromise = page.waitForResponse(response =>
  response.url().includes('/api/profile') && response.ok(),
);
await page.getByRole('button', { name: 'Refresh' }).click();
await responsePromise;
```

Use `waitForLoadState` only when a document lifecycle state is truly the
requirement; web-first assertions are often a better user-visible wait.

## 5. Dialogs, downloads, uploads, and popups

Dialogs block page execution. Register the handler before the triggering
action; ignoring a dialog can make the click appear stuck.

```ts
page.once('dialog', dialog => dialog.accept());
await page.getByRole('button', { name: 'Delete' }).click();
```

Downloads and popups are events, so start waiting first to avoid a race:

```ts
const downloadPromise = page.waitForEvent('download');
await page.getByRole('link', { name: 'Export CSV' }).click();
const download = await downloadPromise;
await download.saveAs('artifacts/export.csv');

const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Open help' }).click();
const popup = await popupPromise;
await popup.waitForLoadState();
```

For uploads, `setInputFiles` targets the file input directly; no native file
chooser UI needs automation.

## 6. Timeout hierarchy

```ts
export default defineConfig({
  timeout: 30_000,                 // complete test, including hooks
  expect: { timeout: 5_000 },      // retrying assertions
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
});
```

A test can call `test.setTimeout(60_000)` for a justified exceptional flow.
Individual actions/expectations also accept `timeout`. The closest applicable
setting wins. Keep budgets finite: zero means no timeout for several APIs and
can hang CI. Increase a timeout only after proving a valid operation sometimes
needs that budget; otherwise fix the locator, readiness condition, or product.

## 7. Why `waitForTimeout` is bad

```ts
await page.waitForTimeout(2_000); // Avoid in production tests.
```

It waits too long when the system is fast and still fails when it is slow. It
does not establish why the page is ready. Wait for an accessible UI result,
URL, response, event, or documented state instead. A short sleep can be
acceptable while manually demonstrating a UI, not as test synchronization.

## 8. Tutorial lab

```ts
test('adds a todo and waits for the visible result', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  const input = page.getByPlaceholder('What needs to be done?');
  await input.fill('replace sleeps');
  await input.press('Enter');
  await expect(page.getByRole('listitem')).toHaveText('replace sleeps');
});
```

Temporarily place a CSS transition over the input in a local demo. Observe an
ordinary action wait or fail with an actionability call log; then resist
“fixing” it with force unless user interaction should truly bypass the overlay.

## 9. Pitfalls

* `force` can prove a synthetic click, not a usable UI.
* Waiting for a response after the click can miss a very fast response.
* A dialog handler must be registered before the triggering operation.
* `fill` does not model every keyboard-driven widget; use sequential typing
  only where per-key events are product behaviour.
* Bigger global timeouts make broken tests take longer to fail.

## Interview Q&A

1. **What does click auto-wait for?** A single visible, stable, enabled target
   that receives events, plus necessary scrolling.
2. **Does a click wait for business completion?** No; assert the outcome or
   wait for the specific URL/response/event.
3. **`fill` versus `pressSequentially`?** Fill replaces a value efficiently;
   sequential typing emits per-key events.
4. **When use `force`?** Rarely, only for a documented low-level case; it
   bypasses safeguards and can hide an overlay defect.
5. **What is `trial`?** A dry run of actionability checks without the action.
6. **Why avoid `networkidle` as a default?** Background polling/connections
   make it unrelated to meaningful product readiness.
7. **Why create event promises first?** To avoid missing popup/download/
   response events caused immediately by the action.
8. **How do you handle a dialog?** Register `page.once('dialog', ...)` before
   the triggering action.
9. **What timeout covers a full test?** `timeout`, including hooks.
10. **What timeout controls retrying assertions?** `expect.timeout`.
11. **Why is `waitForTimeout` flaky?** It guesses duration instead of waiting
    for a causal, observable state.
12. **How do you upload a file?** `setInputFiles` on the file input.

## 10. Actionability internals
Auto-waiting is a sequence of checks performed immediately before an action.
Playwright repeatedly resolves the locator, applies strictness, and waits for
the checks required by that action. It scrolls the target into view when needed.

```text
locator -> exactly one element -> required checks -> scroll -> input event
                         |              |
                         +-- retry until action timeout expires
```

For `click`, `dblclick`, `tap`, and `check`, the target must be visible,
stable, receive pointer events at the action point, and be enabled. `fill`
requires visibility, enabled state, and editability. `hover` requires
visibility, stability, and event reception. `selectOption` requires a visible
and enabled `<select>`.

“Visible” means it has a non-empty bounding box and is not `visibility:hidden`.
“Stable” means its bounding box is not changing across animation frames.
“Receives events” means another element, such as a modal backdrop or fixed
header, is not intercepting the intended point.

## 11. Action categories
### Mouse and touch-like actions

```ts
await page.getByRole('button', { name: 'Open menu' }).click();
await page.getByText('More actions').hover();
await page.getByRole('button', { name: 'Zoom in' }).dblclick();
await page.getByRole('button', { name: 'Accept' }).tap();
```

Use `click({ button: 'right' })` for a context menu and `click({ modifiers:
['Control'] })` only when the modifier is product behavior. Avoid coordinates
unless testing a canvas or genuinely coordinate-based surface.

### Text and keyboard input

```ts
const search = page.getByRole('searchbox', { name: 'Search' });
await search.fill('playwright');
await search.press('Enter');
await page.keyboard.press('Escape');
```

`fill()` replaces the full value. `clear()` removes it. `pressSequentially()`
emits individual key events and is appropriate for typeahead, masking, or a
widget whose behavior intentionally depends on each keystroke.

### Form controls

```ts
await page.getByRole('checkbox', { name: 'Accept terms' }).check();
await page.getByRole('radio', { name: 'Monthly' }).check();
await page.getByLabel('Language').selectOption('en');
await page.getByLabel('Avatar').setInputFiles('fixtures/avatar.png');
```

Use `check` and `uncheck`, not `click`, when the requirement is a final
checkbox state. `selectOption` is for native selects; a custom combobox is
usually operated through its textbox and options.

### Dragging and scrolling

```ts
await page.getByTestId('card-a').dragTo(page.getByTestId('done-column'));
await page.getByRole('heading', { name: 'Release notes' }).scrollIntoViewIfNeeded();
```

Drag-and-drop behavior can vary by application; assert the visible result,
not merely completion of the drag call.

## 12. Force and trial are diagnostic tools
`force: true` skips selected checks, notably whether the element receives
events. It can prove a synthetic DOM event occurred while a real user would
be blocked by an overlay.

```ts
await page.getByRole('button', { name: 'Publish' }).click({ trial: true });
```

`trial: true` runs actionability checks without performing the action. Use it
to investigate readiness. It is not a replacement for asserting user-visible
state. Prefer fixing the overlay, locator, or readiness condition over force.

## 13. Timeout cascade

```text
test timeout
  ├─ hook timeout / test.setTimeout
  ├─ navigation timeout
  ├─ action timeout
  └─ expect timeout
       └─ per-call timeout (closest applicable budget)
```

```ts
export default defineConfig({
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { actionTimeout: 10_000, navigationTimeout: 15_000 },
});
```

The full test timeout is the outer ceiling, including hooks. Action and
navigation budgets limit their respective operations. Expect timeout controls
web-first matcher retries. A per-call timeout is appropriate for a documented,
exceptional operation; it should not disguise a missing synchronization signal.

## 14. Navigation races
For navigation triggered by a click, let the locator action perform its normal
waiting and assert the outcome:

```ts
await page.getByRole('link', { name: 'Account' }).click();
await expect(page).toHaveURL(/\/account$/);
await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
```

For an event that can happen immediately, register the promise first:

```ts
const response = page.waitForResponse(
  item => item.url().includes('/api/profile') && item.ok(),
);
await page.getByRole('button', { name: 'Refresh' }).click();
await response;
```

Avoid a generic `waitForLoadState('networkidle')` as a business-ready signal:
polling, telemetry, and streaming can keep network activity alive. Use the URL,
response, dialog, popup, download, or visible result that actually matters.

## 15. Dialogs, downloads, popups, and file choosers
Dialogs halt page execution, so the handler must exist before the trigger.

```ts
page.once('dialog', async dialog => {
  expect(dialog.type()).toBe('confirm');
  await dialog.accept();
});
await page.getByRole('button', { name: 'Delete' }).click();
```

Downloads and new pages are likewise event races:

```ts
const downloadPromise = page.waitForEvent('download');
await page.getByRole('link', { name: 'Export CSV' }).click();
const download = await downloadPromise;
await download.saveAs('artifacts/export.csv');

const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Open help' }).click();
const popup = await popupPromise;
await expect(popup).toHaveTitle(/Help/);
```

If the page dynamically creates a file input, wait for `filechooser` before
the trigger; otherwise call `setInputFiles` on a known input directly.

## 16. More pitfalls
* Auto-waiting does not wait for a background job to finish; assert its result.
* A successful `click` does not prove the intended navigation happened.
* `noWaitAfter` should not be used to hide an unfinished navigation.
* A disabled button is correctly unclickable; do not force it.
* Increasing global test timeout makes genuine failures slower to diagnose.
* `waitForTimeout` guesses duration rather than observing causality.

## 17. Labs
### Lab A — overlay diagnosis
Place a temporary overlay over a button. Read the actionability call log,
remove the overlay through product behavior, and demonstrate why force gives
misleading confidence.

### Lab B — response race
Trigger a fast request once with `waitForResponse` after the click, then with
the promise created first. Explain the race.

### Lab C — download contract
Download a file, assert `suggestedFilename()`, save it in test output, and
verify the UI reports completion.

### Lab D — budget review
Give a test a 30-second outer timeout. Assign action, navigation, and expect
budgets. For each budget, name the observable event that consumes it.

## Expanded interview Q&A
13. **What does visible mean for actionability?** A non-empty box not hidden by visibility.
14. **What does stable mean?** The element has stopped moving between animation frames.
15. **Why check event reception?** An overlay may intercept a real click.
16. **What does fill require?** A visible, enabled, editable target.
17. **Why use `check` instead of click?** It expresses and guarantees desired checked state.
18. **When use sequential typing?** When the product reacts to each keyboard event.
19. **What does `trial` do?** Runs actionability checks without the action.
20. **Why is force dangerous?** It bypasses evidence that a user can interact.
21. **Which timeout is the outer ceiling?** The test timeout.
22. **What does action timeout govern?** A single action's waiting budget.
23. **What does navigation timeout govern?** Navigation-related waiting.
24. **What does expect timeout govern?** Retry time for web-first assertions.
25. **Why start event waits first?** The event might occur before a later wait is registered.
26. **How do dialogs affect tests?** An unhandled dialog blocks page progress.
27. **How do you test a download?** Wait for its event, inspect, and save it.
28. **Why avoid network idle by default?** It does not mean user-visible readiness.
29. **What should follow an action?** An assertion of the meaningful outcome.
30. **When are coordinates appropriate?** Canvas or inherently coordinate-driven UI.

---

Next: [06 — Assertions, soft assertions, and web-first checks](./06-assertions-soft-and-web-first.md)
