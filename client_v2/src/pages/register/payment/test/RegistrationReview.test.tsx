import type { UiSchema } from '@rjsf/utils';
import type { JSONSchema7 } from 'json-schema';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { RegistrationReview, reviewItems } from '../RegistrationReview';

const dataSchema: JSONSchema7 = {
  definitions: {
    address: {
      type: 'object',
      title: 'Address',
      properties: {
        street: { type: 'string', title: 'Street' },
        city: { type: 'string', title: 'City' },
      },
    },
    camper: {
      type: 'object',
      properties: {
        first_name: { type: 'string', title: 'First name' },
        last_name: { type: 'string', title: 'Last name' },
        age: { type: 'string', title: 'Age', enum: ['a', 'c'] },
        linens: { type: 'boolean', title: 'Linens rental' },
        first_time: { type: 'boolean', title: 'First time?' },
        meals: {
          type: 'array',
          title: 'Dietary needs',
          items: { type: 'string', enum: ['gf', 'df'] },
        },
        driving: { type: 'string', title: 'Driving?', enum: ['Driver', 'Passenger'] },
        lodging: {
          type: 'object',
          title: 'Lodging',
          properties: { lodging_requested: { type: 'object', title: 'Requested lodging' } },
        },
        secret: { type: 'string', title: 'Secret' },
        private_room: { type: 'boolean', title: 'Private room' },
        shirt: { type: 'string', title: 'Shirt', enum: ['s', 'l'] },
        payment_plan: {
          type: 'string',
          title: 'Payment plan',
          oneOf: [
            { const: 'full', title: 'Pay in full' },
            { const: 'split', title: 'Two installments' },
          ],
        },
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
    } as JSONSchema7,
  },
  type: 'object',
  properties: {
    registrant_email: { type: 'string', title: 'Registrant email' },
    comments: { type: 'string', title: 'Comments' },
    address: { title: 'Main address', $ref: '#/definitions/address' },
    donation: { type: 'integer', title: 'Campership donation' },
    campers: { type: 'array', items: { $ref: '#/definitions/camper' } },
  },
};

const uiSchema: UiSchema = {
  'ui:order': ['registrant_email', 'address', '*', 'comments'],
  campers: {
    items: {
      'ui:order': ['first_name', 'last_name', 'age', 'driving', 'license_plate', '*'],
      secret: { 'ui:widget': 'hidden' },
      age: { 'ui:enumNames': { a: 'Adult', c: 'Child' } },
      first_time: { 'ui:enumNames': { true: 'Yes, first time', false: 'No, returning' } },
      meals: { 'ui:enumNames': ['Gluten free', 'Dairy free'] },
      private_room: {
        'ui:enumNames': { false: 'No, shared is fine', true: 'Yes, a private room' },
      },
      shirt: { 'ui:enumNames': ['Small', 'Large'] },
      lodging: { lodging_requested: { 'ui:field': 'LodgingRequested' } },
    },
  },
};

const config = makeRegisterConfig({
  dataSchema,
  uiSchema,
  pricingLogic: {
    registration: [
      { var: 'donation', exp: { var: 'registration.donation' }, label: 'Campership donation' },
      { var: 'total', exp: 0 },
    ],
    camper: [
      { var: 'tuition', exp: 0, label: 'Tuition' },
      { var: 'total', exp: 0 },
    ],
  },
});

const registration = {
  registrant_email: 'pat@example.com',
  comments: 'Arriving late',
  address: { street: '1 Main St', city: 'Berkeley' },
  donation: 25,
  campers: [
    {
      first_name: 'Pat',
      last_name: 'Camper',
      age: 'a',
      linens: true,
      first_time: false,
      meals: ['gf', 'df'],
      driving: 'Driver',
      license_plate: 'ABC123',
      lodging: { lodging_requested: { choices: [1, 4], id: 4, name: 'Cabin A' } },
      secret: 'hide me',
      payment_plan: 'split',
      private_room: true,
      shirt: 'l',
    },
    { first_name: 'Sam', age: 'c', driving: 'Passenger', meals: [] },
  ],
};

const results = {
  total: 475,
  donation: 25,
  tuition: 450,
  campers: [
    { tuition: 300, total: 300 },
    { tuition: 150, total: 150 },
  ],
};

describe('reviewItems', () => {
  const camperUi = (uiSchema.campers as { items: UiSchema }).items;
  const camperSchema = (dataSchema.properties!.campers as JSONSchema7).items as JSONSchema7;

  it('labels rows from the schema, maps enums/booleans/arrays and follows ui:order', () => {
    const items = reviewItems(camperSchema, camperUi, registration.campers[0], dataSchema);
    expect(items.map((item) => [item.label, item.text])).toEqual([
      ['First name', 'Pat'],
      ['Last name', 'Camper'],
      ['Age', 'Adult'],
      ['Driving?', 'Driver'],
      ['License plate', 'ABC123'],
      ['Linens rental', 'Yes'],
      ['First time?', 'No, returning'],
      ['Dietary needs', 'Gluten free, Dairy free'],
      ['Lodging', undefined],
      ['Private room', 'Yes, a private room'],
      ['Shirt', 'Large'],
      ['Payment plan', 'Two installments'],
    ]);
    // The lodging group shows the requested lodging's name; the hidden widget is skipped.
    expect(items.find((item) => item.label === 'Lodging')?.children).toEqual([
      { label: 'Requested lodging', text: 'Cabin A' },
    ]);
    expect(items.some((item) => item.label === 'Secret')).toBe(false);
  });

  it('omits empty values and conditional fields whose condition is not met', () => {
    const items = reviewItems(camperSchema, camperUi, registration.campers[1], dataSchema);
    expect(items.map((item) => item.label)).toEqual(['First name', 'Age', 'Driving?']);
  });

  it('resolves $ref groups and honours ui:order with a wildcard at the top level', () => {
    const items = reviewItems(dataSchema, uiSchema, registration, dataSchema, ['campers']);
    expect(items.map((item) => item.label)).toEqual([
      'Registrant email',
      'Main address',
      'Campership donation',
      'Comments',
    ]);
    expect(items[1].children).toEqual([
      { label: 'Street', text: '1 Main St' },
      { label: 'City', text: 'Berkeley' },
    ]);
  });
});

describe('RegistrationReview', () => {
  it('renders a registration section and one per camper, each with its pricing summary', () => {
    renderWithProviders(
      <RegistrationReview config={config} registration={registration} results={results} />,
    );

    expect(screen.getByRole('heading', { name: 'Review registration' })).toBeInTheDocument();

    const registrationSection = screen.getByRole('heading', { name: 'Registration' })
      .parentElement as HTMLElement;
    expect(within(registrationSection).getByText('pat@example.com')).toBeInTheDocument();
    // "Campership donation" is both an entered field (25) and a fee line ($25.00).
    expect(within(registrationSection).getAllByText('Campership donation')).toHaveLength(2);
    expect(within(registrationSection).getByText('25')).toBeInTheDocument();
    expect(within(registrationSection).getByText('$25.00')).toBeInTheDocument();
    expect(within(registrationSection).getByText('Total')).toBeInTheDocument();
    expect(within(registrationSection).getByText('$475.00')).toBeInTheDocument();
    // Camper-level components are not repeated at the registration level.
    expect(within(registrationSection).queryByText('Tuition')).not.toBeInTheDocument();

    const first = screen.getByRole('heading', { name: '1st Camper — Pat Camper' })
      .parentElement as HTMLElement;
    expect(within(first).getByText('Tuition')).toBeInTheDocument();
    // Tuition and the camper total are both $300.00 for this camper.
    expect(within(first).getAllByText('$300.00')).toHaveLength(2);
    expect(within(first).getByText('Camper total')).toBeInTheDocument();

    const second = screen.getByRole('heading', { name: '2nd Camper — Sam' })
      .parentElement as HTMLElement;
    expect(within(second).getAllByText('$150.00')).toHaveLength(2);
  });
});
