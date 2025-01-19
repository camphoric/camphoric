// Need to use the React-specific entry point to allow generating React hooks
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getCsrfToken } from 'utils/fetch';
import { factory } from '../utils';

const apiObjectNames = [
  'Organization',
  'Event',
  'Registration',
  'RegistrationType',
  'Report',
  'RenderedReport',
  'Invitation',
  'Lodging',
  'Camper',
  'Deposit',
  'Payment',
  'CustomCharge',
  'CustomChargeType',
  'User',
  'WhoAmI',
] as const;

type ApiObjectName = typeof apiObjectNames[number];

type LoginCreds = {
  username: string,
  password: string,
};

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
    const {
      getCreator,
      getByIdCreator,
      updateCreator,
      createCreator,
      deleteCreator,
    } = factory<ApiObjectName, typeof builder>(builder);

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

      /** /api/customchargetypes*/
      getCustomChargeTypes: getCreator<ApiCustomChargeType>('CustomChargeType'),
      getCustomChargeTypeById: getByIdCreator<ApiCustomChargeType>('CustomChargeType'),
      updateCustomChargeType: updateCreator<ApiCustomChargeType>('CustomChargeType'),
      createCustomChargeType: createCreator<ApiCustomChargeType>('CustomChargeType'),
      deleteCustomChargeType: deleteCreator<ApiCustomChargeType>('CustomChargeType'),

      /** /api/customcharges */
      getCustomCharges: getCreator<ApiCustomCharge>('CustomCharge'),
      updateCustomCharge: updateCreator<ApiCustomCharge>('CustomCharge', ['CustomCharge', 'Registration', 'Camper']),
      createCustomCharge: createCreator<ApiCustomCharge>('CustomCharge', ['CustomCharge', 'Registration', 'Camper']),
      deleteCustomCharge: deleteCreator<ApiCustomCharge>('CustomCharge', ['CustomCharge', 'Registration', 'Camper']),
      getCustomChargesByCamper: builder.query<ApiCustomCharge, ApiCamper>({
        query: (arg: ApiCamper) => ({
          url: `customcharges/${arg.id}`,
          method: 'GET',
        }),
        providesTags: ['CustomCharge'],
      }),

      /** /api/registrations */
      getRegistrations: getCreator<ApiRegistration>('Registration'),
      getRegistrationById: getByIdCreator<ApiRegistration>('Registration'),
      updateRegistration: updateCreator<ApiRegistration>(
        'Registration',
        ['Registration', 'Camper'],
      ),
      createRegistration: createCreator<ApiRegistration>(
        'Registration',
        ['Registration', 'Camper'],
      ),
      deleteRegistration: deleteCreator<ApiRegistration>(
        'Registration',
        ['Registration', 'Camper'],
      ),

      /** /api/registrationtypes */
      getRegistrationTypes: getCreator<ApiRegistrationType>('RegistrationType'),
      getRegistrationTypeById: getByIdCreator<ApiRegistrationType>('RegistrationType'),
      updateRegistrationType: updateCreator<ApiRegistrationType>('RegistrationType'),
      createRegistrationType: createCreator<ApiRegistrationType>('RegistrationType'),
      deleteRegistrationType: deleteCreator<ApiRegistrationType>('RegistrationType'),

      /** /api/reports */
      getReports: getCreator<ApiReport>('Report'),
      getReportById: getByIdCreator<ApiReport>('Report'),
      updateReport: updateCreator<ApiReport>('Report', ['Report', 'RenderedReport']),
      createReport: createCreator<ApiReport>('Report', ['Report', 'RenderedReport']),
      deleteReport: deleteCreator<ApiReport>('Report', ['Report', 'RenderedReport']),
      getRenderedReport: builder.query<ApiReportRendered, { id: string | number,  [k: string]: any }>({
        query: (arg: { id: string | number,  [k: string]: any }) => {
          const { id, ...body } = arg;

          return {
            url: `reports/${id}/render`,
            method: 'POST',
            body,
          }
        },
        providesTags: ['RenderedReport'],
      }),

      /** /api/invitations */
      getInvitations: getCreator<ApiInvitation>('Invitation'),
      getInvitationById: getByIdCreator<ApiInvitation>('Invitation'),
      updateInvitation: updateCreator<ApiInvitation>('Invitation'),
      createInvitation: createCreator<ApiInvitation>('Invitation'),
      deleteInvitation: deleteCreator<ApiInvitation>('Invitation'),
      sendInvitation: builder.mutation<ApiInvitation, string | number>({
        query: (id: string | number) => ({
          url: `invitations/${id}/send`,
          method: 'POST',
        }),
        invalidatesTags: ['Invitation'],
      }),

      /** /api/lodgings */
      getLodgings: getCreator<ApiLodging>('Lodging'),
      getLodgingById: getByIdCreator<ApiLodging>('Lodging'),
      updateLodging: updateCreator<ApiLodging>('Lodging'),
      createLodging: createCreator<ApiLodging>('Lodging'),
      deleteLodging: deleteCreator<ApiLodging>('Lodging'),

      /** /api/campers */
      getCampers: getCreator<ApiCamper>('Camper'),
      getCamperById: getByIdCreator<ApiCamper>('Camper'),
      updateCamper: updateCreator<ApiCamper>(
        'Camper',
        ['Camper', 'Registration'],
      ),
      createCamper: createCreator<ApiCamper>(
        'Camper',
        ['Camper', 'Registration'],
      ),
      deleteCamper: deleteCreator<ApiCamper>(
        'Camper',
        ['Camper', 'Registration'],
      ),

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
        query: () => 'user',
        providesTags: ['WhoAmI'],
      }),
      login: builder.mutation<ApiUser, LoginCreds>({
        query: (body: LoginCreds) => {

          return {
            url: 'login',
            method: 'POST',
            body,
          };
        },
        invalidatesTags: ['WhoAmI'],
      }),
    });
  },
});

export default api;
