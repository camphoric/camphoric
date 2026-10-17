/**
 * Editing an email template's subject and body in place (SPEC §8.3, §8.4;
 * §15 DR-45): the saved text until it's changed, then the edits, saved with
 * `save()`. The confirmation (Home) and each invitation (a registration type)
 * are templates like this. The edits remember the version they started from,
 * so saving over someone else's change asks first (§9.8, DR-109).
 */

import type { ApiEmailTemplate } from 'api-types';
import { type Edit, saveResolvingConflicts } from 'hooks/useEditableRecord';
import { useState } from 'react';
import { emailTemplateHooks } from 'store/entities';

interface Draft {
  subject: string;
  body: string;
}

type TemplateEdit = Edit<ApiEmailTemplate, Draft>;

const toDraft = ({ subject, body }: ApiEmailTemplate): Draft => ({ subject, body });

export function useTemplateDraft(templateId: number | null | undefined) {
  const { data: template } = emailTemplateHooks.useById(templateId);
  const update = emailTemplateHooks.useUpdate({ handlesVersionConflict: true });
  const [edit, setEdit] = useState<TemplateEdit | null>(null);
  const subject = edit?.form.subject ?? template?.subject ?? '';
  const body = edit?.form.body ?? template?.body ?? '';

  const change = (form: Draft) =>
    setEdit((prev) =>
      prev
        ? { ...prev, form }
        : { id: template?.id ?? 0, base: { subject, body }, version: template?.version, form },
    );

  return {
    loaded: !templateId || template !== undefined,
    subject,
    body,
    setSubject: (value: string) => change({ subject: value, body }),
    setBody: (value: string) => change({ subject, body: value }),
    changed: edit !== null,
    /** Drop the edits: follow the saved text again. */
    discard: () => setEdit(null),
    /**
     * Save the edits (if any) to the template, then follow the saved text
     * again. Resolves to whether they're saved (or there were none).
     */
    save: async (id: number | null | undefined = templateId): Promise<boolean> => {
      if (!edit || !id) return true;
      const outcome = await saveResolvingConflicts(
        { ...edit, id },
        {
          toForm: toDraft,
          saveRecord: update.mutateAsync,
          label: 'email',
          onRebase: setEdit,
        },
      );
      if (outcome) setEdit(null);
      return !!outcome?.saved;
    },
    saving: update.isPending,
  };
}
