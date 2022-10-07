// @ts-nocheck

// For inspiration on helpers
// https://github.com/helpers/handlebars-helpers

import getFromPath from 'lodash/get';
import flattenDeep from 'lodash/flattenDeep';

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

const comparison = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  // if both are not numbers, do string coercion and compare
  return a.toString().localeCompare(
    b.toString(),
    undefined,
    { sensitivity: 'accent' },
  );
};

const helpers: HelperHash = {
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
          throw new Error('helper {{compare}}: invalid operator: `' + operator + '`');
        }
      }

      if (result) {
        return options.fn(this);
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

        return comparison(aval, bval);
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

        return comparison(aval, bval);
      }).reverse();

      return arrSorted.map(options.fn).join('');
    }
  ],
};

export default helpers;
