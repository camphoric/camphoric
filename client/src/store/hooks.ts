import React from 'react';
import { useParams } from 'react-router-dom';
import { createSelector } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux'
import Fuse from 'fuse.js';
import { store } from './store';
import api from './api';

type CtxId = string | number;
type UrlParams = {
  eventId?: string;
  organizationId?: string;
}

const basicSearchOptions = {
  isCaseSensitive: true,
  includeScore: true,
  shouldSort: true,
  includeMatches: true,
  // findAllMatches: false,
  minMatchCharLength: 3,
  location: 0,
  threshold: 0.6,
  distance: 100,
  // useExtendedSearch: false,
  // ignoreLocation: false,
  // ignoreFieldNorm: false,
};

const registrationSearchOptions = {
  ...basicSearchOptions,
  keys: [
    'registration_type',
    'campers.attributes.last_name',
    'campers.attributes.first_name',
    'attributes.payment.payer_last_name',
    'attributes.payment.payer_first_name',
    'attributes.payment.payer_number',
    'attributes.payment.payer_billing_address.city',
    'attributes.payment.payer_billing_address.country',
    'attributes.payment.payer_billing_address.zip_code',
    'attributes.payment.payer_billing_address.street_address',
    'attributes.payment.payer_billing_address.state_or_province',
  ]
}

const camperSearchOptions = {
  ...basicSearchOptions,
  keys: [
    'attributes.last_name',
    'attributes.first_name',
    'attributes.accommodations.accommodation_preference',
    'attributes.accommodations.camp_preference',
  ]
}

const createRegistrationLookup =
  (registrations: Array<ApiRegistration>, campers: Array<ApiCamper>, eventId: CtxId): RegistrationLookup => {
    const eventIdStr = eventId.toString();

    return registrations
      .filter(r => r.event.toString() === eventIdStr)
      .map(r => ({
        ...r,
        campers: campers.filter(
          c => c.registration.toString() === r.id.toString()
        ),
      }))
      .reduce(
        (acc, r) => ({
          ...acc,
          [r.id]: r,
        }),
        {},
      )
  }

export function useRegistrationLookup(): RegistrationLookup | undefined {
  const registrationsApi = api.useGetRegistrationsQuery();
  const campersApi = api.useGetCampersQuery();
  const { eventId } = useParams<UrlParams>();
  const [lookup, setLookup] = React.useState<RegistrationLookup>();

  React.useEffect(() => {
    if (!registrationsApi.data || !campersApi.data) return;
    if (!eventId) return;

    const result = createRegistrationLookup(registrationsApi.data, campersApi.data, eventId);

    setLookup(result);
  }, [registrationsApi, campersApi, eventId]);

  return lookup;
}

export type RegistrationSearch = Fuse<AugmentedRegistration>;

function createRegistrationSearch(lookup?: RegistrationLookup): RegistrationSearch {
  const augmentedRegistrations = Object.values(lookup || {});

  return new Fuse<AugmentedRegistration>(
    augmentedRegistrations,
    registrationSearchOptions,
  );
}

export function useRegistrationSearch(): RegistrationSearch | undefined {
  const registrationLookup = useRegistrationLookup();

  const [search, setSearch] = React.useState<RegistrationSearch>();

  React.useEffect(() => {
    setSearch(createRegistrationSearch(registrationLookup));
  }, [registrationLookup]);

  return search;
}

const createCamperLookup =
  (registrations: Array<ApiRegistration>, campers: Array<ApiCamper>, eventId: CtxId): CamperLookup => {
    const eventIdStr = eventId.toString();

    const registrationsIdsForEvent = registrations
      .filter(r => r.event.toString() === eventIdStr)
      .map(r => r.id.toString());

    return campers
      .filter(
        c => registrationsIdsForEvent.includes(c.registration.toString())
      )
      .reduce(
        (acc, c) => ({
          ...acc,
          [c.id]: c,
        }),
        {},
      );
  };

export function useCamperLookup(): CamperLookup | undefined {
  const registrationsApi = api.useGetRegistrationsQuery();
  const campersApi = api.useGetCampersQuery();
  const { eventId } = useParams<UrlParams>();

  const [lookup, setLookup] = React.useState<CamperLookup>();

  React.useEffect(() => {
    if (!registrationsApi.isSuccess || !campersApi.isSuccess) return;
    if (!eventId) return;

    const result = createCamperLookup(registrationsApi.data, campersApi.data, eventId);

    setLookup(result);
  }, [registrationsApi, campersApi, eventId]);

  return lookup;
}

export type CamperSearch = Fuse<ApiCamper>;

function createCamperSearch(lookup?: CamperLookup): CamperSearch {
  const augmentedCampers = Object.values(lookup || {});

  return new Fuse<ApiCamper>(
    augmentedCampers,
    camperSearchOptions,
  );
}

export function useCamperSearch(): CamperSearch | undefined {
  const camperLookup = useCamperLookup();

  const [search, setSearch] = React.useState<CamperSearch>();

  React.useEffect(() => {
    setSearch(createCamperSearch(camperLookup));
  }, [camperLookup]);

  return search;
}

export function useEvent() {
  const { eventId } = useParams<UrlParams>();
  const event = api.useGetEventByIdQuery(eventId || 0);

  return event;
}

export function useOrganization() {
  const { organizationId } = useParams<UrlParams>();
  const event = api.useGetOrganizationByIdQuery(organizationId || 0);

  return event;
}

export function useUrlParams() {
  return useParams<UrlParams>();
}

