# 22 — Selenium, Cypress, and Playwright: Comparison and Migration

There is no universally best automation tool. Choose based on application shape, browser and language requirements, delivery constraints, team skills, and the cost of changing an existing suite.

## 1. Comparison matrix

| Concern | Playwright | Selenium | Cypress |
|---|---|---|---|
| Core model | Browser automation library plus Playwright Test runner | WebDriver standard with language bindings and external runners | JavaScript test runner executing commands through a browser-focused architecture |
| Languages | JS/TS, Python, Java, .NET | Java, Python, C#, JavaScript, Ruby and more | JavaScript/TypeScript |
| Browser coverage | Chromium, Firefox, WebKit; branded Chromium channels | Broad driver/vendor ecosystem | Major Chromium browsers, Firefox, and WebKit support varies by product/version |
| Parallelism | Workers and sharding built into Playwright Test | Grid, cloud, runner, and CI strategy are commonly assembled separately | Parallel execution depends on CI setup and Cypress tooling |
| Isolation | Cheap, first-class BrowserContexts | Usually a fresh driver/profile or carefully managed sessions | Test isolation with a different execution model and command queue |
| Waiting | Locator actions and web-first assertions auto-wait | Explicit waits are customary; implicit waits are risky | Retry-ability is a core strength |
| New tabs/windows | First-class pages, contexts, popup events | Window handles and context switching | Cross-origin and multi-window workflows require Cypress-specific approaches |
| Frames | `frameLocator()` | Switch into/out of frames | Supported but often needs custom handling |
| Network control | `route`, HAR replay, request inspection | Not a core WebDriver feature; add proxies/devtools/vendor tools | `cy.intercept()` is mature |
| API testing | `APIRequestContext` | External HTTP library normally used | `cy.request()` |
| Debugging | Trace Viewer, UI mode, inspector, video/screenshot artifacts | Depends on runner, Grid/cloud, logs, screenshots | Interactive runner and command-log/time-travel-style debugging |
| Component testing | Playwright CT for supported JS frameworks | Usually separate tooling | Cypress Component Testing is established in JS front-end workflows |
| Native mobile | No; mobile-web emulation only | Appium ecosystem shares WebDriver heritage | No |

Version-specific capabilities evolve, especially in browser support. Verify the current supported browser matrix and licensing/CI requirements before making a procurement decision.

## 2. Honest tradeoffs

### Playwright

Strong choice for modern web E2E where multi-tab workflows, multiple isolated users, network interception, traces, and Chromium/Firefox/WebKit coverage matter. Its runner reduces assembly work for TypeScript organizations. Its costs are adopting a newer ecosystem, managing bundled-browser versions, and learning a locator/async model that should not be wrapped in old WebDriver abstractions.

### Selenium

Still a sound choice for large polyglot estates, organizations standardized on WebDriver vendors, and programs that need close alignment with Appium for native mobile. Selenium's flexibility is also its cost: test runner, reporting, waiting conventions, driver/browser provisioning, and remote execution are often architectural decisions rather than defaults. A mature Selenium suite is not automatically a migration candidate.

### Cypress

Excellent developer experience for JavaScript front-end organizations, with convenient network stubbing and a strong interactive runner. It can be the lowest-risk choice for a group already productive in Cypress, particularly for component and single-application workflows. Playwright is often more natural for independent browser contexts, popup-heavy journeys, multi-engine validation, and library use outside a test-runner model. Treat these as fit differences, not claims that either tool is obsolete.

## 3. API mapping

