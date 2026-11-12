# 04 — Locators Deep Dive

## Learning goals

Choose locators that represent how users perceive the UI, compose and narrow
them safely, work with lists/frames/shadow DOM, and explain strictness without
reaching for brittle selector paths.

## 1. Locator philosophy

A `Locator` is a lazy, retryable description of one or more elements. It does
not immediately return an `HTMLElement`; Playwright resolves it immediately
before an action or assertion and retries while required conditions are unmet.
This prevents a common stale-element race after a framework rerenders the DOM.

Prefer locators that test the product's accessible contract:

```ts
page.getByRole('button', { name: 'Save' });
page.getByLabel('Email address');
page.getByPlaceholder('What needs to be done?');
page.getByText('Signed in successfully', { exact: true });
page.getByAltText('Company logo');
page.getByTitle('Close');
page.getByTestId('purchase-button');
```

Role plus accessible name is usually the strongest default because it reflects
what an assistive-technology user can find. A failing role locator can expose
an accessibility regression (for example, a clickable `div` without a button
role), rather than merely a test issue.

### Recommended priority

1. `getByRole` with a meaningful accessible name.
2. `getByLabel` for form controls.
3. `getByText`, `getByAltText`, `getByTitle`, or `getByPlaceholder` when they
   express the public UI contract.
4. `getByTestId` for a stable, explicit testing contract where user-facing
   semantics are ambiguous.
5. CSS; XPath only as a last resort.

CSS classes, generated IDs, DOM depth, and XPath axes encode implementation
details. They break on harmless refactors and tell reviewers little about the
user intent. Configure a different test-id attribute if your application
standardizes one:

```ts
export default defineConfig({ use: { testIdAttribute: 'data-pw' } });
```

## 2. Strictness: ambiguity is a defect

Actions and single-element assertions are strict: if a locator resolves to
zero or more than one element, Playwright throws. This prevents a click from
quietly choosing an arbitrary matching “Save” button.

```ts
// May match several buttons: make its surrounding scope explicit.
const dialog = page.getByRole('dialog', { name: 'Edit profile' });
await dialog.getByRole('button', { name: 'Save' }).click();
```

Do not “solve” strictness with `.first()` unless the first result is a genuine
part of the requirement. Index position is fragile; a semantic filter is
better. `count()` and list assertions intentionally operate on multiple
matches.

## 3. Composition: chaining, filters, and boolean logic

Locators can be chained to scope queries:

```ts
const todoList = page.getByRole('list');
const item = todoList.getByRole('listitem').filter({ hasText: 'buy milk' });
await item.getByRole('checkbox').check();
```

`filter({ has })` retains outer matches containing an element matched by a
locator relative to that outer element. `hasText`/`hasNotText` use contained
text; `hasNot` excludes containers with a matching descendant.

```ts
const product = page.getByRole('listitem').filter({
  has: page.getByRole('heading', { name: 'Wireless headset' }),
  hasNotText: 'Unavailable',
});
await product.getByRole('button', { name: 'Add to cart' }).click();
```

`locator.and(other)` requires both locators to match the same element.
`locator.or(other)` matches either alternative—for example an inline error or
a modal error—but can produce multiple matches, so use `.first()` only when
the next operation truly accepts either visible alternative.

```ts
const success = page.getByText('Saved');
const error = page.getByRole('alert');
await expect(success.or(error).first()).toBeVisible();
```

## 4. Lists and indexes

Use list semantics, then assert the collection before selecting a known item:

```ts
const rows = page.getByRole('listitem');
await expect(rows).toHaveCount(3);
await expect(rows).toHaveText(['first', 'second', 'third']);
await rows.nth(1).getByRole('button', { name: 'Delete' }).click();
```

`first()`, `last()`, and `nth()` are available, but indexes should model a
stable ordered requirement. For a named entity, filter by its name instead.

## 5. Frames and shadow DOM

An iframe has its own document, so scope through `frameLocator`:

