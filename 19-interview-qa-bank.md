# 19 — Interview Q&A Bank (Junior → Principal)

Use this as a drill book. Answers are **interview-length** (30–90s). Cross-read modules **01–18** and **23–37** for depth. Section **O (Q291–Q330)** targets senior/principal follow-ups.

**How to practice:** Cover answer → speak aloud → uncover → compare. Mark weak topics and re-read that module.

---

## A. Basics & Architecture (Q1–Q30)

**Q1. What is Playwright?**  
Open-source Microsoft framework for browser automation and E2E testing across Chromium, Firefox, WebKit, with a first-class test runner (`@playwright/test`), fixtures, assertions, and reporters.

**Q2. Playwright Test vs Playwright Library?**  
Library = drive browsers in scripts. Test = runner + fixtures + parallel + expect + config.

**Q3. Which languages?**  
JS/TS, Python, Java, .NET. The Test runner is Node-centric.

**Q4. Browser / Context / Page?**  
Browser process → Context (isolated profile) → Page (tab).

**Q5. Why context isolation?**  
Prevents cookie/storage leaks; enables safe parallelism.

**Q6. How does Playwright talk to Chromium?**  
Primarily CDP (DevTools protocol), not classic WebDriver for the main path.

**Q7. Headless vs headed?**  
Headless has no UI window—default CI. Headed for debugging.

**Q8. Does it use system Chrome?**  
Default: pinned Chromium. Optional `channel: 'chrome'|'msedge'`.

**Q9. What is auto-waiting?**  
Actions wait for actionability (visible, stable, enabled, receives events…).

**Q10. What is a Locator?**  
Lazy, re-querying element reference; preferred over ElementHandle.

**Q11. Strict mode?**  
Actions require a single match; multiple matches throw.

**Q12. Web-first assertion?**  
`expect(locator)` retries until pass/timeout.

**Q13. Default test timeout?**  
30s (configurable).

**Q14. Supported engines?**  
Chromium, Firefox, WebKit.

**Q15. Mobile apps?**  
Mobile **web** emulation yes; native apps no.

**Q16. What is Trace Viewer?**  
Time-travel debugger with DOM snapshots, network, console, actions.

**Q17. codegen?**  
Recorder generating scripts/locators; scaffold only.

**Q18. baseURL?**  
Prefix for relative navigations and API paths.

**Q19. testDir?**  
Root folder for test discovery.

**Q20. Workers?**  
Parallel child processes executing tests.

**Q21. Fixtures?**  
Injectable setup/teardown dependencies (`page`, custom objects).

**Q22. globalSetup?**  
Runs once before tests—seed data, auth files, etc.

**Q23. storageState?**  
Saved cookies/localStorage to reuse auth.

**Q24. Projects?**  
Named configurations (browser/device/grep/use) in one config.

**Q25. fullyParallel?**  
Tests within a file can run in parallel.

**Q26. Soft assert?**  
`expect.soft` collects failures; continues.

**Q27. frameLocator?**  
Locator API into iframes with auto-wait.

**Q28. route?**  
Intercept/mock/abort network requests.

**Q29. request fixture?**  
API testing without browser UI.

**Q30. Why Playwright over Selenium (short)?**  
Better auto-wait, tracing, network control, multi-context, modern selector engine, less boilerplate.

---

## B. Locators & Selectors (Q31–Q55)

**Q31. Selector priority?**  
Role → label/text → test id → CSS/XPath.

**Q32. getByRole benefits?**  
A11y-aligned, stable, readable.

**Q33. getByText exact?**  
`{ exact: true }` or regex.

**Q34. filter hasText?**  
Narrow locator set by text content.

**Q35. filter has?**  
Narrow by nested locator presence.

**Q36. nth vs filter?**  
Prefer filter/semantic scope; nth is brittle.

**Q37. Chaining locators?**  
`parent.getByRole(...)` scopes search.

**Q38. Shadow DOM?**  
Open roots pierce; closed limited.

**Q39. XPath allowed?**  
Yes but discouraged.

**Q40. data-testid strategy?**  
Stable hooks for ambiguous UI; don’t stamp everything.

**Q41. iframe OTP field?**  
`page.frameLocator('#pci').getByLabel('OTP')`.

**Q42. Multiple elements assert texts?**  
`expect(list).toHaveText([...])`.

**Q43. count assert?**  
`toHaveCount(n)`.

**Q44. Locator vs page.$?**  
Locator retries; `$` is ElementHandle snapshot.

**Q45. Invisible element click?**  
Fails actionability unless `force: true` (avoid).

**Q46. SVG text?**  
Often normal locators; canvas needs other approach.

**Q47. Dynamic IDs?**  
Avoid; use role/text/testid.

**Q48. Absolute CSS paths?**  
Brittle—avoid.

**Q49. getByPlaceholder use case?**  
Inputs without proper labels (still push for labels).

**Q50. Accessible name source?**  
Content, aria-label, labelledby, alt, etc.

