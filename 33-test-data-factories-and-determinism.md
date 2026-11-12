# 33 — Test Data Factories and Determinism

## Learning goals

Design test data so every test is independently runnable, parallel-safe, and diagnostically deterministic. Explain factories vs fixtures, Faker vs fixed seeds, cleanup vs isolation-first design, and why shared mutable state fails under workers.

> Cross-read **07** (fixtures), **11** (API setup), **12** (auth state), and **14** (parallelism). Interviewers treat data design as a reliability skill, not a helper-library detail.

---

## 1. Why data determinism matters more than “unique emails”

A green suite that only works when run alone, in order, or against a cold environment is not green. Flakes from data collisions look like “random UI timeouts” in traces. Principal-level answers separate three concerns:

| Concern | Goal |
|---|---|
| **Identity** | Each test owns distinct mutable entities (users, carts, SKUs). |
| **Shape** | Data matches product invariants (valid VAT, allowed role, stock). |
| **Lifecycle** | Setup and teardown are idempotent and survive mid-test failure. |

Prefer **isolation over cleanup**: create data the test alone can mutate. Cleanup is still required for cost and environment hygiene, but it is not a substitute for unique keys.

---

## 2. Factories: typed builders, not JSON dumps

A factory produces a valid domain object with safe defaults and override hooks. Keep factories pure (no I/O). Persist through an API client or UI flow in a fixture.

```ts
// src/data/user.factory.ts
import { randomUUID } from 'node:crypto';

export type UserDraft = {
  email: string;
  password: string;
  displayName: string;
  role: 'customer' | 'support' | 'admin';
};

export function buildUser(overrides: Partial<UserDraft> = {}): UserDraft {
  const id = randomUUID().slice(0, 8);
  return {
    email: `e2e.customer.${id}@example.test`,
    password: process.env.E2E_DEFAULT_PASSWORD ?? 'ChangeMe!e2e',
    displayName: `Customer ${id}`,
    role: 'customer',
    ...overrides,
  };
}
```

Interview talking points:

- **Defaults encode validity**, not production realism. Fake realism that violates constraints creates intermittent 400s.
- **Overrides stay partial.** Call sites should not rebuild the whole object.
- **IDs include worker/test markers** when the backend rejects pure UUIDs or when triage needs human-readable ownership:
  `e2e.w${workerIndex}.${testInfo.testId.slice(0, 8)}@example.test`.

---

## 3. Fixtures for data: put I/O and teardown in the lifecycle

Factories build values; fixtures own create/use/delete. This is the pattern interviewers want to hear after “how do you seed data?”

```ts
// tests/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { buildUser, type UserDraft } from '../src/data/user.factory';
import { UsersApi } from '../src/api/users.client';

type DataFixtures = {
  usersApi: UsersApi;
  customer: UserDraft & { id: string };
};

export const test = base.extend<DataFixtures>({
  usersApi: async ({ request }, use) => {
    await use(new UsersApi(request));
  },

  customer: async ({ usersApi }, use, testInfo) => {
    const draft = buildUser({
      email: `e2e.${testInfo.workerIndex}.${testInfo.parallelIndex}@example.test`,
    });
    const created = await usersApi.create(draft);

    await use({ ...draft, id: created.id });

    // Teardown after use — runs even if the test failed.
    await usersApi.delete(created.id).catch((error) => {
      testInfo.annotations.push({
        type: 'cleanup-warning',
        description: String(error),
      });
    });
  },
});

export { expect };
```

```ts
test('customer edits profile display name', async ({ page, customer }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(customer.email);
  await page.getByLabel('Password').fill(customer.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.goto('/profile');
  await page.getByLabel('Display name').fill('Interview Ready');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

### Worker-scoped vs test-scoped data

| Scope | Use when | Risk |
|---|---|---|
| `scope: 'test'` (default) | Mutable per-test entities | Slightly more setup cost |
| `scope: 'worker'` | Expensive read-only catalog, shared auth lease that is not mutated | Cross-test pollution if anything writes |
| Setup project + `storageState` | Stable role login reused by many tests | Token expiry; never share one mutable account across writers |

Rule of thumb: **if the test can change it, scope it to the test**.

---

## 4. Faker vs fixed seeds

`@faker-js/faker` (or similar) is fine for **shape variety**. It is dangerous for **assertion targets** and **reproducibility** unless seeded.

```ts
import { faker } from '@faker-js/faker';

test.beforeEach(({ }, testInfo) => {
  // Stable per test title + project → same data on retry for this test.
  faker.seed(hashSeed(`${testInfo.project.name}:${testInfo.title}`));
});

