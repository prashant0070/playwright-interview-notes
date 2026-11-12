# 26 — Complete Assertions Reference

## Learning goals

Choose assertions based on what is actually asynchronous, use Playwright's retrying
matchers instead of timing guesses, and recognize the distinction between locator/page/
API assertions and immediate JavaScript assertions.

---

## 1. Import and core rule

```ts
import { test, expect } from '@playwright/test';
```

Playwright Test's `expect` has two important families:

1. **Web-first assertions** on `Locator`, `Page`, and `APIResponse` retry until the
   expected state arrives or the expect timeout expires.
2. **Generic assertions** on JavaScript values run once, just like familiar Jest-style
   expectations.

Prefer the first family for UI state that is rendered asynchronously.

```ts
// Retrying: waits for the control to become visible.
await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

// Immediate: reads the current boolean and asserts it once.
expect(await page.getByRole('button', { name: 'Save' }).isVisible()).toBe(true);
```

---

## 2. Expect timeout and common options

```ts
await expect(locator).toHaveText('Saved', { timeout: 10_000 });
await expect(locator).toBeVisible({ visible: true }); // legacy option form; prefer matcher
```

The assertion timeout is separate from the test timeout and action timeout. Configure a
suite default in the config:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  expect: { timeout: 5_000 },
});
```

Use a per-expect timeout for a known slower state, not as a blanket response to flakes.
Most locator matchers accept `timeout`; text and screenshot matchers have additional
options described below.

---

## 3. Auto-retrying locator state matchers

```ts
const email = page.getByRole('textbox', { name: 'Email' });
const save = page.getByRole('button', { name: 'Save' });

await expect(email).toBeAttached();
await expect(email).toBeVisible();
await expect(email).toBeEditable();
await expect(save).toBeEnabled();
await expect(save).toBeFocused();
await expect(page.getByRole('progressbar')).toBeHidden();
await expect(page.getByTestId('toast')).toBeInViewport();
```

### `toBeAttached(options?)`

Passes when the element is attached to the DOM. It does not mean it is visible,
actionable, or enabled. Use it for DOM lifecycle requirements; use `toBeVisible` for
what users can perceive.

### `toBeVisible(options?)` and `toBeHidden(options?)`

Visible means the element is rendered with non-empty bounding box and not hidden by
relevant CSS. `toBeHidden` passes when the locator resolves to no element or only hidden
elements; it is useful after a toast/modal disappears. Negative visibility assertions
remain semantically different from merely asserting a CSS class.

### `toBeEnabled(options?)` and `toBeDisabled(options?)`

Use these for actual enabled/disabled control state. They are clearer than checking
attributes, and work with supported ARIA disabled semantics where applicable.

### `toBeEditable(options?)`

Passes for an enabled, editable input/textarea/contenteditable target. Use it before
typing when editability is an important product state.

### `toBeChecked(options?)`

For checkboxes, radios, and supported switch controls:

```ts
await expect(page.getByRole('checkbox', { name: 'Email updates' })).toBeChecked();
await expect(page.getByRole('checkbox', { name: 'Email updates' })).not.toBeChecked();
```

Options can express expected `checked` or `indeterminate` state where supported. Do not
use it for a visually selected custom widget without real checkable semantics.

### `toBeFocused(options?)`

Checks `document.activeElement`. Use it for keyboard flow, dialog focus management, and
validation behavior; it is a strong accessibility-oriented assertion.

### `toBeEmpty(options?)`

Checks that the element has no text content/children appropriate to the matcher contract.
For a text input's value, use `toHaveValue('')`, which describes the behavior better.

### `toBeInViewport(options?)`

Checks that an element intersects the viewport. `ratio` can require a minimum intersection:

```ts
await expect(page.getByRole('heading', { name: 'Reviews' }))
  .toBeInViewport({ ratio: 0.5 });
