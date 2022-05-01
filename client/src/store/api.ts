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
  tagTypes: ['Event'],
  // REMEMBER: our api needs trailing slashes
  endpoints: (builder) => ({
    /** /api/organizations */
    getOrganizations: builder.query<[ApiOrganization], void>({
      query: () => 'organizations/',
    }),
    getOrganizationById: builder.query<ApiOrganization, Scalar>({
      query: (id) => `organizations/${id}/`,
    }),

    /** /api/events */
    getEvents: builder.query<[ApiEvent], void>({
      query: () => 'events/',
    }),
    getEventById: builder.query<ApiEvent, Scalar>({
      providesTags: (result, error, id) => [{ type: 'Event', id }],
      query: (id) => `events/${id}/`,
    }),

    updateEvent: builder.mutation<ApiEvent, Partial<ApiEvent> & Pick<ApiEvent, 'id'>>({
      // note: an optional `queryFn` may be used in place of `query`
      query: ({ id, ...patch }) => ({
        url: `events/${id}/`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: ['Event'],
    }),

    /** /api/registrations */
    getRegistrations: builder.query<[ApiRegistration], void>({
      query: () => 'registrations/',
    }),
    getRegistrationById: builder.query<ApiRegistration, Scalar>({
      query: (id) => `registrations/${id}/`,
    }),

    /** /api/registrationtypes */
    getRegistrationTypes: builder.query<[ApiRegistrationType], void>({
      query: () => 'registrationtypes/',
    }),
    getRegistrationTypeById: builder.query<ApiRegistrationType, Scalar>({
      query: (id) => `registrationtypes/${id}/`,
    }),

    /** /api/reports */
    getReports: builder.query<[ApiReport], void>({
      query: () => 'reports/',
    }),
    getReportById: builder.query<ApiReport, Scalar>({
      query: (id) => `reports/${id}/`,
    }),

    /** /api/invitations */
    getInvitations: builder.query<[ApiInvitation], void>({
      query: () => 'invitations/',
    }),
    getInvitationById: builder.query<ApiInvitation, Scalar>({
      query: (id) => `invitations/${id}/`,
    }),

    /** /api/lodgings */
    getLodgings: builder.query<[ApiLodging], void>({
      query: () => 'lodgings/',
    }),
    getLodgingById: builder.query<ApiLodging, Scalar>({
      query: (id) => `lodgings/${id}/`,
    }),

    /** /api/campers */
    getCampers: builder.query<[ApiCamper], void>({
      query: () => 'campers/',
    }),
    getCamperById: builder.query<ApiCamper, Scalar>({
      query: (id) => `campers/${id}/`,
    }),

    /** /api/deposits */
    getDeposits: builder.query<[ApiDeposit], void>({
      query: () => 'deposits/',
    }),
    getDepositById: builder.query<ApiDeposit, Scalar>({
      query: (id) => `deposits/${id}/`,
    }),

    /** /api/payments */
    getPayments: builder.query<[ApiPayment], void>({
      query: () => 'payments/',
    }),
    getPaymentById: builder.query<ApiPayment, Scalar>({
      query: (id) => `payments/${id}/`,
    }),

    /** /api/users */
    getUsers: builder.query<[ApiUser], void>({
      query: () => 'users/',
    }),
    getUserById: builder.query<ApiUser, Scalar>({
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
//   useUpdateEventMutation,
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
