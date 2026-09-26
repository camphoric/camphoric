/** A representative recipient-field catalog (as GET …/email/recipient-fields returns it). */

import type { EmailRecipientField } from 'api-types';

export const recipientFields: EmailRecipientField[] = [
  {
    key: 'registration.registrant_email',
    label: 'Registrant email',
    group: 'Registration',
    type: 'string',
  },
  {
    key: 'registration.registration_type.label',
    label: 'Registration type',
    group: 'Registration',
    type: 'enum',
    options: [
      { value: 'Staff', label: 'Staff' },
      { value: 'Scholarship', label: 'Scholarship' },
    ],
  },
  { key: 'registration.created_at', label: 'Registered on', group: 'Registration', type: 'date' },
  { key: 'registration.balance', label: 'Balance', group: 'Registration', type: 'number' },
  { key: 'registration.completed', label: 'Completed', group: 'Registration', type: 'boolean' },
  {
    key: 'camper.attributes.meals',
    label: 'Meals',
    group: 'Camper answers',
    type: 'enum',
    options: [
      { value: 'Omnivore', label: 'Omnivore' },
      { value: 'Vegetarian', label: 'Vegetarian' },
      { value: 'Vegan', label: 'Vegan' },
    ],
  },
  {
    key: 'camper.attributes.instruments',
    label: 'Instruments',
    group: 'Camper answers',
    type: 'list',
    options: [
      { value: 'Fiddle', label: 'Fiddle' },
      { value: 'Guitar', label: 'Guitar' },
    ],
  },
  { key: 'camper.attributes.age', label: 'Age', group: 'Camper answers', type: 'number' },
  { key: 'camper.lodging.name', label: 'Lodging', group: 'Camper', type: 'string' },
];