**Q51. locator.or / and?**  
`and()` intersects two locators for the same element; `or()` unions alternatives, useful for an expected conditional UI. An action still needs exactly one match, so use `.first()` only when either alternative is genuinely acceptable and then assert the resulting state.

**Q52. waiting for hidden?**  
`waitFor({ state: 'hidden' })` or `not.toBeVisible()`.

**Q53. Strict mode violation fix?**  
Better accessible names or scoped filters.

**Q54. Pseudo :has-text?**  
Works in CSS engine; prefer getByText/filter.

**Q55. Why not selenium-style ID only?**  
IDs change; not user-centric; often missing on modern components.

---

## C. Actions & Waits (Q56–Q80)

**Q56. Actionability checks?**  
Attached, visible, stable, enabled, receives events; editable for inputs.

**Q57. fill vs pressSequentially?**  
fill sets value; sequential fires key events.

**Q58. force click?**  
Skips checks—last resort.

**Q59. waitForTimeout?**  
Anti-pattern; use expects/events.

**Q60. networkidle problem?**  
Analytics/websockets prevent idle.

**Q61. waitUntil goto options?**  
load, domcontentloaded, networkidle, commit.

**Q62. Click + navigation sync?**  
`Promise.all` waitForURL/response + click; or expect URL after.

**Q63. Popup handling?**  
`waitForEvent('popup')` before click completes pairing.

**Q64. Dialog accept?**  
`page.once('dialog', d => d.accept())` before trigger.

**Q65. File upload?**  
`setInputFiles`.

**Q66. Download?**  
`waitForEvent('download')` + saveAs.

**Q67. Hover menu?**  
`locator.hover()` then click item.

**Q68. Drag and drop?**  
`dragTo` or mouse APIs.

**Q69. Select dropdown?**  
`selectOption` for native `<select>`; custom comboboxes use role interactions.

**Q70. Keyboard shortcuts?**  
`page.keyboard.press('Control+A')`.

**Q71. Scroll?**  
Auto before action; `scrollIntoViewIfNeeded`.

**Q72. trial click?**  
Checks actionability without clicking.

**Q73. Action timeout vs test timeout?**  
Action caps one interaction; test caps whole test.

**Q74. test.slow()?**  
Triples test timeout.

**Q75. Double navigation races?**  
Await URL/response; avoid overlapping gotos.

**Q76. Cookie banner?**  
Dismiss or seed cookie; don’t force through.

**Q77. Contenteditable fill?**  
Often click + keyboard; depends on control.

**Q78. Date pickers?**  
Prefer typing ISO if input allows; else UI interactions / test ids.

**Q79. Infinite scroll load?**  
Scroll loop + waitForResponse / count increase expect.

**Q80. Flaky click intercepted?**  
Wait for overlay hidden; fix z-index issues; don’t force blindly.

---

## D. Assertions (Q81–Q95)

**Q81. Why expect(locator).toHaveText?**  
Retries vs one-shot innerText.

**Q82. Soft asserts use case?**  
Multi-field form error checklist.

**Q83. toPass?**  
Retry callback until assertions pass.

**Q84. expect.poll?**  
Poll value against matcher.

**Q85. toBeOK?**  
HTTP 2xx for APIResponse.

**Q86. Screenshot matcher?**  
`toHaveScreenshot` with baselines.

**Q87. Negation?**  
`.not.toBeVisible()`.

**Q88. Attribute assert?**  
`toHaveAttribute('href', /orders/)`.

**Q89. CSS assert?**  
`toHaveCSS('color', 'rgb(...)')`—careful with themes.

**Q90. Array text assert?**  
`toHaveText(['a','b'])`.

**Q91. Custom matcher?**  
`expect.extend`.

**Q92. Assert checked checkbox?**  
`toBeChecked()`.

**Q93. URL assert with baseURL?**  
Relative patterns supported in toHaveURL.

**Q94. Difference Jest expect?**  
PW adds locator retry matchers.

**Q95. Assertion timeout override?**  
`{ timeout: ms }` in expect call.

---

## E. Fixtures & Hooks (Q96–Q115)

**Q96. Built-in fixtures?**  
page, context, browser, request, etc.

**Q97. extend fixtures?**  
`base.extend({ ... })`.

**Q98. use() meaning?**  
Yield value to test; teardown after.

**Q99. Worker scope?**  
Shared per worker process.

**Q100. Option fixture?**  
Overridable via config/test.use.

**Q101. Auto fixture?**  
Runs without destructuring.

**Q102. beforeAll vs globalSetup?**  
beforeAll per worker/scope; globalSetup once per run.

**Q103. TestInfo?**  
Metadata, attachments, annotations, retry.

**Q104. test.step?**  
Named substeps in reports/traces.

**Q105. Hooks order?**  
beforeAll → beforeEach → test → afterEach → afterAll.

**Q106. test.skip(condition)?**  
Conditionally skip.

