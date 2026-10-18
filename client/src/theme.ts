/**
 * Mantine theme (SPEC §2, DR-3). Kept minimal for the scaffold; extend as the
 * design system firms up.
 */

import { createTheme, v8CssVariablesResolver } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'teal',
  // Mantine 9 rounds corners to md (8px) by default; keep 8.x's sm (4px).
  defaultRadius: 'sm',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  // Text 4px larger than Mantine's defaults (12/14/16/18/20px) for
  // readability; spacing and control heights are unchanged. Most body text,
  // labels and inputs use `sm`; the page body uses `md`. Description colour:
  // theme.css.
  fontSizes: {
    xs: '1rem', // 16px
    sm: '1.125rem', // 18px
    md: '1.25rem', // 20px
    lg: '1.375rem', // 22px
    xl: '1.5rem', // 24px
  },
  headings: {
    sizes: {
      h1: { fontSize: '2.375rem' }, // 38px
      h2: { fontSize: '1.875rem' }, // 30px
      h3: { fontSize: '1.625rem' }, // 26px
      h4: { fontSize: '1.375rem' }, // 22px
      h5: { fontSize: '1.25rem' }, // 20px
      h6: { fontSize: '1.125rem' }, // 18px
    },
  },
});

// Mantine 9 paints the light variant in solid colours, and in dark mode its
// text in a near-white shade, so subtle and light controls lose their hue (a
// red delete icon turns white). This keeps 8.x's light-variant colours. Pass it
// to every MantineProvider given the theme.
export const cssVariablesResolver = v8CssVariablesResolver;
