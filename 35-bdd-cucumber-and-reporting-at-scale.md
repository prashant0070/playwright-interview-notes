# 35 — BDD, Cucumber, and Reporting at Scale

## Learning goals

Decide when BDD helps or hurts a Playwright suite, know realistic Cucumber/BDD integration options, operate Allure/Monocart/blob reporting at shard scale, and assign test ownership so large suites remain actionable.

> Cross-read **17** (CI/reporters), **28** (custom reporters / blob merge), **32** (tags/annotations).

---

## 1. BDD with Playwright: when it helps, when it hurts

**BDD** (Behavior-Driven Development) is a collaboration practice—shared examples in business language—not a synonym for Cucumber syntax.

| BDD helps | BDD hurts |
|---|---|
| Product, QA, and eng already refine scenarios together | “BDD” means only a Gherkin layer over existing E2E with no workshop |
| Auditable acceptance criteria for regulated flows | Step definitions become a second POM full of sleeps and CSS |
| Living documentation for a few critical journeys | Every UI widget gets a scenario → combinatorial explosion |
| Same scenario maps to API + UI bindings carefully | Duplicate coverage: Cucumber E2E + Playwright specs drift |

**Interview stance (senior):** Prefer Playwright Test as the execution engine. Introduce Gherkin only if stakeholders actually read and co-author `.feature` files. Otherwise use descriptive `test(...)` titles, tags, and living docs in the repo/Notion—not an unused feature layer.

---

## 2. Cucumber / BDD options in a Playwright world

### Option A — Pure Playwright Test (default recommendation)

```ts
test.describe('Checkout', () => {
  test('guest can place a prepaid order @smoke @checkout', async ({ page }) => {
    // Given / When / Then live in comments or just clear code
    await page.goto('/catalog');
    // ...
    await expect(page.getByRole('status')).toHaveText('Order confirmed');
  });
});
```

Pros: one runner, fixtures, trace, sharding, TypeScript. Cons: non-technical stakeholders may not open specs.

### Option B — Gherkin via community Cucumber + Playwright

Patterns typically use `@cucumber/cucumber` (or similar) with a world that holds a Playwright `page`. Trade-offs to state aloud:

- You **lose or re-implement** much of `@playwright/test`: fixtures, projects, `expect` web-first retries, built-in parallel model, trace UX.
- Step reuse can create **hidden coupling** (“Given I am logged in” mutates global world state).
- Parallelism and isolation become your problem again.

### Option C — Thin Gherkin mapped to Playwright Test functions

Generate or manually bind each scenario to a Playwright test that calls shared flow functions. Keeps Playwright runner benefits; Gherkin is documentation + selection.

### Option D — Playwright component/E2E tests + separate acceptance docs

Often the healthiest “BDD”: discovery workshops produce examples; automation implements them as Playwright tests without obligatory `.feature` files.

**Do not invent** a first-party `@playwright/test` Cucumber API in interviews—there isn’t an official Cucumber runner inside Playwright. Speak in integrations and trade-offs.

---

## 3. If you must do steps: keep them intention-revealing

```ts
// flows/checkout.flow.ts — automation API for scenarios, BDD or not
export async function addFirstPurchasableItem(page: Page) {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
}

export async function payWithTestCard(page: Page) {
  await page.getByRole('button', { name: 'Pay now' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
}
```

Rules:

1. Steps call **flows/page objects**, not raw CSS.
2. No shared mutable `World.cartId` across scenarios without isolation.
3. Assertions stay in the scenario/test, or in domain-named helpers—not in every micro-step.
4. One scenario = one independent journey; avoid `@depends-on-previous`.

---

## 4. Reporting at scale: built-ins first

Playwright built-ins you must know cold:

| Reporter | Role |
|---|---|
| `list` / `line` / `dot` | Local/CI stdout |
| `html` | Interactive single-run report |
| `junit` | Enterprise CI connectors |
| `json` | Custom tooling |
| `blob` | Per-shard machine-readable fragments to merge |
| `github` | Annotations on GitHub Actions |

Sharded merge (official pattern):

```ts
// playwright.config.ts
reporter: process.env.CI
  ? [['blob', { outputDir: `blob-report-${process.env.SHARD_INDEX}` }], ['github']]
  : [['html', { open: 'never' }], ['list']],
```