**Q107. `test.fail()`?**  
Marks a known failing test; it is reported as expected-to-fail only when it fails, and becomes an unexpected pass if the bug appears fixed.

**Q108. test.only danger?**  
CI may run subset—forbidOnly.

**Q109. Dependencies between fixtures?**  
Declared via args; DAG resolved.

**Q110. Page object as fixture?**  
Yes—common pattern.

**Q111. Guest vs auth fixture options?**  
Boolean options switching storage/cookies.

**Q112. Can afterEach run on failure?**  
Yes—should be resilient.

**Q113. Parallel fixtures safety?**  
No shared mutable globals.

**Q114. Annotate owner/severity?**  
testInfo.annotations or test details.

**Q115. Why fixtures over imports of singletons?**  
Lifecycle + isolation + overrides.

---

## F. Network, API, Auth (Q116–Q145)

**Q116. Mock API?**  
route + fulfill.

**Q117. Abort analytics?**  
route abort glob.

**Q118. Modify response?**  
fetch + fulfill altered JSON.

**Q119. HAR replay?**  
routeFromHAR.

**Q120. waitForResponse pattern?**  
Promise.all with click.

**Q121. API testing?**  
request fixture.

**Q122. Hybrid UI+API?**  
API seed → UI assert.

**Q123. storageState auth?**  
Login once, reuse JSON.

**Q124. Project dependencies setup?**  
Declare a setup project and list it in `dependencies`. The setup test verifies login and writes an ignored storage-state file; dependent projects start only after setup succeeds and load the role-specific state.

**Q125. Cookie inject?**  
context.addCookies.

**Q126. Multi-role?**  
Multiple storage states/projects.

**Q127. OTP strategy?**  
Test seam / API fetch / disable 2FA in preprod.

**Q128. User pool locking?**  
File lock or lease API.

**Q129. CORS on fulfill?**  
May need headers on mock.

**Q130. Service worker vs route?**  
SW can bypass; disable SW in tests.

**Q131. GraphQL mock?**  
route on /graphql + body match.

**Q132. Auth for request context?**  
storageState or Authorization header.

**Q133. CSRF?**  
Pass token header from prior call.

**Q134. Network guard?**  
Fail on unexpected prod payment URLs.

**Q135. When not to mock?**  
Critical path confidence against real preprod.

**Q136. Parallel + same user?**  
Cart/session races—lease unique users.

**Q137. Refresh expired cookies?**  
globalSetup refresh job.

**Q138. LocalStorage in storageState?**  
Origins section yes.

**Q139. IndexedDB?**  
Limited—verify needs.

**Q140. API 401 handling?**  
Re-auth or fail fast with clear error.

**Q141. Multipart upload API?**  
request post multipart.

**Q142. WebSocket test?**  
Listen events; mocking hard—test seams.

**Q143. Capture HAR in CI?**  
Optional record for debugging; careful PII.

**Q144. Block fonts for speed?**  
Yes; avoid for visual tests.

**Q145. Extra HTTP headers?**  
context.setExtraHTTPHeaders / use.

---

## G. Config, Parallel, CI (Q146–Q175)

**Q146. playwright.config role?**  
Central run settings, projects, reporters.

**Q147. use cascade?**  
config < project < test.use.

**Q148. retries philosophy?**  
Safety net not cure.

**Q149. shard?**  
`--shard=i/n` across machines.

**Q150. merge-reports?**  
Combine blob outputs.

**Q151. workers=1 when?**  
Debug, serial constraints, rate limits.

**Q152. CI browsers install?**  
`npx playwright install --with-deps`.

**Q153. Docker image?**  
`mcr.microsoft.com/playwright:vX-jammy` matching version.

**Q154. forbidOnly?**  
Fail if test.only left.

**Q155. Artifacts?**  
Trace, screenshot, video, html report.

**Q156. Allure?**  
allure-playwright reporter + generate.

**Q157. JUnit reporter?**  
CI test result parsing.

**Q158. Smoke vs regression?**  
Tags + grep projects/pipelines.

**Q159. Env-specific URLs?**  
Map in config/module from ENVIRONMENT.

**Q160. Secrets?**  
Vault/env; never commit.

**Q161. Flake quarantine?**  
Skip/gate separately with ticket.

**Q162. repeat-each?**  
Stability soak.

**Q163. serial mode?**  
Ordered tests; stop on fail.

**Q164. HTML report open?**  
`show-report`.

**Q165. Trace on-first-retry?**  
Cost/debuggability balance.

**Q166. Parallel flake causes?**  
Shared data/users/inventory.

**Q167. Quality gate design?**  
PR smoke; nightly full; release regression.

**Q168. Caching node_modules?**  
Yes; also browser path cache.

**Q169. Headed in CI?**  
Rare (debugging); needs xvfb sometimes.

**Q170. Matrix browsers on PR?**  
Often chromium-only PR; all browsers nightly.

**Q171. PW_SUITE_RUN?**  
Not a Playwright built-in. Prefer documented project names, tags, and CI variables; validate any custom environment variable at startup.

