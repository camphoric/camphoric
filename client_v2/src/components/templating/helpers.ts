/**
 * Custom Handlebars helpers used in confirmation pages, emails, and Handlebars
 * reports (SPEC §9.3). This set is a contract — preserve each helper's behavior.
 *
 * Each helper carries `help` text in a fixed shape so the in-app Template Help
 * reference (§9.3) can document it:
 *   line 1: example template (≤60 chars)
 *   line 2: rendered result of the example
 *   rest:   a description
 */

import Handlebars from 'handlebars';
import { flattenDeep, getByPath } from 'utils/object';
import { sortComparison } from 'utils/sort';

export interface TemplateHelper {
  help: string;
  fn: Handlebars.HelperDelegate;
}

type ComparisonOperator = '==' | '===' | '!=' | '!==' | '<' | '>' | '<=' | '>=' | 'typeof';

function compareByOperator(a: unknown, operator: string, b: unknown): boolean {
  switch (operator as ComparisonOperator) {
    case '==':
      // Intentional loose equality — part of the documented operator set.
      return a == b;
    case '===':
      return a === b;
    case '!=':
      // Intentional loose inequality — part of the documented operator set.
      return a != b;
    case '!==':
      return a !== b;
    case '<':
      return (a as number) < (b as number);
    case '>':
      return (a as number) > (b as number);
    case '<=':
      return (a as number) <= (b as number);
    case '>=':
      return (a as number) >= (b as number);
    case 'typeof':
      return typeof a === b;
    default:
      throw new Error('invalid operator: `' + operator + '`');
  }
}

/** Read the named lookup table provided to the template via `@root`. */
function rootLookup(options: Handlebars.HelperOptions, name: string): Record<string, unknown> {
  const root = (options.data as { root?: Record<string, unknown> } | undefined)?.root ?? {};
  return (root[name] as Record<string, unknown>) ?? {};
}

/** Build a "lookup an object by id and read a path off it" helper. */
function makeLookupHelper(lookupName: string): Handlebars.HelperDelegate {
  return function lookupHelper(id: unknown, path: string, options: Handlebars.HelperOptions) {
    const record = rootLookup(options, lookupName)[id as string];
    if (!record) return '';
    const value = getByPath(record, path);
    return value === undefined ? '' : value;
  };
}

