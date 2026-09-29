import { addons } from 'storybook/manager-api';
import { themes } from 'storybook/theming';

// Storybook's own UI in dark, to match the app.
addons.setConfig({ theme: themes.dark });
