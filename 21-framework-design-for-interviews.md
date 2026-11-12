# 21 — Framework Design for Interviews

This is a whiteboard guide for designing a maintainable Playwright framework for a generic multi-brand e-commerce website. It is deliberately product-neutral: the architecture should work for any web application with catalog, cart, checkout, account, and support journeys.

## 1. Open with requirements, not folders

For an interview prompt such as “design our E2E framework,” first bound the problem:

- Is the scope web, native mobile, or both? Playwright covers web and mobile-web emulation, not native apps.
- Which environments may tests write to? What test-data APIs and test-only payment or identity seams exist?
- What is the PR feedback target, browser support policy, and expected nightly duration?
- Which user roles need isolation? Are test accounts rate limited or subject to MFA?
- Which artifacts may be retained? Screenshots, traces, and HAR files can contain personal data.
- Who owns selector contracts, test failures, and the shared platform code?

State explicit non-goals: E2E tests do not replace unit, integration, accessibility, performance, or security testing; they protect a deliberately small set of high-value user outcomes.

## 2. Design principles

1. **Tests describe outcomes.** A spec says “guest can place a standard order,” not “click element 4.”
2. **Isolation beats cleanup.** Each test creates or leases distinct mutable data where possible.
3. **Use Playwright primitives directly.** Locators, fixtures, projects, web-first assertions, traces, and routes need less custom abstraction than WebDriver-era frameworks.
4. **Testability is a product contract.** Semantic HTML, accessible names, and stable test IDs are collaboration requirements.
5. **Optimize for diagnosis.** A failed CI test must leave a trace, screenshot, logs, and a clear owner.

## 3. Reference architecture

```text
Developer / CI
      |
playwright.config.ts ── projects, retries, reporters, sharding
      |
      +── setup project ── authenticated storage-state files
      |
      +── tests/ ── thin, independently runnable specifications
      |      |
      |      +── fixtures/ ── dependency injection and lifecycle
      |      +── src/pages/ ── page- or component-level operations
      |      +── src/flows/ ── reusable business journeys (sparingly)
      |      +── src/api/ ── data setup and cleanup clients
      |      +── src/data/ ── typed factories and test data
      |      +── src/support/ ── logging, IDs, environment validation
      |
      +── artifacts/ ── blob reports, traces, screenshots, HTML report
```

### Suggested layout

```text
playwright.config.ts
package.json
src/
  pages/
    catalog.page.ts
    cart.page.ts
    checkout.page.ts
  flows/
    checkout.flow.ts
  api/
    catalog.client.ts
    test-data.client.ts
  data/
    order.factory.ts
  support/
    env.ts
    ids.ts
fixtures/
  test.ts
tests/
  setup/
    auth.setup.ts
  smoke/
  checkout/
  account/
  visual/
```

Keep a page object focused on one rendered surface. It may expose meaningful locators and actions, but should not become a global service container. Use a flow when several pages make one reusable business journey; do not create a “steps” layer merely to forward method calls.

## 4. Locator and assertion contract

Prefer `getByRole`, `getByLabel`, `getByText`, and `getByTestId` in that order where they reflect the user-visible contract. A broad CSS selector coupled to `nth()` is a maintenance liability. Locators are lazy and strict actions require one target, so scope them to a region or table row:

```ts
const row = page.getByRole('row').filter({ hasText: orderId });
await row.getByRole('button', { name: 'Cancel order' }).click();
await expect(row).toContainText('Cancelled');
```

Use `expect(locator)` rather than reading text then asserting it. The former retries until the UI reaches the expected state. Avoid arbitrary sleeps, `force: true`, and `networkidle` as readiness signals.

## 5. Authentication and roles

Use a Playwright setup project to perform UI login once per required role and write an ignored storage-state file. Dependent browser projects then start authenticated:

```ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/customer.json' },
    dependencies: ['setup'],
  },
]
```

The setup test must verify login succeeded before `context.storageState({ path })`. Treat the file as a credential: exclude it from source control and retain it only as long as its session needs.

For multiple roles, create separate states (for example, customer and support). If a role changes server-side state, allocate a unique user or lease one from a **generic user pool** keyed by worker index, release it in fixture teardown, and reset it through a supported API. A browser context is isolated; the database account behind it is not.

## 6. Fixtures and data

