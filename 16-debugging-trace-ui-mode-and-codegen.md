# 16 — Debugging, Trace, UI Mode & Codegen

## Learning goals

Debug a Playwright failure with evidence: reproduce it, pause execution, inspect actionability and locators, read traces, and choose the least expensive artifact that answers the question.

---

## 1. A disciplined debugging loop

Do not start by adding sleeps, force clicks, or longer global timeouts. First answer:

1. Can the failure reproduce locally with the same command, project, URL, data, and environment?
2. Which action or assertion failed, and what did Playwright observe?
3. Did an expected network response, navigation, UI state, or event occur?
4. Is the problem test synchronization, test data, application behavior, or environment capacity?

Run one test in a visible browser:

```bash
npx playwright test tests/profile.spec.ts --project=chromium --headed
npx playwright test --grep "updates profile" --workers=1 --retries=0
```

Match CI inputs as closely as possible. A local pass against a different build, browser revision, database state, or environment is not a diagnosis.

---

## 2. Playwright Inspector

The Inspector pauses before actions and lets you step through the test, inspect locators, and observe actionability. Start it with:

```bash
npx playwright test --debug
```

In Inspector:

- Step through each test action.
- Use the locator picker to see a candidate locator.
- Inspect the call log and why an action is waiting.
- Resume to observe the browser's state transition.

`--debug` commonly runs headed, slows execution, and sets timeouts to zero for interactive inspection. It is ideal for a single local reproduction, not routine CI.

---

## 3. `page.pause()` for an exact breakpoint

Place `page.pause()` just before or after the suspicious operation:

```ts
test('submits the form', async ({ page }) => {
  await page.goto('/profile');
  await page.getByLabel('Display name').fill('Ada');
  await page.pause();
  await page.getByRole('button', { name: 'Save' }).click();
});
```

Run headed or with `--debug`; then inspect the live DOM and continue in Inspector. Remove pauses before committing. A pause is a diagnostic breakpoint, not a synchronization mechanism.

---

## 4. UI Mode: explore tests interactively

Start UI Mode:

```bash
npx playwright test --ui
```

UI Mode provides a test explorer, watch-like re-runs, filters, per-action timeline, live browser view, locator picker, and trace-style inspection for selected tests. It is especially efficient when iterating on a spec because it reruns only what you select and retains diagnostic context between edits.

Use UI Mode to develop and investigate locally; use normal headless commands in CI for reproducibility.

---

## 5. Trace Viewer, in depth

A trace is a time-ordered recording of a test attempt. Capture it in config:

```ts
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

Policies include `off`, `on`, `retain-on-failure`, `on-first-retry`, and `on-all-retries`. A strong default is `on-first-retry`: ordinary successful runs stay light, while a failing first attempt gets a rich diagnostic retry.

Open a downloaded trace:

```bash
npx playwright show-trace path/to/trace.zip
```

Trace Viewer can include:

- **Actions/call timeline:** each Playwright API call, duration, errors, and parameters.
- **DOM snapshots:** before and after actions, allowing time-travel inspection of the rendered page.
- **Network:** requests, responses, status codes, timing, and often bodies/headers subject to trace settings.
- **Console:** browser console messages and errors.
- **Source:** the test source linked to an action.
- **Screenshots:** action snapshots and failure evidence.

A trace answers “what did the test see?” better than a final screenshot alone. Treat sensitive network data carefully: trace files can contain URLs, request content, screenshots, and application state.

---

## 6. API protocol logs with `DEBUG=pw:api`

Enable Playwright API-call logging:

```bash
DEBUG=pw:api npx playwright test tests/login.spec.ts
```

The output shows calls such as navigation, locator resolution, clicks, and assertions. It is useful when a test hangs or fails before an artifact is produced. The log can be noisy and may expose sensitive values, so do not publish it indiscriminately.

For even more focused diagnosis, add temporary event listeners:

```ts
page.on('console', message => console.log('browser:', message.type(), message.text()));
page.on('requestfailed', request =>
  console.log('request failed:', request.url(), request.failure()?.errorText),
);
```

Remove ad hoc logging once the issue is understood or gate it behind a diagnostic flag.

---

## 7. Codegen: recorder, not final architecture

Generate a starting script:

```bash
npx playwright codegen https://example.test
npx playwright codegen --device="Pixel 7" https://example.test
```

Codegen records interactions and suggests locators. It is useful for learning locator APIs, rapidly exploring an unfamiliar UI, and producing a minimal reproduction. Generated code should then be reviewed:

- Replace incidental locators with intentional role, label, and test-id locators.
- Add assertions that prove the expected outcome.
- Remove recorder-specific waits and redundant navigation.
- Move repeated setup into fixtures or helpers.
- Never treat a generated script as proof of a stable test.

---

## 8. VS Code integration

The Playwright VS Code extension can discover tests, run/debug selected tests, show browser selection, and open traces from the editor. Configure it consistently with `playwright.config.ts` so commands use the same projects and environment assumptions as the terminal.

Editor debugging is convenient, but a CI-only failure still requires reproducing CI inputs: the exact commit/build, project, browser version, env vars, worker count, test data, and artifact policy.

---

## 9. Reproducing a CI failure

Use the failure's exact test title/path and project. Disable retries while isolating the initial cause:

```bash
CI=1 BASE_URL="https://staging.example.test" \
  npx playwright test tests/orders.spec.ts \
  --project=chromium --grep "creates order" --workers=1 --retries=0
```

Then:

1. Download and inspect the trace/artifacts from the failed CI attempt.
2. Re-run with the CI browser image/version where possible.
3. Compare logs, network responses, configuration, and test data.
4. Repeat with normal workers to detect parallel-only contamination.
5. Fix the causal race, locator, state dependency, or product defect; prove it with repeated runs.

Do not put production credentials or copied secrets into a local command history.

---

## 10. Video versus trace

| Artifact | Best question answered | Limitation |
|---|---|---|
| Screenshot | What did the final visible state look like? | One instant; no event history. |
| Video | What visually happened over time? | No DOM/action/network detail; can be large. |
| Trace | Which test actions, DOM states, network calls, and console events led here? | Requires capture and may contain sensitive data. |

Use traces as the default deep diagnostic for failures. Retain video when motion, focus, drag/drop, or rendering sequence matters. A screenshot is cheap and often sufficient for a straightforward assertion mismatch.

---

## Interview Q&A

### Q1. How do you debug a failing locator?
**A:** Reproduce it headed with `--debug` or UI Mode, inspect the live accessibility/DOM state, read the call log and trace, then replace the locator or fix the UI semantics rather than using `force`.

### Q2. What is in a Playwright trace?
**A:** A timeline of actions plus snapshots, network activity, console output, source links, and screenshots where captured. It allows investigation of state before and after each action.

### Q3. What trace policy do you recommend?
**A:** Often `on-first-retry` in CI: it keeps normal runs smaller while recording rich evidence for a failed first attempt. The right policy depends on storage and failure rate.

### Q4. What is `page.pause()` for?
**A:** An interactive breakpoint that opens Inspector so you can inspect live state. It must not remain in committed tests.

### Q5. Is codegen suitable for production test suites?
**A:** It is a useful scaffold and locator-learning tool, but generated scripts need deliberate locators, assertions, fixtures, and cleanup before becoming maintainable tests.

### Q6. Why not rely only on video?
**A:** Video shows pixels but not why an action failed. Trace Viewer adds action timing, DOM snapshots, network, console, and source context.

---

## Next

→ [17-ci-cd-docker-reporters-and-artifacts.md](./17-ci-cd-docker-reporters-and-artifacts.md)
