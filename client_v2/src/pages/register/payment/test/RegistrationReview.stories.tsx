/**
 * Ladle story for RegistrationReview (SPEC §7.2): the read-only rundown shown
 * above the payment options, with enum/boolean/array/nested values and the
 * per-section pricing summaries. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import type { ApiRegister } from 'api-types';

import { RegistrationReview } from '../RegistrationReview';

const config: ApiRegister = {
  dataSchema: {
    definitions: {
      address: {
        type: 'object',
        properties: {
          street: { type: 'string', title: 'Street' },
          city: { type: 'string', title: 'City' },
          state: { type: 'string', title: 'State' },
        },
      },
      camper: {
        type: 'object',
        properties: {
          first_name: { type: 'string', title: 'First name' },
          last_name: { type: 'string', title: 'Last name' },
          age: {
            type: 'string',
            title: 'Age (at the beginning of camp)',
            enum: ['0-2', '3-12', '13-17', '18+'],
          },
          email: { type: 'string', title: 'Camper email', format: 'email' },
          emergency_contact: {
            type: 'object',
            title: 'Emergency contact',
            properties: {
              name: { type: 'string', title: 'Full name' },
              phone: { type: 'string', title: 'Phone number' },
            },
          },
          attendance: {
            type: 'array',
            title: 'When will you attend?',
            items: { type: 'string', enum: ['Fri', 'Sat', 'Sun'] },
          },
          meal_type: { type: 'string', title: 'Meals', enum: ['Omnivore', 'Vegetarian', 'Vegan'] },
          linens: { type: 'boolean', title: 'Linens rental' },
          first_time: { type: 'boolean', title: 'Is this your first time?' },
          driving: { type: 'string', title: 'Driving?', enum: ['Driver', 'Passenger'] },
          lodging: {
            type: 'object',
            title: 'Lodging',
            properties: {
              lodging_requested: { type: 'object', title: 'Requested lodging' },
              lodging_shared: { type: 'boolean', title: 'Sharing with someone?' },
              lodging_shared_with: { type: 'string', title: 'Sharing with' },
            },
          },
          campership_request: { type: 'integer', title: 'Campership request' },
        },
        dependencies: {
          driving: {
            allOf: [
              {
                if: { properties: { driving: { const: 'Driver' } } },
                then: { properties: { license_plate: { type: 'string', title: 'License plate' } } },
              },
            ],
          },
        },
      },
    },
    type: 'object',
    properties: {
      registrant_email: { type: 'string', title: 'Registrant email' },
      address: { title: 'Main address', $ref: '#/definitions/address' },
      membership: { type: 'string', title: 'Membership', enum: ['member', 'non'] },
      campership_donation: { type: 'integer', title: 'Campership donation' },
      comments: { type: 'string', title: 'Comments' },
      campers: { type: 'array', items: { $ref: '#/definitions/camper' } },
    },
  },
  uiSchema: {
    'ui:order': [
      'registrant_email',
      'address',
      'campers',
      'membership',
      'campership_donation',
      'comments',
    ],
    membership: { 'ui:enumNames': { member: 'Current member', non: 'Not a member' } },
    campers: {
      items: {
        first_time: { 'ui:enumNames': { true: 'Yes', false: 'No' } },
        age: {
          'ui:enumNames': {
            '0-2': '0–2 years old',
            '3-12': '3–12 years old',
            '13-17': '13–17 years old',
            '18+': 'Adult',
          },
        },
        'ui:order': [
          'first_name',
          'last_name',
          'age',
          'email',
          'emergency_contact',
          'attendance',
          'driving',
          'license_plate',
          'lodging',
          '*',
        ],
        lodging: { lodging_requested: { 'ui:field': 'LodgingRequested' } },
      },
    },
  },
  preSubmitTemplate: '',
  templateVars: {},
  event: { is_open: true, epayment_handling: 3 },
  pricing: {},
  pricingLogic: {
    registration: [
      { var: 'campership_donation', exp: 0, label: 'Campership donation' },
      { var: 'total', exp: 0 },
    ],
    camper: [
      { var: 'tuition', exp: 0, label: 'Tuition' },
      { var: 'linens', exp: 0, label: 'Linens' },
      { var: 'campership', exp: 0, label: 'Campership' },
      { var: 'total', exp: 0 },
    ],
  },
};

const registration = {
  registrant_email: 'bob@example.com',
  address: { street: '1234 Easy St', city: 'Berkeley', state: 'CA' },
  membership: 'member',
  campership_donation: 25,
  comments: 'We will arrive Friday after dinner.',
  campers: [
    {
      first_name: 'Bob',
      last_name: 'Ross',
      age: '18+',
      email: 'bob@example.com',
      emergency_contact: { name: 'Jane Ross', phone: '+1 555 398 5678' },
      attendance: ['Fri', 'Sat', 'Sun'],
      meal_type: 'Vegetarian',
      linens: true,
      first_time: false,
      driving: 'Driver',
      license_plate: 'HAPPY1',
      lodging: {
        lodging_requested: { choices: [1, 3, 9], id: 9, name: 'Cabin 4' },
        lodging_shared: true,
        lodging_shared_with: 'Jane Ross',
      },
    },
    {
      first_name: 'Jane',
      last_name: 'Ross',
      age: '18+',
      attendance: ['Sat', 'Sun'],
      meal_type: 'Omnivore',
      linens: false,
      first_time: true,
      driving: 'Passenger',
      lodging: { lodging_requested: { choices: [1, 3, 9], id: 9, name: 'Cabin 4' } },
      campership_request: 100,
    },
  ],
};

const results = {
  total: 660.5,
  handling: 19.5,
  campership_donation: 25,
  tuition: 700,
  linens: 16,
  campership: -100,
  campers: [
    { tuition: 400, linens: 16, campership: 0, total: 416 },
    { tuition: 300, linens: 0, campership: -100, total: 200 },
  ],
};

/** Two campers, nested groups, conditional fields and per-section fee summaries. */
export const Review: Story = () => (
  <Stack maw={720} p="md">
    <RegistrationReview config={config} registration={registration} results={results} />
  </Stack>
);

/** A bare registration with a single camper and no fee lines besides the total. */
export const Minimal: Story = () => (
  <Stack maw={720} p="md">
    <RegistrationReview
      config={{ ...config, pricingLogic: { registration: [], camper: [] } }}
      registration={{ registrant_email: 'solo@example.com', campers: [{ first_name: 'Solo' }] }}
      results={{ total: 400, campers: [{ total: 400 }] }}
    />
  </Stack>
);
