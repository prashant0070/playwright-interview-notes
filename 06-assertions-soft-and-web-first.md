# 06 — Assertions, Soft Assertions, and Web-First Checks

## Learning goals

Distinguish retrying web-first assertions from one-shot JavaScript assertions,
choose common matchers precisely, aggregate related observations safely, and
use `poll`/`toPass` for conditions outside the DOM.

## 1. Assertions are synchronization contracts

Playwright Test exports `expect`, based on Jest-style matchers but extended for
browser automation. **Web-first** assertions target a `Locator` or `Page` and
automatically retry until the expected state occurs or the expect timeout
expires:

```ts
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
await expect(page).toHaveURL(/\/dashboard$/);
await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
```

The assertion both verifies the result and waits for it. This is superior to
“wait two seconds, then inspect,” because it finishes as soon as the condition
is true and produces a call log if it never becomes true.

Non-retrying assertions evaluate an ordinary value once:

```ts
expect([1, 2, 3]).toHaveLength(3);
expect(await page.title()).toContain('Example');
```

Use them for stable in-memory values. Do not write
`expect(await locator.textContent()).toBe('Saved')` for changing UI: the text
is sampled once and might be null or stale. Write
`await expect(locator).toHaveText('Saved')` instead.

## 2. Common web-first matchers

```ts
const status = page.getByRole('status');
await expect(status).toBeVisible();
await expect(status).toHaveText('Saved');
await expect(status).toContainText('Save');
await expect(status).toHaveClass(/success/);

const email = page.getByLabel('Email');
await expect(email).toHaveValue('ada@example.com');
await expect(email).toBeEditable();

await expect(page.getByRole('listitem')).toHaveCount(3);
await expect(page.getByRole('listitem')).toHaveText(['one', 'two', 'three']);
await expect(page).toHaveTitle(/Example Domain/);
await expect(page).toHaveURL('https://example.com/');
```

Choose exactness deliberately. `toHaveText` checks complete normalized text;
`toContainText` checks a substring and can be less brittle for longer content.
Use a regular expression when controlled variation is part of the contract.
For absence, `not.toBeVisible()` waits for hidden/detached state; it is
different from asserting a locator never existed.

## 3. Soft assertions

A hard assertion stops the test at the first failure. A soft assertion records
the failure and lets the test continue:

```ts
await expect.soft(page.getByRole('heading')).toHaveText('Profile');
await expect.soft(page.getByLabel('Name')).toHaveValue('Ada');

// Stop before a later action whose result would be misleading.
expect(test.info().errors).toHaveLength(0);
```

Soft checks are valuable when one page inspection should report several
independent discrepancies. They are dangerous for prerequisite checks: if a
failed login is soft, later failures merely add noise. Use hard assertions for
critical gates, and check `test.info().errors` before proceeding to an action
that assumes earlier expectations passed.

## 4. Configured expectations and messages

Set the default retry budget centrally:

```ts
export default defineConfig({
  expect: { timeout: 5_000 },
});
```

Create a local expectation policy when a category needs different behaviour:

```ts
const slowExpect = expect.configure({ timeout: 15_000 });
await slowExpect(page.getByRole('status')).toHaveText('Processed');

await expect(
  page.getByRole('alert'),
  'A failed save must explain the problem to the user',
).toBeVisible();
```

Custom messages improve reports; they do not replace a precise locator and
matcher. Prefer a narrow, documented timeout for genuinely asynchronous work
over increasing all expectations.

## 5. `expect.poll` and `expect.toPass`

`expect.poll` repeatedly evaluates a function until a normal matcher passes.
Use it for API state, browser-side storage, or other values that are not
locators:

```ts
await expect.poll(
  async () => (await page.request.get('/health')).status(),
  { message: 'service should become healthy', timeout: 10_000 },
).toBe(200);
```

`expect(...).toPass()` retries a block that contains one or more assertions:

```ts
await expect(async () => {
  const response = await page.request.get('/api/jobs/latest');
  expect(response.status()).toBe(200);
  expect((await response.json()).state).toBe('complete');
}).toPass({ timeout: 20_000 });
```

Keep both side-effect free where possible. Retrying a block that creates an
order, clicks a destructive button, or sends email can duplicate work.

## 6. Screenshot assertion introduction

`await expect(page).toHaveScreenshot()` compares a rendered image with an
approved baseline and retries for a stable image. It is powerful for visual
regressions but needs controlled fonts, viewport, data, animation, and
platform policy. Visual testing and baseline management are covered in the
later visual/accessibility module; do not use screenshots as the primary
assertion for ordinary text, roles, or values.

## 7. Tutorial lab

```ts
test('marks a TodoMVC item complete', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  const input = page.getByPlaceholder('What needs to be done?');
  await input.fill('use web-first assertions');
  await input.press('Enter');

  const item = page.getByRole('listitem');
  await expect(item).toHaveText('use web-first assertions');
  await item.getByRole('checkbox').check();
  await expect(item).toHaveClass(/completed/);
});
```