```

It does not mean fully visible, unobscured, or ready to click; use an action or a more
specific assertion as appropriate.

---

## 4. Auto-retrying locator text, count, and value matchers

```ts
const resultRows = page.getByRole('row').filter({ has: page.getByRole('cell') });

await expect(page.getByRole('heading')).toHaveText('Search results');
await expect(page.getByTestId('summary')).toContainText('3 items');
await expect(resultRows).toHaveCount(3);
await expect(page.getByLabel('Email')).toHaveValue('ada@example.test');
await expect(page.locator('select[name="country"]')).toHaveValues(['GB', 'IE']);
```

### `toHaveText(expected, options?)`

Requires full text content to match a string, regex, or ordered array for a multi-element
locator. It normalizes whitespace for string expectations. Use it when the exact displayed
content is the contract.

### `toContainText(expected, options?)`

Requires a substring/regex (or an ordered subset across multiple elements). Use it when
surrounding dynamic text is intentionally irrelevant.

```ts
await expect(page.getByRole('status')).toContainText(/saved at \d{2}:\d{2}/);
```

### `toHaveCount(number, options?)`

Waits until the locator resolves to exactly that many elements. It is the correct first
assertion before using a dynamic list's `all()` method.

### `toHaveValue(value, options?)` and `toHaveValues(values, options?)`

`toHaveValue` checks the current form control value. `toHaveValues` checks selected
values of a multi-select. These match actual form state, not visible label text.

```ts
await expect(page.getByLabel('Quantity')).toHaveValue('2');
await expect(page.locator('select[multiple]')).toHaveValues(['red', 'blue']);
```

---

## 5. Auto-retrying locator attributes, properties, and CSS

```ts
const dialog = page.getByRole('dialog', { name: 'Edit profile' });

await expect(dialog).toHaveAttribute('aria-modal', 'true');
await expect(dialog).toHaveAttribute('aria-describedby', /profile-help/);
await expect(dialog).toHaveClass(/is-open/);
await expect(dialog).toContainClass('dialog');
await expect(dialog).toHaveId('profile-dialog');
await expect(dialog).toHaveCSS('display', 'block');
await expect(dialog).toHaveJSProperty('open', true);
```

### `toHaveAttribute(name, value?, options?)`

Waits for an attribute to exist, or for its value to equal a string/regex. Prefer a
semantic matcher if one exists—for example, `toBeDisabled` instead of checking `disabled`.

### `toHaveClass(expected, options?)`

Matches the complete class value (string/regex), or class values for a multi-element
locator in order. Use when the full class contract genuinely matters.

### `toContainClass(expected, options?)`

Checks that required class tokens are present without requiring every class. It can accept
a string or array of required class names, making it less brittle than a complete class
comparison.

### `toHaveId(id, options?)`

Asserts element `id`. Prefer a user-facing locator for interaction; this is useful for
explicit DOM integration contracts, such as label/control relationships.

### `toHaveCSS(name, value, options?)`

Checks a computed CSS property. It is suitable for a small behavior such as a visually
hidden state, but screenshots are generally better for whole layout/appearance.

### `toHaveJSProperty(name, value, options?)`

Checks a DOM JavaScript property, not an attribute. Remember the distinction:
`input.value` can change while its original `value` attribute does not.

---

## 6. Auto-retrying accessible-semantics matchers

```ts
const submit = page.getByRole('button', { name: 'Place order' });

