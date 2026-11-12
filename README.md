# Playwright Interview Notes

### Crack SDET / QA Automation interviews — junior → principal

<p align="center">
  <a href="https://github.com/prashant0070/playwright-interview-notes/stargazers"><img src="https://img.shields.io/github/stars/prashant0070/playwright-interview-notes?style=for-the-badge&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/prashant0070/playwright-interview-notes/network/members"><img src="https://img.shields.io/github/forks/prashant0070/playwright-interview-notes?style=for-the-badge&logo=github" alt="GitHub forks"></a>
  <a href="https://github.com/prashant0070/playwright-interview-notes/issues"><img src="https://img.shields.io/github/issues/prashant0070/playwright-interview-notes?style=for-the-badge" alt="GitHub issues"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Playwright-TypeScript-45ba4b?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright TypeScript">
  <img src="https://img.shields.io/badge/Modules-37-blue?style=for-the-badge" alt="37 modules">
  <img src="https://img.shields.io/badge/Q%26A-330+-purple?style=for-the-badge" alt="330+ Q&A">
</p>

<p align="center">
  <b>Free, practical, interview-grade Playwright curriculum</b> — real APIs, TypeScript examples, coding drills, and whiteboard system-design scripts.<br/>
  Not a toy cheatsheet. Built to survive senior and principal SDET loops.
</p>

<p align="center">
  <a href="#-why-engineers-star-this">Why star</a> ·
  <a href="#-quick-start-60-seconds">Quick start</a> ·
  <a href="#-curriculum-index-01--37">Curriculum</a> ·
  <a href="#-14-day-senior-track">14-day track</a> ·
  <a href="docs/STARTER_PACK.md">Starter pack</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

---

## ✍️ Handwritten-style PDF (printable)

A full A4 study book with ruled-paper styling, handwritten headings, code, and diagrams:

- [`pdfs/Playwright-Interview-Handwritten-Notes.pdf`](./pdfs/Playwright-Interview-Handwritten-Notes.pdf) (~7.6MB)

Regenerate anytime:

```bash
./tools/generate-pdf.sh
```

> If this helped you land interviews or level up — **please star the repo**. Stars help other SDETs find deep Playwright prep.


## ⭐ Why engineers star this

| What you get | Why it matters in interviews |
|---|---|
| **37 deep modules** | Fundamentals → fixtures → sharding → CT → flake SLOs |
| **330+ Q&A** including section **O** | The follow-ups that separate mid from staff |
| **25 coding drills** with rubrics | Timed practice, not vibes |
| **8 system-design scripts** | 10k tests, auth matrix, MFE, Selenium migration |
| **Official-API honesty** | No invented Playwright methods |

If this saves you one interview loop, **star the repo** so others can find it.

```bash
# clone & browse
git clone https://github.com/prashant0070/playwright-interview-notes.git
cd playwright-interview-notes
open README.md   # or: code .
```

Replace `prashant0070` with the actual GitHub owner when you publish.

---

## 🚀 Quick start (60 seconds)

1. Skim [`docs/STARTER_PACK.md`](docs/STARTER_PACK.md) — what to read first by role level.
2. Open [`01-fundamentals.md`](./01-fundamentals.md) and run one example in a tiny Playwright project.
3. Drill [`19-interview-qa-bank.md`](./19-interview-qa-bank.md) out loud (cover → speak → check).
4. Time-box problems from [`20-coding-round-problems.md`](./20-coding-round-problems.md).
5. Whiteboard one script from [`37-system-design-interview-scripts.md`](./37-system-design-interview-scripts.md).

