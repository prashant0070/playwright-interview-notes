# 09 — Page Object Model and Design Patterns

## Learning goals

Design readable, maintainable UI tests with Playwright locators, page and component objects, fixture injection, and optional flow layers.

---

## 1. What a Page Object Model solves

A Page Object Model (POM) is a small object that represents a screen or a meaningful part of a screen. It keeps UI knowledge—locators and interactions—near the UI abstraction rather than repeating it in every test.

Good outcomes:

- Tests describe user intent instead of selector mechanics.
- A locator change usually has one repair location.
- Repeated interactions become named operations.
- UI-specific code has a clear ownership boundary.

A POM is not mandatory for every test. A short, focused test with one or two idiomatic locators may be clearer without one. Introduce an object when interaction is reused or its meaning deserves a name.

---

## 2. Playwright-idiomatic page objects

Use Playwright `Locator` objects. They are lazy, retry-aware, and safe to reuse. Do not cache `ElementHandle`s for ordinary testing; they can become stale after rendering changes.

```ts
import { type Locator, type Page } from '@playwright/test';

export class SignInPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email address');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }

  async open() {
    await this.page.goto('/sign-in');
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
```

Favor user-facing locators: `getByRole`, `getByLabel`, `getByText`, and `getByTestId` where the product provides a stable test contract. Avoid brittle CSS chains and XPath that describe implementation structure rather than accessible behavior.

---

## 3. What belongs in a page object?

Page objects should own:

- Locators for controls on that screen.
- Screen-level navigation, interactions, and meaningful state access.
- Small operations that hide mechanical details but preserve intent.

```ts
export class ProfilePage {
  constructor(private readonly page: Page) {}

  private readonly displayName = this.page.getByLabel('Display name');
  private readonly save = this.page.getByRole('button', { name: 'Save changes' });
  readonly confirmation = this.page.getByRole('status');

  async open() {
    await this.page.goto('/settings/profile');
  }

  async changeDisplayName(name: string) {
    await this.displayName.fill(name);
    await this.save.click();
  }
}
```

Keep business assertions visible in the test where possible:

```ts
test('updates the display name', async ({ profilePage }) => {
  await profilePage.open();
  await profilePage.changeDisplayName('Avery');
  await expect(profilePage.confirmation).toHaveText('Profile saved');
});
```

A page object may include a carefully named readiness assertion when the page cannot safely be used until a condition is met. Avoid hiding every assertion inside objects; tests should still show what outcome matters.

---

## 4. Navigation and return values

Navigation deserves an explicit contract. If an action opens another screen, returning its object can be helpful.

```ts
export class CartPage {
  constructor(private readonly page: Page) {}

  async checkout(): Promise<CheckoutPage> {
    await Promise.all([
      this.page.waitForURL('**/checkout'),
      this.page.getByRole('button', { name: 'Checkout' }).click(),
    ]);
    return new CheckoutPage(this.page);
  }
}
```

Do not return a new page object from every click automatically. A click may update the same screen, open a dialog, or issue a request without navigation. Name methods according to observable behavior: `openAddressDialog`, `save`, `checkout`, or `removeItem`.

---

## 5. Component objects for shared UI

An application shell, dialog, toast, or date picker often appears on multiple pages. Model it as a component object and compose it into pages.

```ts
export class Toast {
  constructor(private readonly page: Page) {}

  readonly region = this.page.getByRole('status');

  async expectSuccess(message: string) {
    await expect(this.region).toHaveText(message);
  }
}

export class AppHeader {
  constructor(private readonly page: Page) {}

  async openAccountMenu() {
    await this.page.getByRole('button', { name: 'Account menu' }).click();
  }

  async signOut() {
    await this.openAccountMenu();
    await this.page.getByRole('menuitem', { name: 'Sign out' }).click();
  }
}
```

Composition is usually easier to evolve than a deep inheritance hierarchy. A page can contain an `AppHeader`, `Toast`, and domain-specific controls without inheriting an unrelated base class.

---

## 6. Fixture-injected page objects

Fixtures provide construction and lifecycle; page objects provide UI behavior.

```ts
// fixtures.ts
import { test as base, expect } from '@playwright/test';

type Fixtures = {
  profilePage: ProfilePage;
  header: AppHeader;
};

export const test = base.extend<Fixtures>({
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
  header: async ({ page }, use) => {
    await use(new AppHeader(page));
  },
});

export { expect };
```

```ts
test('a signed-in user can sign out', async ({ profilePage, header, page }) => {
  await profilePage.open();
  await header.signOut();
  await expect(page).toHaveURL(/sign-in/);
});
```

