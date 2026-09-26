/**
 * A group email's audience (SPEC §8.9; §15 DR-45): who it can go to, the
 * server's defaults when an expression is blank, why a recipient is skipped,
 * and the template context each source renders with.
 */

import type {
  ApiEmailTemplate,
  AudienceSkipped,
  EmailAudience,
  EmailRecipientSource,
  TemplateContextName,
} from 'api-types';
import { EMPTY_FILTER } from 'components/RecipientFilterBuilder';

export const SOURCE_OPTIONS: { value: EmailRecipientSource; label: string }[] = [
  { value: 'campers', label: 'Campers' },
  { value: 'registrations', label: 'Registrations' },
  { value: 'manual', label: 'Listed addresses' },
];

export const SOURCE_LABEL: Record<EmailRecipientSource, string> = {
  campers: 'Campers',
  registrations: 'Registrations',
  manual: 'Listed addresses',
};

/** One of the source's recipients, for "every … is included". */
export const SOURCE_NOUN: Record<EmailRecipientSource, string> = {
  campers: 'camper',
  registrations: 'registration',
  manual: 'address',
};

export const CONTEXT_FOR_SOURCE: Record<EmailRecipientSource, TemplateContextName> = {
  registrations: 'bulk_email_registration',
  campers: 'bulk_email_camper',
  manual: 'bulk_email_manual',
};

/** The server's defaults when an expression is left blank (bulk.py). */
export const DEFAULT_EXPRESSIONS: Record<
  'registrations' | 'campers',
  { address: string; name: string }
> = {
  registrations: { address: 'registration.registrant_email', name: '' },
  campers: {
    address: 'camper.attributes.email or registration.registrant_email',
    name: "[camper.attributes.first_name, camper.attributes.last_name] | select | join(' ')",
  },
};

export const SKIP_REASONS: Record<AudienceSkipped['reason'], string> = {
  no_address: 'No address',
  invalid: 'Not a valid address',
  duplicate: 'Duplicate address',
  filter_error: 'Expression failed',
};

export const EMPTY_AUDIENCE: EmailAudience = {
  recipient_source: 'campers',
  filter: EMPTY_FILTER,
  filter_expression: '',
  address_expression: '',
  name_expression: '',
  recipient_list: '',
  include_incomplete: false,
};

/** A template's saved audience. */
export function audienceOf(template?: ApiEmailTemplate): EmailAudience {
  if (!template) return EMPTY_AUDIENCE;
  return {
    recipient_source: template.recipient_source,
    filter: template.filter ?? EMPTY_FILTER,
    filter_expression: template.filter_expression,
    address_expression: template.address_expression,
    name_expression: template.name_expression,
    recipient_list: template.recipient_list,
    include_incomplete: template.include_incomplete,
  };
}
