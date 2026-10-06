import { addons } from 'storybook/manager-api';
import { themes } from 'storybook/theming';

// Storybook's own UI follows the OS colour scheme, as the app does.
addons.setConfig({
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? themes.dark : themes.light,
});
