/**
 * Shared Mantine Modal props for the record editors (camper, registration):
 * a wide modal, and `styles` for a bounded-height flex column so the editor's
 * tabbed sections scroll internally while its Save/Delete action bar stays
 * pinned at the bottom.
 */

import type { ModalProps } from '@mantine/core';

/** Most of the screen's width, so long forms have room to breathe. */
export const EDITOR_MODAL_SIZE = '80%';

export const editorModalStyles: ModalProps['styles'] = {
  content: { display: 'flex', flexDirection: 'column', height: 'min(85vh, 900px)' },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
};
