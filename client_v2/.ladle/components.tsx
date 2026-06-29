import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import type { GlobalProvider } from '@ladle/react';

import { theme } from '../src/theme';

// Wrap every story in the app's Mantine provider so components render with the
// real theme (dark, matching the app). Add more providers here if stories need
// them (e.g. a QueryClientProvider for data-driven components).
export const Provider: GlobalProvider = ({ children }) => (
  <MantineProvider theme={theme} defaultColorScheme="dark">
    {children}
  </MantineProvider>
);
