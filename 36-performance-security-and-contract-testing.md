# 36 — Performance, Security, and Contract Testing (with Playwright)

## Learning goals

Use Playwright for **perf smoke**, **API/UI contracts**, and **basic security checks** without pretending it replaces k6/Lighthouse CI, ZAP/Burp, or dedicated contract platforms. Know HAR, `APIRequestContext`, and authz checks that belong in an SDET interview.

> Cross-read **10** (routing/HAR), **11** (API testing), **12** (auth), **18** (performance boundaries).

---

## 1. Performance: what Playwright can and cannot claim

Playwright drives a real browser. That is useful for **smoke-level** user-perceived checks and for capturing timings, but it is a poor primary load generator.

| Use Playwright | Use a dedicated tool |
|---|---|
| Single-user journey budgets (p95 click→visible) | Multi-VU load (k6, Gatling, JMeter) |
| Catch egregious regressions on critical paths | Capacity planning, soak, stress |
| Correlate slow UI with network waterfall in trace | Server flame graphs, APM |
| Lighthouse via external orchestration (not core Test) | Lab/field performance products |

**Interview line:** “Playwright performance checks are canaries, not load tests. I keep them few, stable, and budgeted.”

### Perf smoke pattern

```ts
import { test, expect } from '@playwright/test';

test('@perf-smoke catalog becomes interactive', async ({ page }) => {
  await page.goto('/catalog', { waitUntil: 'domcontentloaded' });

  const start = Date.now();
  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  const elapsed = Date.now() - start;

  expect(elapsed, `catalog interactive budget`).toBeLessThan(3_000);
});
```

Notes:

- Budget **user-visible readiness**, not `networkidle` (analytics can break you).
- Pin environment, CPU, and browser channel—perf asserts are environment-sensitive.
- Prefer measuring with **trace** or Performance API markers over a single wall-clock assert when stakes rise.
- Mark `@perf-smoke` and run on a dedicated job with retries low; flaky budgets erode trust.

### CDP metrics (advanced interview spice)

```ts
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');
// ... exercise page ...
const metrics = await client.send('Performance.getMetrics');
// interpret cautiously — still not a substitute for Lighthouse/lab tools
```

State caveats: CDP metrics vary by browser (Chromium-oriented), and micro-benchmarks in E2E are noisy.

---

## 2. HAR and contract-ish network boundaries

HAR files record HTTP archives. Playwright can record and replay via routing:

```ts
// Record (occasionally, under controlled env)
await context.routeFromHAR('hars/checkout.har', {
  url: '**/api/**',
  update: true, // refresh when intentionally re-recording
});

// Replay in CI for deterministic third-party/edge cases
await context.routeFromHAR('hars/checkout.har', {
  url: '**/payments/**',
  update: false,
  notFound: 'abort', // or 'fallback' depending on strategy
});
```

Also related: `page.route` / `page.request` fulfillment for explicit stubs (**10**).

| Approach | Strength | Weakness |
|---|---|---|
| `route` + `fulfill` | Precise, readable stubs | Drift from real payloads |
| HAR replay | Realistic canned traffic | Auth expiry, dynamic IDs, huge files, PII |
| Live + schema assert | True integration | Needs stable env |

**Interview compare — route vs HAR:** use `route` for intentional behavioral stubs (500, empty list); use HAR when you need a bulk recorded surface (complex third party) and you scrub secrets. Neither replaces a versioned API contract test.

---

## 3. API contract testing with the `request` fixture

Playwright’s `APIRequestContext` (`request` fixture) is excellent for **lightweight contract checks** beside UI:

