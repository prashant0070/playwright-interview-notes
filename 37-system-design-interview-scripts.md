# 37 — System Design Interview Scripts (Playwright / SDET)

## Learning goals

Deliver 5–8 whiteboard-ready answers for senior→principal interviews: large suites, multi-env, auth matrices, microfrontends, flake control planes, and Selenium migration. Speak in requirements, trade-offs, and failure modes—not folder trees alone.

> Pair with **21** (framework design) and **22** (Selenium migration). This module is timed oral scripts (~5–8 minutes each).

---

## How to use these scripts

1. Restate constraints and non-goals (60s).
2. Draw the control plane + test layers (90s).
3. Dive one level deep where the interviewer probes (fixtures, sharding, data).
4. Close with risks, metrics, and rollout (60s).

---

## Script 1 — Framework for 10k tests

**Prompt:** “Design a Playwright system that will grow to ~10,000 tests.”

### Restate

- Web E2E + API assist; not native mobile.
- PR feedback target (e.g. smoke < 12 min), nightly full suite.
- Multiple roles/browsers; shared platform team + domain squads.
- Non-goals: replace unit/component; become a load tester.

### Architecture

```text
                    ┌─────────────────────────┐
   PR / Nightly ──▶ │  Orchestrator (CI)      │
                    │  shard math, grep, SLO  │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   Shard 1..N              Merge reports          Reliability
   Playwright Test         blob → HTML/JUnit      flake warehouse
        │
        ├─ setup projects → storageState(role)
        ├─ domain packages (checkout, account, …)
        ├─ platform: fixtures, factories, API clients, reporter
        └─ artifacts: trace/video on failure
```

### Key design choices

| Decision | Choice | Trade-off |
|---|---|---|
| Ownership | Domain folders + `owner` annotation | Platform doesn’t bottleneck every selector |
| Selection | Tags `@smoke`/`@regression` + path filters | Avoid one mega-job |
| Parallelism | `fullyParallel` + CI shards | Requires isolation discipline (**33**) |
| Data | API factories, test-scoped | Cost of seeding vs flake cost |
| Abstraction | Thin pages + fixtures; avoid Selenium-era BaseTest | Less magic, faster RCA |
| Browsers | Chromium on PR; multi-browser nightly | Cost vs coverage |

### Shard math (say aloud)

```text
wall ≈ ceil(total_test_time / (shards * effective_parallelism)) + overhead
```

Balance by **timing**, not file count, when suite skews. Rebalance when p95 shard duration drifts >20%.

### Metrics

- PR smoke duration, flake rate (**34**), top failing owners, artifact upload success, cost per run.

### Risks to name

- Shared mutable data at scale.
- Over-quarantine.
- Report merge gaps.
- Selector ownership wars → enforce a11y/`data-testid` contracts.

---

## Script 2 — Multi-environment strategy

**Prompt:** “Support local, ephemeral PR envs, staging, and prod-like.”

### Principles

1. **Same tests, different config** — `baseURL`, credentials, feature flags via env + projects.
2. **Prod is mostly read-only synthetic monitoring** — no destructive orders without safe tenants.
3. **Ephemeral envs** get seeded baselines; don’t assume shared staging data.

```ts
// playwright.config.ts (sketch)
const env = process.env.E2E_ENV ?? 'local';

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL, // injected per env
  },
  projects: [
    { name: `${env}-setup`, testMatch: /.*\.setup\.ts/ },
    {
      name: `${env}-chromium`,
      dependencies: [`${env}-setup`],
      use: { storageState: `states/${env}/customer.json` },
    },
  ],
});
```

### Trade-offs

| Approach | Pros | Cons |
|---|---|---|
| One config, env vars | Simple | Mistyped env = silent wrong target |
| Project-per-env | Explicit | Combinatorial explosion with browsers |
| Separate pipelines | Strong blast radius | Drift between suites |

**Probe answer:** “I fail fast when `BASE_URL` missing; I tag destructive tests `@destructive` and exclude them from prod synthetics; I version seed data with the env’s API.”

---

## Script 3 — Auth matrix (roles × browsers × apps)

**Prompt:** “We have guest, customer, seller, admin; MFA on admin; SSO on seller.”

### Design

```text
setup-customer ──▶ states/customer.json ──▶ projects needing customer
setup-seller  ──▶ states/seller.json
setup-admin   ──▶ states/admin.json   (MFA test seam / TOTP secret in vault)
guest         ──▶ no storageState
```

```ts
projects: [
  { name: 'setup-customer', testMatch: /auth.customer.setup.ts/ },
  { name: 'setup-seller', testMatch: /auth.seller.setup.ts/ },
  {
    name: 'customer-chromium',
    dependencies: ['setup-customer'],
    use: { ...devices['Desktop Chrome'], storageState: 'states/customer.json' },
  },
  {
    name: 'admin-chromium',
    dependencies: ['setup-admin'],
    grep: /@admin/,
    use: { storageState: 'states/admin.json' },
  },
],
```

### Interview points

- **Never** one shared admin for parallel writers—lease admin sessions or isolate tenants.
- MFA: use a **test seam** (bypass header in non-prod, vault TOTP), never disable security in prod.
- Refresh `storageState` on expiry; treat files as secrets.
- Authz tests (**36**) deliberately cross roles with two contexts.
- Matrix explosion: not every role × every browser × every journey. Smoke: all roles on Chromium; Firefox/WebKit on `@smoke` subset.

---

## Script 4 — Microfrontend testing

