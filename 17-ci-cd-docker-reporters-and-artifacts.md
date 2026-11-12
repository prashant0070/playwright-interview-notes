# 17 — CI/CD, Docker, Reporters & Artifacts

## Learning goals

Run Playwright reliably in CI, pin the browser runtime, shard feedback safely, publish useful reports, and protect secrets and quality gates.

---

## 1. CI principles

A CI test job should be reproducible from a commit and its declared inputs:

- install dependencies from the lockfile (`npm ci`);
- pin the Playwright package and browser image version;
- provide an explicit target URL and required secrets;
- use deterministic test data and environment configuration;
- retain failure evidence long enough to diagnose it;
- make the required pass/fail decision visible.

Do not depend on a developer machine's browser, an unpinned `latest` container, or unspecified deployment state.

---

## 2. GitHub Actions example

```yaml
# .github/workflows/playwright.yml
name: Playwright tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      CI: true
      BASE_URL: ${{ vars.TEST_BASE_URL }}
      API_TOKEN: ${{ secrets.TEST_API_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 14
```

`if: always()` ensures artifacts are uploaded after a failed test step. Use a separate deployment-completion dependency or a health check before tests if the application is deployed by another job.

---

## 3. Docker: pin the Playwright runtime

The official image includes browsers and their system dependencies:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.58.0-noble

WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV CI=true
CMD ["npx", "playwright", "test"]
```

The image tag must match the Playwright version in `package.json`; use an exact version, not `latest`. The image supplies browsers and OS libraries, but your project dependencies still need installation. Build a new image when dependency or source changes, and run it with CI-provided `BASE_URL` and secrets rather than baking secrets into layers.

---

## 4. Sharding in CI

Create a matrix, with each job producing a blob report:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1/4, 2/4, 3/4, 4/4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}
  - if: always()
    uses: actions/upload-artifact@v4
    with:
      name: blob-report-${{ strategy.job-index }}
      path: blob-report/
```

Use `fail-fast: false` so all shards complete and deliver diagnostic evidence. A final merge job downloads every blob artifact and runs:

```bash
npx playwright merge-reports --reporter html ./all-blob-reports
```

Each shard must be independent. It cannot rely on test order, a record created in another shard, or a single shared mutable account.

---

## 5. Reporters and consumers

```ts
reporter: [
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ['junit', { outputFile: 'test-results/junit.xml' }],
  ['blob', { outputDir: 'blob-report' }],
]
```

- **HTML**: human investigation, attachments, and a browsable run summary.
- **JUnit**: broadly compatible XML for CI test-result views and trend systems.
- **Blob**: mergeable shard output; use it when a run is sharded.
- **Allure**: an optional third-party reporting ecosystem when its history, categories, and dashboard integrations are justified. Configure it as a standard reporter package and retain the generated result files.
- **Custom reporter**: possible through Playwright's reporter API; keep it focused on a clear integration need. See module 28 if it covers reporter extension design.

Choose formats based on consumers rather than producing every format by default.

---

## 6. Artifact policy

Configure evidence deliberately:

```ts
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
outputDir: 'test-results',
```

Upload:

- `playwright-report/` for the HTML report;
- `test-results/` for traces, screenshots, videos, and JUnit XML;
- `blob-report/` for sharded report merging.

Set retention based on debugging needs and storage cost. Treat artifacts as potentially sensitive: screenshots and traces may expose customer-like data, tokens in URLs, or request details. Limit access, redact test data, and avoid uploading debug logs containing secrets.

---

## 7. Quality gates

A quality gate is an explicit decision rule, not merely “a job ran.” Typical rules:

- Required browser/smoke projects must pass on a pull request.
- `forbidOnly: !!process.env.CI` rejects accidental focused tests.
- No unexpected skipped tests or unreviewed baseline updates.
- The main gate excludes only transparently tracked quarantined tests.
- Retries may make a job pass, but flaky outcomes are measured and have an owner.
- Nightly/full runs cover slower browser/device/visual suites.

Use `maxFailures` only to conserve compute during a broad outage; it reduces diagnostic coverage and should not replace examining the first failures.

---

## 8. Secrets and target safety

Pass secrets with the CI secret store:

```yaml
env:
  BASE_URL: ${{ vars.TEST_BASE_URL }}
  ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
```

Never commit credentials, echo secrets, include them in screenshots/test names, or write them to reports. Use constrained test accounts and minimum permissions. Avoid pointing destructive E2E suites at production; if production verification is required, make it read-only or explicitly protected.

---

## Interview Q&A

### Q1. Why pin the Playwright Docker image?
**A:** Browsers depend on precise OS libraries and Playwright versions. Pinning makes CI reproducible and avoids breakage from a moving `latest` tag.

### Q2. What should CI upload after a failure?
**A:** The HTML report and test-results directory containing trace, screenshot, video, and test XML as configured. Upload with an always-run condition.

### Q3. Why use blob reports for shards?
**A:** Blob reports are designed to be merged, producing a single final report for one logically distributed run.

### Q4. What is the difference between HTML and JUnit reporters?
**A:** HTML is rich, interactive evidence for people. JUnit is standardized XML for CI systems and external result processors.

### Q5. How should retries affect a quality gate?
**A:** A retry can prevent transient infrastructure noise from blocking delivery, but a flaky pass should still be recorded, monitored, and fixed—not silently considered healthy.

### Q6. What is the primary CI secret rule?
**A:** Inject secrets at runtime from a secret manager, minimize their scope, and prevent them from appearing in code, logs, reports, or artifacts.

---

## Next

→ [18-advanced-topics.md](./18-advanced-topics.md)
