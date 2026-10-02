import { sampleDescription as description } from 'components/TemplateEditor/sampleDescription';
import { describe, expect, it } from 'vitest';

import {
  reachableTypes,
  sampleVariablesTemplate,
  searchFilters,
  variableSections,
} from '../reference';

describe('reachableTypes', () => {
  it('follows variables to every type they lead to, nearest first', () => {
    const types = reachableTypes(description, 'report');
    // The variables' own types come before the types their fields lead to.
    expect(types.slice(0, 3)).toEqual(['event', 'registration', 'camper']);
    expect(types.indexOf('lodging')).toBeLessThan(
      types.indexOf('attributes:camper.emergency_contact'),
    );
    expect(types).toEqual(
      expect.arrayContaining([
        'camper',
        'lodging',
        'attributes:camper',
        'attributes:camper.emergency_contact',
      ]),
    );
    expect(types).not.toContain('recipient');
  });

  it('ends with the Python value types those variables have', () => {
    const types = reachableTypes(description, 'report');
    const builtins = types.filter((type) => description.types[type].builtin);
    // `list` (from list fields) and `dict` (the objects' base) included.
    expect(builtins).toEqual(
      expect.arrayContaining(['string', 'number', 'money', 'date', 'datetime', 'dict', 'list']),
    );
    expect(types.slice(-builtins.length)).toEqual(builtins);
  });

  it('depends on the kind of template', () => {
    const types = reachableTypes(description, 'invitation_email');
    expect(types).toEqual(expect.arrayContaining(['invitation', 'registration_type']));
    expect(reachableTypes(description, 'bulk_email_manual')).toContain('recipient');
  });
});

describe('variableSections', () => {
  it('starts with the context’s variables', () => {
    const [variables] = variableSections(description, 'report');
    expect(variables.id).toBe('variables');
    expect(variables.fields.map((f) => f.name)).toContain('campers');
  });

  it('searches names, titles and docs, keeping only matching fields', () => {
    const sections = variableSections(description, 'report', 'linens');
    const camper = sections.find((s) => s.id === 'attributes:camper');
    expect(camper?.fields.map((f) => f.name)).toEqual(['linens']);
    expect(sections.every((s) => s.fields.length > 0)).toBe(true);
  });

  it('names the type whose methods a type also has', () => {
    const sections = variableSections(description, 'report');
    expect(sections.find((s) => s.id === 'camper')?.base).toBe('dict');
    expect(sections.find((s) => s.id === 'string')?.base).toBeUndefined();
  });

  it('keeps a whole type when its name matches', () => {
    const lodging = variableSections(description, 'report', 'lodging').find(
      (s) => s.id === 'lodging',
    );
    expect(lodging?.fields.length).toBe(description.types.lodging.fields.length);
  });
});

describe('searchFilters', () => {
  it('matches names and docs', () => {
    expect(searchFilters(description, 'money').map((f) => f.name)).toContain('money');
    expect(searchFilters(description, '').length).toBe(description.filters.length);
  });
});

describe('sampleVariablesTemplate', () => {
  it('dumps every variable, cutting lists short', () => {
    const template = sampleVariablesTemplate(description, 'report');
    expect(template).toMatch(/^\{\{ dict\(.*\) \| dump\(2\) \}\}$/);
    expect(template).toContain('event=event');
    expect(template).toContain('campers=campers[:3]');
    expect(template).toContain('today=today');
  });
});