Replace the first locator assertion with `textContent()` and introduce a slow
render locally. Notice that the one-shot assertion loses the useful retry
behaviour.

## 8. Pitfalls

* Extracting text/value first converts a retrying UI check into a one-shot
  assertion.
* Soft assertions should not guard required setup or navigation.
* `toContainText` can allow an unintended larger message; use exact text when
  exact content matters.
* Polling a side-effecting callback can repeat the side effect.
* Raising expect timeout globally hides a locator or product readiness issue.

## Interview Q&A

1. **What is a web-first assertion?** A locator/page assertion that retries
   until the expected browser state or timeout.
2. **Why is `toHaveText` better than `textContent()` for dynamic UI?** It
   retries and reports the locator state; `textContent()` samples once.
3. **Hard versus soft expect?** Hard stops the test; soft records failure and
   continues.
4. **When should soft assertions be avoided?** Preconditions such as login,
   navigation, and required data creation.
5. **How do you stop after soft failures?** Assert
   `test.info().errors` has length zero.
6. **What does `expect.configure` do?** Produces an expectation instance with
   defaults such as a different timeout or soft mode.
7. **What is `expect.poll` for?** Retrying a function that returns a changing
   non-locator value.
8. **What is `toPass` for?** Retrying a block containing multiple assertions.
9. **Why should a `toPass` block avoid side effects?** The block may run many
   times, duplicating actions.
10. **`toHaveText` versus `toContainText`?** Complete expected text versus
    expected substring/content.
11. **What does `not.toBeVisible` mean?** It waits for the matched element to
    become hidden or detached.
12. **What timeout applies to web-first expectations?** The configured expect
    timeout, unless overridden locally.
13. **When use screenshot assertions?** For controlled visual contracts, not
    as a substitute for semantic UI assertions.
14. **Why add custom expect messages?** They make failure intent clear in
    reports without changing assertion semantics.

## 9. Web-first assertion theory
A web-first assertion is both a verification and a synchronization contract.
Instead of sampling the page at one arbitrary instant, Playwright repeatedly
resolves the locator and checks the matcher until it passes or its timeout
expires.

```ts
await expect(page.getByRole('status')).toHaveText('Import complete');
```

The assertion asks a precise question: “will this user-visible status become
this text?” A fixed delay asks only whether enough time happened to pass.
Web-first checks are usually faster on a healthy system and provide locator
and retry diagnostics on failure.

Do not turn a locator into a one-shot value before asserting:

```ts
// Snapshot: can be null, stale, or early.
expect(await page.getByRole('status').textContent()).toBe('Ready');

// Retrying browser assertion.
await expect(page.getByRole('status')).toHaveText('Ready');
```

## 10. Major matchers and when to use them
### Presence, visibility, and state

```ts
await expect(page.getByRole('dialog')).toBeVisible();
await expect(page.getByRole('dialog')).toBeHidden();
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
await expect(page.getByLabel('Email')).toBeEditable();
await expect(page.getByRole('checkbox', { name: 'Terms' })).toBeChecked();
```

Use `toBeVisible` for a user-observable element. Use `toBeHidden` when the
contract is that it becomes hidden or detached. Use `toBeAttached` when DOM
presence, rather than visibility, is the requirement. Use enabled, editable,
checked, focused, and empty matchers for native control state.

### Text, values, and attributes

```ts
await expect(page.getByRole('alert')).toHaveText('Email is required');
await expect(page.getByRole('status')).toContainText('Saved');
await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');
await expect(page.getByRole('link', { name: 'Invoice' }))
  .toHaveAttribute('href', /\/invoices\/\d+$/);
```

`toHaveText` checks complete normalized text. `toContainText` is appropriate
for a deliberate stable fragment. `toHaveValue` checks form value, not visible
text. `toHaveAttribute` asserts a public HTML contract such as a link target.

### Lists, classes, and CSS

```ts
const rows = page.getByRole('listitem');
await expect(rows).toHaveCount(3);
await expect(rows).toHaveText(['One', 'Two', 'Three']);
await expect(rows.nth(0)).toHaveClass(/selected/);
await expect(rows.nth(0)).toHaveCSS('display', 'list-item');
```

Use `toHaveText` with an array when order itself is specified. CSS assertions
are useful for a narrow visual-state contract but should not replace semantic
checks of roles, text, and values.

### Page and response matchers

```ts
await expect(page).toHaveURL(/\/settings$/);
await expect(page).toHaveTitle('Settings');
await expect(response).toBeOK();
```

URL and title checks are web-first for a page. `toBeOK` verifies an API
response status in the successful range; pair it with body assertions when
the response meaning matters.

## 11. Hard versus soft: a failure philosophy
Hard assertions stop at the first invalid prerequisite. They are correct for
login completion, navigation, data creation, and any condition required for
the next action.

