// @ts-nocheck

// For inspiration on helpers
// https://github.com/helpers/handlebars-helpers

import getFromPath from 'lodash/get';
import flattenDeep from 'lodash/flattenDeep';
import { sortComparison } from 'utils/sort';

/**
 * HelpText
 *
 * The help text needs to be in a specific format if you want the help text to
 * render correctly in the template help modal.
 * line 1: Example Template (60 characters max)
 * line 2: Result of example template rendered
 * rest of lines: a description
 */
type HelpText = string;

type HelperHash = {
  [a: string]: [ HelpText, Function ],
}

const compareByOperator = (a, operator, b) => {
  let result;
  switch (operator) {
    case '==':
      // eslint-disable-next-line eqeqeq
      result = a == b;
      break;
    case '===':
      result = a === b;
      break;
    case '!=':
      // eslint-disable-next-line eqeqeq
      result = a != b;
      break;
    case '!==':
      result = a !== b;
      break;
    case '<':
      result = a < b;
      break;
    case '>':
      result = a > b;
      break;
    case '<=':
      result = a <= b;
      break;
    case '>=':
      result = a >= b;
      break;
    case 'typeof':
      result = typeof a === b;
      break;
    default: {
      throw new Error('invalid operator: `' + operator + '`');
    }
  }

  return result;
}

