/**
 * Mantine theme (SPEC §2, DR-3). Kept minimal for the scaffold; extend as the
 * design system firms up.
 */

import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'teal',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
