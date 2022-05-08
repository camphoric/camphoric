import React from 'react';
import { useParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import api from 'store/api';

export default api;

type CtxId = string | number;
type UrlParams = {
  eventId?: string;
  organizationId?: string;
}

export type RegistrationLookup = {
  [id: string]: AugmentedRegistration,
}

export type CamperLookup = {
  [id: string]: ApiCamper,
}

export type ReportLookup = {
  [id: string]: ApiReport,
}

export function useEvent() {
  const { eventId } = useParams<UrlParams>();
  const event = api.useGetEventByIdQuery(eventId || 0);

  return event;
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


/**
 * HOOKS FOR ApiRegistrations
 */

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
};

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

/**
 * HOOKS FOR ApiCampers
 */

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
const camperSearchOptions = {
  ...basicSearchOptions,
  keys: [
    'attributes.last_name',
    'attributes.first_name',
    'attributes.accommodations.accommodation_preference',
    'attributes.accommodations.camp_preference',
  ]
};

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

/**
 * HOOKS FOR ApiReports
 */

const createReportLookup =
  (reports: Array<ApiReport>, eventId: CtxId): ReportLookup => {
    const eventIdStr = eventId.toString();

    return reports
      .filter(r => r.event.toString() === eventIdStr)
      .reduce(
        (acc, c) => ({
          ...acc,
          [c.id]: c,
        }),
        {},
      );
  };

export function useReportLookup(): ReportLookup | undefined {
  const { data: reports } = api.useGetReportsQuery();
  const { eventId } = useParams<UrlParams>();

  const [lookup, setLookup] = React.useState<ReportLookup>();

  React.useEffect(() => {
    if (!reports) return;
    if (!eventId) return;

    const result = createReportLookup(reports, eventId);

    setLookup(result);
  }, [reports, eventId]);

  return lookup;
}

export type ReportSearch = Fuse<ApiReport>;
const reportSearchOptions = {
  ...basicSearchOptions,
  keys: [
    'attributes.last_name',
    'attributes.first_name',
    'attributes.accommodations.accommodation_preference',
    'attributes.accommodations.camp_preference',
  ]
};

function createReportSearch(lookup?: ReportLookup): ReportSearch {
  const augmentedReports = Object.values(lookup || {});

  return new Fuse<ApiReport>(
    augmentedReports,
    reportSearchOptions,
  );
}

export function useReportSearch(): ReportSearch | undefined {
  const reportLookup = useReportLookup();

  const [search, setSearch] = React.useState<ReportSearch>();

  React.useEffect(() => {
    setSearch(createReportSearch(reportLookup));
  }, [reportLookup]);

  return search;
}

export function useOrganization() {
  const { organizationId } = useParams<UrlParams>();
  const organization = api.useGetOrganizationByIdQuery(organizationId || 0);

  return organization;
}

export function useUrlParams() {
  return useParams<UrlParams>();
}
