import { describe, expect, it } from 'vitest';

import {
  collectScope,
  completionEntries,
  type CursorContext,
  getCursorContext,
  resolveType,
} from './completion';
import { sampleDescription as description } from './sampleDescription';

const scopeAt = (text: string) => collectScope(text, description, 'report');

const labels = (text: string) => {
  const cursor = getCursorContext(text);
  if (!cursor) return [];
  return completionEntries(cursor, scopeAt(text), description).map((e) => e.label);
};

const entry = (text: string, label: string) => {
  const cursor = getCursorContext(text) as CursorContext;
  return completionEntries(cursor, scopeAt(text), description).find((e) => e.label === label);
};

describe('getCursorContext', () => {
  it('ignores plain text, closed expressions and comments', () => {
    expect(getCursorContext('Hello event.')).toBeNull();
    expect(getCursorContext('{{ event.name }} and event.')).toBeNull();
    expect(getCursorContext('{# event.')).toBeNull();
  });

  it('knows variables, fields, filters, tests and tags', () => {
    expect(getCursorContext('{{ ev')).toEqual({ kind: 'root', partial: 'ev' });
    expect(getCursorContext('{{ event.lodging.na')).toEqual({
      kind: 'member',
      base: 'event.lodging',
      partial: 'na',
    });
    expect(getCursorContext("{{ campers[0]['x'].")).toMatchObject({
      kind: 'member',
      base: "campers[0]['x']",
    });
    expect(getCursorContext('{{ campers | len')).toEqual({ kind: 'filter', partial: 'len' });
    expect(getCursorContext('{% if camper.lodging is not no')).toEqual({
      kind: 'test',
      partial: 'no',
    });
    expect(getCursorContext('{%- fo')).toEqual({ kind: 'tag', partial: 'fo' });
    expect(getCursorContext('{% for c in cam')).toEqual({ kind: 'root', partial: 'cam' });
  });
});

describe('resolveType', () => {
  const scope = scopeAt('');

  it('follows fields, indexes and keys', () => {
    expect(resolveType('event', scope, description)).toBe('event');
    expect(resolveType('event.lodging.children', scope, description)).toBe('list<lodging>');
    expect(resolveType('campers[0].registration', scope, description)).toBe('registration');
    expect(resolveType("campers[0]['attributes']", scope, description)).toBe('attributes:camper');
    expect(resolveType('event.start.strftime("%a")', scope, description)).toBe('string');
  });

  it('carries types through list filters', () => {
    expect(resolveType('campers | first', scope, description)).toBe('camper');
    expect(resolveType("campers | sort(attribute='id') | last", scope, description)).toBe('camper');
    expect(resolveType("campers | selectattr('lodging') | list", scope, description)).toBe(
      'list<camper>',
    );
    expect(resolveType("campers | map(attribute='lodging') | first", scope, description)).toBe(
      'lodging',
    );
    expect(resolveType('campers | length', scope, description)).toBe('number');
  });

  it('gives up on unknown names', () => {
    expect(resolveType('nope.name', scope, description)).toBeUndefined();
    expect(resolveType('event.nope.name', scope, description)).toBeUndefined();
  });
});

describe('collectScope', () => {
  it('has the context roots and globals', () => {
    const scope = scopeAt('');
    expect(scope.get('campers')).toBe('list<camper>');
    expect(scope.get('range')).toBeDefined();
  });

  it('adds loop variables inside open for-blocks only', () => {
    const inside = scopeAt('{% for c in campers %}{{ ');
    expect(inside.get('c')).toBe('camper');
    expect(inside.get('loop')).toBe('loop');
    const after = scopeAt('{% for c in campers %}{% endfor %}{{ ');
    expect(after.has('c')).toBe(false);
    expect(after.has('loop')).toBe(false);
  });

  it('types nested loops, set and with', () => {
    const scope = scopeAt(
      '{% for r in registrations %}{% for c in r.campers %}' +
        '{% set cabin = c.lodging %}{% with first = r.campers | first %}{{ ',
    );
    expect(scope.get('c')).toBe('camper');
    expect(scope.get('cabin')).toBe('lodging');
    expect(scope.get('first')).toBe('camper');
    expect(scopeAt('{% set rows = [] %}{{ ').get('rows')).toBe('list<any>');
  });
});

describe('completionEntries', () => {
  it('lists an object’s fields', () => {
    const fields = labels('{{ event.');
    expect(fields).toEqual(
      expect.arrayContaining(['name', 'nights', 'lodging', 'registration_types']),
    );
    expect(entry('{{ event.', 'nights')).toMatchObject({ kind: 'field', detail: 'list<date>' });
  });

  it('follows loop variables to the event’s own questions', () => {
    const fields = labels('{% for camper in campers %}{{ camper.attributes.');
    expect(fields).toEqual(expect.arrayContaining(['first_name', 'linens', 'meal_type']));
    expect(entry('{% for camper in campers %}{{ camper.attributes.', 'linens')).toMatchObject({
      sortPrefix: '0',
      detail: 'bool',
    });
    expect(labels('{% for c in campers %}{{ loop.')).toEqual(
      expect.arrayContaining(['index', 'first', 'last']),
    );
  });

  it('writes keys that aren’t identifiers as subscripts', () => {
    const note = entry('{{ registrations[0].attributes.', 'donation-note');
    expect(note).toMatchObject({ insertText: "['donation-note']", replacesDot: true });
  });

  it('inserts methods with parentheses', () => {
    expect(entry('{{ event.start.', 'strftime')).toMatchObject({
      kind: 'method',
      insertText: 'strftime($1)',
      snippet: true,
    });
  });

  it('lists variables, filters, tests and tag snippets', () => {
    expect(labels('{{ ')).toEqual(expect.arrayContaining(['event', 'campers', 'registrations']));
    expect(labels('{{ campers | ')).toEqual(
      expect.arrayContaining(['money', 'length', 'selectattr']),
    );
    expect(labels('{% if x is ')).toEqual(expect.arrayContaining(['defined', 'none']));
    const forTag = entry('{% ', 'for');
    expect(forTag?.snippet).toBe(true);
    expect(forTag?.insertText.startsWith('for ')).toBe(true);
  });

  it('offers nothing for an unknown object', () => {
    expect(labels('{{ nope.')).toEqual([]);
  });
});