| Intent | Selenium (Java concept) | Cypress | Playwright |
|---|---|---|---|
| Find a control | `By` + `findElement` | `cy.get()` / `cy.contains()` | `getByRole()` / `locator()` |
| Wait for UI | `WebDriverWait` | built-in command retries | actionability + `expect(locator)` |
| Click | `element.click()` | `cy.get(...).click()` | `locator.click()` |
| New tab | window handles | framework-specific workflow | `waitForEvent('popup')` / `context.waitForEvent('page')` |
| Frame | `switchTo().frame()` | custom frame wrapper often used | `frameLocator()` |
| Stub HTTP | proxy/devtools extension | `cy.intercept()` | `page.route()` |
| Preserve session | cookies/profile management | `cy.session()` | `storageState` |
| API call | HTTP client such as RestAssured | `cy.request()` | `request` fixture |
| Parallel scale | Grid/cloud nodes | CI/dashboard routing | workers + `--shard` |

Mappings are learning aids, not mechanical translations. In particular, replace explicit wait chains with a meaningful locator and web-first assertion rather than translating them line-for-line.

## 4. Selenium-to-Playwright migration plan

### Phase 0 — Decide whether to migrate

Inventory journey value, failure rate, runtime, browser/device needs, code ownership, and external dependencies. Establish success measures: PR duration, critical-flow pass rate, flake rate, diagnostic time, and maintenance cost. Keep Selenium for native-mobile or vendor-required coverage when it remains the better fit.

### Phase 1 — Build a thin foundation

Create one Playwright project, a CI image, secret injection, a small locator convention, and trace/report retention. Implement test-data API helpers and storage-state setup projects. Avoid designing a large framework before two or three real journeys reveal repeated needs.

### Phase 2 — Port by risk and learning value

Port a representative smoke journey first: login, search, cart, or account update. Rewrite its synchronization around locators and assertions; do not carry over `Thread.sleep`, implicit waits, static drivers, or global mutable test data. Pair experienced Selenium and application engineers while reviewing the first ports.

### Phase 3 — Run parallel evidence, not duplicate gates forever

For a bounded period, run the old and new critical journeys against the same controlled environment. Investigate disagreements; they frequently reveal different timing, data, or test assumptions rather than a tool defect. Publish equivalent reports and define a parity exit criterion.

### Phase 4 — Shift ownership and retire deliberately

Make new web E2E coverage Playwright-first after the foundation has proved stable. Delete duplicate Selenium cases only after the new suite has met parity and reliability targets. Archive dependencies, credentials, Grid capacity, and documentation only when consumers are gone.

## 5. Cypress-to-Playwright migration plan

Start with a shared vocabulary: `cy.session()` maps conceptually to persisted `storageState`; `cy.intercept()` to `page.route()`; custom commands often become fixtures, page objects, or small utilities. The hard work is not syntax—it is moving from Cypress's queued command semantics to ordinary `async`/`await`, deciding which custom commands were genuinely reusable, and preserving data isolation.

Port a flow that benefits from Playwright's model, such as a popup payment, two-user collaboration, or browser matrix check. For components, make an explicit decision: retain Cypress Component Testing, adopt Playwright CT, or use neither where unit tests cover the need. Do not force a rewrite solely for tool uniformity.

## 6. Common migration failures

- **Big-bang rewrites:** destroy feedback from a known-good suite and delay value. Port incrementally.
- **WebDriver wrappers in Playwright:** hide locators and auto-waiting behind generic `click(selector)` helpers. Use Playwright's typed, composable APIs.
- **Blind syntax conversion:** `waitFor` chains encode outdated synchronization; assert the business-visible outcome instead.
- **Shared accounts and static data:** parallel execution exposes contamination. Introduce factories, APIs, and a user-pool policy.
- **No artifact plan:** a faster runner without traces and ownership can increase diagnosis time.
- **Changing the application and tests simultaneously without contract tests:** selector churn obscures whether failures are product or automation regressions.

## 7. Decision guide

Choose Playwright when building modern web E2E with a need for rich artifacts, isolated multi-user sessions, multi-tab workflows, or an integrated TypeScript runner. Choose Selenium when WebDriver ecosystem compatibility, native-mobile adjacency, or a mature polyglot investment dominates. Keep or choose Cypress when its front-end developer workflow and existing productive suite fit the application, especially where its limitations are not relevant.

