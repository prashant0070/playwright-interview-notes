# 24 — ARIA Snapshots

## Learning goals

Understand ARIA snapshots as compact, human-readable assertions of accessible structure.
Use `locator.ariaSnapshot()` to inspect a subtree and `expect(locator).toMatchAriaSnapshot()`
to protect its meaningful accessibility contract.

---

## 1. What is an accessibility-tree snapshot?

A browser exposes an accessibility tree to assistive technology. It represents controls,
relationships, names, states, and content as users of a screen reader encounter them—not
as raw HTML or visual pixels. Elements may be absent from that tree, and the tree can
include semantics inferred from native HTML, ARIA attributes, labels, and text.

An ARIA snapshot is Playwright's YAML representation of a locator's accessible subtree.
It is intentionally much smaller and more semantic than a DOM dump:

```yaml
- navigation:
  - link "Home"
  - link "Products"
  - link "Cart (2)"
```

The indentation expresses containment. The node label expresses the accessible role, and
quoted text commonly expresses its accessible name. Snapshot details depend on the
browser accessibility tree and Playwright's supported YAML syntax, so treat the snapshot
as a behavioral contract rather than an HTML serialization format.

---

## 2. Capture a snapshot for investigation

```ts
import { test } from '@playwright/test';

test('inspect product card semantics', async ({ page }) => {
  await page.goto('/products/42');

  const card = page.getByRole('article', { name: /wireless headphones/i });
  console.log(await card.ariaSnapshot());
});
```

`locator.ariaSnapshot()` returns the current snapshot text. It is useful in debugging,
exploration, and custom diagnostics. It does not assert or retry by itself: it reads the
state at that instant. Use a normal web-first assertion first when the UI is loading.

```ts
await expect(page.getByRole('main')).toBeVisible();
const snapshot = await page.getByRole('main').ariaSnapshot();
expect(snapshot).toContain('heading "Featured products"');
```

The final `expect(snapshot)` checks a string and is non-retrying. For a built-in,
retrying snapshot assertion, use `toMatchAriaSnapshot`.

---

## 3. Assert the semantic contract

```ts
import { test, expect } from '@playwright/test';

test('checkout summary has navigable semantics', async ({ page }) => {
  await page.goto('/checkout');

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "Checkout"
    - region "Order summary":
      - list:
        - listitem:
          - link "Wireless headphones"
          - text: "$79.00"
    - button "Place order"
  `);
});
```

`toMatchAriaSnapshot()` is a locator assertion, so it retries until its configured
expect timeout. This is valuable for content rendered asynchronously. Scope the locator
to the component whose contract matters; a snapshot of the entire page makes unrelated
copy, navigation, and experiment changes noisy.

Use an inline snapshot when the expected structure is short and explanatory. Playwright
can also maintain external snapshot files through the snapshot update workflow:

```ts
await expect(page.getByTestId('order-summary')).toMatchAriaSnapshot();
```

When no expected YAML is supplied, Playwright stores and compares a generated snapshot
in the test snapshots directory, similarly to other snapshot assertions.

---

## 4. YAML structure intuition

This example describes a form region containing labelled controls and a submit button:

```yaml
- region "Sign in":
  - heading "Sign in"
  - text: "Use your work account."
  - textbox "Email"
  - textbox "Password"
  - checkbox "Remember me"
  - button "Continue"
```

Important intuitions:

- A dash begins a sibling node.
- Greater indentation places a node inside the preceding parent.
- `role "name"` matches semantics, not a CSS selector.
- `text: "..."` represents plain accessible text content.
- A concise snapshot should state the user-facing landmarks, controls, names, and order.

Do not hand-copy every incidental node emitted by a large application. Start at a
component root, use stable accessible names, and express only the contract worth
protecting. Exact snapshot syntax can evolve; verify unfamiliar YAML features against
the official Playwright ARIA snapshots documentation for the installed version.

---

## 5. Snapshot update workflow

Snapshot updates are intentional changes, not a command to run blindly. A sensible
review loop is:

1. Run the failing test and inspect the ARIA snapshot diff.
2. Determine whether the changed role, name, hierarchy, or order is desired.
3. Fix the product if the change broke accessibility or the intended UI contract.
4. Update the snapshot only when the new user-facing semantics are correct.
5. Review the YAML diff like code and commit it with the component change.

```bash
npx playwright test tests/checkout.spec.ts --update-snapshots
```

For a first capture, update mode writes the baseline. In CI, do not normally enable
automatic updates: a test should fail and require review when semantics change.

Avoid snapshots that include volatile counts, timestamps, user-specific names, or
experiment variants unless that variability is central to the behavior. Isolate test
data and scope the locator before relaxing an assertion.

---

## 6. ARIA snapshots vs other tools

### `getByRole`: locate and interact

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
```

