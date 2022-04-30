// Need to use the React-specific entry point to allow generating React hooks
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getCsrfToken } from 'utils/fetch';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      headers.set('X-CSRFToken', getCsrfToken());

      return headers;
    },
  }),
  // REMEMBER: our api needs trailing slashes
  endpoints: (builder) => ({
    /** /api/organizations */
    getOrganizations: builder.query<[ApiOrganization], void>({
      query: () => 'organizations/',
    }),
    getOrganizationById: builder.query<ApiOrganization, number>({
      query: (id) => `organizations/${id}/`,
    }),

    /** /api/events */
    getEvents: builder.query<[ApiEvent], void>({
      query: () => 'events/',
    }),
    getEventById: builder.query<ApiEvent, number>({
      query: (id) => `events/${id}/`,
    }),

    /** /api/registrations */
    getRegistrations: builder.query<[ApiRegistration], void>({
      query: () => 'registraions/',
    }),
    getRegistrationById: builder.query<ApiRegistration, number>({
      query: (id) => `registraions/${id}/`,
    }),

    /** /api/registrationtypes */
    getRegistrationTypes: builder.query<[ApiRegistrationType], void>({
      query: () => 'registrationtypes/',
    }),
    getRegistrationTypeById: builder.query<ApiRegistrationType, number>({
      query: (id) => `registrationtypes/${id}/`,
    }),

    /** /api/reports */
    getReports: builder.query<[ApiReport], void>({
      query: () => 'reports/',
    }),
    getReportById: builder.query<ApiReport, number>({
      query: (id) => `reports/${id}/`,
    }),

    /** /api/invitations */
    getInvitations: builder.query<[ApiInvitation], void>({
      query: () => 'invitations/',
    }),
    getInvitationById: builder.query<ApiInvitation, number>({
      query: (id) => `invitations/${id}/`,
    }),

    /** /api/lodgings */
    getLodgings: builder.query<[ApiLodging], void>({
      query: () => 'lodgings/',
    }),
    getLodgingById: builder.query<ApiLodging, number>({
      query: (id) => `lodgings/${id}/`,
    }),

    /** /api/campers */
    getCampers: builder.query<[ApiCamper], void>({
      query: () => 'campers/',
    }),
    getCamperById: builder.query<ApiCamper, number>({
      query: (id) => `campers/${id}/`,
    }),

    /** /api/deposits */
    getDeposits: builder.query<[ApiDeposit], void>({
      query: () => 'deposits/',
    }),
    getDepositById: builder.query<ApiDeposit, number>({
      query: (id) => `deposits/${id}/`,
    }),

    /** /api/payments */
    getPayments: builder.query<[ApiPayment], void>({
      query: () => 'payments/',
    }),
    getPaymentById: builder.query<ApiPayment, number>({
      query: (id) => `payments/${id}/`,
    }),

    /** /api/users */
    getUsers: builder.query<[ApiUser], void>({
      query: () => 'users/',
    }),
    getUserById: builder.query<ApiUser, number>({
      query: (id) => `users/${id}/`,
    }),

    /** /api/user */
    getCurrentUser: builder.query<ApiUser, void>({
      query: () => 'user/',
    }),
  }),
});

// Export hooks for usage in function components, which are
// auto-generated based on the defined endpoints
// export const {
//   useGetOrganizationsQuery,
//   useGetOrganizationByIdQuery,
// } = api;

export default api;

/**
 * another way to get a single organization by id
 * 
 * const id = 1; // Id of org we're going to look for
 * const { organization } = api.useGetOrganizationsQuery(undefined, {
 *   selectFromResult: ({ data }) => ({
 *     organization: data?.find((o) => o.id === id),
 *   }),
 * });
 */
