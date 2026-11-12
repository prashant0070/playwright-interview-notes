# 11 — API Testing with Playwright

## Learning goals

Use Playwright's HTTP client for API checks and test setup, share authenticated state safely, combine API and UI steps, and recognize when dedicated API tooling is a better fit.

---

## 1. Playwright can test HTTP without a browser page

Playwright Test includes an `APIRequestContext`, an HTTP client with cookie handling, base URL support, request methods, and assertion integration. The built-in `request` fixture is ready in every Playwright Test.

```ts
import { test, expect } from '@playwright/test';

test('creates an item through the API', async ({ request }) => {
  const response = await request.post('/api/items', {
    data: { name: 'Notebook', quantity: 2 },
  });

  await expect(response).toBeOK();
  expect(response.status()).toBe(201);

  const item = await response.json();
  expect(item.id).toBeTruthy();
  expect(item.name).toBe('Notebook');
});
```

Relative URLs use `baseURL` when it is configured. API tests do not launch a UI page unless the test also requests one.

---

## 2. Configure the `request` fixture

Place common connection details in the Playwright config.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.API_BASE_URL ?? 'https://api.example.test',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});
```

The request fixture is convenient for test-level calls. For a distinct API identity, host, header set, or lifetime, create a separate request context.

---

## 3. Create and dispose a custom `APIRequestContext`

```ts
import { request, expect } from '@playwright/test';

const api = await request.newContext({
  baseURL: 'https://api.example.test',
  extraHTTPHeaders: {
    Authorization: `Bearer ${process.env.API_TOKEN}`,
    Accept: 'application/json',
  },
});

try {
  const response = await api.get('/v1/profile');
  await expect(response).toBeOK();
} finally {
  await api.dispose();
}
```

Disposing a context frees its resources. A fixture is often the cleanest place to create a reusable custom context because it guarantees disposal after the test or worker lifetime.

---

## 4. Request bodies and response assertions

Use `data` for JSON-serializable bodies:

```ts
const response = await request.patch('/api/profile', {
  data: {
    displayName: 'Avery',
    notifications: false,
  },
});

expect(response.status()).toBe(200);
expect(response.headers()['content-type']).toContain('application/json');
expect(await response.json()).toMatchObject({
  displayName: 'Avery',
  notifications: false,
});
```

`await expect(response).toBeOK()` asserts an HTTP status in the 200–299 range. It is a good baseline, but it is not sufficient by itself: assert the specific status and meaningful response fields when the contract requires them.

Avoid asserting an entire response object when it includes timestamps, IDs, generated links, or unrelated fields. Assert the stable contract relevant to the scenario.

---

## 5. API setup plus UI verification

The most valuable use of API requests in an end-to-end suite is often arranging prerequisites faster than the UI can.

```ts
test('shows a document created through the API', async ({ request, page }) => {
  const createResponse = await request.post('/api/documents', {
    data: { title: 'Release notes', visibility: 'private' },
  });
  expect(createResponse.status()).toBe(201);

  const document = await createResponse.json();
  await page.goto(`/documents/${document.id}`);

  await expect(page.getByRole('heading', { name: 'Release notes' }))
    .toBeVisible();
});
```

This is a hybrid test. The API creates state efficiently; the browser still proves that a user can see the expected outcome. It is not a replacement for at least some pure UI journey coverage where the UI creation flow itself is important.

---

## 6. Shared authentication state

An `APIRequestContext` can use a storage state file created by browser authentication.

```ts
const api = await request.newContext({
  baseURL: 'https://example.test',
  storageState: 'playwright/.auth/user.json',
});

try {
  const response = await api.get('/api/me');
  await expect(response).toBeOK();
} finally {
  await api.dispose();
}
```

You can also create it from an in-memory browser state:

```ts
const state = await page.context().storageState();
const api = await request.newContext({ storageState: state });
```

Storage state commonly includes cookies and local storage. Whether that authenticates an API depends on the application's authentication model and domain rules. Token-only APIs may require an explicit `Authorization` header instead.

---

## 7. API login and browser state

An API request context can authenticate with a service and save resulting cookie state. A browser context can then use that state when the service and browser share compatible cookie-based authentication.

```ts
const api = await request.newContext({ baseURL: 'https://example.test' });
await api.post('/api/session', {
  data: { email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD },
});
await api.storageState({ path: 'playwright/.auth/user.json' });
await api.dispose();
```

Do not assume this works universally. CSRF protection, different API hosts, OAuth redirects, or browser-only state can require the official UI login flow or a purpose-built test authentication mechanism.

---

## 8. Multipart form uploads

Use `multipart` for `multipart/form-data` requests.

```ts
import fs from 'node:fs';

