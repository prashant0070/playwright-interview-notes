# 10 — Network Interception and Mocking

## Learning goals

Use Playwright routing APIs to observe, modify, mock, and block network traffic; replay HAR files; and choose an appropriate mocking strategy.

---

## 1. Why control network traffic?

Network controls make UI tests useful for cases that would otherwise be slow, unsafe, or difficult to create:

- Show an empty result, a timeout, or a server error deterministically.
- Prevent requests to external or irreversible systems.
- Test UI behavior while a backend is unavailable.
- Speed focused tests by blocking nonessential resources.
- Verify a UI action produced an expected request or response.

Network interception is not automatically better than a real environment. Mocked tests prove the UI's reaction to a chosen contract; they do not prove that a live backend currently honors that contract.

---

## 2. Route at the right scope

Routes can be registered on a `Page` or a `BrowserContext`.

```ts
await page.route('**/api/preferences', handler);       // this page only
await context.route('**/api/preferences', handler);    // every page in context
```

Use a context route for session-wide policies and multi-page flows. Use a page route for a narrow test-specific override. Register the route before navigation or the action that sends the request; interception registered afterward cannot affect an already-issued request.

---

## 3. Fulfill a request with a mocked response

`route.fulfill()` prevents the real request from reaching the network and sends the supplied response to the page.

```ts
await page.route('**/api/products?category=books', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{ id: 'book-1', name: 'Testing Handbook', inStock: true }],
    }),
  });
});

await page.goto('/products?category=books');
await expect(page.getByText('Testing Handbook')).toBeVisible();
```

Use a response shape that the client actually expects. A mock that omits required headers, pagination fields, or nested data may teach the UI test an unrealistic behavior.

To model errors, be deliberate about which layer fails:

```ts
await page.route('**/api/orders', (route) =>
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Temporary service failure' }),
  }),
);
```

---

## 4. `continue`, `abort`, `fulfill`, and `fetch`

| Method | Result |
|---|---|
| `route.continue()` | sends the request onward, optionally with modified request fields |
| `route.abort()` | fails the request at the network layer |
| `route.fulfill()` | returns a supplied response without contacting the server |
| `route.fetch()` | performs the original request so the handler can inspect or alter its response |

Modify outbound request data:

```ts
await page.route('**/api/search', async (route) => {
  const headers = {
    ...route.request().headers(),
    'X-Test-Mode': 'enabled',
  };
  await route.continue({ headers });
});
```

Modify a real response:

```ts
await page.route('**/api/recommendations', async (route) => {
  const response = await route.fetch();
  const json = await response.json();

  await route.fulfill({
    response,
    json: { ...json, experiments: [] },
  });
});
```

`route.fetch()` still calls the live service, so this is partial mocking rather than isolation. Preserve response headers and status with `response` unless the test deliberately changes them.

---

## 5. URL matchers: glob, RegExp, and predicate

The first argument to `route` can be a glob, regular expression, or predicate.

```ts
await page.route('**/api/orders/**', handler);
await page.route(/\/api\/orders\/\d+$/, handler);
await page.route(
  (url) => url.pathname === '/api/search' && url.searchParams.has('q'),
  handler,
);
```

Globs are convenient but can be too broad. Prefer a matcher that captures the intended endpoint without accidentally matching an unrelated request. For a state-changing API, verify method and request payload inside the handler when relevant.

---

## 6. Observe requests and responses without mocking

Use waiters to coordinate one known network event with the action that causes it.

```ts
const [response] = await Promise.all([
  page.waitForResponse((candidate) =>
    candidate.url().includes('/api/orders') &&
    candidate.request().method() === 'POST' &&
    candidate.status() === 201,
  ),
  page.getByRole('button', { name: 'Place order' }).click(),
]);

const order = await response.json();
expect(order.id).toBeTruthy();
```

```ts
const [request] = await Promise.all([
  page.waitForRequest((candidate) =>
    candidate.url().includes('/api/search') &&
    candidate.method() === 'GET',
  ),
  page.getByRole('button', { name: 'Search' }).click(),
]);

expect(new URL(request.url()).searchParams.get('q')).toBe('notebook');
```

