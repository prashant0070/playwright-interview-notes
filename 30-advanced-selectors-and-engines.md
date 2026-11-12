# 30 — Advanced Selectors and Engines

## Learning goals

Choose resilient built-in locators, understand the selector engines behind CSS, text, and XPath selectors, use shadow-DOM-aware locators, and recognize why custom selector engines are an exceptional integration mechanism rather than a default test style.

> Locator and selector semantics evolve. Verify edge cases against [playwright.dev](https://playwright.dev/docs/locators), the source of truth for current APIs.

---

## 1. Locators are the main abstraction

Playwright's `Locator` resolves elements when an action or assertion runs. That retryable, strict abstraction is more important than the string syntax used to describe it.

Prefer user-facing built-ins:

```ts
await page.getByRole('button', { name: 'Save changes' }).click();
await page.getByLabel('Email address').fill('person@example.com');
await page.getByTestId('order-total').toHaveText('$42.00');
await page.getByText('No results found').waitFor();
```

These locators communicate intent and tend to survive layout refactors. A locator that depends on CSS classes or DOM hierarchy tests an implementation detail unless that detail is deliberately a contract.

---

## 2. Built-in `getBy*` locators

| Locator | Use when |
|---|---|
| `getByRole(role, options)` | The element has a meaningful accessible role and name |
| `getByLabel(text)` | A form control is labelled |
| `getByPlaceholder(text)` | Placeholder text is a stable user-facing contract |
| `getByText(text)` | Finding visible textual content |
| `getByAltText(text)` | An image's alternative text is meaningful |
| `getByTitle(text)` | A title attribute is the intended contract |
| `getByTestId(id)` | A test identifier is the stable test contract |

Compose locators instead of selecting a positional child:

```ts
const product = page.getByRole('listitem').filter({ hasText: 'Travel backpack' });
await product.getByRole('button', { name: 'Add to cart' }).click();

const dialog = page.getByRole('dialog', { name: 'Delete account' });
await dialog.getByRole('button', { name: 'Delete' }).click();
```

Strictness means a single-target operation throws if the locator resolves to multiple matching elements. Do not reflexively append `.first()` to silence strictness: identify the missing scope, accessible name, filter, or test id. Use `.first()`, `.last()`, or `.nth()` only when ordering is explicitly the behavior under test.

---

## 3. CSS selectors

CSS is supported and sometimes ideal for stable structural contracts:

```ts
const toast = page.locator('[data-testid="toast"]');
await expect(toast.locator(':scope > [role="alert"]')).toBeVisible();

await page.locator('input[name="postalCode"]').fill('110001');
```

Playwright supports CSS extensions including `:has-text()`, `:text-is()`, `:text-matches()`, and `:has()`. They can be useful, but user-facing locators remain clearer for most tests:

```ts
const card = page.locator('article:has(h2:has-text("Camera"))');
await card.getByRole('button', { name: 'Add to cart' }).click();
```

Avoid dynamic class names, generated CSS module hashes, and deep child combinators. Use `data-testid` when a UI element has no stable semantic name; configure the attribute centrally if the application uses a different convention:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { testIdAttribute: 'data-qa' },
});
```

---

## 4. Text selectors and text matching

`getByText()` and the `text=` engine find text visible to users. Choose exact matching when the full wording is a contract:

```ts
await expect(page.getByText('Order confirmed', { exact: true })).toBeVisible();
await expect(page.getByText(/items? in your cart/i)).toBeVisible();
```

The legacy selector form still exists:

```ts
await page.locator('text=Order confirmed').click();
```

Prefer `getByText()` in new tests because it is clearer and composes naturally with other locators. Text matching normalizes whitespace in most cases; do not use it to inspect hidden implementation strings. If one phrase appears in multiple regions, scope it to a dialog, row, or card.

---

## 5. XPath: available, but rarely preferred

XPath is supported:

```ts
const row = page.locator('//tr[td[normalize-space()="INV-1024"]]');
await expect(row.locator('.//td[@data-column="status"]')).toHaveText('Paid');
```

It is occasionally useful for XML-like documents, legacy markup with no hooks, or a migration where a clear XPath already exists. Its drawbacks are readability, brittleness, and poor alignment with accessible UI semantics.

XPath does **not** pierce shadow roots. CSS and Playwright locators generally work through open shadow DOM, which is another practical reason to prefer them for modern web applications.

---

## 6. Shadow DOM

Playwright locators pierce **open** shadow roots by default:

```ts
await page.getByRole('button', { name: 'Open cart' }).click();
await expect(page.getByText('Your cart is empty')).toBeVisible();
```

This is preferable to manually evaluating `shadowRoot` from test code. Closed shadow roots are intentionally inaccessible to normal page scripts and Playwright locators. Test their externally visible behavior through the component's host and public controls, or expose a deliberate test contract in the component design; do not depend on browser-internal implementation details.

---

## 7. Selector engine prefixes

Playwright recognizes engines in selector strings, including `css=`, `xpath=`, `text=`, and `id=`:

```ts
await page.locator('css=[data-testid="submit"]').click();
await page.locator('xpath=//button[@type="submit"]').click();
await page.locator('id=submit-order').click();
```

The prefix can clarify an ambiguous expression, but new code normally needs neither a prefix nor raw selector string. `getByRole`, `getByLabel`, and `getByTestId` better show why the element is being selected.

---

## 8. Registering a custom selector engine

`selectors.register()` installs a selector engine for a `Browser`, `BrowserContext`, or `Page` created later. Registration must happen **before** creating the browser/context/page that uses it.

```ts
import { selectors, chromium } from 'playwright';