**API source of truth:** [playwright.dev](https://playwright.dev). Verify version-sensitive APIs before citing them in an interview.

---

## 📚 Learning paths

| Goal | Path |
|---|---|
| Zero → productive | **01 → 18**, then **23 → 37** |
| Reliable E2E | **03–08**, **10–14**, **16–17**, **23**, **30–34** |
| 7-day cram | D1–2: **01–08** · D3–4: **09–14** · D5: **15–18, 23–32** · D6: **19, 33–36** · D7: **20–22, 37** |
| Senior loop | **07, 09–14, 16–18, 21–37** + **19** section O |
| Principal / staff | **21, 33–37**, coding **21–25**, design scripts aloud |
| Coding round only | **20** → refresh **04–07**, **10**, **33–34** |

Practice loop: read → explain trade-off in 90s → write one test → answer Q bank cold → timed coding.

---

## 🗓️ 14-day senior track (“crack any interview”)

~2–3 focused hours/day. Speak answers aloud.

| Day | Focus | Modules / drills |
|---|---|---|
| 1 | Isolation + locators | **01–04**; Q bank A |
| 2 | Auto-wait & expects | **05–06**, **26** |
| 3 | Fixtures & TestInfo | **07**; typed fixture; Q291–292, Q316–318 |
| 4 | Contexts, POM, network | **08–10**; route vs HAR |
| 5 | API + auth | **11–12**; `storageState` pitfalls |
| 6 | Config, parallel, flakes | **13–14**, **34**; `--repeat-each` |
| 7 | Visual / debug / CI | **15–17**, **24**; trace RCA |
| 8 | Advanced APIs | **18, 23, 27, 30–32** |
| 9 | CT + reporters + BDD | **28–29**, **35**; blob merge |
| 10 | Data + contracts | **33**, **36**; factory + authz |
| 11 | Coding marathon | **20** problems 1–15 |
| 12 | Hard coding + O | **20** 16–25; Q291–330 cold |
| 13 | System design | **21**, **37** scripts 1–5 |
| 14 | Mock interview | **22**, **37** 6–8; 45m code + 45m design + 30m Q&A |

**Day-14 pass bar:** worker vs test fixtures · 10k-test control plane · flake RCA without `waitForTimeout` · typed fixture teardown · route/HAR/contract · Selenium migration without big-bang.

---

## 📖 Curriculum index (01 → 37)

### Foundations

| # | Module | Topics |
|---|---|---|
| 01 | [Fundamentals](./01-fundamentals.md) | Architecture, browsers, comparison concepts |
| 02 | [Installation, CLI, and project setup](./02-installation-cli-and-project-setup.md) | Install, TS config, first test, CLI |
| 03 | [Test anatomy and execution model](./03-test-anatomy-and-execution-model.md) | `test`, workers, isolation, hooks |

### Core browser testing

| # | Module | Topics |
|---|---|---|
| 04 | [Locators deep dive](./04-locators-deep-dive.md) | Strategy, strictness, chains, frames |
| 05 | [Actions, auto-waiting, and timeouts](./05-actions-auto-waiting-and-timeouts.md) | Actionability, timeout hierarchy |
| 06 | [Assertions, soft assertions, and web-first testing](./06-assertions-soft-and-web-first.md) | `expect`, soft asserts, matchers |
| 07 | [Fixtures, hooks, and TestInfo](./07-fixtures-hooks-and-test-info.md) | Scopes, custom fixtures, lifecycle |
| 08 | [Browser, context, page, and multi-tab](./08-browser-context-page-and-multi-tab.md) | Isolation, popups, downloads, frames |

### Design, data, and integration

| # | Module | Topics |
|---|---|---|
| 09 | [Page objects and design patterns](./09-page-object-model-and-design-patterns.md) | POM, composition, fixture pages |
| 10 | [Network interception and mocking](./10-network-interception-and-mocking.md) | Route, fulfill, HAR, waits |
| 11 | [API testing with Playwright](./11-api-testing-with-playwright.md) | `request`, API + UI flows |
| 12 | [Authentication, storage state, and sessions](./12-authentication-storage-state-and-sessions.md) | Setup projects, session isolation |

### Configuration, quality, and delivery

| # | Module | Topics |
|---|---|---|
| 13 | [Configuration, projects, and environments](./13-configuration-projects-and-environments.md) | Config, projects, envs |
| 14 | [Parallelism, sharding, retries, and flakes](./14-parallelism-sharding-retries-and-flakes.md) | Workers, shards, retries |
| 15 | [Visual, accessibility, and mobile testing](./15-visual-accessibility-and-mobile.md) | Screenshots, a11y, devices |
| 16 | [Debugging, trace, UI mode, and codegen](./16-debugging-trace-ui-mode-and-codegen.md) | Inspector, traces, UI mode |
| 17 | [CI/CD, Docker, reporters, and artifacts](./17-ci-cd-docker-reporters-and-artifacts.md) | CI, containers, reports |
| 18 | [Advanced topics](./18-advanced-topics.md) | CDP, Clock, SW, perf boundaries |

### Interview practice

| # | Module | Topics |
|---|---|---|
| 19 | [Interview Q&A bank](./19-interview-qa-bank.md) | Q1–Q330 (section **O** deep follow-ups) |
| 20 | [Coding round problems](./20-coding-round-problems.md) | 25 timed exercises + rubrics |
| 21 | [Framework design for interviews](./21-framework-design-for-interviews.md) | Architecture trade-offs |
| 22 | [Selenium/Cypress comparison and migration](./22-selenium-cypress-comparison-and-migration.md) | Migration planning |

### Advanced Playwright APIs

| # | Module | Topics |
|---|---|---|
| 23 | [Locator handlers and overlays](./23-locator-handlers-and-overlays.md) | `addLocatorHandler` |
| 24 | [ARIA snapshots](./24-aria-snapshots.md) | `toMatchAriaSnapshot` |
| 25 | [Page / Locator / Browser API cheatsheet](./25-page-locator-browser-api-cheatsheet.md) | Broad API map |
| 26 | [Assertions complete reference](./26-assertions-complete-reference.md) | Matcher catalog |
| 27 | [Remote browsers, CDP, and connect](./27-remote-browsers-cdp-and-connect.md) | `connect` / `connectOverCDP` |
| 28 | [Custom reporters](./28-custom-reporters.md) | Reporter lifecycle, blob merge |
| 29 | [Component testing deep dive](./29-component-testing-deep-dive.md) | React CT, Vite harness |
| 30 | [Advanced selectors and engines](./30-advanced-selectors-and-engines.md) | Engines, shadow DOM |
| 31 | [Emulation, clipboard, media, and permissions](./31-emulation-clipboard-media-and-permissions.md) | Devices, permissions |
| 32 | [Annotations, tags, and test metadata](./32-annotations-tags-and-test-metadata.md) | Tags, annotations, attachments |

### Reliability, scale, and principal-level design

| # | Module | Topics |
|---|---|---|
| 33 | [Test data factories and determinism](./33-test-data-factories-and-determinism.md) | Factories, seeds, isolation, cleanup |
| 34 | [Flake RCA playbook](./34-flake-rca-playbook.md) | Taxonomy, RCA, quarantine, SLOs |
| 35 | [BDD, Cucumber, and reporting at scale](./35-bdd-cucumber-and-reporting-at-scale.md) | BDD trade-offs, reports, ownership |
| 36 | [Performance, security, and contract testing](./36-performance-security-and-contract-testing.md) | Perf smoke, HAR/contracts, authz |
| 37 | [System design interview scripts](./37-system-design-interview-scripts.md) | Whiteboard: 10k tests, MFE, migration |

---

## ✅ Interview readiness checklist

### Essentials
- [ ] Browser / context / page isolation
- [ ] Role, label, text, test-id locators
- [ ] Auto-waiting + web-first assertions
- [ ] Test vs worker fixture scopes
- [ ] Projects, timeouts, retries
- [ ] `storageState` without auth leaks
- [ ] Traces, UI mode, Inspector

### Reliable design
- [ ] Intentional route / HAR / live network
- [ ] API contracts via `request`
- [ ] Popups, downloads, frames, multi-page
- [ ] Sharding, flakes, quarantine policy
- [ ] Factories + idempotent cleanup (**33**)
- [ ] Flake RCA without timeout theatre (**34**)

### Advanced / principal
- [ ] Locator handlers vs `force: true`
- [ ] ARIA snapshot vs screenshot
- [ ] `connect` / `connectOverCDP` vs `launch`
- [ ] Blob reporter + `merge-reports`
- [ ] CT vs E2E boundary
- [ ] BDD stance (**35**); perf/security honesty (**36**)
- [ ] Typed fixtures; section **O** cold
- [ ] One **37** design script in ≤8 minutes

---

## 🤝 Contributing

PRs welcome — fix outdated APIs, add interview-grade examples, improve drills.

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CHANGELOG.md](CHANGELOG.md)
- [MIT License](LICENSE)

---

## ⚠️ Disclaimer

Unofficial community study notes. Not affiliated with Microsoft or the Playwright project. Always verify against [playwright.dev](https://playwright.dev).

---

<p align="center">
  <b>If this helped you land the offer — star it, fork it, and pass it on.</b><br/>
  <a href="https://github.com/prashant0070/playwright-interview-notes">github.com/prashant0070/playwright-interview-notes</a>
</p>
