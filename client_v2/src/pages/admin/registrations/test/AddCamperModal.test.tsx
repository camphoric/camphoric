import userEvent from '@testing-library/user-event';
import type { ApiEvent } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddCamperModal } from '../AddCamperModal';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('store/entities', () => ({
  camperHooks: { useCreate: () => ({ mutate: create, isPending: false }) },
}));

const event = {
  pricing: {},
  registration_error_messages: {},
  registration_ui_schema: {},
  registration_schema: {
    definitions: {
      address: { type: 'object', properties: { city: { type: 'string', title: 'City' } } },
    },
  },
  camper_schema: {
    type: 'object',
    required: ['first_name'],
    properties: {
      first_name: { type: 'string', title: 'First name' },
      last_name: { type: 'string', title: 'Last name' },
      address: { title: 'Address', $ref: '#/definitions/address' },
    },
  },
} as unknown as ApiEvent;

function setup() {
  renderWithProviders(
    <AddCamperModal event={event} registrationId={5} sequence={2} opened onClose={vi.fn()} />,
  );
  return userEvent.setup();
}

beforeEach(() => create.mockClear());

describe('AddCamperModal', () => {
  it('adds the camper to the end of the registration', async () => {
    const user = setup();
    await user.type(screen.getByRole('textbox', { name: /First name/ }), 'Robin');
    await user.type(screen.getByRole('textbox', { name: 'City' }), 'Albany');
    await user.click(screen.getByRole('button', { name: 'Add camper' }));
    expect(create).toHaveBeenCalledWith(
      {
        registration: 5,
        attributes: { first_name: 'Robin', address: { city: 'Albany' } },
        admin_attributes: {},
        sequence: 2,
      },
      expect.anything(),
    );
  });

  it('asks for what’s required first', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Add camper' }));
    expect(create).not.toHaveBeenCalled();
  });
});
