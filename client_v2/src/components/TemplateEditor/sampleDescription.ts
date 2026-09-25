/**
 * A real variable spec (Camp Harmony's describe payload, trimmed) for the
 * editor's stories and tests. Its `attributes:registration` adds a
 * `donation-note` question to exercise keys that aren't identifiers.
 */

import type { TemplateDescription } from 'api-types';

import json from './sampleDescription.json';

export const sampleDescription = json as unknown as TemplateDescription;