**Prompt:** “Checkout is a remote MFE owned by another team; shell is ours.”

### Layers

| Layer | Owner | Tooling |
|---|---|---|
| MFE unit/component | MFE team | CT / unit (**29**) |
| MFE contract (routes, custom events, i18n keys) | Bilateral | API/contract + CT |
| Shell integration E2E | Shell + MFE DRIs | Playwright thin journeys |
| Visual of shared header | Design system | Limited screenshots / ARIA snapshots |

### Tactics

1. **Test against composed env** that loads real remotes at known versions (or stage versions).
2. Prefer **role/label** locators; avoid piercing shadow/CSS internals of remotes you don’t own—agree `data-testid` contracts at boundaries.
3. `route` stub remotes only for shell-resilience tests (“remote down → error boundary”), not for happy-path checkout.
4. Version pins in env metadata attached to `testInfo` for RCA (“checkout@1.14.2”).
5. Ownership: failure in checkout remote selectors → MFE team; shell routing → shell team (annotations).

### Trade-off

Full E2E through all remotes is expensive and politically fraught. Push depth down to CT/contracts; keep few cross-MFE journeys.

---

## Script 5 — Flaky control plane

**Prompt:** “How do you operate reliability for a large Playwright estate?”

Reuse **34** as the deep dive; on the whiteboard draw:

```text
CI results ──▶ warehouse ──▶ dashboards (flake %, hot spots)
                 │
                 ├─ quarantine gate + expiry bot
                 ├─ auto-file issues for new flaky signatures
                 └─ weekly reliability review
```

Policies to recite:

1. `@smoke` flake SLO = 0 tolerated.
2. Suite flake SLO < 1% (example).
3. Quarantine requires owner + issue + date; shadow runs continue.
4. Retries ≤ 1 in CI; flaky-pass still counts against SLO.
5. Top 10 flaky tests are a staff-level objective, not “QA homework.”

---

## Script 6 — Migration from Selenium

**Prompt:** “We have 3k TestNG/Selenium tests. Migrate to Playwright.”

### Phased plan

| Phase | Action | Exit |
|---|---|---|
| 0 | Pilot 1 critical journey; prove CI artifacts/traces | Team buy-in |
| 1 | Platform: config, fixtures, factories, auth setup | New tests are Playwright-first |
| 2 | Strangler: migrate by domain risk, not line count | Dual-run parity on `@smoke` |
| 3 | Delete Selenium for migrated domains | Ownership cutover |
| 4 | Decommission grid for web E2E | Cost savings realized |

### Mapping talking points (**22** depth)

| Selenium habit | Playwright replacement |
|---|---|
| Explicit waits everywhere | Auto-wait + web-first expect |
| Driver singleton | Context/page fixtures |
| Huge BasePage | Thin pages + fixtures |
| Grid nodes | Playwright browsers in CI container / cloud |
| TestNG dependencies | Independent tests + API seed; rare `serial` |

### Risk

- Rewrite-all big bang fails.
- Keeping WebDriver wait patterns inside Playwright creates “Selenium on CDP.”
- Parity theater: dual-run forever—set end dates.

---

## Script 7 — PR vs nightly quality gates

**Prompt:** “What’s your CI design?”

```text
PR:   lint + unit + CT + Playwright @smoke (Chromium, shard 2–4) + @contract
Merge/nightly: @regression multi-browser, @authz, visual subset
Release: @smoke multi-browser + prod-like read-only synthetics
Quarantine: scheduled, non-gating but visible
```

Artifacts: blob per shard → merge; traces on first retry; retention aligned with PII policy.

---

## Script 8 — “Why not one giant POM framework?”

**Prompt:** Often a hidden prompt when they ask you to critique their Selenium framework.

### Answer structure

1. Playwright already provides runner, fixtures, isolation, assertions, traces.
2. Over-abstracted waits/wrappers **fight** auto-waiting.
3. Prefer **composition**: fixtures inject pages; flows for multi-page journeys used thrice+.
4. Measure success by **MTTR on failures** and flake SLO, not class count.

---

## Common whiteboard mistakes

| Mistake | Stronger move |
|---|---|
| Jump into folder structure | Start with SLOs and isolation |
| Promise 100% browser × role × journey | Explicit coverage matrix |
| Ignore test data | Factories + API teardown (**33**) |
| “Retries = strategy” | Control plane (**34**) |
| Migrate by copying Selenium helpers | Teach Playwright idioms |

---

## Interview Q&A

**Q: First question you’d ask before designing the framework?**  
A: What environments can tests mutate, what’s the PR time budget, which roles need isolation, and who owns failures?

**Q: How do you stop 10k tests from becoming unmaintainable?**  
A: Domain ownership, thin E2E, strong lower layers, tag-based selection, flake SLOs, and platform fixtures—not a single shared BaseTest.

**Q: How do you handle MFA in CI?**  
A: Non-prod test seam or vault-backed TOTP in setup projects; never store interactive bypasses in prod; rotate secrets.

**Q: Microfrontends break your selectors—what do you do?**  
A: Boundary contracts (`data-testid`/roles), CT owned by MFE teams, few composed E2E journeys, stub only for resilience cases.

**Q: What’s the Selenium migration killer?**  
A: Big-bang rewrite and porting explicit-wait frameworks instead of adopting locator/fixture/expect models.

---

## Next

→ [19-interview-qa-bank.md](./19-interview-qa-bank.md) (section **O**) · [21-framework-design-for-interviews.md](./21-framework-design-for-interviews.md)
