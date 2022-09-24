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

