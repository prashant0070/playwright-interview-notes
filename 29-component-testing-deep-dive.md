# 29 — Component Testing Deep Dive

## Learning goals

Set up Playwright Component Testing (CT) for React, mount and test components with real browser locators, know where CT fits beside unit and end-to-end testing, and recognize its framework-integration boundaries.

> Component Testing integrations and package names can change. Confirm current setup guidance at [playwright.dev](https://playwright.dev/docs/test-components).

---

## 1. What component testing proves

Playwright CT renders a component in a real browser, then drives it through locators and web-first assertions. It is particularly effective for a component's accessible behavior, visual states, keyboard interaction, and browser-dependent rendering.

It is not a replacement for either unit or end-to-end (E2E) testing:

| Test type | Scope | Strength | Typical limitation |
|---|---|---|---|
| Unit | A function or component logic | Very fast, precise branch coverage | Browser integration is often simulated |
| Component | A rendered UI component plus its test harness | Real DOM, CSS, events, accessibility semantics | No full deployed application journey by default |
| E2E | The application through public user flows | Navigation, backend integration, auth, browser behavior | More setup and slower feedback |

Use all three intentionally. For example: unit-test a currency formatter, CT-test an interactive `PriceInput`, and E2E-test a signed-in checkout that persists the value through the server.

---

## 2. React setup

For React, install the Playwright CT package and initialize the integration:

```sh
npm init playwright@latest -- --ct
# Or choose React when the initializer asks for the component-testing framework.
```

The setup creates a component-test config, typically `playwright-ct.config.ts`, and support files under `playwright/`. The exact scaffold evolves; do not copy a stale generated Vite setup across major versions.

```ts
// playwright-ct.config.ts
import { defineConfig, devices } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: './src',
  snapshotDir: './__snapshots__',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

Run component tests with the CT config:

```sh
npx playwright test -c playwright-ct.config.ts
npx playwright test -c playwright-ct.config.ts --ui
```

The imports differ from ordinary E2E tests:

```ts
import { test, expect } from '@playwright/experimental-ct-react';
```

React CT is a separate integration. Do not mix `@playwright/test` and the CT package in the same CT spec merely because their test APIs look similar.

---

## 3. Mounting a component

`mount` renders a JSX component into the browser test environment and returns a locator rooted at that component.

```tsx
// src/Counter.tsx
import { useState } from 'react';

export function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <section aria-label="Counter">
      <output aria-live="polite">{count}</output>
      <button onClick={() => setCount(value => value + 1)}>Increment</button>
    </section>
  );
}
```

```tsx
// src/Counter.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react';
import { Counter } from './Counter';

test('increments from the supplied initial value', async ({ mount }) => {
  const component = await mount(<Counter initial={4} />);

  await expect(component.getByRole('status')).toHaveText('4');
  await component.getByRole('button', { name: 'Increment' }).click();
  await expect(component.getByRole('status')).toHaveText('5');
});
```

Prefer accessible locators inside the mounted component, as in E2E. A CT test is still user-facing browser automation; `locator('div > :nth-child(2)')` is just as brittle here as it is in an application journey.

---

## 4. Inputs, events, and callbacks

Props are the primary state seam. For browser interactions, act as a user would:

```tsx
// src/SearchBox.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react';
import { SearchBox } from './SearchBox';

test('submits trimmed input', async ({ mount }) => {
  const submitted: string[] = [];
  const component = await mount(
    <SearchBox onSearch={query => submitted.push(query)} />,
  );

  const input = component.getByRole('searchbox', { name: 'Search catalog' });
  await input.fill('  headphones  ');
  await input.press('Enter');

  await expect(component.getByRole('status')).toHaveText('Search submitted');
  expect(submitted).toEqual(['headphones']);
});
```

Keep callback assertions small. If a callback triggers a request, CT usually benefits from making that dependency injectable (for example, a `searchClient` prop) so the component test concentrates on UI behavior rather than a live service.

---

## 5. Hooks and the CT harness

Framework support files provide the harness around every mounted component. In React, this is where application-wide providers belong: router context, theme, localization, or a narrowly scoped state provider.

```tsx
// playwright/index.tsx
import type { ReactNode } from 'react';
import { ThemeProvider } from '../src/theme';

export function AppHarness({ children }: { children: ReactNode }) {
  return <ThemeProvider mode="light">{children}</ThemeProvider>;
}
```

Keep the harness deterministic. A global provider that automatically calls production APIs, starts timers, or reads a developer's local storage turns focused component tests into unstable integration tests. Use explicit mock providers or fixture data instead.

Where the current integration supports lifecycle hooks such as `beforeMount` / `afterMount`, use them for controlled setup and cleanup rather than hidden global state. Follow the generated version-specific scaffold for their exact signature.

---

## 6. Vite configuration

CT uses Vite to bundle component code. `ctViteConfig` customizes that bundling while preserving the integration defaults:

```ts
// playwright-ct.config.ts
import { defineConfig } from '@playwright/experimental-ct-react';
import path from 'node:path';

