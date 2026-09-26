/**
 * Editing an email template's subject and body in place (SPEC §8.3, §8.4;
 * §15 DR-45): the saved text until it's changed, then the edits, saved with
 * `save()`. The confirmation (Home) and each invitation (a registration type)
 * are templates like this.
 */

import { useState } from 'react';

import { emailTemplateHooks } from './entities';

interface Draft {
  subject: string;
  body: string;
}

export function useTemplateDraft(templateId: number | null | undefined) {
  const { data: template } = emailTemplateHooks.useById(templateId);
  const update = emailTemplateHooks.useUpdate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const subject = draft?.subject ?? template?.subject ?? '';
  const body = draft?.body ?? template?.body ?? '';

  return {
    loaded: !templateId || template !== undefined,
    subject,
    body,
    setSubject: (value: string) => setDraft({ subject: value, body }),
    setBody: (value: string) => setDraft({ subject, body: value }),
    changed: draft !== null,
    /** Save the edits (if any) to the template, then follow the saved text again. */
    save: async (id: number | null | undefined = templateId) => {
      if (!draft || !id) return;
      await update.mutateAsync({ id, ...draft });
      setDraft(null);
    },
    saving: update.isPending,
  };
}