Fixtures are dependency injection with deterministic teardown. Keep browser/page fixtures scoped per test unless cost and state safety justify worker scope. An API client can seed a product or create an order faster and more reliably than clicking through the UI, while the test still validates the user-facing outcome.

```ts
export const test = base.extend<{ seededProduct: Product }>({
  seededProduct: async ({ request }, use, testInfo) => {
    const product = await createProduct(request, { reference: testInfo.testId });
    await use(product);
    await deleteProduct(request, product.id);
  },
});
```

Factories should generate valid defaults and permit only the fields relevant to a scenario. Use generated IDs, avoid shared static records, and make cleanup idempotent. For irreversible external systems, use a sandbox, a fake integration, or an explicit read-only test.

## 7. Configuration and projects

Use projects for meaningfully different execution environments: browser engines, device profiles, locale, or setup dependencies. Do not make a project for every feature. Keep environment-specific values in validated environment variables:

```ts
export default defineConfig({
  use: { baseURL: process.env.BASE_URL, trace: 'on-first-retry' },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['blob'], ['junit', { outputFile: 'results.xml' }]] : 'list',
});
```

Tag tests using Playwright annotations or `@tag` in titles, then select them through `--grep`. Tags should be few and orthogonal, such as `@smoke`, `@checkout`, `@read-only`, and `@visual`; document what each tag promises.

## 8. CI execution model

| Stage | Purpose | Typical policy |
|---|---|---|
| Pull request | Fast confidence | Chromium, `@smoke`, changed-area tests, one retry |
| Main branch | Detect integration issues | Core journeys plus accessibility/visual subsets |
| Nightly | Broader risk coverage | Browser matrix, responsive cases, larger data set |
| Release candidate | Evidence for release | Explicit critical journey list and stable environment |

Set workers based on CPU, application capacity, and available accounts—not merely machine cores. Use `--shard=N/M` to distribute a suite across CI jobs. Configure the `blob` reporter for every shard, collect all blob directories, then run `npx playwright merge-reports --reporter html <blob-directory>` in a single aggregation job.

## 9. Reporting, debugging, and ownership

For CI failures, retain trace on first retry, screenshots on failure, and video where its storage cost is justified. Publish HTML reports and CI-native JUnit results. A custom reporter is appropriate only when standard reporters cannot deliver a required integration; it should consume test events and never decide test outcomes.

Define the failure workflow:

1. The test owner inspects trace, console, request, screenshot, and retry history.
2. Classify the failure: product defect, test defect, environment issue, or third-party outage.
3. File and link a defect, fix the test, or quarantine temporarily with an owner and expiry.
4. Do not turn retries or increased timeouts into the permanent fix.

Track a flake SLO, such as “fewer than 1% of non-product failures over a rolling 14 days,” alongside PR duration, pass rate, and mean time to diagnose. An SLO makes reliability work visible rather than optional.

## 10. Network, third parties, and time

Use `page.route()` before navigation to make deterministic UI edge cases: empty carts, server errors, or delayed responses. Use real integrations for a small approved set of end-to-end confidence tests, and mocked/sandboxed integrations for broad functional coverage. Never automate CAPTCHA solving; request a test-environment bypass.

Use Playwright's Clock API only when the application can be tested against controlled browser time. It helps with expiry banners, timers, and scheduled UI states, but it cannot make an external backend's clock deterministic. State this limitation in an interview.

## 11. Security and artifact hygiene

- Read credentials from secret storage or CI variables; never commit them.
- Use least-privileged, labeled test accounts and test payment instruments.
- Prevent production writes unless explicitly approved and guarded.
- Redact tokens, personal data, and payment fields from logs, traces, and HAR files.
- Set artifact access controls and retention periods.

## 12. A concise interview answer

“I would start with a small, risk-based suite and make each test independent. The specs would be thin, with typed fixtures for auth, data setup, and cleanup; page objects would encapsulate only meaningful UI operations. Login is a setup project that creates protected storage-state files per role. CI runs a Chromium smoke suite on pull requests, shards broader cross-browser coverage later, and merges blob reports into one HTML report. Traces on retry and a flake SLO give us evidence to fix instability rather than hiding it with retries. The key product contract is accessible, stable selectors and supported test-data APIs.”

## Next

→ [22-selenium-cypress-comparison-and-migration.md](./22-selenium-cypress-comparison-and-migration.md)
