# 28 — Custom Reporters

## Learning goals

Understand Playwright Test's reporting lifecycle, select a built-in reporter for local and CI feedback, merge shard output with the blob reporter, and write a custom reporter only when existing reporters cannot emit the data a consuming system needs.

> API behavior evolves. Treat [playwright.dev](https://playwright.dev/docs/test-reporters) as the source of truth for reporter APIs and configuration.

---

## 1. What a reporter receives

A reporter observes test-run events. It does **not** drive browser execution and should not change test outcome decisions. Its job is to transform completed-run information into console output, files, API calls, or a quality-system payload.

The useful lifecycle methods include:

| Hook | Timing | Typical use |
|---|---|---|
| `onBegin(config, suite)` | Once, before execution | Initialize an output file or run summary |
| `onTestBegin(test, result)` | Before one attempt | Progress logging |
| `onStdOut` / `onStdErr` | When workers write output | Forward or collect diagnostics |
| `onTestEnd(test, result)` | After each attempt | Capture status, duration, errors, attachments |
| `onEnd(result)` | Once after all tests | Finalize output and return a process status override |
| `onExit()` | After `onEnd` | Async cleanup such as flushing a remote client |

Retries produce multiple `TestResult` objects for one `TestCase`. A reporter must use `result.retry`, `test.results`, and the final test outcome deliberately; reporting every failed attempt as an independent failed test makes a retried pass look like a failure.

---

## 2. Built-in reporters first

Configure reporters in `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
});
```

Common built-ins:

| Reporter | Best fit |
|---|---|
| `list` | Readable local terminal feedback |
| `line` / `dot` | Compact CI terminal logs |
| `html` | Rich local or CI artifact report |
| `json` | Machine-readable single-run result |
| `junit` | CI systems that ingest JUnit XML |
| `github` | GitHub Actions annotations |
| `blob` | Sharded/parallel CI runs that will be merged |
| `null` | Suppress built-in output when another reporter handles it |

Multiple reporters run together. For example, preserve useful terminal logs while generating an uploadable HTML artifact:

```ts
export default defineConfig({
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
});
```

Do not treat the HTML report as a permanent data store. CI should publish the report directory as an artifact, and a dashboard integration should receive a structured format that it owns.

---

## 3. A custom JSON-lines reporter

Use a custom reporter when a required integration is unavailable or when a team needs a deliberately small, stable event format. This example writes one final record per test, including attachments created by tests.

```ts
// reporters/run-events.ts
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

type Event = {
  id: string;
  title: string;
  status: TestResult['status'];
  retry: number;
  durationMs: number;
  error?: string;
  attachments: Array<{ name: string; contentType: string; path?: string }>;
};

class RunEventsReporter implements Reporter {
  private readonly events: Event[] = [];
  private outputFile = 'test-results/run-events.json';

  onBegin(config: FullConfig, _suite: Suite) {
    this.outputFile =
      (config.reporter.find(([name]) => name.includes('run-events'))?.[1] as
        | { outputFile?: string }
        | undefined)?.outputFile ?? this.outputFile;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.events.push({
      id: test.id,
      title: test.titlePath().join(' › '),
      status: result.status,
      retry: result.retry,
      durationMs: result.duration,
      error: result.error?.message,
      attachments: result.attachments.map(({ name, contentType, path }) => ({
        name,
        contentType,
        path,
      })),
    });
  }

  async onEnd(result: FullResult) {
    await mkdir(dirname(this.outputFile), { recursive: true });
    await writeFile(
      this.outputFile,
      JSON.stringify({ status: result.status, events: this.events }, null, 2),
    );
  }
}

export default RunEventsReporter;
```

Configure it by a path relative to the config file:

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['./reporters/run-events.ts', { outputFile: 'test-results/run-events.json' }],
  ],
});
```

Keep the reporter's output directory under `test-results/` or another ignored artifact path. Avoid importing application test fixtures or page objects into reporters: the reporter process should only interpret test data.

---

## 4. Status, outcome, and errors

`result.status` describes one execution attempt: `passed`, `failed`, `timedOut`, `skipped`, or `interrupted`. `test.outcome()` aggregates all attempts and can be `expected`, `unexpected`, `flaky`, or `skipped`.

```ts
onTestEnd(test: TestCase, result: TestResult) {
  const terminalAttempt = result.retry === test.results.length - 1;
  if (terminalAttempt && test.outcome() === 'flaky') {
    console.warn(`Flaky test: ${test.titlePath().join(' › ')}`);
  }

  for (const error of result.errors) {
    console.error(error.message);
  }
}
```

The exact array population can differ for interruptions and configuration failures. Handle missing error fields defensively and avoid parsing stack-trace strings as a formal API.

---

## 5. Attachments and diagnostics

Tests add report artifacts through `testInfo.attach()`:

```ts
import { test } from '@playwright/test';

