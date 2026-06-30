import type { ApiCamper } from 'api-types';

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

/** A camper's display name from its attributes, with an id fallback. */
export function camperName(c: ApiCamper): string {
  return `${str(c.attributes.first_name)} ${str(c.attributes.last_name)}`.trim() || `Camper ${c.id}`;
}
