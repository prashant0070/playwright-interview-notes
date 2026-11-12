# 34 — Flake RCA Playbook

## Learning goals

Classify flakes, run a disciplined root-cause analysis (RCA), use Playwright diagnostics without cargo-culting retries, quarantine responsibly, and discuss flake-rate SLOs like a staff/principal SDET.

> Builds on **14** (retries/sharding) and **16** (trace/UI mode). This module is the interview “incident commander” answer for flaky E2E.

---

## 1. Flake taxonomy (name it before you “fix” it)

Interviewers want precise language. Map every flake into a primary class:

| Class | Typical signal | Durable fix direction |
|---|---|---|
| **Sync / race** | Passes with sleep; fails on click/assert timeout | Wait on observable UI/network; arm listeners before triggers |
| **Isolation / data** | Fails only under workers or full suite | Unique data, no shared mutable accounts |
| **Environment** | CI-only, time-of-day, capacity | Pin browsers, resources, third-party seams |
| **Nondeterministic product** | A/B, ads, live clocks, animations | Control flags, clock, motion, mask dynamic regions |
| **Selector brittleness** | Strict-mode multi-match; wrong row | Role/label/test-id; scope to row/region |
| **Infra / runner** | Agent OOM, shard imbalance, browser crash | Resource limits, retries only for infra, health checks |
| **Over-mocking / under-mocking** | Mock drift vs real contract | Contract tests + intentional boundaries |
| **Human process** | Quarantine forever; retries hide bugs | SLO + ownership + expiry |

If you cannot classify it, you do not yet have an RCA—you have a guess.

---

## 2. RCA process (interview script)

Use this 7-step narrative in senior interviews:

1. **Stabilize the definition of failure** — Capture the exact assertion/error, project, browser, shard, retry index.
2. **Preserve evidence** — Trace, screenshot, video, console, network; do not delete the failing job artifacts.
3. **Reproduce deliberately** — `npx playwright test path/spec.ts:line --retries=0 --repeat-each=20 --workers=1`, then raise workers.
4. **Bisect variables** — Parallelism, data, env, browser, headed vs headless, clock/locale.
5. **Form a falsifiable hypothesis** — “Click races newsletter overlay,” not “CI is slow.”
6. **Fix the cause** — Product readiness, locator, isolation, or controlled seam—not a larger timeout as the primary fix.
7. **Prove and monitor** — Repeat-each green; flake dashboard trend; remove quarantine.

```bash
# Isolate timing vs shared state
npx playwright test tests/checkout.spec.ts --retries=0 --repeat-each=25 --workers=1

# Reveal cross-test interference
npx playwright test tests/checkout.spec.ts --retries=0 --repeat-each=25 --workers=4

# Keep artifacts rich while diagnosing
npx playwright test tests/checkout.spec.ts --trace on --video on --screenshot on
```

Config for CI diagnosis (temporary):