await selectors.register('dataqa', () => ({
  query(root, selector) {
    return root.querySelector(`[data-qa="${CSS.escape(selector)}"]`);
  },
  queryAll(root, selector) {
    return Array.from(
      root.querySelectorAll(`[data-qa="${CSS.escape(selector)}"]`),
    );
  },
}));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.locator('dataqa=checkout').click();
await browser.close();
```

The engine runs in the page context, so it must be serializable and should have no dependence on Node state. It should return `Element` instances, follow its own clear matching contract, and stay small.

In Playwright Test, a custom engine often creates more maintenance than it saves. Prefer configuring `testIdAttribute` or writing a small application-level locator helper. If an engine is unavoidable, register it in controlled global setup before workers create pages and document its ownership.

---

## 9. React and Vue selector engines: historical caution

Playwright previously exposed React and Vue selector engines that matched framework component internals. Treat them as legacy/experimental tooling, not a selector strategy for new suites. They can depend on development builds, framework internals, and version-specific instrumentation; production behavior may differ.

Use browser-visible contracts instead:

```tsx
// Application component
<button data-testid="account-menu" aria-label="Open account menu">
  <Avatar />
</button>
```

```ts
await page.getByRole('button', { name: 'Open account menu' }).click();
```

Tests should validate what users and assistive technology can observe, not which framework component happened to render it.

---

## 10. A locator decision sequence

1. Can a role plus accessible name identify it? Use `getByRole`.
2. Is it an input with a label? Use `getByLabel`.
3. Is visible text the intended contract? Use `getByText`.
4. Is there no semantic contract? Use a stable test id.
5. Is a CSS or XPath structure genuinely the contract? Use a scoped selector and explain why.
6. Is the problem repeated across the codebase? Improve the application's testing contract before creating a selector engine.

---

## Interview Q&A

**Q: Why prefer `getByRole()` to CSS?**  
A: It targets an accessible user-facing contract, is readable, and is less coupled to styling and layout. It also encourages accessible markup.

**Q: Does Playwright support XPath?**  
A: Yes, but it is generally a fallback. It is harder to read and does not pierce shadow roots, so role, label, test-id, or scoped CSS locators are usually stronger.

**Q: What does strict mode protect against?**  
A: It prevents an action from silently choosing among multiple matching elements. A strictness error indicates an ambiguous test contract that should normally be scoped.

**Q: When should you register a custom selector engine?**  
A: Only for a repeated, well-defined selection contract that built-ins and configured test ids cannot represent. It must be registered before pages are created and maintained as integration code.

**Q: Can Playwright inspect closed shadow DOM?**  
A: Not through normal locators. Test external behavior or provide an intentional public test seam rather than reaching into a closed implementation.
