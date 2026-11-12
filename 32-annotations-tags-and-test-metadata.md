# 32 — Annotations, Tags, and Test Metadata

## Learning goals

Use Playwright metadata to classify tests without making suite execution opaque, distinguish tags from annotations, select tests with `grep`, attach useful evidence, and report ownership and severity information responsibly.

> Metadata syntax and reporter rendering may change. Use [playwright.dev](https://playwright.dev/docs/test-annotations) as the source of truth.

---

## 1. Why test metadata exists

Names describe behavior. Metadata describes operational context: a test's owner, severity, issue reference, known environment limitation, or release classification. Good metadata makes targeted runs and report triage easier; excessive or inconsistent metadata becomes decoration that nobody trusts.

Keep these concerns separate:

| Need | Playwright feature |
|---|---|
| Run a category of tests | Tags and `grep` |
| Explain a condition in a report | Annotations |
| Mark execution behavior | `skip`, `fixme`, `fail`, `slow` |
| Add files or text to a result | `testInfo.attach()` |
| Build a product-level ownership system | A documented naming convention plus reporter/CI integration |

---

## 2. Tags in titles

The simple portable convention puts tags in a test or describe title:

```ts
import { test, expect } from '@playwright/test';

test('customer can submit a @smoke @checkout order', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
});

test.describe('@account profile', () => {
  test('customer updates their display name', async ({ page }) => {
    await page.goto('/profile');
    // ...
  });
});
```

Select tagged tests:

```sh
npx playwright test --grep @smoke
npx playwright test --grep "@smoke.*@checkout"
npx playwright test --grep-invert @slow
```

`grep` matches the project's full test title, including enclosing `describe` titles. Keep a tag lexicon short and lowercase—examples: `@smoke`, `@regression`, `@checkout`, `@mobile`. Do not overload tags with mutable implementation facts such as `@uses-api-v2`.

---

## 3. Tags using the `tag` details property

Modern Playwright supports structured tag metadata in test details. It keeps tags semantically separate from the human-readable title:

```ts
test(
  'customer can submit an order',
  { tag: ['@smoke', '@checkout'] },
  async ({ page }) => {
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('status')).toHaveText('Order confirmed');
  },
);
```

Tags declared this way are still searchable with `--grep`:

```sh
npx playwright test --grep @checkout
```

Use the property form when the installed Playwright version supports it and teams want clean titles. Use title tags if compatibility with an older version or external title-only tooling matters. Do not use both forms for the same tag unless a consumer has an explicit requirement; duplication makes report titles noisy.

---

## 4. Static annotations

Annotations are structured `{ type, description? }` entries attached to a test or group:

```ts
test.describe(
  'VAT calculation',
  {
    annotation: {
      type: 'owner',
      description: 'billing-team',
    },
  },
  () => {
    test(
      'rounds fractional amounts',
      {
        annotation: [
          { type: 'severity', description: 'critical' },
          { type: 'issue', description: 'https://tracker.example.test/QA-248' },
        ],
      },
      async ({ page }) => {
        await page.goto('/invoice/preview');
        await expect(page.getByTestId('vat-total')).toHaveText('$10.00');
      },
    );
  },
);
```

The HTML report displays annotations, and custom reporters can consume them through test metadata. Annotation types are conventions: Playwright does not impose an organizational meaning for `severity`, `owner`, or `issue`. Define allowed values in team documentation and validate them in a reporter or CI check if they are used for policy.

---

## 5. Runtime annotations with `testInfo`

`testInfo.annotations` is an array available during execution. Add a runtime annotation when the reason can only be known after setup:

```ts
test('uses the payment sandbox when available', async ({ page }, testInfo) => {
  if (process.env.PAYMENT_SANDBOX === 'degraded') {
    testInfo.annotations.push({
      type: 'environment',
      description: 'Payment sandbox degraded during this run',
    });
  }

  await page.goto('/checkout');
  // Continue only with behavior the environment can support.
});
```

Runtime annotations are evidence, not a mechanism to silently excuse broken tests. A test whose required dependency is unavailable should be skipped with a clear reason, failed as appropriate, or isolated from a run by deliberate configuration.

Read static annotations for a test:

```ts
test('records its declared classification', async ({ page }, testInfo) => {
  const severity = testInfo.annotations.find(
    annotation => annotation.type === 'severity',
  )?.description;

  await page.goto('/');
  expect(severity).toBe('critical');
});
```

Use this sparingly. Tests should not normally branch behavior based on a label; labels describe a test rather than dictate its functional assertions.

---

## 6. Test details and reusable conventions

Test details accept metadata near the test declaration:

```ts
test(
  'customer sees saved addresses',
  {
    tag: ['@regression', '@account'],
    annotation: [
      { type: 'owner', description: 'identity-team' },
      { type: 'severity', description: 'high' },
    ],
  },
  async ({ page }) => {
    await page.goto('/account/addresses');
    await expect(page.getByRole('heading', { name: 'Addresses' })).toBeVisible();
  },
);
```

Use a helper only when it preserves visibility:

```ts
const ownership = (team: string, severity: 'critical' | 'high' | 'medium') => ({
  annotation: [
    { type: 'owner', description: team },
    { type: 'severity', description: severity },
  ],
});

test(
  'card form rejects an expired card',
  { tag: '@payments', ...ownership('payments-team', 'critical') },
  async ({ page }) => {
    await page.goto('/checkout');
    // ...
  },
);
```

Avoid a custom DSL that hides tags, titles, and test functions behind multiple wrappers. Playwright's runner should still be able to discover the test normally and a reviewer should be able to see its classification at a glance.

---

## 7. Execution metadata: skip, fixme, fail, slow

These annotations alter runner expectations and must include an actionable reason:

```ts
test.skip(process.env.DEPLOYMENT_REGION !== 'us-east', 'Feature is deployed only in us-east');

test('exports a CSV', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Known browser limitation: TRACK-811');
  await page.goto('/reports');
  // ...
});

test.fixme('imports an archived file', 'Blocked by parser rewrite: TRACK-920', async () => {
  // This test is not run until the fixme is removed.
});

test.fail('validates legacy redirect', 'Known defect: TRACK-104', async ({ page }) => {
  await page.goto('/legacy');
  await expect(page).toHaveURL(/\/new-location$/);
});

test.slow('generates annual statement', async ({ page }) => {
  await page.goto('/statements/annual');
  // Timeout is multiplied for this test.
});
```

`skip` means intentionally not executed. `fixme` is a stronger signal that the test is not expected to run until addressed. `fail` marks a known failure: an unexpected pass is reported, which makes it suitable only for a temporary, tracked defect. `slow` multiplies the test timeout; it is not a fix for a flaky or indefinitely slow flow.

Avoid unconditional `test.skip()` or `test.fail()` without a reason and tracking reference. They are suite metadata, so review and expiry are essential.

---

## 8. Attachments: test evidence, not metadata

Attachments place files or bodies in a test result:

```ts
import { test, expect } from '@playwright/test';

test('includes a calculation breakdown', async ({ page }, testInfo) => {
  await page.goto('/quote');
  const breakdown = await page.getByTestId('breakdown').innerText();

  await testInfo.attach('quote-breakdown.txt', {
    body: breakdown,
    contentType: 'text/plain',
  });

  await expect(page.getByTestId('total')).toHaveText('$42.00');
});
```

For file-backed data:

```ts
await testInfo.attach('request-payload.json', {
  path: 'test-results/request-payload.json',
  contentType: 'application/json',
});
```

Attachments appear in the HTML report and are available to reporters. Add them for triage value—screenshots, traces, relevant response bodies after redaction—not as a substitute for a concise assertion failure. Never attach credentials, access tokens, personal data, or production exports.

---

## 9. A practical governance model

A small convention scales better than dozens of tags:

```text
Tags:       @smoke, @regression, @mobile, @checkout, @account
Annotations: owner=<team>, severity=<critical|high|medium>, issue=<URL>
Execution:  skip/fixme/fail only with a ticket and reason
```

Suggested review rules:

1. Every `@smoke` test has an `owner` and `severity`.
2. Every `fixme` and `fail` has a tracking reference.
3. Tags classify execution selection, not test priority alone.
4. Attachments obey the same data-handling policy as CI artifacts.
5. A reporter or scheduled check identifies stale issue annotations.

Playwright supplies the metadata primitives; ownership enforcement belongs in the team's process, custom reporter, or CI policy.

---

## Interview Q&A

**Q: What is the difference between a tag and an annotation?**  
A: A tag is primarily a searchable execution category, commonly selected with `--grep`. An annotation is structured explanatory metadata shown in reports and consumable by reporters.

**Q: Why use the `tag` details property instead of putting tags in a title?**  
A: It keeps titles clean while preserving grep selection. Title tags remain useful for older-version compatibility or title-only tooling.

**Q: When should `testInfo.annotations` be used?**  
A: When run-time setup discovers information worth recording in the result, such as an environment condition. It should not conceal a failed dependency or alter business assertions based on labels.

**Q: When is `test.fail()` appropriate?**  
A: For a temporary, tracked known defect where an unexpected pass should alert the team. It should not become a permanent way to keep broken coverage green.

**Q: Are attachments annotations?**  
A: No. Annotations classify or explain a test; attachments are files or bodies that provide result evidence.

---

## Next

→ [33-test-data-factories-and-determinism.md](./33-test-data-factories-and-determinism.md)
