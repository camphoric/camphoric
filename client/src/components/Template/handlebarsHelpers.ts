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

const helpers: HelperHash = {
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

        if (aval < bval) {
          return -1;
        }

        if (aval > bval) {
          return 1;
        }

        // names must be equal
        return 0;
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

        if (aval < bval) {
          return -1;
        }

        if (aval > bval) {
          return 1;
        }

        // names must be equal
        return 0;
      }).reverse();

      return arrSorted.map(options.fn).join('');
    }
  ],
};

export default helpers;