**Q172. TEAM env?**  
Not a Playwright built-in. Generic suite selection should use `--grep`, `--project`, paths, or a clearly documented configuration option.

**Q173. grep project?**  
Filter titles/tags per project.

**Q174. expect timeout in CI?**  
May raise slightly; prefer fixing slowness.

**Q175. Exit code?**  
Non-zero on failures—even if some retries passed eventually? Final status after retries.

---

## H. Design & Soft Skills (Q176–Q200)

**Q176. Framework layers?**  
Config/fixtures → steps → pages → locators; data/users isolated.

**Q177. POM still valid?**  
Yes—with locator-based internals.

**Q178. Steps vs pages?**  
Steps = business flows; pages = screen ops.

**Q179. How reduce flake rate 50%?**  
Kill sleeps; unique users; traces; quarantine; fix overlays; API setup.

**Q180. Metrics you track?**  
Pass rate, flake rate, duration, top failures, MTTR.

**Q181. Test pyramid?**  
Few E2E; more API/component; many unit.

**Q182. Who owns selectors?**  
Shared contract; often QA+dev on testids; role-first.

**Q183. Flaky test in critical path?**  
Quarantine with severity; don’t silently retry forever.

**Q184. How review a PR with new tests?**  
Tags, isolation, no sleeps, asserts web-first, data cleanup, naming.

**Q185. Migrate Selenium?**  
Incremental; start new journeys in PW; shared env data; train team.

**Q186. Captcha in preprod?**  
Bypass flag for test accounts.

**Q187. Prod testing ethics?**  
Read-only, labeled accounts, rate limits, approvals.

**Q188. Documentation you write?**  
Runbook, tag taxonomy, how to add test, failure triage.

**Q189. Cross-team framework?**  
Shared fixtures, configuration, and test-data helpers with feature-owned specs; use code ownership and versioned conventions rather than hidden coupling.

**Q190. Handling redesign of checkout?**  
Central locators; contract tests; phased rollout flags.

**Q191. ROI of E2E?**  
Prevent revenue bugs; balance cost of maintenance.

**Q192. When delete tests?**  
Obsolete features; duplicated coverage; eternal flakes replaced by lower layer.

**Q193. Pairing with developers?**  
Testability: testids, stable roles, API seeds, clock seams.

**Q194. On-call for CI?**  
Triage board; owners; SLAs for red main.

**Q195. Security of test users?**  
Secrets manager; least privilege; rotate.

**Q196. i18n testing?**  
locale project + language asserts sparingly.

**Q197. Feature flag testing?**  
Cookie/header/API flag; explicit variants.

**Q198. Visual regression ownership?**  
Design+QA baselines; review diffs in PR.

**Q199. Contracting test data?**  
Builders/factories; avoid cryptic shared JSON only.

**Q200. Your biggest Playwright win?**  
Tell a STAR story: flake drop / release confidence / time saved.

---

## I. Rapid-fire True/False (Q201–Q220)

| # | Statement | Answer |
|---|-----------|--------|
| 201 | Locators are evaluated lazily | True |
| 202 | beforeAll always runs once globally | False |
| 203 | force:true is best practice | False |
| 204 | storageState can skip UI login | True |
| 205 | Playwright replaces unit tests | False |
| 206 | WebKit ≡ Safari 100% | False (close engine) |
| 207 | Soft expects fail immediately | False |
| 208 | Workers share one BrowserContext by default | False |
| 209 | HAR can replay APIs | True |
| 210 | networkidle is always safe | False |
| 211 | test.only is OK in main | False |
| 212 | Trace has network waterfalls | True |
| 213 | XPath is preferred | False |
| 214 | APIRequestContext needs a page | False |
| 215 | Sharding needs merge-reports for unified HTML | True (blob path) |
| 216 | Mobile = Appium alternative | False |
| 217 | expect(locator).toHaveText retries | True |
| 218 | Context cookies isolated | True |
| 219 | Retries fix root causes | False |
| 220 | Component testing uses real browser | True |

---

## J. Scenario questions (Q221–Q240)

**Q221. Test fails “element not receiving events”.**  
Overlay/cookie banner/spinner—assert overlay gone; fix selector; don’t force.

**Q222. Passes locally, fails CI.**  
Workers, timing, baseURL, secrets, browser deps, headless diffs—trace CI artifact.

**Q223. Strict mode intermittent.**  
Duplicate button sometimes rendered—stable names; wait for single; filter by section.

**Q224. Payment gateway new tab.**  
waitForEvent popup; complete flow; assert opener confirmation.

**Q225. Need empty cart edge case.**  
Mock cart API empty; or API clear cart.

**Q226. Suite 2 hours → 20 min.**  
Shard; API setup; fewer browsers on PR; tag smoke; parallel + user pool; drop sleeps.

**Q227. Captcha blocks login.**  
Test env bypass; never automate solving as strategy.

**Q228. Flaky visual diffs.**  
Mask dynamic; disable animations; same Docker OS; thresholds.