The strongest interview answer is conditional: “I would not migrate because a tool is fashionable. I would quantify the present suite's pain, run a small representative pilot, and migrate only the web journeys where Playwright measurably improves feedback time, stability, or diagnosis.”

## 8. Sample answer

“Playwright packages browser automation, isolation through contexts, network control, and test-runner features such as projects, fixtures, traces, and sharding. Selenium remains valuable where WebDriver and Appium alignment or a large multi-language estate matters, but it usually requires more supporting infrastructure. Cypress remains a capable JavaScript choice with strong developer ergonomics. I would migrate incrementally: establish Playwright CI/auth/data foundations, port high-value smoke flows, dual-run to prove parity, measure flake and runtime improvements, then retire only proven duplicates.”

## 9. Architecture and execution model

Playwright provides browser, browser-context, page, frame, locator, and request
objects. A context is an inexpensive isolated browser session, so a test can
model two independent users without sharing cookies or local storage.

```text
Playwright Test -> worker -> browser context -> page -> locator -> browser
Selenium test   -> language binding -> WebDriver -> driver/Grid -> browser
Cypress spec    -> command queue <-> runner/browser application
```

Selenium is built around the interoperable WebDriver standard. A driver may be
local or remote, and its runner, reporting, waits, Grid, and browser lifecycle
are commonly chosen separately. This flexibility is useful in a polyglot or
vendor-standardized organization, but it requires deliberate conventions.

Cypress uses queued commands and automatic command retries. Playwright browser
calls are ordinary promises: every asynchronous operation must be awaited.
That difference is the most important conceptual migration issue.

## 10. Detailed feature matrix

| Concern | Playwright | Selenium | Cypress |
|---|---|---|---|
| Primary query | locator | element found by `By` | command chain |
| Isolation | new context | driver/profile strategy | runner test isolation |
| Browser pages | pages and popup events | window handles | workflow-dependent |
| Frames | frame locator | switch to frame | custom handling often needed |
| Waiting | actionability plus expect | explicit waits customary | command retries |
| Network | route/HAR/API client | proxy/CDP/library additions | intercept/request |
| Debug artifact | trace viewer | runner/cloud dependent | runner command log |
| Parallel unit | worker | node/session | CI worker |
| API testing | request context | external HTTP library | request command |
| Mobile web | emulation | browser/vendor choice | browser viewport |
| Native apps | no | Appium ecosystem | no |

## 11. Translation is not migration
Syntax conversion preserves old assumptions. Behavioral migration replaces
those assumptions with Playwright's locator and assertion model.

```java
new WebDriverWait(driver, Duration.ofSeconds(10))
  .until(ExpectedConditions.elementToBeClickable(By.id("save"))).click();
```

```ts
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByRole('status')).toHaveText('Saved');
```

The Playwright version intentionally asserts completion after the action. A
click becoming possible does not prove that saving completed.

```ts
cy.get('[aria-label="Email"]').type('ada@example.com');
cy.contains('[role="status"]', 'Saved').should('be.visible');
```

```ts
await page.getByLabel('Email').fill('ada@example.com');
await expect(page.getByRole('status')).toContainText('Saved');
```

Do not port Cypress custom commands wholesale. Classify each command as a
fixture, a page component, a small utility, or duplicated abstraction that
should disappear.

## 12. Feature mapping

| Intent | Selenium | Cypress | Playwright |
|---|---|---|---|
| navigation | `driver.get` | `cy.visit` | `page.goto` |
| UI assertion | expected condition | `.should` | `expect(locator)` |
| popup | window handle | product workaround | popup/page event |
| frame | switch call | custom wrapper | `frameLocator` |
| session | cookies/profile | session command | storage state/context |
| upload | send keys | select file | set input files |
| download | profile/file access | download workflow | download event |
| dialog | alert switch | alert handling | dialog event |
| stub HTTP | proxy/CDP | intercept | route |
| shard | Grid/cloud | CI tooling | `--shard` |

