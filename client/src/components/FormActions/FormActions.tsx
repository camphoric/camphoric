/**
 * A form's actions — Save, and any Cancel, Close or Delete — kept in view
 * (SPEC §9.6, *Form actions*; §15, DR-102). The bar sticks to the bottom of
 * whatever scrolls the form, the page or a dialog, so Save can be reached
 * wherever the form is scrolled to. It keeps its own place after the last
 * field, so scrolled to the end it covers nothing; above that, fields pass
 * under it as they scroll, and a field moved to by the keyboard stops above
 * it. With `dirty`, it says the form has changes not yet saved.
 *
 * Its look and stickiness are in theme.css (`.camphoric-form-actions`), which
 * also fits it to a dialog's edges and to a card's colour.
 */

import { Badge, Group, type GroupProps } from '@mantine/core';
import type { ReactNode } from 'react';

interface FormActionsProps {
  children: ReactNode;
  /** The form has changes not yet saved. */
  dirty?: boolean;
  /** How the actions are spread along the bar; at its end by default. */
  justify?: GroupProps['justify'];
}

export function FormActions({ children, dirty = false, justify = 'flex-end' }: FormActionsProps) {
  return (
    <Group className="camphoric-form-actions" justify={justify} gap="sm">
      {dirty && (
        <Badge color="yellow" variant="light">
          Unsaved changes
        </Badge>
      )}
      {children}
    </Group>
  );
}
