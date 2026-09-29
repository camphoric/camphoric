import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '../src/theme.css';

import { MantineProvider } from '@mantine/core';
import type { Preview } from '@storybook/react-vite';

import { theme } from '../src/theme';

const preview: Preview = {
  // Wrap every story in the app's Mantine provider so components render with
  // the real theme (dark, matching the app). Add more providers here if stories
  // need them (e.g. a QueryClientProvider for data-driven components).
  decorators: [
    (Story) => (
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Story />
      </MantineProvider>
    ),
  ],
};

export default preview;
