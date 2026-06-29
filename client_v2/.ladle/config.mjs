/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.{js,jsx,ts,tsx}',
  port: 61000,
  addons: {
    // Default Ladle's own UI/background to dark to match the app's dark theme.
    theme: {
      enabled: true,
      defaultState: 'dark',
    },
  },
};
