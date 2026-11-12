# 27 — Remote Browsers, CDP, and Connect

## Learning goals

Understand the difference between launching a browser and attaching to one already
running. Use `browserType.connect()`, `connectOverCDP()`, and `BrowserServer` only where
their transport and isolation trade-offs fit the system.

---

## 1. Launch versus connect

The standard Playwright Test model launches a managed browser and creates a fresh,
isolated `BrowserContext` for each test. It is the recommended default because lifecycle,
browser version, artifacts, and isolation are controlled by the runner.

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://example.test');
await browser.close();
```

Connecting attaches to a browser process that another process started. This is valuable
when the browser must run elsewhere (a remote host, container, browser service, or a
developer's already-open Chrome), but it transfers lifecycle and isolation responsibility
to the system that owns that browser.

```text
Launch:   test process ──starts/owns──> browser process
Connect:  test process ──attaches──────> existing browser process
```

Connecting is not automatically a Selenium Grid replacement. It can be a building block
for remote infrastructure, but the provider must supply browser provisioning, capacity,
endpoint discovery, browser/version compatibility, artifact collection, and security.

---

## 2. `browserType.connect()` — Playwright protocol

`browserType.connect(wsEndpoint, options?)` attaches to a browser server launched by
Playwright using the Playwright protocol. It is the higher-fidelity remote option when
both ends are Playwright-compatible.

```ts
// client.ts
import { chromium } from 'playwright';

const browser = await chromium.connect(process.env.PW_WS_ENDPOINT!);
console.log(browser.isConnected());

const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://example.test');

await context.close();
await browser.close(); // disconnects this client; consider server ownership policy
```

The major compatibility rule: the Playwright client and server must use matching major
and minor versions. Pin the version at both ends in a real remote service. Do not assume
an arbitrary browser WebSocket endpoint speaks the Playwright protocol.

`connect` accepts connection options such as headers, slow-motion delay, timeout, and
expose-network rules in supported Playwright versions. Headers can carry service
authentication—but avoid logging endpoint URLs or tokens.

---

## 3. `BrowserServer` — launch once, connect elsewhere

`browserType.launchServer()` starts a browser controlled as a Playwright browser server
and returns a `BrowserServer`.

```ts
// server.ts
import { chromium } from 'playwright';

const server = await chromium.launchServer({ headless: true });
console.log(server.wsEndpoint());

// Keep the owning process alive while clients use the endpoint.
process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});
```

```ts
// client.ts
import { chromium } from 'playwright';

const browser = await chromium.connect(process.env.PW_WS_ENDPOINT!);
const page = await browser.newPage();
await page.goto('https://example.test');
await browser.close();
```

Key `BrowserServer` methods:

```ts
server.wsEndpoint(); // WebSocket endpoint for browserType.connect()
server.process();    // underlying ChildProcess, when applicable
server.close();      // closes the server/browser
server.kill();       // forcefully kills the browser process
```

Use `close()` for normal cleanup. `kill()` is a last-resort operational escape hatch,
not ordinary test teardown.

`launchServer` is often useful for a service that owns browser processes and gives jobs
short-lived endpoints. It is not required for normal Playwright Test workers, which
already manage their browser lifecycle efficiently.

---

## 4. `connectOverCDP()` — attach to Chromium DevTools

CDP means Chrome DevTools Protocol. `browserType.connectOverCDP(endpointURL, options?)`
attaches Playwright to a Chromium-family browser exposing a CDP endpoint.

```ts
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const contexts = browser.contexts();
const context = contexts[0];
const pages = context.pages();
const page = pages[0] ?? await context.newPage();

console.log(await page.title());
await browser.close();
```

Start local Chrome with remote debugging enabled:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/pw-cdp-profile
```

On macOS, the executable command may differ by installation. Use a separate temporary
profile: attaching to a personal profile risks state contamination and exposes sensitive
browser data.

CDP attachment supports an HTTP endpoint such as `http://localhost:9222` or a CDP WebSocket
endpoint. It is Chromium-only: it cannot attach to Firefox or WebKit.

---

## 5. Why CDP is lower fidelity

`connectOverCDP` is useful for existing Chrome and Chrome-compatible services, but the
official API documents it as significantly lower fidelity than a Playwright-protocol
connection. Some Playwright features and edge behavior may not be available or behave
identically because Playwright is adapting through CDP rather than controlling a
Playwright-launched browser.

Choose it when the browser already exists and CDP is the only supported access path:

- local debugging against an open Chromium profile;
- a managed browser provider offers only a secure CDP endpoint;
- tooling needs to inspect/automate a browser launched by another program;
- migration/integration work temporarily attaches to existing Chromium infrastructure.

For production-grade cross-browser automation, prefer Playwright-managed launch or a
remote system that supports the Playwright protocol.

---

## 6. Contexts and existing browser state

With `connect`, you can normally create fresh contexts:

```ts
const browser = await chromium.connect(wsEndpoint);
const cleanContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
const page = await cleanContext.newPage();
```

With CDP, the browser may already contain pages and a default context representing the
existing profile. Inspect carefully instead of assuming a clean start:

```ts
const browser = await chromium.connectOverCDP(cdpUrl);

for (const [contextIndex, context] of browser.contexts().entries()) {
  for (const [pageIndex, page] of context.pages().entries()) {
    console.log({ contextIndex, pageIndex, url: page.url() });
  }
}
```

Never let concurrent test jobs share a pre-existing context. Cookies, local storage,
permissions, service workers, downloads, pages, and navigation race across users. Build
one isolated context per job where the browser/service supports it; otherwise serialize
or do not use the endpoint for tests.

---

## 7. Typical remote-service architecture