await expect(submit).toHaveRole('button');
await expect(submit).toHaveAccessibleName('Place order');
await expect(submit).toHaveAccessibleDescription(/charges your saved card/i);
await expect(page.getByLabel('Email')).toHaveAccessibleErrorMessage('Email is required');
```

### `toHaveRole(role, options?)`

Asserts the element's accessible role. Use it to protect a semantic contract, especially
when a component can accidentally become a generic `div`. It expects the exact role, not
a subclass relationship.

### `toHaveAccessibleName(expected, options?)`

Checks the computed accessible name—the label a screen reader uses for a control. This
can originate from visible text, `<label>`, `aria-label`, `aria-labelledby`, or other
accessibility naming rules.

### `toHaveAccessibleDescription(expected, options?)`

Checks computed accessible description, commonly help text connected through
`aria-describedby`. It complements, rather than replaces, the accessible name.

### `toHaveAccessibleErrorMessage(expected, options?)`

Checks the computed accessible error message for an invalid control where the application
uses the relevant ARIA error-message semantics. Use direct alert/error-summary assertions
as well when the user experience includes both.

### `toMatchAriaSnapshot(expected?, options?)`

Matches a YAML representation of the locator's accessibility subtree:

```ts
await expect(page.getByRole('navigation', { name: 'Primary' })).toMatchAriaSnapshot(`
  - link "Home"
  - link "Products"
`);
```

It retries, unlike a raw `ariaSnapshot()` call. See module 24 for snapshot scope, reviews,
and update workflow.

---

## 7. Auto-retrying screenshot matchers

```ts
await expect(page).toHaveScreenshot('account.png', {
  fullPage: true,
  animations: 'disabled',
  mask: [page.getByTestId('current-time')],
  maxDiffPixelRatio: 0.01,
});

await expect(page.getByTestId('pricing-card')).toHaveScreenshot('pricing-card.png');
```

`toHaveScreenshot` exists on `Page` and `Locator`. It captures repeatedly until two
consecutive screenshots match, then compares against the baseline. Use it for visual
contracts; stabilize fonts, data, viewport, animation, and masking rather than raising
diff tolerances first. Locator screenshots are often more maintainable than full pages.

---

## 8. Page and API-response retrying assertions

```ts
await expect(page).toHaveTitle(/Dashboard/);
await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

const response = await page.request.get('/api/health');
await expect(response).toBeOK();
```

### `toHaveTitle(expected, options?)`

Waits for the page title. This is useful for document metadata and navigation results,
but it rarely proves the page's meaningful content alone.

### `toHaveURL(expected, options?)`

Waits for the `Page` URL to match a string, regex, or predicate. It is useful after
navigation or SPA routing. Follow it with a destination UI assertion.

### `toBeOK(options?)`

Checks that an `APIResponse` has an OK HTTP status (200–299). Pair it with status/body
assertions when the contract needs more precision:

```ts
expect(response.status()).toBe(201);
await expect(response).toBeOK();
expect(await response.json()).toMatchObject({ id: expect.any(String) });
```

---

## 9. Negation and soft assertions

```ts
await expect(page.getByRole('alert')).not.toBeVisible();
await expect.soft(page.getByLabel('First name')).toHaveValue('Ada');
await expect.soft(page.getByLabel('Last name')).toHaveValue('Lovelace');
```

`.not` inverts the matcher and still retries where the underlying matcher retries.
Be precise with absence: `not.toBeVisible()` is often suitable for “not shown”; use
`toHaveCount(0)` when “not present in the DOM” is the contract.

`expect.soft` records failures but lets the test proceed. Before performing a later action
that depends on these checks, stop safely:

```ts
await expect.soft(page.getByRole('heading')).toHaveText('Profile');
await expect.soft(page.getByLabel('Name')).toHaveValue('Ada');
expect(test.info().errors).toHaveLength(0);
```

Soft expectations should not become a way to hide failures; use them when a test needs to
report multiple independent discrepancies in one run.

---

## 10. `expect.configure`, `expect.poll`, and `expect.toPass`

### Named/default expect instances

```ts
const slowExpect = expect.configure({ timeout: 15_000 });
const softExpect = expect.configure({ soft: true });

