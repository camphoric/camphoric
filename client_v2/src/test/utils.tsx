/**
 * Shared test helpers. `renderWithProviders` wraps the UI in the app's Mantine
 * provider (most components need it) and Mantine's modals provider (for
 * `modals.openConfirmModal`); it re-exports Testing Library so tests can
 * `import { renderWithProviders, screen } from 'test/utils'`.
 */

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <ModalsProvider>{children}</ModalsProvider>
    </MantineProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