Soft assertions collect independent observations during an inspection:

```ts
await expect.soft(page.getByRole('heading')).toHaveText('Profile');
await expect.soft(page.getByLabel('Name')).toHaveValue('Ada');
await expect.soft(page.getByLabel('Email')).toHaveValue('ada@example.com');
expect(test.info().errors).toHaveLength(0);
```

The final hard check prevents later actions from producing confusing secondary
failures. Do not make every assertion soft: an error report with twenty
consequences of a failed login is less useful than the first causal failure.

## 12. `expect.configure`, messages, and budgets

```ts
const slowExpect = expect.configure({ timeout: 15_000 });
const softExpect = expect.configure({ soft: true });

await slowExpect(page.getByRole('status')).toHaveText('Processed');
await expect(page.getByRole('alert'), 'Save errors must be announced').toBeVisible();
await softExpect(page.getByText('Optional detail')).toBeVisible();
```

Configured instances allow local policy without mutating the global default.
Custom messages explain business intent in reports; they do not repair broad
locators. Choose a longer timeout only for a known asynchronous contract.

## 13. Polling and retries outside the DOM
`expect.poll` repeatedly obtains a value and applies an ordinary matcher.

```ts
await expect.poll(
  async () => (await page.request.get('/health')).status(),
  { timeout: 10_000, intervals: [100, 250, 500] },
).toBe(200);
```

`toPass` retries a whole block. It is suited to several related eventual
checks, such as status plus JSON shape:

```ts
await expect(async () => {
  const response = await page.request.get('/api/jobs/latest');
  expect(response.status()).toBe(200);
  expect((await response.json()).state).toBe('complete');
}).toPass({ timeout: 20_000 });
```

Both callbacks should be idempotent. A retried callback that clicks Publish,
creates a record, or sends a request with side effects can duplicate work.

## 14. Negation and absence
Negation is still a contract. `not.toBeVisible()` waits until a matched target
is hidden or detached; it does not mean Playwright proved it never existed.

```ts
await expect(page.getByRole('progressbar')).not.toBeVisible();
await expect(page.getByText('Invalid credentials')).not.toBeVisible();
```

Use a positive assertion whenever possible. “The error is gone” is meaningful
after a correction; “nothing is visible” is often too broad to diagnose.

## 15. Anti-pattern clinic
* `expect(await locator.textContent())` loses retry behavior.
* `toContainText('error')` can accept an unintended larger message.
* Soft assertions on setup obscure the root cause.
* Polling a mutating callback repeats side effects.
* Raising global expect timeout masks broken readiness and slows feedback.
* Screenshot assertions for text or roles produce less actionable failures.

## 16. Labs
### Lab A — snapshot versus web-first
Create a delayed success message. Compare a `textContent()` assertion with
`toHaveText`; record which one carries useful retry diagnostics.

### Lab B — soft inspection
Build a profile page with three independent fields. Use soft expectations,
then add a hard `test.info().errors` gate before clicking Edit.

### Lab C — eventual API state
Poll a read-only status endpoint until it is complete. Rewrite an unsafe
version whose callback triggers completion, and explain the duplication risk.

### Lab D — exactness
Make two alerts, “Saved” and “Not saved”. Compare `toContainText('saved')`
with exact, case-aware expected text and explain the false positive.

## Expanded interview Q&A
15. **What is web-first?** A page or locator matcher that retries browser state.
16. **Why not assert `textContent()`?** It samples once rather than waiting.
17. **When use `toBeAttached`?** When DOM attachment matters but visibility does not.
18. **When use `toBeHidden`?** When a known element must hide or detach.
19. **What does `toHaveValue` verify?** The current form-control value.
20. **What does `toHaveText` normalize?** Whitespace in rendered textual content.
21. **When use array text expectations?** To verify a collection and its specified order.
22. **When use `toHaveAttribute`?** To verify a meaningful HTML attribute contract.
23. **What does `toBeOK` check?** A successful HTTP response status range.
24. **Which assertions should stay hard?** Preconditions and causal gates.
25. **Why check soft errors explicitly?** To stop before misleading dependent actions.
26. **What does `expect.configure` return?** An expectation instance with local defaults.
27. **What is a custom expectation message for?** Explaining business intent in reports.
28. **What should `poll` callbacks avoid?** Side effects and expensive uncontrolled work.
29. **What should `toPass` blocks contain?** Idempotent related assertions.
30. **Does negation skip waiting?** No; it waits for the negated state.
31. **Why prefer semantic checks over screenshots?** They identify the failed contract directly.
32. **Where is the full matcher catalog?** [26 — Assertions complete reference](./26-assertions-complete-reference.md).

---

For the full matcher catalog, options, and negated forms, see
[26 — Assertions complete reference](./26-assertions-complete-reference.md).

Next: [07 — Fixtures, hooks, and test info](./07-fixtures-hooks-and-test-info.md)