Use role locators to find a specific target in a realistic way. They are excellent for
single-control behavior and often reveal missing accessible names. They do not guarantee
that a whole composite widget has the expected hierarchy or sequence.

### ARIA snapshot: assert a semantic subtree

```ts
await expect(page.getByRole('navigation', { name: 'Primary' }))
  .toMatchAriaSnapshot(`
    - link "Home"
    - link "Products"
    - link "Support"
  `);
```

Use it when the accessible shape of a menu, card, form, alert, tree, or rich widget is
the behavior you want to preserve.

### Screenshot: assert visual rendering

```ts
await expect(page.getByTestId('product-card')).toHaveScreenshot('product-card.png');
```

Use screenshots for layout, color, spacing, iconography, clipping, and responsive visual
regressions. They cannot reliably prove an accessible name, role, reading order, or
keyboard relationship. ARIA snapshots cannot prove pixels are correctly styled.

### Dedicated accessibility analysis: find rule violations

An ARIA snapshot is not a complete WCAG conformance audit. Use an accessibility testing
tool and manual keyboard/screen-reader testing for contrast, focus order, target size,
ARIA authoring rules, and other broader checks.

---

## 7. Strengths

- Tests semantics closer to how assistive technology identifies UI.
- Produces small, reviewable text diffs instead of image-only diffs.
- Captures hierarchy and order, which isolated role assertions can miss.
- Less sensitive than screenshots to fonts, rendering, and pixel variation.
- Helps teams treat accessible names and landmarks as product contracts.

## 8. Limits and pitfalls

- A matching tree does not prove visual layout, contrast, or keyboard behavior.
- A snapshot only covers the locator subtree you selected.
- An incorrect but stable ARIA implementation can still produce a stable snapshot.
- Huge page-wide snapshots are brittle and unreadable.
- Dynamic content needs deterministic data or carefully scoped expectations.
- Do not replace focused assertions with a snapshot when a clear `toHaveText` or
  `toBeEnabled` explains the intent better.

Pair semantic snapshots with behavioral interaction tests and targeted web-first
assertions.

---

## 9. Component pattern

```ts
test('error summary is announced and linked to fields', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create account' }).click();

  const errors = page.getByRole('alert', { name: /fix the following/i });
  await expect(errors).toMatchAriaSnapshot(`
    - heading "Fix the following errors"
    - list:
      - listitem:
        - link "Email is required"
      - listitem:
        - link "Password must contain 12 characters"
  `);

  await expect(page.getByRole('textbox', { name: 'Email' })).toBeFocused();
});
```

This combines a snapshot of the announced error structure with a focused behavioral
assertion. Neither alone fully specifies the validation experience.

---

## 10. Interview Q&A

1. **What does an ARIA snapshot represent?**  
   The accessibility-tree semantics of a locator subtree, serialized in readable YAML.

2. **Is it a DOM snapshot?**  
   No. It is about accessible roles, names, text, and hierarchy rather than HTML nodes.

3. **When would you prefer one over a screenshot?**  
   When protecting accessible structure, control names, landmarks, or reading order.

4. **What does a screenshot test better?**  
   Visual presentation: layout, rendering, color, spacing, and responsive appearance.

5. **Is `ariaSnapshot()` retrying?**  
   No. It reads the current snapshot; `toMatchAriaSnapshot` is the retrying locator
   assertion.

6. **How do you prevent noisy snapshots?**  
   Scope to a component, control test data, and omit irrelevant volatile UI.

7. **What does YAML indentation mean?**  
   Accessible containment/hierarchy.

8. **Can a matching snapshot certify WCAG compliance?**  
   No. It is one semantic contract; use broader automation and manual evaluation too.

9. **How do snapshots get updated?**  
   Review the diff, verify the intended semantic change, then use update-snapshots mode.

10. **Why still use `getByRole`?**  
    It is the best way to target individual controls and exercise their behavior.

11. **What kind of regression can this catch?**  
    A button losing its accessible name, a heading becoming plain text, or a menu's
    meaningful order/hierarchy changing.

12. **What is the key review principle?**  
    Treat an updated snapshot as a product accessibility change requiring human review.

---

## 11. Lab — protect a checkout form

1. Create a form with a heading, labelled textboxes, an error alert, and submit button.
2. Capture `ariaSnapshot()` after a failed submit to inspect its current semantics.
3. Add a scoped `toMatchAriaSnapshot` for the alert/error-summary region.
4. Add direct role assertions for the invalid input and submit button.
5. Change a label or heading to an inaccessible equivalent and observe the snapshot diff.
6. Add a screenshot assertion and identify one visual regression that only it catches.
7. Update the snapshot only after making an intentional semantic product change.

## Next

Continue to [25 — Page, Locator, and Browser API Cheatsheet](./25-page-locator-browser-api-cheatsheet.md).