Fixture injection reduces repetitive `new` calls and makes dependencies obvious in the test signature. It should not create a vast catalogue of objects that each test receives whether it needs them or not.

---

## 7. A generic steps or flows layer

Some journeys span multiple pages and have reusable business meaning. A generic flow layer can coordinate page objects while keeping tests concise.

```ts
export class RegistrationFlow {
  constructor(
    private readonly signUp: SignUpPage,
    private readonly verification: VerificationPage,
  ) {}

  async registerVerifiedUser(user: { email: string; password: string }) {
    await this.signUp.open();
    await this.signUp.register(user);
    await this.verification.completeFor(user.email);
  }
}
```

Use flows for multi-screen journeys or repeated domain operations. Avoid using them as a second, mandatory wrapper around every page method. A flow should express an outcome such as “register verified user,” not become a dumping ground for arbitrary helper functions.

---

## 8. Data belongs outside the POM

Page objects should receive data as parameters rather than importing environment-specific values.

```ts
type Address = {
  line1: string;
  city: string;
  postalCode: string;
};

async fillAddress(address: Address) {
  await this.page.getByLabel('Address line 1').fill(address.line1);
  await this.page.getByLabel('City').fill(address.city);
  await this.page.getByLabel('Postal code').fill(address.postalCode);
}
```

This makes the object reusable, deterministic, and easy to test with different data. Store secrets outside source control and create test data through fixtures or APIs where appropriate.

---

## 9. Waits and assertions in the design

Playwright actions auto-wait for actionability and web-first assertions retry. Page objects should use those mechanisms rather than fixed sleeps.

```ts
async save() {
  await this.page.getByRole('button', { name: 'Save' }).click();
  await expect(this.page.getByRole('status')).toHaveText('Saved');
}
```

The above is reasonable when “save completed” is part of the method's contract. If several tests need different post-save outcomes, return control after the click and let the test assert its specific expected result.

Avoid `waitForTimeout`. It slows passing tests and still fails when the system is slower than the chosen delay.

---

## 10. Common anti-patterns

| Anti-pattern | Why it causes trouble | Better approach |
|---|---|---|
| A single “app” object with every selector | becomes a god object | split by screen and component |
| Raw selectors throughout tests | duplicated UI knowledge | use locators in a POM or component |
| `ElementHandle` fields | stale after re-render | use `Locator` |
| Fixed sleeps in methods | slow and flaky | actionability and web-first assertions |
| Deep base-class hierarchy | hidden behavior, fragile coupling | composition |
| Every assertion hidden in POMs | tests lose their intent | assert important outcomes in tests |
| POM that performs unrelated API/database work | mixes layers | inject a helper or use a flow |
| Over-abstracting a one-off test | indirection without reuse | keep simple tests direct |

---

## 11. BDD is optional

Playwright Test does not require BDD tooling. Clear test titles and page/flow methods can already describe behavior:

```ts
test('editor publishes a draft', async ({ editorPage }) => {
  await editorPage.openDraft('Release notes');
  await editorPage.publish();
  await expect(editorPage.status).toHaveText('Published');
});
```

Use a Gherkin-based BDD layer only when its feature files are genuinely maintained and read by stakeholders. It should call the same well-designed page and flow layer; BDD syntax does not remove the need for good test design.

---

## 12. Interview Q&A

### What is the goal of POM?

It centralizes UI interactions and locator knowledge so tests express behavior and selector changes are localized. It is a design aid, not a rule that every line must go through an object.

### Are page objects still useful with Playwright locators?

Yes. Locators make page-object implementation more reliable, but they do not organize repeated interactions or give domain actions meaningful names.

### What locator strategy would you use in a POM?

Prefer accessible, user-facing locators such as role and label. Use test IDs for stable controls where semantic locators are not sufficient. Avoid implementation-coupled selector chains.

### Page objects or fixtures: which one?

They solve different problems. Page objects model UI behavior; fixtures create and inject dependencies with lifecycle management. A maintainable suite commonly uses both.

### Where should assertions live?

Keep the behavior an individual test is proving visible in the test. A POM can have named readiness or completion assertions when those are part of a reusable operation's contract.

### How do you handle a common header or modal?

Create a component object and compose it into pages or inject it as a fixture. Composition avoids forcing unrelated pages into a deep inheritance tree.

### When is a flow layer appropriate?

For a reusable, multi-page user journey or domain operation. It should coordinate page objects without turning into an unstructured helper collection.

### What are signs that a POM is over-designed?

It has a huge surface area, hides important assertions, wraps every one-line operation, requires many inheritance layers, or makes a simple test hard to follow.

---

## Next

→ [10-network-interception-and-mocking.md](./10-network-interception-and-mocking.md)