```text
CI worker
  │ obtains a short-lived authenticated endpoint
  ▼
browser broker / device-farm provider
  │ provisions a pinned browser and isolated profile
  ▼
Playwright BrowserServer endpoint (preferred) or CDP endpoint (Chromium only)
  │
  ▼
test creates one context per scenario and uploads trace/video/screenshots
```

A robust broker should:

1. authenticate and authorize clients before issuing endpoints;
2. create isolated browser/profile capacity per job or tenant;
3. pin Playwright/browser versions and publish compatibility information;
4. set expiry, idle timeout, quotas, and explicit cleanup;
5. capture logs, traces, videos, and crash diagnostics appropriately;
6. keep endpoint URLs private and rotate credentials;
7. run browsers in restricted containers/hosts with egress controls.

Playwright itself is the browser automation client; it does not provision a general
device farm or make an arbitrary third-party grid protocol-compatible.

---

## 8. Remote debugging workflow

For a developer investigation, attach to an intentionally launched local Chrome, inspect
its pages, then use normal locators:

```ts
import { chromium, expect } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];

await expect(page.getByRole('heading')).toBeVisible();
console.log(await page.locator('body').innerText());
await browser.close();
```

This is powerful for diagnosis, but avoid turning it into a deterministic CI test:
personal extensions, cached data, login state, viewport, service workers, and timing all
make an existing interactive profile less reproducible than a fresh Playwright context.

For Playwright Test debugging, tracing, UI mode, headed launch, and `page.pause()` are
usually more reproducible than attaching to an unrelated browser.

---

## 9. Security notes

A CDP port or Playwright WebSocket endpoint effectively grants powerful browser control.
It can read page content, act as a logged-in user, navigate pages, and often access
session-bearing browser state. Treat it like a privileged credential.

- Bind debugging ports to loopback (`127.0.0.1`), never all interfaces by default.
- Do not expose port `9222` directly to a LAN or public internet.
- Use a VPN, authenticated reverse proxy, mTLS, or private network for remote services.
- Issue short-lived, tenant-scoped endpoints/tokens and redact them from logs/reports.
- Use disposable profiles; do not attach automation to a user's daily browsing profile.
- Restrict browser container privileges, filesystem mounts, and outbound network access.
- Close contexts/browsers in `finally` blocks and enforce broker-side TTL cleanup.
- Treat test data, cookies, storage state, traces, screenshots, and videos as sensitive.

```ts
const browser = await chromium.connect(wsEndpoint);
try {
  const context = await browser.newContext();
  try {
    // test work
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
```

Client cleanup is necessary but not sufficient: the owner service must also clean orphaned
browsers when a worker crashes.

---

## 10. Decision guide

| Situation | Prefer | Why |
|---|---|---|
| Normal Playwright Test suite | built-in fixtures / launch | controlled, isolated, cross-browser |
| Remote browsers managed by your platform | `connect()` | Playwright protocol, higher fidelity |
| Existing local Chrome investigation | `connectOverCDP()` | attaches to Chrome's debugging endpoint |
| Provider exposes only CDP | `connectOverCDP()` | pragmatic Chromium-only integration |
| Need a browser endpoint for clients | `launchServer()` + `connect()` | owner can manage server lifecycle |
| Need real Android/iOS native app automation | another appropriate tool/service | Playwright is web automation, not native app control |

---

## 11. Interview Q&A

1. **What is the default Playwright lifecycle?**  
   The runner launches browsers and gives tests isolated contexts/pages.

2. **`launch` versus `connect`?**  
   Launch creates/owns a browser; connect attaches to one already created elsewhere.

3. **What protocol does `browserType.connect` use?**  
   The Playwright browser protocol over a WebSocket endpoint.

4. **What protocol does `connectOverCDP` use?**  
   Chrome DevTools Protocol, so it is Chromium-family only.

5. **Why prefer `connect` over CDP when possible?**  
   It is the higher-fidelity Playwright connection and supports Playwright's intended
   remote browser model.

6. **What is `BrowserServer`?**  
   A Playwright-launched browser server that exposes a WebSocket endpoint for clients.

7. **Can this replace Selenium Grid by itself?**  
   No. A grid/device farm also needs scheduling, provisioning, isolation, observability,
   authentication, and capacity management.

8. **Why must Playwright versions match for `connect`?**  
   Client/server protocol compatibility is defined around matching major/minor versions.

9. **What is risky about attaching to existing Chrome?**  
   Existing session state and browser settings make it non-isolated and can expose data.

10. **How do you isolate multiple remote test users?**  
    Use independent browser contexts/profiles per job wherever supported.

11. **Is a CDP endpoint safe to expose publicly?**  
    No; it is a privileged browser-control interface and must be network/auth protected.

12. **When would you use `launchPersistentContext` instead?**  
    When a test/tool intentionally owns a persistent local profile, rather than attaching
    to a browser someone else launched.

13. **What should the remote owner do after a client crash?**  
    Enforce TTL/idle cleanup and terminate orphaned contexts/browsers server-side.

---

## 12. Lab — attach safely to local Chromium

1. Launch a separate Chromium profile with a loopback-only remote debugging port.
2. Create a TypeScript script that calls `connectOverCDP`.
3. Enumerate existing contexts/pages and print their URLs.
4. Create a new page or isolated context if the environment supports it.
5. Use a role-based locator and a retrying assertion, not raw DOM polling.
6. Close the page/context and disconnect in `finally`.
7. Explain why this script should not use a personal signed-in profile in CI.
8. Design a broker endpoint contract containing authentication, TTL, version, and artifact
   metadata for a future `connect()` integration.

## Next

Return to the [Playwright curriculum index](./README.md) and use modules 23–27 as an
advanced API and interview revision set.