**Q229. Shared wallet balance races.**  
Lease users; serialize wallet tests; API reset balance.

**Q230. iframe PCI not found.**  
frameLocator; wait attached; correct selector; permissions.

**Q231. Want only @sanity @mweb @beauty.**  
Use tags and a documented grep expression or a project. Keep tags orthogonal; a test may be both `@smoke` and `@mobile`.

**Q232. Debug without re-run whole suite.**  
`--last-failed`, UI mode, single file, trace from CI.

**Q233. Add new team to monorepo.**  
Add feature-owned tests following the common fixture and data contract; assign owners and independent accounts rather than creating a special runner path.

**Q234. Analyst asks Allure history.**  
Publish results to a supported reporting service, keep test IDs/names stable, and use metadata consistently so trends remain meaningful.

**Q235. Need to assert toast that disappears.**  
expect visible quickly; or assert network+store; increase expect timeout carefully.

**Q236. SSO login.**  
Enterprise storageState from SSO setup; or deep link with token test seam.

**Q237. File download content assert.**  
download.path/saveAs; read file; assert CSV rows.

**Q238. Geolocation delivery ETA.**  
grantPermissions + setGeolocation; assert ETA UI.

**Q239. A/B experiment.**  
Force cookie/flag; assert variant UI; don’t flake across buckets.

**Q240. Manager: “100% E2E coverage”.**  
Push pyramid; risk-based E2E; complementary layers.

---

## K. Principal / Architect (Q241–Q260)

**Q241. Design multi-brand framework.**  
Use shared fixtures, reporting, data factories, and page/component objects. Keep brand or locale differences explicit in configuration and give feature teams ownership of their journeys.

**Q242. Cost of flakes at 5% of 10k tests/day.**  
500 noise failures; alert fatigue; ignored red builds—treat flake rate as SLO.

**Q243. Ownership model.**  
Team owns specs+data; platform team owns runner/reporting/browser images.

**Q244. Contract between FE and QA.**  
Roles/testids for critical controls; changelog for DOM contracts; feature flags documented.

**Q245. Phased payment suites why?**  
Separate sandboxed third-party checks from deterministic mocked coverage. This contains rate limits and outages while preserving a small real-integration confidence suite.

**Q246. Data engine vs static JSON.**  
Dynamic inventory truth vs speed/determinism—hybrid.

**Q247. Cross-region CI.**  
Timezone/locale projects; data residency of artifacts/secrets.

**Q248. Open-source PW versioning policy.**  
Pin; upgrade monthly; browser changelog review; canary job.

**Q249. Observability of tests.**  
Publish results DB; correlate with deploy versions; top failing signatures.

**Q250. When rewrite framework?**  
If abstractions fight Playwright idioms (heavy sleeps, WebDriver habits); migrate incrementally.

**Q251. Security review of framework.**  
Secrets; prod guards; PII in traces; dependency scanning.

**Q252. Education plan for 30 QAs.**  
Curriculum modules 01–18; pairing; code review checklist; office hours.

**Q253. Balancing mocks vs real.**  
Risk-based: money paths real preprod; edge UI mocked.

**Q254. Multi-repo vs monorepo tests.**  
Monorepos simplify shared versioning and cross-feature refactors; separate repositories improve autonomy. Choose based on ownership and release cadence, not directory fashion.

**Q255. Defining done for a test.**  
Reliable locally+CI; tags; docs; data cleanup; owner; no known flake.

**Q256. Handling third-party outages.**  
Detect & skip with annotation; circuit breaker; status page integration.

**Q257. Browser matrix strategy.**  
Chromium PR gate; WebKit/Firefox nightly; device smoke limited.

**Q258. Legal: recording prod HAR.**  
PII scrubbing; retention policy; consent.

**Q259. Linking tests to requirements.**  
Annotations/Allure epic/feature; Traceability matrix lightly.

**Q260. Your 6-month roadmap.**  
Flake SLO, CT intro, better data factories, faster PR smoke, a11y gates, self-serve traces.

---

## L. Modern APIs & Emerging Topics (Q261–Q275)

**Q261. What does `page.addLocatorHandler()` solve?**  
It registers a handler that Playwright invokes when a locator blocks an action, such as a recurring consent dialog. Use it narrowly and still test the dialog itself where it is product behavior.

**Q262. What is the risk of locator handlers?**  
They can hide unexpected UI or create side effects; keep the handler deterministic, scoped, and remove it when the condition no longer applies.

**Q263. What is an ARIA snapshot?**  
It is a YAML-like representation of the accessible tree. It tests meaningful roles, names, and hierarchy rather than visual pixels.

**Q264. How do you assert an ARIA snapshot?**  
Use `await expect(locator).toMatchAriaSnapshot(...)`, review changes as accessibility-contract changes, and keep snapshots focused on stable components.

**Q265. ARIA snapshot versus screenshot?**  
ARIA snapshots validate semantic structure; screenshots validate rendering. They complement each other and neither replaces functional assertions.

