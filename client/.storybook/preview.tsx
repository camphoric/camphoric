import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '../src/theme.css';

import { MantineProvider } from '@mantine/core';
import type { Preview } from '@storybook/react-vite';

import { theme } from '../src/theme';

const preview: Preview = {
  // A toolbar switch for the colour scheme: System follows the OS, as the app
  // does (SPEC §10, DR-100); Light and Dark force one so a story can be
  // checked in both.
  globalTypes: {
    colorScheme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Colour scheme',
        icon: 'mirror',
        items: [
          { value: 'auto', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { colorScheme: 'auto' },
  // Wrap every story in the app's Mantine provider so components render with
  // the real theme. Add more providers here if stories need them (e.g. a
  // QueryClientProvider for data-driven components).
  decorators: [
    (Story, context) => {
      const scheme = context.globals.colorScheme as 'auto' | 'light' | 'dark' | undefined;
      return (
        <MantineProvider
          theme={theme}
          defaultColorScheme="auto"
          forceColorScheme={scheme === 'light' || scheme === 'dark' ? scheme : undefined}
        >
          <Story />
        </MantineProvider>
      );
    },
  ],
};

export default preview;