```ts
// playwright.config.ts (excerpt)
export default defineConfig({
  retries: process.env.CI ? 1 : 0, // keep low; see §4
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

---

## 3. Tooling: what each artifact proves

| Artifact | Best for | Weak for |
|---|---|---|
| **Trace** (`trace on` / Trace Viewer) | Actionability timelines, network, consoles, snapshots before/after actions | Extremely long runs (size); secrets in payloads |
| **Video** | Human narrative of unexpected navigation/overlays | Precise timing; headless differences |
| **Screenshot** | Final DOM visual state | How you got there |
| **UI mode / Inspector** | Interactive locator and step debugging | Reproducing rare parallel races |
| **`--debug` / PWDEBUG** | Step-through locally | CI flakes under load |
| **HAR** | Replaying third-party/network boundaries | Dynamic auth and mutating APIs without scrubbing |
| **Custom logging / `testInfo.attach`** | Seed IDs, feature flags, build SHA | Replacing assertions |

Interview line: “I open the trace first—timeline shows whether the element never became actionable, became stale, or the wrong request completed.”

### Reading a trace like an RCA lead

1. Jump to the failing action.
2. Check **before/after** DOM snapshots and whether the overlay intercepted pointer events.
3. Inspect **network**: pending vs failed vs slow; wrong status; CORS.
4. Read **console** errors that UI swallowed.
5. Compare **retry 0 vs retry 1**—if retry 1 passes with different network ordering, you have a race, not “fixed by magic.”

---

## 4. When retries hide bugs

Retries are an **availability** control for the pipeline, not a quality strategy.

| Retry policy | Appropriate use | Anti-pattern |
|---|---|---|
| `retries: 0` locally | Force engineers to see truth | — |
| `retries: 1` in CI | Absorb rare infra blips while measuring flakes | `retries: 3` on a chronically red suite |
| Project-level retries | Only for known infra-sensitive projects | Hiding product races in checkout |
| `test.fixme` / skip | Never as silent flake absorption | “Keep main green” without ticket |

**Key interview distinction:**

- **Flaky pass** (failed then passed on retry) = still a defect in signal quality.
- **Infra retry** (browser download, agent disconnect) may be classified separately if telemetry proves it.

Measure:

```text
flake_rate = flaky_tests / executed_tests
# or more strictly:
flake_rate = tests_with_retry_pass / tests_run
```

A suite can be “green” at 8% flake and still be untrustworthy. Principal answer: treat flake rate as a **SLO**, not a vibe.

---

## 5. Quarantine strategy (containment with teeth)

Quarantine is allowed only as **time-boxed containment**.

```ts
test(
  'exports CSV',
  {
    tag: ['@quarantined', '@checkout'],
    annotation: [
      { type: 'issue', description: 'https://tracker.example.test/QA-441' },
      { type: 'owner', description: 'checkout-qa' },
      { type: 'quarantine-until', description: '2026-12-01' },
    ],
  },
  async ({ page }) => {
    // ...
  },
);
```

Operational rules:

1. **Gate:** required PR job uses `grepInvert: /@quarantined/`.
2. **Shadow run:** scheduled job runs `@quarantined` with `retries: 0` and publishes a flake report.
3. **Expiry:** CI fails the quarantine job if `quarantine-until` is past (custom reporter or script).
4. **Ownership:** no owner → cannot quarantine.
5. **Cap:** hard limit (e.g. ≤1% of suite or ≤N tests); exceeding cap fails merge of new quarantines.
6. **Exit criteria:** root cause fixed + `--repeat-each=50` green on CI-shaped hardware.

Never rename a flake to `test.fixme()` without a product bug, and never delete coverage to silence CI.

---

## 6. Flake-rate SLOs and control plane

Staff/principal interviews often ask “how do you manage reliability of 5k–10k tests?” Answer with a control plane:

| Signal | Example SLO | Action when breached |
|---|---|---|
| Suite flake rate | < 1% of test runs flaky / 7 days | Freeze non-critical merges of new E2E; swarm RCA |
| P0 journey flake | 0 tolerated on `@smoke` | Block release; immediate owner page |
| Median time-to-RCA | < 2 business days for quarantined | Escalate; pair with product |
| Quarantine age | < 14 days | Auto-escalate or auto-reintroduce to gate (team policy) |
| Artifact completeness | ≥ 99% failures have trace | Fix CI upload path |

Implementation sketch (conceptual):

- CI emits JUnit/blob + custom reporter fields: `retry`, `tags`, `owner`, `shard`.
- Warehouse/dashboard aggregates flaky signatures (normalize dynamic IDs in titles).
- Weekly reliability review: top offenders by fail-impact × product risk.

---

## 7. Decision tree (memorize for whiteboard)

```text
Failure observed
  ├─ Reproduces with workers=1, retries=0?
  │    ├─ Yes → sync/selector/product/env (single-thread RCA)
  │    └─ No  → isolation/data/order dependence
  ├─ Reproduces only with parallel workers?
  │    └─ Shared mutable state / resource contention
  ├─ Reproduces only in CI?
  │    └─ Compare browser build, CPU, secrets, baseURL, third parties
  └─ Passes on retry without code change?
       └─ Race or infra — do NOT close as “fixed by retry”
```

---

## 8. Common mistakes

| Mistake | Better move |
|---|---|
| Add `waitForTimeout(5000)` | Assert ready state / use web-first expect |
| Raise test timeout globally | Find the slow observable; budget timeouts intentionally |
| `retries: 2` everywhere | Measure flakes; fix top N; keep retries low |
| Quarantine without issue | Forbid in review |
| Trace off in CI | `on-first-retry` minimum |
| Debugging only the last retry | Compare attempt 1 vs 2 in artifacts |
| Blaming “Playwright is flaky” | Playwright surfaces races that sleeps used to hide |

---

## Interview Q&A

**Q: What’s your first move on a flaky CI test?**  
A: Pull artifacts (trace first), reproduce with `--retries=0 --repeat-each`, classify the taxonomy bucket, then fix synchronization or isolation—not the timeout.

**Q: Do retries help or hurt?**  
A: They protect pipeline throughput from rare infra noise but hide product races if overused. Track flaky-passes as failures of signal quality.

**Q: How do you quarantine safely?**  
A: Tag + issue + owner + expiry; exclude from the required gate; run on a schedule; enforce a cap and exit criteria.

**Q: What flake SLO would you set?**  
A: Example: <1% flaky runs suite-wide, 0% on `@smoke`, quarantine max age 14 days—tuned to org risk tolerance.

**Q: How do traces beat videos for RCA?**  
A: Traces correlate DOM snapshots, network, and actionability for the exact failing call; videos are narrative support.

---

## Next

→ [35-bdd-cucumber-and-reporting-at-scale.md](./35-bdd-cucumber-and-reporting-at-scale.md)
