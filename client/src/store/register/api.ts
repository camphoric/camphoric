// Need to use the React-specific entry point to allow generating React hooks
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getCsrfToken } from 'utils/fetch';
import { matchPath } from 'react-router-dom';
import { registerUrl } from 'navigation/RouterConfig';
import { FormData, PricingResults }from 'components/JsonSchemaForm';
import type { OrderResponseBody } from '@paypal/paypal-js';

export type PaymentType = 'Check' | 'PayPal' | 'Card';
export type DepositType = string;
export type InitialPaymentBody = {
  registrationUUID: string,
  paymentType: PaymentType,
  paymentData: {
    type: DepositType,
    total: number,
    [a: string]: any,
  },
  payPalResponse?: OrderResponseBody,
}

const apiObjectNames = [
  'Register',
] as const;

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/events',
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      headers.set('X-CSRFToken', getCsrfToken());

      return headers;
    },
  }),
  tagTypes: apiObjectNames,
  endpoints: (builder) => {
    const getEventId = () => {
      const p = matchPath<{ eventId: string }>(
        window.location.pathname,
        { path: registerUrl },
      );

      return p?.params?.eventId;
    };

    return ({
      getRegistration: builder.query<ApiRegister, void>({
        query: () => {
          const eventId = getEventId();

          return `${eventId}/register${window.location.search}`;
        },
      }),

      createRegistration: builder.mutation<
        ApiRegisterPaymentStep,
        {
          formData: FormData,
          pricingResults: PricingResults,
          invitation?: ApiRegister['invitation'],
        }
      >({
        // note: an optional `queryFn` may be used in place of `query`
        query: (body) => {
          const eventId = getEventId();

          return {
            url: `${eventId}/register`,
            method: 'POST',
            body: {
              step: 'registration',
              ...body,
            },
          }
        },
      }),

      createInitialPayment: builder.mutation<
        ApiRegisterConfirmationStep,
        InitialPaymentBody
      >({
        // note: an optional `queryFn` may be used in place of `query`
        query: (body) => {
          const eventId = getEventId();

          return {
            url: `${eventId}/register`,
            method: 'POST',
            body: {
              step: 'payment',
              ...body,
            },
          }
        },
      }),


      getCurrentUser: builder.query<ApiUser, void>({
        query: () => 'user/',
      }),
    });
  },
});

export default api;