**Q266. What is Playwright Clock?**  
`page.clock` controls browser time and timers for deterministic tests of client-side expiry, countdowns, and scheduled UI behavior.

**Q267. What cannot Clock control?**  
It does not automatically change server time or third-party systems; use API/test seams for backend-driven time.

**Q268. What is `connectOverCDP`?**  
It connects Playwright to an existing Chromium-based browser via a CDP endpoint. It is useful for controlled tooling but has lower fidelity than a browser launched by Playwright.

**Q269. When avoid `connectOverCDP`?**  
Avoid it for normal CI E2E tests: launch a pinned browser so browser lifecycle, isolation, and reproducibility remain under the runner's control.

**Q270. How do custom reporters work?**  
They implement reporter callbacks for test lifecycle events and can publish results to another system. They should report facts, not mutate tests or conceal failures.

**Q271. What is Playwright component testing?**  
It mounts supported JavaScript framework components in a real browser, enabling fast component-level interaction and assertions between unit and full E2E tests.

**Q272. When choose component testing?**  
Use it for complex reusable UI states and interactions; retain E2E tests for integration journeys such as auth, checkout, and backend behavior.

**Q273. What does `expect.configure()` do?**  
It creates a configured expect instance, for example with a default timeout or soft assertions, without changing every assertion call.

**Q274. How should test tags be used?**  
Use a small, documented taxonomy such as `@smoke`, `@checkout`, and `@visual`; select through grep and avoid tags that duplicate folder structure.

**Q275. How do sharded reports become one report?**  
Run each shard with the blob reporter, collect all blob outputs, then run `npx playwright merge-reports --reporter html <directory>`.

---

## M. Coding explanation prompts (Q276–Q285)

Explain aloud what this does and pitfalls:

**Q276.** `await Promise.all([page.waitForNavigation(), click()])` — outdated vs waitForURL; races.

**Q277.** `expect(await loc.textContent()).toBe('x')` — no retry.

**Q278.** `test.beforeAll(async ({ page }) => ...)` — page fixture may not work as assumed in beforeAll depending on scope—know limitations; prefer beforeEach or worker fixtures carefully.

**Q279.** `workers: 10` with 3 test users — contention.

**Q280.** `route('**/*', abort)` — breaks app.

**Q281.** `storageState` committed with prod token — security incident.

**Q282.** `networkidle` on an analytics-heavy homepage — likely hang or unnecessary delay.

**Q283.** `.nth(0)` everywhere — brittle.

**Q284.** Shared static `let cartId` across tests — parallel corruption.

**Q285.** `test.skip(false, 'msg')` — still runs? skip(false) does not skip—know API.

---

## N. Follow-up design prompts (Q286–Q290)

**Q286. How would you model a setup project for two roles?**  
Create one setup test per role, save separate storage-state files after proving each login, and have only the projects that need that role depend on the appropriate setup. Never share a mutable account merely because its browser state is isolated.

**Q287. When should `locator.and()` be preferred over filtering?**  
Use it when two independent locators describe the same element, such as a role and a title. Use `filter()` when scoping a list by descendant or text content; both should leave a strict, readable target.

**Q288. What should a custom reporter include for CI triage?**  
Stable test ID, project, outcome after retries, duration, error, and links or paths to artifacts. It must tolerate missing artifacts and should use standard reporter output rather than replacing it prematurely.

**Q289. Can an ARIA snapshot replace accessibility testing?**  
No. It detects changes to an accessible structure, but it does not assess contrast, keyboard behavior, real assistive-technology experience, or whether the underlying design is appropriate.

**Q290. What is a safe tag-selection policy?**  
Use tags to select intentionally defined subsets, test the CI command itself, and avoid a default grep that silently runs zero tests. Fail or alert when an expected critical tag has no matching tests.

---

## O. Deep follow-ups (Q291–Q330)

Use these after a solid pass through A–N. They are the “push deeper” questions common in senior/principal SDET loops. Cross-read **07, 10, 12, 14, 23–29, 33–37**.

**Q291. Worker-scoped vs test-scoped fixtures—when each?**  
Test scope (default) creates/tears down per test—use for mutable pages, seeded records, and anything a test can change. Worker scope shares one instance across tests in that worker—use for expensive read-only clients, authenticated API tokens that are not mutated, or browser-level leases. Mutating a worker-scoped resource from parallel tests in the same worker causes flakes.

**Q292. How do fixture dependencies and teardown order work?**  
Playwright sets up dependencies first, then the dependent fixture. After the test, teardown runs in reverse dependency order (after `use`). Put cleanup after `await use(...)` so it always runs.

**Q293. `storageState` pitfalls?**  
Expiry (tests “randomly” bounce to login); sharing one writable account across parallel tests; committing secrets/PII to git; mixing roles in one state file; assuming localStorage-only apps are covered when auth is also in memory; using prod tokens in CI. Validate a signed-in marker before saving state; separate files per role; refresh on a schedule.