```ts
import { test, expect } from '@playwright/test';

test('@contract GET /api/orders/:id shape', async ({ request }) => {
  const created = await request.post('/api/orders', {
    data: { sku: 'SKU-100', qty: 1 },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();

  const res = await request.get(`/api/orders/${id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body).toEqual(
    expect.objectContaining({
      id,
      status: expect.stringMatching(/PENDING|PAID/),
      items: expect.arrayContaining([
        expect.objectContaining({ sku: 'SKU-100', qty: 1 }),
      ]),
    }),
  );
});
```

### How far to go

| Depth | Playwright `request` | Dedicated (Pact, OpenAPI validators, Postman/Newman, Schemathesis) |
|---|---|---|
| Status + required fields | ✅ | ✅ |
| Consumer-driven Pact | Possible but awkward | ✅ |
| Property-based / fuzz | Limited | ✅ |
| UI consumes same contract | ✅ hybrid tests | Complementary |

**Hybrid pattern (high interview value):** API creates entity → UI asserts user-visible state → API asserts final status. One journey, two layers, clear failure localization.

For OpenAPI, teams often validate responses in CI with a schema validator; Playwright can call the endpoint and attach the body for that validator, or assert a curated subset of fields critical to UI.

---

## 4. Basic security checks (SDET-scoped, not AppSec replacement)

Stay honest: Playwright is not your SAST/DAST platform. You **can** encode regression checks for bugs you already understand.

### Security headers smoke

```ts
test('@security-headers home sends baseline headers', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();

  expect(headers['x-content-type-options']?.toLowerCase()).toBe('nosniff');
  expect(headers['x-frame-options'] || headers['content-security-policy']).toBeTruthy();
  // Avoid brittle exact CSP string matches unless you own that policy surface
});
```

### Authz / IDOR-style checks (high value)

```ts
test('@authz user A cannot read user B order', async ({ browser }) => {
  const contextA = await browser.newContext({ storageState: 'states/userA.json' });
  const contextB = await browser.newContext({ storageState: 'states/userB.json' });
  const pageA = await contextA.newPage();
  const requestB = contextB.request;

  // user A creates an order via UI or API
  await pageA.goto('/orders/new');
  // ... create ...
  const orderId = await pageA.getByTestId('order-id').innerText();

  const sneaky = await requestB.get(`/api/orders/${orderId}`);
  expect(sneaky.status(), 'B must not read A order').toBeGreaterThanOrEqual(400);

  await contextA.close();
  await contextB.close();
});
```

### Other reasonable checks

| Check | Example |
|---|---|
| Redirect to login when anonymous | `expect(page).toHaveURL(/sign-in/)` |
| Cookie flags on auth cookie | `secure`, `httpOnly` via `context.cookies()` (where applicable) |
| XSS reflection smoke | Input `"><script>…` asserts text not executable DOM — weak but sometimes required |
| Logout clears privileged UI | storage/session assertions after sign-out |

### Out of scope (say so)

Full CSP bypass hunting, dependency CVE scanning, infra pentests, advanced CSRF matrix, secrets in Git history—belong to security engineering tooling and processes.

---

## 5. Putting it in the test pyramid for interviews

```text
Manual / exploratory AppSec & perf labs
          ↑
   Load (k6) + Lighthouse CI + APM
          ↑
   Few Playwright @perf-smoke / @authz / @contract
          ↑
   Playwright E2E journeys (thin)
          ↑
   API contract suite (request or dedicated)
          ↑
   Unit / component tests
```

Tag and schedule:

- `@contract` on every PR (fast).
- `@authz` on PR or merge (critical paths).
- `@perf-smoke` on dedicated hardware nightly + release.
- `@security-headers` nightly (low flake if env-stable).

---

## 6. Common mistakes

| Mistake | Better |
|---|---|
| Asserting TTFB in parallel overloaded CI | Dedicated job + budgets with slack |
| HAR in repo with tokens | Scrub; gitignore; synthetic fixtures |
| “We do security with Playwright” as the whole program | Position as regression checks |
| Exact full JSON body golden files | `objectContaining` / schema subset |
| Perf + functional asserts in one giant test | Split; different flake economics |
| Using `networkidle` as perf oracle | User-visible markers |

---

## Interview Q&A

**Q: Can Playwright replace k6?**  
A: No. It can smoke user-perceived budgets for a single journey. Load and capacity need a dedicated tool.

**Q: Route stub vs HAR vs live contract test?**  
A: Stubs for controlled behavior, HAR for recorded bulk dependencies, live/`request` asserts for real contract confidence. Combine deliberately.

**Q: How do you test authorization with Playwright?**  
A: Two isolated contexts/storage states; resource created as user A; user B’s `request` or UI must receive 401/403/empty—not the resource.

**Q: What’s a safe header assertion?**  
A: Presence of stable baseline headers and coarse CSP/frame protections; avoid asserting entire evolving CSP strings unless that policy is a owned, versioned artifact.

**Q: Where do contracts live relative to E2E?**  
A: Prefer fast API contract checks on PR; keep E2E for integrated user outcomes; use hybrid API-seed + UI-verify for localization of failures.

---

## Next

→ [37-system-design-interview-scripts.md](./37-system-design-interview-scripts.md)