Do not wait for a generic “network idle” state to prove a business action completed. Modern applications can keep polling or loading analytics indefinitely. Wait for a response when the network contract matters, and assert visible UI afterward.

---

## 7. HAR recording and replay

HAR (HTTP Archive) files capture requests and responses for replay. Route from a HAR to run a UI against recorded network data.

```ts
await context.routeFromHAR('tests/har/catalog.har', {
  url: '**/api/**',
  notFound: 'abort',
});
```

`notFound: 'abort'` makes unmatched requests fail, which is valuable for an offline deterministic test. Depending on the desired behavior, unmatched requests can instead fall back to the network.

Record or update a HAR:

```ts
await context.routeFromHAR('tests/har/catalog.har', {
  url: '**/api/**',
  update: true,
  updateMode: 'minimal',
});
```

HARs are snapshots. Review them for tokens and personal data before committing them. They can become stale when API contracts change, so use them for a bounded, known scenario rather than treating them as a permanent backend substitute.

---

## 8. Block resources deliberately

Resource blocking can speed non-visual tests.

```ts
await context.route('**/*.{png,jpg,jpeg,webp,woff,woff2}', (route) =>
  route.abort(),
);
await context.route('**/analytics/**', (route) => route.abort());
```

Blocking images, fonts, or CSS can change layout and behavior. Do not use this optimization for visual regression, layout-sensitive, or accessibility scenarios unless the impact is intentionally understood.

---

## 9. Unroute and route order

Routes remain active until the page or context closes, or until they are removed.

```ts
const handler = async (route: Route) => route.continue();
await page.route('**/api/**', handler);
await page.unroute('**/api/**', handler);
```

Avoid a broad persistent route that accidentally affects later behavior in the same test. Make the route's scope and lifetime explicit. When multiple routes could match, keep matchers narrow and document the intended ownership.

---

## 10. Service worker caveat

Service workers can intercept requests before Playwright's routing sees them. For tests that depend on request interception, block service workers in the browser context:

```ts
const context = await browser.newContext({
  serviceWorkers: 'block',
});
```

Do this only when the test does not need to verify service-worker behavior. If offline caching or a progressive web app service worker is part of the feature, test that behavior in a dedicated scenario with clear expectations.

---

## 11. Choosing a mocking strategy

| Strategy | Strength | Risk |
|---|---|---|
| Fully mocked UI | fast and deterministic | mock can drift from production contract |
| Partial mock via `fetch` | isolates one condition while retaining most realism | still depends on a live service |
| HAR replay | realistic captured payloads, offline | snapshot becomes stale |
| Real test environment | validates integration | slower, data-dependent, less deterministic |
| Hybrid API setup + UI assertion | fast prerequisite setup with visible user validation | requires stable setup APIs |

A balanced suite typically uses real integration coverage for critical journeys, targeted mocks for UI edge cases, and API setup to avoid slow UI prerequisites. The right mix depends on the risk being tested.

---

## 12. Interview Q&A

### How do you mock an API response?

Register `page.route` or `context.route` before the request, then call `route.fulfill` with the desired status, headers, and body.

### What is the difference between `fulfill`, `abort`, and `continue`?

`fulfill` supplies a response, `abort` causes a network failure, and `continue` lets the request proceed, optionally after modifying it.

### How do you modify a live response?

Call `route.fetch()` to obtain the response, read or change its data, then call `route.fulfill({ response, json })`. This still depends on the live service.

### Page route or context route?

Use a page route for one tab and a context route for all pages in the session. Context scope is appropriate for multi-page flows or common policies.

### Why must a route be registered before clicking?

The request may be sent immediately after the action. Registering a route afterward creates a race and can let the real request escape.

### How do you wait for a backend call caused by a click?

Arm `page.waitForRequest` or `page.waitForResponse` in `Promise.all` with the click, using a predicate that checks URL, method, and where useful, status.

### When should you use HAR replay?

For a bounded UI flow that benefits from deterministic recorded responses or offline execution. Review HAR content and refresh it intentionally as contracts change.

### What is a service-worker routing caveat?

A service worker may handle a request before Playwright routing can intercept it. Block service workers for interception-focused tests when the feature itself does not require them.

---

## Next

→ [11-api-testing-with-playwright.md](./11-api-testing-with-playwright.md)