const response = await request.post('/api/uploads', {
  multipart: {
    description: 'Product image',
    file: {
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync('tests/fixtures/sample.png'),
    },
  },
});

await expect(response).toBeOK();
```

The same `multipart` object can include ordinary text fields and one or more file payloads. Keep fixture files small and non-sensitive.

---

## 9. GraphQL requests

GraphQL normally uses a single HTTP endpoint; send the query and variables as JSON.

```ts
const response = await request.post('/graphql', {
  data: {
    query: `
      query Product($id: ID!) {
        product(id: $id) { id name inStock }
      }
    `,
    variables: { id: 'product-42' },
  },
});

await expect(response).toBeOK();
const body = await response.json();
expect(body.errors).toBeUndefined();
expect(body.data.product).toMatchObject({
  id: 'product-42',
  inStock: true,
});
```

For GraphQL, HTTP 200 does not guarantee a successful operation: GraphQL errors are often returned in `body.errors`. Assert both transport success and the operation result.

---

## 10. A reusable API client is optional

For repeated endpoints, a thin typed client can make tests clearer.

```ts
export class DocumentsApi {
  constructor(private readonly api: APIRequestContext) {}

  async create(title: string) {
    const response = await this.api.post('/api/documents', { data: { title } });
    expect(response.status()).toBe(201);
    return response.json() as Promise<{ id: string; title: string }>;
  }

  async remove(id: string) {
    const response = await this.api.delete(`/api/documents/${id}`);
    expect(response.status()).toBe(204);
  }
}
```

Keep this layer focused on HTTP operations. Avoid turning it into a hidden source of test data, retries, and UI assertions. Cleanup can live in a fixture teardown when a test creates a resource.

---

## 11. When Playwright API testing is not enough

Playwright is an excellent fit when API requests support UI tests, when a modest HTTP regression suite lives beside UI tests, or when one reporter and language simplify maintenance.

Use dedicated tools when the problem is different:

- Load and performance testing needs tools designed for concurrency and metrics.
- Large schema and contract programs may benefit from dedicated contract tooling.
- Service-level tests may need protocol, database, message-bus, or service virtualization capabilities beyond HTTP.
- Exploratory API design and collaboration can benefit from specialized API clients.

The decision is about testing goals, not a limitation of Playwright's HTTP API.

---

## 12. Interview Q&A

### Does Playwright support API testing?

Yes. Use the built-in `request` fixture or create an `APIRequestContext` with `request.newContext()`.

### What does `toBeOK()` assert?

It asserts that the HTTP response status is in the 200–299 range. Strong tests also check the expected status code and important response contract.

### Why combine API setup with UI assertions?

It creates prerequisites quickly and reliably while still verifying the user-visible outcome in a browser. It reduces test time without pretending the UI creation flow was tested.

### Can an API context share browser authentication?

Yes, by creating it with a compatible `storageState`, or by providing required headers. Whether it works depends on how the application authenticates its API.

### How do you upload a file through the API?

Use the `multipart` option and provide text fields and file descriptors with a name, MIME type, and buffer or readable stream.

### How do you test GraphQL?

POST to the GraphQL endpoint with `query` and `variables`, then assert HTTP success, absence or expected presence of `errors`, and the data payload.

### Should all UI test setup use APIs?

No. Use APIs for prerequisites that do not need UI coverage. Keep representative UI journeys that prove important user interactions work end to end.

### How do you avoid leaking API secrets?

Read credentials from environment variables or an approved secret manager, redact them from logs and attachments, and never commit them in source or storage-state files.

---

## Next

→ [12-authentication-storage-state-and-sessions.md](./12-authentication-storage-state-and-sessions.md)