const helpers: HelperHash = {
  getLodgingValue: [
    `
    {{getLodgingValue lodging 'name'}}
    Tent spot A
    Lookup a lodging object and return a value from a path
    `,
    function (lodgingId, path, options) {
      console.log(options.data.root);
      const lookup = options.data.root.lodgingLookup;
      const reg = lookup[lodgingId];

      if (!reg) return '';

      const value = getFromPath(reg, path);

      if (value === undefined) return '';

      return value;
    },
  ],

  getRegistrationValue: [
    `
    {{getRegistrationValue camper.registration 'initial_payment.total'}}
    9999
    Lookup a registration object and return a value from a path
    `,
    function (registrationId, path, options) {
      const lookup = options.data.root.registrationLookup;
      const reg = lookup[registrationId];

      if (!reg) return '';

      const value = getFromPath(reg, path);

      if (value === undefined) return '';

      return value;
    },
  ],

  getCamperValue: [
    `
    {{getCamperValue campers.0.id 'attributes.first_name'}}
    bob
    Lookup a camper object and return a value from a path
    `,
    function (camperId, path, options) {
      const lookup = options.data.root.camperLookup;
      const reg = lookup[camperId];

      if (!reg) return '';

      const value = getFromPath(reg, path);

      if (value === undefined) return '';

      return value;
    },
  ],

  count: [
    `
    {{count campers}}
    5
    Count the items in an array
    `,
    function (arr, options) {
      if (!Array.isArray(arr)) throw new Error(
        'non-array passed to {{count}}'
      );

      return arr.length;
    },
  ],

  filter: [
    `
    {{#each (filter campers 'attributes.age' '===' '0-4'))}}{{attributes.first_name}}{{/each}}
    bob
    Filter an array of objects with a comparison of the path's value and third arguments
    `,
    function (...args) {
      if (args.length < 5) {
        throw new Error('handlebars Helper {{filter}} expects 5 arguments');
      }

      const [arr, path, operator, b, options] = args;

      console.log({
        arr, path, operator, b, options
      });

      try {
        const result = arr.filter((item) => {
          if (!item) return false;

          const val = getFromPath(item, path);

          return compareByOperator(val, operator, b);
        });

        if (result) {
          return result;
        }
      } catch(e) {
        throw new Error(`helper {{filter}}: ${e.message}`);
      }
    },
  ],

  compare: [
    `
    {{compare myStr '===' 'bob'}}bob{{/compare}}
    bob
    Render a block when a comparison of the first and third arguments returns
    true. The second argument is the comparison operator to use.
    `,
    function (...args) {
      if (args.length < 4) {
        throw new Error('handlebars Helper {{compare}} expects 4 arguments');
      }

      const [a, operator, b, options] = args;

      try {
        const result = compareByOperator(a, operator, b);

        if (result) {
          return options.fn(this);
        }
      } catch(e) {
        throw new Error(`helper {{compare}}: ${e.message}`);
      }
    },
  ],

  abs: [
    `
    {{abs -5}}
    5
    returns the absolute value of a number
    `,
    function(num: number) {
      const abs = Math.abs(num);

      if (!abs) return num;

      return abs;
    }
  ],

  or: [
    `
    {{or false 0 bob}}
    bob
    returns the first truthy value
    `,
    function(...args) {
      return args.find(Boolean);
    }
  ],

  lt: [
    `
    {{#if (lt 5 8)}}yes{{else}}no{{/if}}
    yes
    returns true if arg1 is less than arg2
    `,
    function(a, b) {
      return Number(a) < Number(b)
    }
  ],

  gt: [
    `
    {{#if (gt 5 8)}}yes{{else}}no{{/if}}
    no
    returns true if arg1 is greater than arg2
    `,
    function(a, b) {
      return Number(a) > Number(b)
    }
  ],

  subtract: [
    `
    {{subtract 20 5 10}}
    5
    returns the first argument minus the rest of the arguments.  If one of the arguments is an array, it
    will flatten the array and treat the items as elements to subtract
    `,
    function(...args) {
      return flattenDeep(args)
        .map(Number)
        .filter(a => !Number.isNaN(a))
        .reduce((acc, n) => acc-n);
    }
  ],

  sum: [
    `
    {{sum 5 10 20}}
    35
    returns sum of all the arguments.  If one of the arguments is an array, it
    will flatten the array and treat the items as elements to sum
    `,
    function(...args) {
      return flattenDeep(args)
        .map(Number)
        .filter(Boolean)
        .reduce((acc, n) => acc+n);
    }
  ],

  sumpath: [
    `
    {{sumpath arrayOfObjects 'path.to.key.in.object'}}
    35
    returns sum of all the keys in the objects in the array.
    `,
    function(arr, path) {
      return arr.map(i => getFromPath(path))
        .reduce((acc, n) => acc + (Number(n) || 0), 0);
    }
  ],

  eachLookupSort: [
    `
    {{#eachLookupSort campers 'lodging' 'lodgingLookup' 'name'}}{{attributes.name}},{{/eachLookupSort}}
    Abby,Bob,Jane,Zed,
    Block helper that sorts an array of objects by a value found in a lookup
    `,
    function(arr, objKey, lookupName, lookupValueKey, options) {
      console.log(options);
      const lookup = options.data.root[lookupName];

      if (!lookup) {
        console.error(`can't find lookup '${lookupName}`);
        return '';
      }

      const arrSorted =  arr.sort((a, b) => {
        const akey = getFromPath(a, objKey);
        const bkey = getFromPath(b, objKey);

        const aval = getFromPath(lookup[akey], lookupValueKey);
        const bval = getFromPath(lookup[bkey], lookupValueKey);

        return sortComparison(aval, bval);
      });

      return arrSorted.map(options.fn).join('');
    }
  ],

  eachsort: [
    `
    {{#eachsort usrs 'attr.name'}}{{attr.name}},{{/eachsort}}
    Abby,Bob,Jane,Zed,
    Block helper that sorts an array of objects by a key
    `,
    function(arr, keyPath, options) {
      if (!options) {
        options = keyPath;
        keyPath = undefined;
      }

      const arrSorted =  arr.sort((a, b) => {
        const aval = !!keyPath ? getFromPath(a, keyPath) : a;
        const bval = !!keyPath ? getFromPath(b, keyPath) : b;

        return sortComparison(aval, bval);
      });

      return arrSorted.map(options.fn).join('');
    }
  ],

  eachrsort: [
    `
    {{#eachrsort usrs 'attr.name'}}{{attr.name}},{{/eachrsort}}
    Zed,Jane,Bob,Abby,
    Block helper that reverse sorts an array of objects by a key
    `,
    function(arr, keyPath, options) {
      if (!options) {
        options = keyPath;
        keyPath = undefined;
      }

      const arrSorted =  arr.sort((a, b) => {
        const aval = !!keyPath ? getFromPath(a, keyPath) : a;
        const bval = !!keyPath ? getFromPath(b, keyPath) : b;

        return sortComparison(aval, bval);
      }).reverse();

      return arrSorted.map(options.fn).join('');
    }
  ],
};

export default helpers;
