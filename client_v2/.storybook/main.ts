import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  // Storybook builds with the app's vite.config.ts. Its type/lint checker is
  // for the app's own dev server and build (tsc and eslint run separately), so
  // it's left out here.
  viteFinal(config) {
    return {
      ...config,
      plugins: config.plugins?.filter(
        (plugin) => !(plugin && 'name' in plugin && plugin.name === 'vite-plugin-checker'),
      ),
    };
  },
};

export default config;
