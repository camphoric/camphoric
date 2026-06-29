/**
 * Shared Mantine Modal `styles` for the record editors (camper, registration):
 * a bounded-height flex column so the editor's tabbed sections scroll internally
 * while its Save/Delete action bar stays pinned at the bottom.
 */

import type { ModalProps } from '@mantine/core';

export const editorModalStyles: ModalProps['styles'] = {
  content: { display: 'flex', flexDirection: 'column', height: 'min(85vh, 900px)' },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
};