```ts
const payment = page.frameLocator('iframe[title="Payment"]');
await payment.getByLabel('Card number').fill('4242 4242 4242 4242');
```

Playwright locators pierce **open** shadow DOM by default. XPath does not
pierce shadow roots, and closed shadow roots cannot be inspected through normal
DOM querying. Prefer role/label locators regardless of whether a component
uses shadow DOM.

## 6. Locator versus `evaluate`

Use locators for user actions and UI assertions. `locator.evaluate()` executes
page JavaScript against a matched element and is appropriate only for a
specific DOM-derived detail with no public API:

```ts
const width = await page.getByRole('dialog').evaluate(
  element => element.getBoundingClientRect().width,
);
```

It bypasses user-level actionability and can couple tests to implementation.
Avoid `ElementHandle` unless an API explicitly needs it; locators provide
better retries and re-resolution.

## 7. Tutorial lab

```ts
test('completes the named TodoMVC item', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  const input = page.getByPlaceholder('What needs to be done?');
  for (const text of ['review locators', 'learn filters']) {
    await input.fill(text);
    await input.press('Enter');
  }

  const target = page.getByRole('listitem').filter({ hasText: 'learn filters' });
  await target.getByRole('checkbox').check();
  await expect(target).toHaveClass(/completed/);
});
```

Try replacing the filter with `nth(1)`, then add an item before it. The index
based version no longer describes the intended business entity.

## 8. Pitfalls

* Selecting by CSS class or DOM path couples tests to styling and layout.
* Text that is too broad often matches hidden/template content as well.
* `.first()` suppresses a useful strictness failure.
* `has` must be relative to the outer locator; do not pass a locator rooted in
  a different frame.
* Use `getByText` for content, not as the default way to locate controls with
  an accessible role/name.

## Interview Q&A

1. **What is a locator?** A lazy query resolved/retried at action or assertion
   time, not a saved DOM node.
2. **Why prefer role locators?** They mirror user-accessible semantics and
   make tests readable and resilient.
3. **What is strict mode?** Single-target operations fail if the locator has
   zero or multiple matches.
4. **How do you fix a strictness error?** Narrow scope with a role, accessible
   name, parent locator, or semantic filter—not arbitrary indexing.
5. **What does `has` do?** Keeps outer elements that contain a matching
   descendant.
6. **`hasText` versus `getByText`?** `hasText` filters an existing container;
   `getByText` locates text directly.
7. **When use test IDs?** When public accessibility/text semantics cannot
   uniquely represent a stable interaction.
8. **How do you locate inside an iframe?** `page.frameLocator(...).getBy...`.
9. **Does Playwright cross shadow DOM?** Open shadow roots yes; closed roots
   cannot be normally queried.
10. **When is `nth()` appropriate?** Only when ordered position itself is the
    requirement and that order is asserted.
11. **Why avoid XPath?** It is implementation-shaped, hard to read, and does
    not pierce shadow DOM.
12. **Why avoid ElementHandle?** It can go stale; locators re-resolve and
    integrate waiting.
13. **What is `.or()` useful for?** A genuine alternate UI state, with care to
    resolve resulting ambiguity.

## 9. Every `getBy*` method in context

### `getByRole`
Use it for interactive controls and meaningful structure. A role query is
especially strong when it includes an accessible name, because it describes
the same target a keyboard or screen-reader user finds.

```ts
const form = page.getByRole('form', { name: 'Create account' });
await form.getByRole('textbox', { name: 'Display name' }).fill('Ada');
await form.getByRole('button', { name: 'Create account' }).click();

await expect(page.getByRole('status')).toHaveText('Account created');
await page.getByRole('tab', { name: 'Security', selected: false }).click();
```

Role options such as `checked`, `disabled`, `expanded`, `level`, `pressed`,
and `selected` are useful when state is part of identity:

```ts
await expect(page.getByRole('checkbox', { name: 'Public profile', checked: true }))
  .toBeVisible();
await expect(page.getByRole('heading', { level: 2, name: 'Privacy' })).toBeVisible();
```

