/**
 * Shared test helpers. `renderWithProviders` wraps the UI in the app's Mantine
 * provider (most components need it) and Mantine's modals provider (for
 * `modals.openConfirmModal`); it re-exports Testing Library so tests can
 * `import { renderWithProviders, screen } from 'test/utils'`. The provider is in
 * Mantine's test environment, with no transitions or portals: a dropdown is open
 * as soon as it's clicked, however busy the machine (#959). A test of what a portal
 * does asks for `withPortals`, and has transitions with them.
 */

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

function wrapper(env: 'default' | 'test') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider env={env}>
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  { withPortals = false, ...options }: Omit<RenderOptions, 'wrapper'> & { withPortals?: boolean } = {},
) {
  return render(ui, { wrapper: wrapper(withPortals ? 'default' : 'test'), ...options });
}

export * from '@testing-library/react';