**Q294. When is `storageState` the wrong tool?**  
Per-test unique users that must not share session; flows that assert login UI itself; short-lived tokens that expire within the suite; apps whose auth is primarily non-cookie (custom headers only)—then prefer API login headers or UI login fixtures.

**Q295. `page.route` vs HAR replay?**  
`route`/`fulfill`/`abort`/`continue` is precise and readable for intentional stubs and failure injection. HAR (`routeFromHAR`) replays recorded bulk traffic—good for complex third parties, risky for auth expiry, dynamic IDs, PII, and silent drift. Prefer route for behavior control; HAR for canned dependency surfaces; live contract tests for truth.

**Q296. How do you keep mocks from lying forever?**  
Pair stubs with a small live `@contract` suite on the same endpoints; version stub payloads; fail when schema-critical fields disappear; periodically re-record HAR under review; never mock the assertion target of a pure integration test without saying so.

**Q297. Component testing vs E2E—where is the boundary?**  
CT mounts a component (or small tree) in a real browser with fast feedback—ideal for complex UI states, interactions, and visual/a11y structure. E2E covers cross-service journeys: auth, routing across MFEs, payments, persistence. Duplicate CT coverage in E2E only for critical path glue.

**Q298. What breaks if you push too much into E2E?**  
Runtime cost, flake surface, unclear ownership, and slow PR loops. Push state matrix down to CT/unit; keep E2E thin and outcome-focused.

**Q299. `connectOverCDP` vs `browserType.launch` vs `connect`?**  
`launch` starts a Playwright-managed browser (normal tests). `connect` attaches to a Playwright BrowserServer/remote Playwright endpoint. `connectOverCDP` attaches to an existing Chromium-based browser via CDP (e.g. already-open Chrome). CDP connect is Chromium-family oriented and used for remote/debugging/special harnesses—not the default for isolated CI tests.

**Q300. Risks of `connectOverCDP` in a test suite?**  
Shared profile pollution, less isolation than fresh contexts from `launch`, environment-specific failures, and weaker reproducibility. Use deliberately (device farms, attached sessions), not as a shortcut around fixtures.

**Q301. Soft assert abuse—what goes wrong?**  
`expect.soft` continues after failure, which is useful for collecting multiple independent field checks. Abuse: soft-asserting critical preconditions (login, navigation), then acting on a broken page → cascading noise and wasted time. Soft only for non-dependent checks; hard-fail readiness gates.

**Q302. Soft vs `expect.poll` vs `toPass`?**  
Soft = multiple assertions, one test result. `poll`/`toPass` = retry a condition until timeout. Don’t soft-assert a eventually-consistent value—poll it; then hard assert the final UI.

**Q303. When is `test.describe.configure({ mode: 'serial' })` justified?**  
Only when a multi-step workflow cannot be decomposed without unreasonable cost and order is truly required. It reduces parallelism and encourages hidden coupling. Prefer API seed + independent tests; if serial, isolate data and document why.

**Q304. Why is test dependence a reliability smell?**  
Parallel workers, sharding, retries, and filtered greps break order assumptions. “Test B needs Test A” fails in CI unpredictably. Encode prerequisites in fixtures/setup, not in suite order.

**Q305. How do you refactor a dependent chain?**  
Extract shared setup into fixtures or API seeding; each test creates what it needs; delete `beforeAll` mutable shared IDs; use setup projects only for auth/bootstrap, not business-state chaining.

**Q306. What is Playwright’s Clock API for?**  
Controlling time in the page for deterministic tests of timers, countdowns, and date UI (`page.clock`). Use instead of waiting real durations or depending on wall clock. Know installation/version details from current docs when discussing `install`/`fastForward`/`pause_at`-style APIs.

**Q307. Clock pitfalls?**  
Incomplete faking if some APIs still read real time; server-side timestamps unaffected; over-faking hiding real race bugs; forgetting to install before app code reads `Date`. Prefer controlling server test time for backend-driven deadlines when that seam exists.

**Q308. ARIA snapshots vs screenshots?**  
ARIA snapshots assert accessible name/role structure—stable against pure CSS restyle, sensitive to a11y tree changes. Screenshots assert pixels—catch visual regressions, brittle to animation/OS/fonts. Use ARIA for structure contracts; screenshots sparingly with masks and disabled animations.

**Q309. Can ARIA snapshots replace axe/a11y audits?**  
No. They detect structural drift, not contrast, keyboard traps, or AT experience.

**Q310. What problem do locator handlers solve?**  
Recurring overlays (cookie banners, NPS modals) that intermittently intercept actions. `addLocatorHandler` runs when a locator becomes visible and can dismiss it—preferable to `force: true` or random sleeps.

**Q311. Locator handler pitfalls?**  
Handlers that always match and slow every action; dismissing something under assertion; masking a product bug that should fail the journey; forgetting handlers are context-bound. Keep them narrow and intentional.