### `getByLabel`
Use it to operate a labelled form control—not to assert that label text exists.

```ts
const address = page.getByRole('form', { name: 'Delivery address' });
await address.getByLabel('Postal code').fill('SW1A 1AA');
await address.getByLabel('Country').selectOption({ label: 'United Kingdom' });
```

If it fails, inspect the product first: an input may be missing a `<label>`,
`for`/`id` relationship, or appropriate ARIA label.

### `getByPlaceholder`
Prefer labels, but placeholder locators are reasonable for stable search and
command fields where the placeholder is the public affordance.

```ts
await page.getByPlaceholder('Search documentation').fill('frame locator');
await page.getByPlaceholder(/filter by name/i).press('Enter');
```

### `getByText`
Use text for static content, feedback, and text-driven controls only when no
stronger role is available.

```ts
await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
await expect(page.getByText(/you have \d+ unread messages/i)).toBeVisible();
```

Text matching normalizes whitespace. Scope broad phrases through an alert,
dialog, region, or list item so duplicate responsive markup does not create
ambiguity.

### `getByAltText`, `getByTitle`, and `getByTestId`

```ts
await expect(page.getByAltText('Workspace logo')).toBeVisible();
await page.getByTitle('Close notification').click();
await page.getByTestId('usage-chart').scrollIntoViewIfNeeded();
```

Alternative text is the right contract for meaningful images. `title` is
appropriate only when that attribute is intentionally stable. A test ID is
best when user-visible wording cannot uniquely identify a complex control.

## 10. Strictness scenarios
Strictness applies to operations intended for one element: `click`, `fill`,
`check`, `inputValue`, and one-target assertions. The following is ambiguous:

```ts
await page.getByRole('button', { name: 'Save' }).click();
```

Two common repairs are scope and filtering:

```ts
const editor = page.getByRole('dialog', { name: 'Edit profile' });
await editor.getByRole('button', { name: 'Save' }).click();

const row = page.getByRole('row').filter({ hasText: 'Ada Lovelace' });
await row.getByRole('button', { name: 'Save' }).click();
```

`.first()`, `.last()`, and `.nth()` opt out of ambiguity only by choosing a
position. Use them when position is explicitly contractual:

```ts
const results = page.getByRole('option');
await expect(results).toHaveCount(5);
await results.first().click(); // the requirement is “choose the first result”
```

Do not use an index merely because a named row is currently second. Inserting
a row would make the test perform the wrong user action while still passing.

## 11. Boolean locator composition
`and()` intersects two queries on the same element. It is useful when one
attribute supplies a stable distinction unavailable through role options.

```ts
const publish = page.getByRole('button', { name: 'Publish' })
  .and(page.getByTitle('Make this version public'));
await publish.click();
```

`or()` represents alternatives:

```ts
const welcome = page.getByRole('heading', { name: 'Welcome' });
const error = page.getByRole('alert');
await expect(welcome.or(error).first()).toBeVisible();
```

The `.first()` here is only safe if it is immediately followed by a branch
that examines which state is visible. If both alternatives may be visible,
test the expected state directly instead.

## 12. Frames, shadow DOM, and boundaries
An iframe is a separate document. Query it through a frame locator:

```ts
const checkout = page.frameLocator('iframe[title="Payment details"]');
await checkout.getByLabel('Card number').fill('4242 4242 4242 4242');
await checkout.getByRole('button', { name: 'Pay securely' }).click();
```

The `has` filter cannot cross frames. A page locator cannot see content in an
iframe, and a frame locator cannot see page content outside that frame.

Playwright locators pierce open shadow roots by default. This means role and
label locators remain useful for well-designed web components. XPath does not
pierce shadow DOM; closed shadow roots cannot be queried through ordinary DOM
automation. Expose accessible semantics rather than testing private internals.

## 13. CSS, XPath, and locator inspection
CSS can be acceptable for a stable product-owned attribute:

