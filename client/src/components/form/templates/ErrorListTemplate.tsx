/**
 * The error list at the top of the form (SPEC §7.1): the theme's list, minus
 * errors whose text was blanked as noise (see `resolveErrorMessages`). Those
 * errors still count towards blocking submission; they just aren't shown.
 */

import { Templates } from '@rjsf/mantine';
import type { ErrorListProps } from '@rjsf/utils';

const BaseErrorList = Templates.ErrorListTemplate!;

export function ErrorListTemplate(props: ErrorListProps) {
  const visible = props.errors.filter((error) => error.stack);
  if (visible.length === 0) return null;
  return <BaseErrorList {...props} errors={visible} />;
}
