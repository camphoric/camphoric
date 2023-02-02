/**
 * These functions are used for quickly displaying info that a user might need
 */
import { LodgingLookup } from 'hooks/api';
import getFromPath from 'lodash/get';

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