```bash
# after all shards upload artifacts into ./all-blob-reports
npx playwright merge-reports --reporter html,./all-blob-reports
# or: npx playwright merge-reports --config=merge.config.ts ./all-blob-reports
```

Interview detail: **blob → merge-reports** preserves attachments/traces references when artifact paths are handled correctly. Merging HTML folders by hand is wrong.

---

## 5. Allure, Monocart, and ecosystem reporters

Teams often add richer history/trend UI:

| Tool | Why teams adopt it | Playwright notes |
|---|---|---|
| **Allure** | History, categories, suites, attachments UX | Community adaptor/reporter; version-pin; don’t double-attach huge traces carelessly |
| **Monocart** | HTML-centric rich report, merging discussions in community | Verify current Playwright compatibility; still keep blob for official merge if sharding |
| **Custom reporter** | Ownership, SLO, quarantine expiry | See **28**; emit to your warehouse |

**Principal guidance:**

1. Keep **one source of truth** for pass/fail (Playwright results / blob merge).
2. Treat Allure/Monocart as **presentation and history**, not a second flaky executor.
3. Redact secrets before any reporter uploads bodies/HARs.
4. At 10k tests, prioritize **queryable metadata** (owner, tag, duration, flake) over prettier HTML alone.

Sketch: Playwright reporter implements `onTestEnd`, writes parquet/JSON lines with `testId`, `project`, `outcome`, `retry`, `tags`, `owner`; dashboard computes flake SLO from **34**.

---

## 6. Test ownership at scale

Without ownership, reporting is tourism.

```ts
test.describe(
  'Billing invoices',
  {
    annotation: { type: 'owner', description: 'team-billing' },
    tag: ['@billing'],
  },
  () => {
    test('downloads PDF invoice', async ({ page }) => { /* ... */ });
  },
);
```

Ownership model interviewers like:

| Layer | Owner |
|---|---|
| Journey `@checkout` | Checkout squad QA + eng twin |
| Platform fixtures/config | Test platform / SDET guild |
| Browser infra / shards | CI platform |
| Quarantine exit | Named DRI on the issue |

Reporting must surface **owner** on failure Slack/GitHub comments. A custom reporter or CI script maps `annotation.owner` → CODEOWNERS/team routing.

---

## 7. Selecting what runs: tags > giant BDD suites

```bash
npx playwright test --grep @smoke
npx playwright test --grep @checkout --grep-invert @quarantined
```

| Pipeline | Selection | Goal |
|---|---|---|
| PR | `@smoke` + touched-area tags | < 10–15 min |
| Merge / nightly | `@regression` minus quarantine | Full confidence |
| Release | `@smoke` + critical journeys multi-browser | Gate |
| Quarantine shadow | `@quarantined` | Visibility |

BDD feature tags (`@smoke`) only help if they match the same taxonomy as Playwright tags—duplicate taxonomies drift.

---

## 8. Common mistakes

| Mistake | Fix |
|---|---|
| Cucumber for “enterprise feel” with no business readers | Drop Gherkin; invest in titles + docs |
| Step def copying Selenium sleeps | Web-first expect inside Playwright tests |
| HTML report per shard only | Blob + `merge-reports` |
| Allure without retention/redaction policy | Treat as prod-adjacent data |
| No owners on failures | Annotations + routing |
| One 2k-scenario feature file | Split by domain; keep scenarios independent |

---

## Interview Q&A

**Q: Should we use Cucumber with Playwright?**  
A: Only if stakeholders co-author Gherkin and you accept re-implementing runner features—or you map scenarios thinly onto Playwright Test. Otherwise descriptive Playwright tests + tags beat a unused BDD stack.

**Q: How do you merge sharded reports?**  
A: Each shard emits the blob reporter; CI collects blob outputs; `npx playwright merge-reports` produces unified HTML/JUnit.

**Q: Allure vs Playwright HTML?**  
A: HTML/blob is first-party and sufficient for many teams. Allure adds history/organization at the cost of another moving part—justify with consumers and retention needs.

**Q: How do you assign ownership?**  
A: Domain annotations/tags aligned to squads, CODEOWNERS for platform code, and reporter/CI routing so every failure notifies a DRI.

**Q: What’s the biggest BDD failure mode in automation?**  
A: Gherkin as a wrapper that adds indirection without collaboration, producing brittle step libraries and slower RCA.

---

## Next

→ [36-performance-security-and-contract-testing.md](./36-performance-security-and-contract-testing.md)
