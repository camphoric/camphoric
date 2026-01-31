/**
 * These functions are used for quickly displaying info that a user might need
 */
import { LodgingLookup } from 'hooks/api';
import getFromPath from 'lodash/get';
import debug from 'utils/debug';

export function getCamperDisplayId(camper: ApiCamper) {
  // gather possible identifiers
  const lastName = [
    getFromPath(camper, 'attributes.lastname'),
    getFromPath(camper, 'attributes.last_name'),
  ].find(Boolean);
  const firstName = [
    getFromPath(camper, 'attributes.firstname'),
    getFromPath(camper, 'attributes.first_name'),
  ].find(Boolean);
  const fullName = [
    getFromPath(camper, 'attributes.name'),
    getFromPath(camper, 'attributes.fullname'),
  ].find(Boolean);
  const email = [
    getFromPath(camper, 'attributes.mail'),
    getFromPath(camper, 'attributes.email'),
  ].find(Boolean);

  // try a series of possible identifiers and return the first one that works
  return [
    [firstName, lastName].join(' '),
    fullName,
    email,
    lastName,
    firstName,
    camper.id,
  ].find(Boolean);
}

export function lodgingPathDisplay(
  lodgingLookup: LodgingLookup,
  lodgingId?: string | number,
  parts: Array<string> = []
): string {
  if (!lodgingId) return '';

  const node = lodgingLookup[lodgingId];

  if (!node.parent) return parts.join('→');

  return lodgingPathDisplay(lodgingLookup, node.parent, [ node.name, ...parts ]);
};

const ordinalsLessThan10 = [
  'Zeroth',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
];

export function moneyFmt(price: number | string) {
  let numericPrice = typeof price === 'string' ? parseFloat(price) : price;

  // Step 2: Check if input is a valid number
  if (isNaN(numericPrice)) {
    debug(`Invalid moneyFmt input. Expected number or numeric string, got ${price}`)
    numericPrice = 0;
  }

  // Step 3: Format to 2 decimal places (adds trailing zeros)
  return `$${numericPrice.toFixed(2)}`;
}

export function ordinal(i: number) {
  if (i < 10 && i > 0) return ordinalsLessThan10[i];

  const j = i % 10;
  const k = i % 100;

  if (j === 1 && k !== 11) return `${i}st`;
  if (j === 2 && k !== 12) return `${i}nd`;
  if (j === 3 && k !== 13) return `${i}rd`;

  return `${i}th`;
}

export function getAllStrings(arg: any): Array<string> {
  if (typeof arg === 'string') {
    return [arg];
  }

  // handle wrong types and null
  if (typeof arg !== 'object' || !arg) {
    return [];
  }

  return Object.keys(arg).reduce((acc: Array<string>, key: string) => {
    return [...acc, ...getAllStrings(arg[key])];
  }, []);
};

export function alphaSort(key?: string) {
  return (a: string | object, b: string | object) => {
    let valueA: string = '';
    let valueB: string = '';

    // .sort((a, b) => a.label.localeCompare(b.label)),
    if (key && typeof a === 'object' && typeof b === 'object') {
      valueA = getFromPath(a, key, '');
      valueB = getFromPath(b, key, '');
    }

    if (!key && typeof a === 'string' && typeof b === 'string') {
      valueA = a;
      valueB = b;
    }

    return valueA.localeCompare(valueB);
  };
}