**Q312. Sharding math—how do you size shards?**  
Aim for balanced wall-clock: `target_wall ≈ total_effective_time / shard_count` (+ queue overhead). Start from historical durations; avoid sharding by file count when a few files dominate. Too many shards → overhead and merge cost; too few → slow gates.

**Q313. Workers vs shards?**  
Workers = parallel processes in one job. Shards = partition suite across jobs/machines. Use both: shards scale horizontally; workers saturate a machine. Isolation must hold at both levels.

**Q314. Why blob reporter + `merge-reports`?**  
Each shard writes blob fragments; `npx playwright merge-reports` builds one HTML/JUnit view with coherent results. Merging HTML directories manually loses fidelity.

**Q315. Blob merge failure modes?**  
Missing shard artifacts, mismatched Playwright versions, wrong directories, traces uploaded without paths the merger expects. CI must fail if any shard blob is absent.

**Q316. How do you type custom fixtures in TypeScript?**  
`base.extend<TestFixtures, WorkerFixtures>({ ... })` with explicit types for fixture values and option fixtures; export `test` and `expect` from your fixtures module; use `test.use({ option: value })`. Avoid `any` on fixture bags—typing is how IDEs and reviews catch misuse.

**Q317. Option fixtures vs value fixtures?**  
Options (`{ option: true }`) are configuration inputs (role, persona, feature flag) set via `test.use`. Value fixtures provide constructed dependencies (`page`, `customer`). Options often select which storage state or API tenant to wire.

**Q318. `testInfo.parallelIndex` vs `workerIndex`?**  
`workerIndex` identifies the worker process; `parallelIndex` is the index for parallel slots used for worker-scoped fixtures. Use them in unique data keys; don’t assume stable mapping to machine CPU ids across runs.

**Q319. How do you design idempotent teardown?**  
Delete by IDs created in this test; treat 404 as success; never “delete all matching prefix” in shared envs without guards; annotate cleanup failures without swallowing the original error unless policy says otherwise.

**Q320. Faker without seeds—why do interviewers dislike it?**  
Failures become non-reproducible; retries may change inputs; assertions on random strings flake. Seed per test title/project or only randomize uniqueness fields you capture in locals/attachments.

**Q321. What is a flake SLO?**  
A numeric reliability objective (e.g. <1% flaky runs suite-wide, 0% on `@smoke`) with ownership and response actions—not “we retry until green.”

**Q322. When do retries hide bugs?**  
When product races routinely fail attempt 0 and pass attempt 1. Pipeline stays green while users still hit races. Track flaky-pass as a first-class signal.

**Q323. Quarantine vs `test.fixme` vs skip?**  
Quarantine = temporary exclude from gate with shadow runs + expiry. `fixme` = known fail expected until fixed (unexpected pass alerts). `skip` = not applicable in this env/config. Don’t mix them to silence flakes without tickets.

**Q324. BDD/Cucumber with Playwright—your stance?**  
Use Gherkin only if stakeholders co-author scenarios; otherwise Playwright titles/tags. Official runner benefits (fixtures, expect, trace, projects) are easiest with `@playwright/test` as the engine.

**Q325. How do you report ownership at scale?**  
Annotations (`owner`, `severity`, `issue`) + tags; custom reporter/CI maps owners to Slack/CODEOWNERS; failures without owners violate policy.

**Q326. Perf testing with Playwright—limits?**  
Single-user budgets and canaries only. Not multi-VU load. Avoid `networkidle` as a perf oracle; pin hardware; keep `@perf-smoke` separate from functional flake economics.

**Q327. Authz test pattern?**  
Two contexts/storage states; create resource as A; access as B via UI or `request`; expect deny. That’s an SDET-level security regression check, not a full pentest.

**Q328. Microfrontend E2E strategy?**  
CT + contracts owned by MFE teams; few composed shell journeys; boundary `data-testid`/role agreements; stub remotes for resilience tests only; attach remote version metadata for RCA.

**Q329. Design answer for 10k tests—headline?**  
Domain-owned thin E2E, platform fixtures/factories, tag-selected gates, shard+blob merge, auth setup projects, flake control plane with SLOs—optimize MTTR and isolation, not class hierarchy depth.

**Q330. Selenium→Playwright migration killer mistakes?**  
Big-bang rewrite; porting Driver/BaseTest wait wrappers that fight auto-wait; dual-run forever without cutover dates; ignoring data isolation while copying suite order dependence.

---

## Score yourself

| Band | Suggests |
|------|----------|
| < 150 solid | Junior gap—reread 01–07 |
| 150–220 | Mid—strengthen 10–17 |
| 220–280 | Senior |
| 280–310 + section O | Staff |
| 310+ with **33–37** design scripts | Principal-ready |

---

## Next

→ [20-coding-round-problems.md](./20-coding-round-problems.md)
· [33-test-data-factories-and-determinism.md](./33-test-data-factories-and-determinism.md)
· [37-system-design-interview-scripts.md](./37-system-design-interview-scripts.md)
