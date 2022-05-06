// Need to use the React-specific entry point to allow generating React hooks
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { EndpointBuilder } from '@reduxjs/toolkit/dist/query/endpointDefinitions';
import { getCsrfToken } from 'utils/fetch';

const apiObjectNames = [
  'Organization',
  'Event',
  'Registration',
  'RegistrationType',
  'Report',
  'Invitation',
  'Lodging',
  'Camper',
  'Deposit',
  'Payment',
  'User',
] as const;

/**
 * I tried doing the creating of basic CRUD creation like this, but I was
 * defeated by typescript
 *
 * function createBasicEndpoints<R extends { id: Scalar }> (
 *   apiObjectName: typeof apiObjectNames[number],
 *   builder: EndpointBuilder<any, any, any>,
 * ) {
 *   const apiName = apiObjectName.toLowerCase();
 *   return {
 *     [`get${apiName}s` as const]: builder.query<[R], void>({
 *       query: () => 'events/',
 *     }),
 *     [`get${apiObjectName}ById` as const]: builder.query<R, Scalar>({
 *       providesTags: (result, error, id) => [{ type: apiObjectName, id }],
 *       query: (id) => `${apiName}s/${id}/`,
 *     }),
 *     [`update${apiObjectName}` as const]: builder.mutation<R, Partial<R> & Pick<R, 'id'>>({
 *       // note: an optional `queryFn` may be used in place of `query`
 *       query: ({ id, ...patch }) => ({
 *         url: `${apiName}s/${id}/`,
 *         method: 'PATCH',
 *         body: patch,
 *       }),
 *       invalidatesTags: [apiObjectName],
 *     }),
 *   };
 * }
 */

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
  tagTypes: apiObjectNames,
  // REMEMBER: our api needs trailing slashes
  endpoints: (builder) => {
    const getCreator = <R>(apiObjectName: typeof apiObjectNames[number]) =>
      builder.query<[R], void>({
        query: () => `${apiObjectName.toLowerCase()}s/`,
        providesTags: [apiObjectName],
      });
    const getByIdCreator = <R>(apiObjectName: typeof apiObjectNames[number]) =>
      builder.query<[R], Scalar>({
        query: (id) => `${apiObjectName.toLowerCase()}s/${id}/`,
        providesTags: (result, error, id) => [{ type: apiObjectName, id }],
      });
    const updateCreator = <R extends { id: Scalar }>(apiObjectName: typeof apiObjectNames[number]) =>
      builder.mutation<R, Partial<R> & Pick<R, 'id'>>({
        // note: an optional `queryFn` may be used in place of `query`
        query: ({ id, ...patch }) => ({
          url: `${apiObjectName.toLowerCase()}s/${id}/`,
          method: 'PATCH',
          body: patch,
        }),
        invalidatesTags: [apiObjectName],
      });
    const createCreator = <R extends {}>(apiObjectName: typeof apiObjectNames[number]) =>
      builder.mutation<
        R,
        Omit<R, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
      >({
        // note: an optional `queryFn` may be used in place of `query`
        query: (body) => ({
          url: `${apiObjectName.toLowerCase()}s/`,
          method: 'POST',
          body,
        }),
        invalidatesTags: [apiObjectName],
      });
    const deleteCreator = <R extends { id: Scalar }>(apiObjectName: typeof apiObjectNames[number]) =>
      builder.mutation<R, { id: Scalar }>({
        // note: an optional `queryFn` may be used in place of `query`
        query: ({ id }) => ({
          url: `${apiObjectName.toLowerCase()}s/${id}/`,
          method: 'DELETE',
        }),
        invalidatesTags: [apiObjectName],
      });

    return ({
      /** /api/organizations */
      getOrganizations: getCreator<ApiOrganization>('Organization'),
      getOrganizationById: getByIdCreator<ApiOrganization>('Organization'),
      updateOrganization: updateCreator<ApiOrganization>('Organization'),
      createOrganization: createCreator<ApiOrganization>('Organization'),
      deleteOrganization: deleteCreator<ApiOrganization>('Organization'),

      /** /api/events */
      getEvents: getCreator<ApiEvent>('Event'),
      getEventById: getByIdCreator<ApiEvent>('Event'),
      updateEvent: updateCreator<ApiEvent>('Event'),
      createEvent: createCreator<ApiEvent>('Event'),
      deleteEvent: deleteCreator<ApiEvent>('Event'),

      /** /api/registrations */
      getRegistrations: getCreator<ApiRegistration>('Registration'),
      getRegistrationById: getByIdCreator<ApiRegistration>('Registration'),
      updateRegistration: updateCreator<ApiRegistration>('Registration'),
      createRegistration: createCreator<ApiRegistration>('Registration'),
      deleteRegistration: deleteCreator<ApiRegistration>('Registration'),

      /** /api/registrationtypes */
      getRegistrationTypes: getCreator<ApiRegistrationType>('RegistrationType'),
      getRegistrationTypeById: getByIdCreator<ApiRegistrationType>('RegistrationType'),
      updateRegistrationType: updateCreator<ApiRegistrationType>('RegistrationType'),
      createRegistrationType: createCreator<ApiRegistrationType>('RegistrationType'),
      deleteRegistrationType: deleteCreator<ApiRegistrationType>('RegistrationType'),

      /** /api/reports */
      getReports: getCreator<ApiReport>('Report'),
      getReportById: getByIdCreator<ApiReport>('Report'),
      updateReport: updateCreator<ApiReport>('Report'),
      createReport: createCreator<ApiReport>('Report'),
      deleteReport: deleteCreator<ApiReport>('Report'),

      /** /api/invitations */
      getInvitations: getCreator<ApiInvitation>('Invitation'),
      getInvitationById: getByIdCreator<ApiInvitation>('Invitation'),
      updateInvitation: updateCreator<ApiInvitation>('Invitation'),
      createInvitation: createCreator<ApiInvitation>('Invitation'),
      deleteInvitation: deleteCreator<ApiInvitation>('Invitation'),

      /** /api/lodgings */
      getLodgings: getCreator<ApiLodging>('Lodging'),
      getLodgingById: getByIdCreator<ApiLodging>('Lodging'),
      updateLodging: updateCreator<ApiLodging>('Lodging'),
      createLodging: createCreator<ApiLodging>('Lodging'),
      deleteLodging: deleteCreator<ApiLodging>('Lodging'),

      /** /api/campers */
      getCampers: getCreator<ApiCamper>('Camper'),
      getCamperById: getByIdCreator<ApiCamper>('Camper'),
      updateCamper: updateCreator<ApiCamper>('Camper'),
      createCamper: createCreator<ApiCamper>('Camper'),
      deleteCamper: deleteCreator<ApiCamper>('Camper'),

      /** /api/deposits */
      getDeposits: getCreator<ApiDeposit>('Deposit'),
      getDepositById: getByIdCreator<ApiDeposit>('Deposit'),
      updateDeposit: updateCreator<ApiDeposit>('Deposit'),
      createDeposit: createCreator<ApiDeposit>('Deposit'),
      deleteDeposit: deleteCreator<ApiDeposit>('Deposit'),

      /** /api/payments */
      getPayments: getCreator<ApiPayment>('Payment'),
      getPaymentById: getByIdCreator<ApiPayment>('Payment'),
      updatePayment: updateCreator<ApiPayment>('Payment'),
      createPayment: createCreator<ApiPayment>('Payment'),
      deletePayment: deleteCreator<ApiPayment>('Payment'),

      /** /api/users */
      getUsers: getCreator<ApiUser>('User'),
      getUserById: getByIdCreator<ApiUser>('User'),
      updateUser: updateCreator<ApiUser>('User'),
      createUser: createCreator<ApiUser>('User'),
      deleteUser: deleteCreator<ApiUser>('User'),

      /** /api/user */
      getCurrentUser: builder.query<ApiUser, void>({
        query: () => 'user/',
      }),
    });
  },
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