export const templateHelpers: Record<string, TemplateHelper> = {
  getLodgingValue: {
    help: `
{{getLodgingValue lodging 'name'}}
Tent spot A
Look up a lodging object and return a value from a path`,
    fn: makeLookupHelper('lodgingLookup'),
  },

  getRegistrationValue: {
    help: `
{{getRegistrationValue camper.registration 'total_owed'}}
9999
Look up a registration object and return a value from a path`,
    fn: makeLookupHelper('registrationLookup'),
  },

  getCamperValue: {
    help: `
{{getCamperValue campers.0.id 'attributes.first_name'}}
bob
Look up a camper object and return a value from a path`,
    fn: makeLookupHelper('camperLookup'),
  },

  count: {
    help: `
{{count campers}}
5
Count the items in an array`,
    fn: (arr: unknown) => {
      if (!Array.isArray(arr)) throw new Error('non-array passed to {{count}}');
      return arr.length;
    },
  },

  filter: {
    help: `
{{#each (filter campers 'attributes.age' '===' '0-4')}}…{{/each}}
bob
Filter an array of objects by comparing a path's value to the given value`,
    fn: (...args: unknown[]) => {
      if (args.length < 5) {
        throw new Error('handlebars Helper {{filter}} expects 4 arguments');
      }
      const [arr, path, operator, b] = args as [unknown[], string, string, unknown];
      try {
        return arr.filter((item) => {
          if (!item) return false;
          return compareByOperator(getByPath(item, path), operator, b);
        });
      } catch (e) {
        throw new Error(`helper {{filter}}: ${(e as Error).message}`);
      }
    },
  },

  compare: {
    help: `
{{#compare myStr '===' 'bob'}}bob{{/compare}}
bob
Render the block when comparing the first and third args (via the operator) is true`,
    fn: function compare(this: unknown, ...args: unknown[]) {
      if (args.length < 4) {
        throw new Error('handlebars Helper {{compare}} expects 3 arguments');
      }
      const [a, operator, b, options] = args as [
        unknown,
        string,
        unknown,
        Handlebars.HelperOptions,
      ];
      try {
        return compareByOperator(a, operator, b) ? options.fn(this) : '';
      } catch (e) {
        throw new Error(`helper {{compare}}: ${(e as Error).message}`);
      }
    },
  },

  abs: {
    help: `
{{abs -5}}
5
Return the absolute value of a number`,
    fn: (num: unknown) => {
      const abs = Math.abs(num as number);
      return abs || num;
    },
  },

  or: {
    help: `
{{or false 0 bob}}
bob
Return the first truthy argument`,
    fn: (...args: unknown[]) => args.slice(0, -1).find(Boolean) ?? '',
  },

  lt: {
    help: `
{{#if (lt 5 8)}}yes{{else}}no{{/if}}
yes
Return true if the first argument is less than the second`,
    fn: (a: unknown, b: unknown) => Number(a) < Number(b),
  },

  gt: {
    help: `
{{#if (gt 5 8)}}yes{{else}}no{{/if}}
no
Return true if the first argument is greater than the second`,
    fn: (a: unknown, b: unknown) => Number(a) > Number(b),
  },

  subtract: {
    help: `
{{subtract 20 5 10}}
5
First argument minus the rest; arrays are flattened into elements`,
    fn: (...args: unknown[]) => {
      const numbers = flattenDeep<number>(args.slice(0, -1))
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      if (numbers.length === 0) return 0;
      return numbers.reduce((acc, n) => acc - n);
    },
  },

  sum: {
    help: `
{{sum 5 10 20}}
35
Sum of all the arguments; arrays are flattened into elements`,
    fn: (...args: unknown[]) =>
      flattenDeep<number>(args.slice(0, -1))
        .map(Number)
        .filter(Boolean)
        .reduce((acc, n) => acc + n, 0),
  },

  eachLookupSort: {
    help: `
{{#eachLookupSort campers 'lodging' 'lodgingLookup' 'name'}}…{{/eachLookupSort}}
Abby,Bob,Jane,Zed,
Block helper that sorts an array of objects by a value found in a lookup`,
    fn: (
      arr: unknown[],
      objKey: string,
      lookupName: string,
      lookupValueKey: string,
      options: Handlebars.HelperOptions,
    ) => {
      const lookup = rootLookup(options, lookupName);
      const sorted = [...arr].sort((a, b) => {
        const aVal = getByPath(lookup[getByPath(a, objKey) as string], lookupValueKey);
        const bVal = getByPath(lookup[getByPath(b, objKey) as string], lookupValueKey);
        return sortComparison(aVal, bVal);
      });
      return sorted.map((item) => options.fn(item)).join('');
    },
  },

  eachsort: {
    help: `
{{#eachsort users 'attr.name'}}{{attr.name}},{{/eachsort}}
Abby,Bob,Jane,Zed,
Block helper that sorts an array of objects by a key path (ascending)`,
    fn: (...args: unknown[]) => sortedEach(args, false),
  },

  eachrsort: {
    help: `
{{#eachrsort users 'attr.name'}}{{attr.name}},{{/eachrsort}}
Zed,Jane,Bob,Abby,
Block helper that sorts an array of objects by a key path (descending)`,
    fn: (...args: unknown[]) => sortedEach(args, true),
  },
};

/**
 * Shared body for eachsort/eachrsort. The key path is optional: with two args
 * (`arr`, `options`) the items are sorted by their own value; with three
 * (`arr`, `keyPath`, `options`) they're sorted by the value at `keyPath`.
 */
function sortedEach(args: unknown[], reverse: boolean): string {
  const arr = args[0] as unknown[];
  const hasKeyPath = args.length > 2;
  const keyPath = hasKeyPath ? (args[1] as string) : undefined;
  const options = args[args.length - 1] as Handlebars.HelperOptions;

  const sorted = [...arr].sort((a, b) => {
    const aVal = keyPath ? getByPath(a, keyPath) : a;
    const bVal = keyPath ? getByPath(b, keyPath) : b;
    return sortComparison(aVal, bVal);
  });
  if (reverse) sorted.reverse();
  return sorted.map((item) => options.fn(item)).join('');
}