## 13. Phased migration plan

### Phase 0 — decide with evidence
Inventory critical journeys, browser requirements, test owners, runtime, flake
rate, diagnosis time, vendor obligations, and native-mobile needs. A mature
suite with stable economics is not automatically a rewrite candidate.

### Phase 1 — build a thin vertical slice
Create projects, CI execution, trace retention, authentication setup, and test
data support. Port one representative journey end to end. Do not invent a
large abstraction layer before real duplication appears.

### Phase 2 — set operating conventions
Document locator priority, data isolation, artifact retention, retry policy,
and code review expectations. Prefer role/name and label locators. Require a
reason for test IDs, force, sleeps, and exceptional timeouts.

### Phase 3 — port valuable flows
Prioritize business-critical, flaky, slow, popup-heavy, multi-user, or
network-dependent journeys. Rewrite static waits and selector wrappers. Keep
tests independent so workers can run them in any order.

### Phase 4 — dual-run temporarily
Run equivalent old and new journeys against controlled data for a bounded
period. Classify disagreements as product, environment, data, or test
differences. Define parity and reliability exit criteria before dual-running.

### Phase 5 — retire deliberately
Make new browser coverage use the chosen platform after the pilot proves its
value. Delete duplicates only after targets are met. Remove retired CI
capacity, credentials, dependencies, and runbooks when consumers are gone.

## 14. Migration risks

| Risk | Why it hurts | Control |
|---|---|---|
| big-bang rewrite | feedback arrives too late | small representative pilot |
| copied sleeps | flakiness survives | assert observable outcome |
| shared accounts | parallel contamination | isolated records or user pools |
| generic wrappers | hides locator strengths | expose typed Playwright APIs |
| no traces | slow diagnosis | retain artifacts on failure |
| dual-run forever | doubles maintenance | published exit date |
| missing metrics | claims stay subjective | baseline and compare |

## 15. Decision flowchart

```text
Need native mobile automation?
  yes -> evaluate Appium/WebDriver ecosystem
  no  -> need WebDriver vendor or polyglot alignment?
           yes -> Selenium may be lower risk
           no  -> need rich multi-page, multi-context web E2E?
                    yes -> pilot Playwright
                    no  -> is Cypress currently productive?
                             yes -> keep it unless a measured gap exists
                             no  -> pilot Playwright
```

Tool selection is not a popularity contest. Existing skills, regulatory
requirements, browser matrix, and cost of change can outweigh feature lists.

## 16. Interview scripts

**Why Playwright?** “For modern web E2E, I value its contexts, browser events,
locators, traces, network control, projects, and integrated parallel runner. I
would validate the application and CI fit in a pilot.”

**Why retain Selenium?** “WebDriver ecosystem alignment, vendor support,
native-mobile adjacency, or a large polyglot investment can outweigh a
rewrite. I would improve the current suite before assuming migration.”

**How does Cypress differ?** “Its queued command model and front-end developer
workflow are strengths. Playwright's async API and contexts are often more
natural for multi-page, multi-user, and multi-engine workflows.”

**How do you migrate safely?** “Baseline, build a thin foundation, port
high-value flows incrementally, dual-run only to prove parity, measure
reliability and diagnosis, then retire proven duplicates.”