export default defineConfig({
  testDir: './src',
  use: {
    ctViteConfig: {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      define: {
        __BUILD_TARGET__: JSON.stringify('test'),
      },
    },
  },
});
```

Use `ctViteConfig` for aliases, plugins required to compile the component, and test-safe compile-time flags. Avoid copying the full production Vite configuration without review: production-only PWA plugins, analytics injection, and environment-specific transforms can introduce unrelated behavior into CT.

---

## 7. Routing and network behavior

A component that renders links normally needs a router provider. Test its intent at component scope instead of navigating a full application route:

```tsx
import { MemoryRouter } from 'react-router-dom';

test('exposes the product detail link', async ({ mount }) => {
  const component = await mount(
    <MemoryRouter>
      <ProductCard product={{ id: '42', name: 'Camera' }} />
    </MemoryRouter>,
  );

  await expect(component.getByRole('link', { name: 'Camera' }))
    .toHaveAttribute('href', '/products/42');
});
```

For components that fetch data in the browser, use Playwright routing to fulfill a deterministic response:

```tsx
test('renders a supplied inventory state', async ({ page, mount }) => {
  await page.route('**/api/inventory/42', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ available: false }),
    }),
  );

  const component = await mount(<InventoryBadge productId="42" />);
  await expect(component).toHaveText('Out of stock');
});
```

This works technically, but an injectable data client is often easier to understand and avoids depending on application fetch URLs. Reserve routes for behavior that genuinely belongs at the HTTP boundary.

---

## 8. Visual and accessibility-focused CT

Because CT runs in a browser, it is useful for focused visual assertions:

```tsx
test('error state remains readable', async ({ mount }) => {
  const component = await mount(
    <Alert tone="error">Payment could not be authorized.</Alert>,
  );

  await expect(component).toHaveScreenshot('alert-error.png');
  await expect(component.getByRole('alert')).toHaveText(
    'Payment could not be authorized.',
  );
});
```

Keep visual snapshots intentionally narrow, stabilize fonts and animations, and review diffs as UI changes—not as a command to update baselines automatically. Playwright's accessibility-oriented locators validate semantics, but they do not replace a full accessibility audit.

---

## 9. Vue, Svelte, and support boundaries

Playwright also provides framework-specific CT integrations such as Vue and Svelte. Their package names, mounting syntax, and scaffold files are framework-specific; consult the current official CT documentation before selecting one.

The important design principles remain the same:

- Mount a component with explicit inputs.
- Interact using locator and assertion APIs.
- Put required app context in a deterministic harness.
- Mock or inject service dependencies thoughtfully.
- Keep E2E coverage for real navigation, authentication, and backend contracts.

Do not assume every framework feature is supported identically. Component Testing integrations have historically carried experimental status and evolve more quickly than Playwright Test's core E2E API.

---

## 10. Choosing CT

Use CT when a UI behavior needs a real DOM and browser event model but does not require the complete running application. Good candidates include design-system components, complex forms, empty/loading/error states, menus, dialogs, and responsive rendering.

Prefer E2E when the risk crosses boundaries: authentication, routing configuration, server contracts, payment redirects, storage state, or production deployment behavior. Prefer a unit test for pure transformations and logic where browser rendering adds no confidence.

---

## Interview Q&A

**Q: How is Playwright CT different from E2E?**  
A: CT mounts one component in a browser harness. E2E navigates a running application and proves complete user workflows. CT gives faster focused feedback; E2E proves integration boundaries.

**Q: Why use Playwright CT over a DOM-only component test?**  
A: It uses a real browser and Playwright's locators, events, screenshots, and assertions, which is valuable for rendering and interaction behavior. It does not make unit tests obsolete.

**Q: What belongs in `ctViteConfig`?**  
A: Only bundling needs for the test harness—such as aliases and required transforms. Avoid bringing in production-only plugins or environment side effects.

**Q: How should a CT test handle a component that fetches data?**  
A: Prefer dependency injection when practical. A `page.route()` fulfillment is appropriate when testing the browser HTTP boundary, but it should be deterministic and local to the test.

**Q: Is CT stable across React, Vue, and Svelte in exactly the same way?**  
A: No. The integrations are framework-specific and can be experimental or version-sensitive. Verify the supported setup and limitations in the official docs.