test('records the checkout request', async ({ page }, testInfo) => {
  const response = await page.goto('/checkout');
  await testInfo.attach('checkout-response.txt', {
    body: await response!.text(),
    contentType: 'text/plain',
  });
});
```

Reporters receive attachment metadata at `result.attachments`. An attachment can have `path` (a file) or `body` (an in-memory buffer). Do not blindly upload attachment bodies or screenshots to an external service: they may contain PII, secrets, or URLs with credentials. Apply retention and redaction rules outside the test assertion path.

---

## 6. Blob reports and merging shards

`blob` is designed for CI where multiple jobs produce partial test results. Each shard must write a distinct blob zip, then a final job merges those zips:

```ts
// playwright.config.ts
export default defineConfig({
  reporter: process.env.CI
    ? [['blob', { outputDir: 'blob-report' }]]
    : [['html']],
});
```

```sh
# Each shard runs a portion of the suite and uploads blob-report/ as an artifact.
npx playwright test --shard=1/4

# A dependent merge job downloads every shard artifact into all-blob-reports/.
npx playwright merge-reports --reporter html ./all-blob-reports
```

The merge step consumes **all** shard reports from the same logical run. Keep Playwright versions and test configuration aligned across shard jobs. If tests use a dynamic project matrix, ensure the merger receives compatible report metadata.

You can specify reporters for merge through a config file:

```ts
// merge.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
});
```

```sh
npx playwright merge-reports --config merge.config.ts ./all-blob-reports
```

---

## 7. When a custom reporter is justified

Write one when you need to:

- Send a stable, documented summary to an internal quality API.
- Convert attachments and annotations to a mandated domain schema.
- Emit a compact, privacy-filtered event stream.
- Enforce a post-run policy that existing reporter output cannot express.

Do **not** write one merely to replace HTML, JUnit, JSON, GitHub annotations, or blob merging. Prefer standard reporters because they receive compatibility work as Playwright evolves.

Reporter code must be fast, fault-tolerant, and non-invasive. Buffer events and flush once, bound network timeouts, and ensure an observability outage does not hide the original test failure. If `onEnd` returns `{ status: 'failed' }`, it can override the run result—use that power only for explicit quality gates.

---

## Interview Q&A

**Q: Why does a reporter need to understand retries?**  
A: `onTestEnd` runs for every attempt. Reporting attempt failures as final failures produces false alarms when a retry passes. Use `result.retry`, `test.results`, and `test.outcome()` to distinguish a flaky final outcome from an unexpected failure.

**Q: When would you choose blob over JSON?**  
A: Blob is Playwright's format for merging results from shards. JSON is useful for a single machine-readable result, but it is not the normal shard-merge workflow.

**Q: Can a custom reporter take screenshots?**  
A: No. It observes results after execution; tests or configured artifacts create screenshots. The reporter can read their attachment metadata and publish them.

**Q: What is the difference between `onEnd` and `onExit`?**  
A: `onEnd` receives the completed run result and may return a status override. `onExit` is a later cleanup hook, useful for asynchronous resource cleanup.

**Q: What is the safest first reporting setup for CI?**  
A: A compact terminal reporter plus a standard artifact reporter such as HTML or JUnit. Add blob when the suite is sharded; introduce custom reporting only for a concrete integration gap.