## 17. Interview Q&A
1. **Is any tool universally best?** No; portfolio and constraints decide.
2. **What is Playwright isolation?** Independent browser contexts.
3. **What standard underlies Selenium?** WebDriver.
4. **Why does Selenium need more assembly?** Its surrounding runner and Grid are choices.
5. **What is Cypress's key execution difference?** A queued command model.
6. **Why is `await` important in Playwright?** Browser operations are promises.
7. **What replaces fixed sleeps?** Actionability and outcome assertions.
8. **What replaces window handles?** Popup or context page events.
9. **What replaces frame switching?** Frame locators.
10. **What replaces network intercepts?** Routes and response waits.
11. **What should be measured?** Runtime, flakes, diagnosis, maintenance.
12. **Why avoid big bang?** It defers learning and risks coverage.
13. **Why dual-run?** To explain parity differences with evidence.
14. **When delete old tests?** After defined parity and reliability targets.
15. **What is a migration smell?** Line-by-line wait and selector translation.
16. **Why retain traces?** They shorten root-cause analysis.
17. **What makes a good pilot?** A representative high-value journey.
18. **When keep Cypress?** When it remains productive and meets requirements.
19. **When keep Selenium?** When WebDriver or polyglot needs dominate.
20. **What is a sound decision?** Conditional, measured, and reversible.

## Curriculum continuation
Return to [README.md](./README.md), drill [19 — Interview Q&A bank](./19-interview-qa-bank.md), practice [20 — Coding round problems](./20-coding-round-problems.md), or whiteboard [21 — Framework design for interviews](./21-framework-design-for-interviews.md).

Next: [23 — Locator handlers and overlays](./23-locator-handlers-and-overlays.md)

## 18. Migration readiness checklist
Before a pilot, answer these questions with evidence:

1. Which journeys cause the most customer or release risk?
2. Which browser engines and devices are contractual?
3. Which tests require multiple users or browser tabs?
4. Which dependencies need deterministic API or network control?
5. How is test data isolated across parallel workers?
6. Where will traces, videos, screenshots, and reports be retained?
7. Who owns test failures and application selector contracts?
8. What CI runtime and shard count are acceptable?
9. Which existing tests have reliable business value?
10. Which cases should remain in lower-level tests instead of E2E?

## 19. Pilot scorecard
Score a representative pilot before making a platform commitment.

| Measure | Baseline | Pilot result | Decision use |
|---|---|---|---|
| median runtime | record | compare | developer feedback |
| failure rate | record | compare | reliability |
| diagnosis time | record | compare | artifact value |
| setup effort | record | compare | operating cost |
| browser coverage | record | compare | contract fit |
| maintenance changes | record | compare | long-term cost |

Interpret results carefully. A single fast run does not prove stability. A
short pilot with controlled data and repeated CI execution is more persuasive
than a feature checklist.

## 20. Additional interview Q&A
21. **Why is a context cheaper than a browser?** It shares the browser process while isolating session state.
22. **Can Playwright replace native mobile automation?** No; it provides mobile-web emulation.
23. **Why do selector wrappers hurt a migration?** They hide semantic locator APIs and diagnostics.
24. **What should replace implicit waits?** Explicit user-visible assertions and actionability.
25. **Why is a test-data plan essential?** Parallel tests expose hidden shared-state assumptions.
26. **What should a parity criterion include?** Equivalent behavior, reliability, and artifact quality.
27. **Why might a migration be rejected?** Its cost can exceed measurable portfolio benefit.
28. **What is the first migration deliverable?** A working vertical slice, not a framework diagram.
29. **How should browser upgrades be handled?** Deliberately, with release notes and targeted validation.
30. **What is the role of projects?** They define browser/environment execution variants.
31. **Why is API control useful in E2E?** It improves deterministic setup and failure isolation.
32. **What does a trace provide?** Timeline, actions, network, DOM snapshots, and diagnostics.
33. **Why avoid permanent duplicate tests?** They double maintenance and obscure ownership.
34. **Should every Selenium test move?** No; port based on value and fit.
35. **Should every Cypress command become a fixture?** No; preserve only real reusable behavior.

## 21. Closing principle
A migration succeeds when it improves feedback quality for meaningful browser
journeys. Prefer measured evidence over a blanket rewrite mandate, and retain
the tool that best satisfies the actual product, browser, and operating needs.

---

Next: [23 — Locator handlers and overlays](./23-locator-handlers-and-overlays.md)