```ts
const chart = page.locator('[data-chart="monthly-usage"]');
await expect(chart).toBeVisible();
```

Avoid copied selectors:

```ts
// Fragile: wrapper and position are presentation details.
page.locator('main > div:nth-child(2) > section button');
page.locator('//main/div[2]/section/button');
```

Use the inspector and code generator to discover a target, then rewrite the
suggestion into the smallest semantic locator that captures the requirement.

## 14. Locator snapshots versus assertions
Methods such as `count()`, `isVisible()`, `innerText()`, and `inputValue()`
read a current snapshot. They are useful for branching or diagnostics, but
they do not retry the desired state.

```ts
const items = page.getByRole('listitem');
const count = await items.count();
expect(count).toBeGreaterThan(0);
```

For dynamic UI, prefer a web-first assertion:

```ts
await expect(items).toHaveCount(3);
await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');
```

## 15. Anti-pattern clinic

| Symptom | Root cause | Repair |
|---|---|---|
| “strict mode violation” | query names multiple controls | scope to a semantic container |
| click finds hidden duplicate | global text is broad | use role/name or visible parent |
| test breaks after restyling | selector follows classes | use accessible contract |
| test breaks after sort | index identifies data | filter by stable row content |
| iframe target never found | query is rooted in page | use `frameLocator` |
| component cannot be selected | closed internal tree | expose an accessible public API |

## 16. Labs
### Lab A — duplicate buttons
Create two dialogs with Save buttons. Reproduce strictness, then narrow the
query through the dialog name. Assert that only the intended dialog closes.

### Lab B — semantic list targeting
Add “learn filters” and “review locators” to TodoMVC. Complete the named item
using `filter({ hasText })`, insert a new item first, and show why `nth(1)` is
incorrect.

### Lab C — a table row
Locate a row containing an email address using `filter({ has })`; then click
its Remove button. Add a duplicate email in a different frame and explain why
the frame boundary requires a separate locator.

### Lab D — locator review
Rewrite these selectors: `.primary-button`, `#email-1`, and
`main > div:nth-child(3) button`. For each rewrite, state the user contract.

## Expanded interview Q&A
14. **Why does locator laziness matter?** It resolves the current DOM at use time.
15. **Which calls are strict?** Single-target actions and assertions.
16. **Does `toHaveCount` require one match?** No, collection assertions expect many.
17. **What does `exact` change?** It requires an exact accessible name or text.
18. **Why does `getByRole` support accessibility?** It validates exposed semantic UI.
19. **When should a test ID be added?** When semantics cannot express stable identity.
20. **What is a good test-ID name?** A stable product meaning, not layout or database state.
21. **What does `hasText` match?** Descendant text contained by each outer candidate.
22. **What does `hasNotText` do?** Excludes candidates containing that text.
23. **Can `has` use a locator from a different frame?** No; both must be in one frame.
24. **When is `and()` better than a CSS compound selector?** When it preserves readable semantics.
25. **What is the risk of `or()`?** Both alternatives may match, requiring explicit handling.
26. **Can CSS cross open shadow roots?** Playwright CSS locators can; XPath cannot.
27. **What does `frameLocator` return?** A locator-like scope for an iframe document.
28. **Why is text often a weak default for buttons?** It loses role-specific intent.
29. **What is the difference between `count()` and `toHaveCount()`?** Snapshot versus retrying assertion.
30. **When use `locator.evaluate`?** Only for a narrow DOM property without a public test API.
31. **How does a locator reveal a product defect?** A missing role or label can make it unfindable.
32. **Why is XPath discouraged?** It encodes implementation hierarchy and misses shadow DOM.
33. **What should happen after a strictness failure?** Improve identity, never arbitrarily select.
34. **How should repeated labels be handled?** Scope them to dialog, region, form, row, or list item.
35. **What makes index use legitimate?** The product requirement explicitly depends on ordering.

---

Next: [05 — Actions, auto-waiting, and timeouts](./05-actions-auto-waiting-and-timeouts.md)