await slowExpect(page.getByRole('status')).toHaveText('Complete');
await softExpect(page.getByLabel('Email')).toHaveValue('ada@example.test');
```

Use `configure` to make intent visible in a suite or helper. Do not conceal arbitrary
timeouts inside a generic helper.

### Poll arbitrary asynchronous state

```ts
await expect.poll(
  async () => (await page.request.get('/api/jobs/42')).status(),
  { message: 'job should finish', timeout: 20_000, intervals: [500, 1_000, 2_000] },
).toBe(200);
```

`expect.poll` repeatedly runs a function and then applies generic matchers to its
returned value. Use it for API/database/service state that no locator assertion owns.
The callback should be safe to retry—avoid a poll that creates records or charges money.

### Retry a multi-step assertion block

```ts
await expect(async () => {
  const response = await page.request.get('/api/summary');
  expect(response.status()).toBe(200);
  expect((await response.json()).total).toBeGreaterThan(0);
}).toPass({ timeout: 15_000, intervals: [250, 500, 1_000] });
```

`toPass` reruns the function until every expectation inside succeeds. It is useful for
eventually consistent external state, but normal locator expectations are clearer for UI.
The callback must remain idempotent/read-only.

---

## 11. Immediate generic and asymmetric matchers

These are JavaScript-value assertions, so they do not auto-retry:

```ts
expect(2 + 2).toBe(4);                       // identity / primitives
expect({ name: 'Ada' }).toEqual({ name: 'Ada' }); // deep equality
expect({ id: '42', state: 'ready' }).toMatchObject({ state: 'ready' });
expect(['a', 'b']).toContain('a'); expect('order-42').toMatch(/^order-\d+$/);
expect(10).toBeGreaterThan(5); expect(10).toBeGreaterThanOrEqual(10);
expect(3).toBeLessThan(5); expect(3).toBeLessThanOrEqual(3); expect(0.1 + 0.2).toBeCloseTo(0.3);
expect(null).toBeNull(); expect(undefined).toBeUndefined();
expect('value').toBeTruthy(); expect('').toBeFalsy();
expect(() => JSON.parse('{')).toThrow();
```

Asymmetric matchers make partial/dynamic objects readable:

```ts
expect(await response.json()).toEqual({ id: expect.any(String), total: expect.any(Number),
  items: expect.arrayContaining([expect.objectContaining({ sku: 'headphones-42' })]) });
expect('order-42').toEqual(expect.stringMatching(/^order-\d+$/));
expect('Welcome, Ada').toEqual(expect.stringContaining('Ada'));
expect({ metadata: { source: 'ui' } }).toEqual(expect.objectContaining({ metadata: expect.objectContaining({ source: 'ui' }) }));
```

Use `expect.any`, `anything`, `arrayContaining`, `objectContaining`, `stringContaining`,
and `stringMatching` to assert stable contracts without hard-coding generated values.

## 12. Interview Q&A

1. **What is a web-first assertion?**  
   A locator/page/API assertion that retries until its condition matches or times out.
2. **Why is `expect(await locator.isVisible()).toBe(true)` weaker?**  
   It samples once and can race rendering; `toBeVisible` waits intelligently.
3. **`toHaveText` vs `toContainText`?**  
   Full expected text versus a required substring/pattern.
4. **How do you assert a removed modal?**  
   `toBeHidden` for no longer user-visible, or `toHaveCount(0)` for DOM removal.
5. **What does `toBeAttached` not prove?**  
   Visibility, enabled state, actionability, or viewport position.
6. **How do soft expectations affect execution?**  
   They record failures and continue; check `test.info().errors` before dependent actions.
7. **What is `expect.poll` for?**  
   Retrying a safe arbitrary function such as an API status query.
8. **What is `toPass` for?**  
   Retrying a whole idempotent assertion block.
9. **Why avoid updating screenshot baselines blindly?**  
   The diff may represent a real visual regression.
10. **How do accessible-name assertions help?**  
    They preserve the label assistive technology uses to identify controls.
## Next

Continue to [27 — Remote Browsers, CDP, and Connect](./27-remote-browsers-cdp-and-connect.md).