const address = {
  line1: faker.location.streetAddress(),
  city: faker.location.city(),
  postalCode: '90210', // keep constrained fields fixed when the product validates format
};
```

Interview trade-offs:

| Approach | Pros | Cons |
|---|---|---|
| Fixed literals | Easy diffs, stable asserts | Narrow coverage; copy-paste collisions |
| Seeded Faker | Broader inputs, still reproducible on retry | Seed bugs; hard-to-read failures if values not logged |
| Unseeded random | Finds odd bugs | Non-reproducible flakes; CI archaeology nightmare |
| Server-allocated IDs | True uniqueness | Need API seam; cleanup mandatory |

**Best practice:** randomize only fields that must be unique or that you intentionally fuzz; assert on **outcomes** (status text, row presence), not on the random string unless you captured it into a local variable and attached it to `testInfo`.

```ts
await testInfo.attach('seeded-user.json', {
  body: Buffer.from(JSON.stringify(customer, null, 2)),
  contentType: 'application/json',
});
```

---

## 5. Isolation patterns that survive `fullyParallel`

### Prefer unique keys over locks

Do not serialize the suite around one “test user.” Create or lease distinct users/orders. If the product only has one admin seat, isolate **what** the admin mutates (unique org/tenant), not the admin identity alone.

### Avoid module-level mutable state

```ts
// BAD — shared across parallel tests in the same worker/file
let cartId: string;

test.beforeAll(async ({ request }) => {
  cartId = await createCart(request);
});
```

```ts
// GOOD — fixture or per-test local
test('adds item', async ({ cart }) => {
  await cart.addSku('SKU-100');
});
```

### `test.describe.configure({ mode: 'serial' })` is not a data strategy

Serial mode is for rare ordered workflows. Using it to hide shared-cart coupling is a senior red flag. Interview answer: “I’d split into independent tests with API seeding; serial only if the product journey cannot be decomposed and we accept throughput cost.”

---

## 6. Idempotent setup and resilient cleanup

**Idempotent setup** means re-running setup does not fail because the resource already exists, and does not leave ambiguous state.

```ts
async function ensureCoupon(api: CouponsApi, code: string) {
  const existing = await api.findByCode(code);
  if (existing) {
    await api.reset(existing.id); // known baseline, not “maybe update”
    return existing;
  }
  return api.create({ code, percentOff: 10 });
}
```

**Cleanup rules interviewers expect:**

1. Teardown lives after `await use(...)` in fixtures, or in `test.afterEach` with the created IDs stored on `testInfo`.
2. Cleanup must tolerate “already deleted” (404 → success).
3. Cleanup failures should annotate, not mask the original test failure (rethrow only if policy requires hard fail).
4. Prefer deleting by **ID created in this test**, never “delete all rows matching prefix” in shared envs without guardrails.
5. For storageState users, rotate or refresh on a schedule; do not delete the only shared bootstrap account mid-suite.

### Soft-delete and eventual consistency

If the API is eventually consistent, assert readiness before UI:

```ts
await expect.poll(async () => (await usersApi.get(customer.id)).status)
  .toBe('ACTIVE');
```

---

## 7. Avoiding shared mutable state — checklist

- [ ] No `let`/`var` mutable globals used by more than one test.
- [ ] No single DB row updated by parallel tests.
- [ ] No reliance on “previous test left the UI on dashboard.”
- [ ] Auth: role-specific `storageState` files; writers get dedicated accounts.
- [ ] Feature flags: pin per project/env, do not flip globally from a test.
- [ ] Time: use `page.clock` (see **18**) or fixed server clock for date-sensitive data.
- [ ] Locales/currency: set context options; do not assert on ambient OS locale.

---

## 8. Layering: factory → API → UI

Ideal flow for speed and stability:

1. **Factory** builds a valid draft.
2. **API fixture** persists it (auth via service token or privileged test user).
3. **UI test** exercises the user-visible outcome only.
4. **Teardown** deletes via API.

Use UI for setup only when no test seam exists—and call that out as a product testability gap in senior interviews.

---

## 9. Common mistakes

| Mistake | Why it fails interviews / CI |
|---|---|
| Timestamp-only emails | Collides under parallel workers in the same millisecond |
| Faker without seed + assert on exact name | Cannot reproduce after flake |
| Cleanup only in happy-path `try` | Leaks data after assertion failures |
| Shared coupon `SAVE10` | Inventory/redemption races |
| Seeding in `beforeAll` with `page` | Wrong lifecycle; encourages order dependence |
| Committing `storageState` with PII/tokens | Security finding |
| “Unique enough” static JSON fixtures copied into every test | Drift and collisions |

---

## Interview Q&A

**Q: Factory vs fixture — what’s the difference?**  
A: A factory is a pure builder of valid data shapes. A fixture owns Playwright lifecycle: create, inject, and tear down resources the test depends on.

**Q: How do you keep parallel tests from colliding?**  
A: Unique identities per test (UUID + worker/test id), test-scoped fixtures for mutable data, separate auth states per role, and no module-level mutable variables.

**Q: When is Faker acceptable?**  
A: When values are captured into locals, optionally seeded for retries, constrained to valid formats, and not used as brittle golden strings unless intentionally testing that exact value.

**Q: Isolation vs cleanup — which first?**  
A: Isolation first so failures and parallelism cannot corrupt neighbors. Cleanup second for environment cost and hygiene; make it idempotent.

**Q: How do you debug “passes alone, fails in suite”?**  
A: Suspect shared data or order dependence. Run with `fullyParallel`, high workers, `--repeat-each`, inspect which entity IDs collided, then move state into per-test fixtures.

---

## Next

→ [34-flake-rca-playbook.md](./34-flake-rca-playbook.md)
