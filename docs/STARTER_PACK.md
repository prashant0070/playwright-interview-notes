# Starter Pack — Playwright Interview Notes

Pick a lane. Do not try to read all 37 modules on day one.

**Repo:** `YOUR_GITHUB_USERNAME/playwright-interview-notes`  
**Source of truth for APIs:** [playwright.dev](https://playwright.dev)

---

## 60-second orientation

| Asset | Use it for |
|---|---|
| Modules `01–18` | Core Playwright Test skill |
| Modules `23–32` | Advanced API fluency |
| Modules `33–37` | Senior/principal depth (data, flakes, scale, design) |
| [`19-interview-qa-bank.md`](../19-interview-qa-bank.md) | Speak answers aloud (incl. section **O**) |
| [`20-coding-round-problems.md`](../20-coding-round-problems.md) | Timed implementation |
| [`37-system-design-interview-scripts.md`](../37-system-design-interview-scripts.md) | Whiteboard loops |

---

## By level

### Junior / first Playwright job

1. [`01-fundamentals.md`](../01-fundamentals.md) → [`08-browser-context-page-and-multi-tab.md`](../08-browser-context-page-and-multi-tab.md)
2. Coding problems **1–5** in module **20**
3. Q bank sections **A–D**
4. One page object from module **09**

**Exit check:** explain context isolation, locators, auto-wait, and a web-first assertion without notes.

### Mid-level SDET

1. [`07`](../07-fixtures-hooks-and-test-info.md), [`10`](../10-network-interception-and-mocking.md)–[`14`](../14-parallelism-sharding-retries-and-flakes.md), [`16`](../16-debugging-trace-ui-mode-and-codegen.md)–[`17`](../17-ci-cd-docker-reporters-and-artifacts.md)
2. Auth setup + `storageState` ([`12`](../12-authentication-storage-state-and-sessions.md))
3. Coding problems **6–15**
4. Q bank through **N**; sample **O**

**Exit check:** design a fixture with teardown; arm `waitForResponse` before click; explain workers vs shards.

### Senior / staff

1. [`21`](../21-framework-design-for-interviews.md), [`33`](../33-test-data-factories-and-determinism.md)–[`36`](../36-performance-security-and-contract-testing.md)
2. Flake RCA playbook ([`34`](../34-flake-rca-playbook.md)) end-to-end
3. Coding problems **16–25**
4. Section **O** (Q291–Q330) cold

**Exit check:** flake SLO + quarantine policy; route vs HAR vs contract; typed worker vs test fixtures.

### Principal / lead

1. All of senior pack
2. [`37-system-design-interview-scripts.md`](../37-system-design-interview-scripts.md) — deliver scripts 1, 3, 5, 6 timed
3. [`22`](../22-selenium-cypress-comparison-and-migration.md) migration narrative
4. Mock interview: 45m coding + 45m design + 30m Q&A

**Exit check:** 10k-test control plane, auth matrix, MFE boundaries, Selenium strangler plan.

---

## 7-day emergency cram

| Day | Read | Drill |
|---|---|---|
| 1 | 01–08 | Q A–C; coding 1–3 |
| 2 | 09–12 | Coding 4–7; storageState pitfalls |
| 3 | 13–17 | Flakes; trace RCA story |
| 4 | 18, 23–26 | Soft assert vs poll; handlers |
| 5 | 27–32 | Connect/CDP; tags; CT boundary |
| 6 | 33–36 + Q **O** | Factory + flake SLO answers |
| 7 | 20 (hard) + 21 + 37 | One full mock interview |

Prefer the README **14-day senior track** when you have time.

---

## Daily practice ritual (45–90 min)

1. **Read** one module section (not an entire mega-file if short on time).
2. **Speak** the core trade-off in 60–90 seconds.
3. **Code** one tiny proof in a scratch Playwright project.
4. **Answer** 5–10 Q bank items cold.
5. **Log** weak topics → revisit next day.

---

## Mini lab (optional but high ROI)

```bash
npm init -y
npm i -D @playwright/test
npx playwright install
npx playwright test --help
```

Re-implement:

- unique data factory + fixture teardown (**33**)
- response wait armed before click (**20** #11 / #21)
- setup project + `storageState` (**12**)
- two contexts for authz (**36**)

---

## Common interview traps (read these early)

| Trap | Fix module |
|---|---|
| `waitForTimeout` as sync | **05**, **34** |
| Shared mutable user/cart | **33**, **14** |
| Soft-asserting preconditions | **06**, Q301 |
| Retries as quality strategy | **34** |
| Gigantic POM / BaseTest port from Selenium | **09**, **21**, **37** |
| Claiming Playwright replaces k6/AppSec | **36** |

---

## After you land the offer

- Star / fork the repo so other candidates find it.
- Open a PR for any outdated API you hit in real interviews.
- See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
