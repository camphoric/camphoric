import type { RJSFSchema } from '@rjsf/utils';
import userEvent from '@testing-library/user-event';
import type { ApiEvent } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorMessagesSettings } from '../ErrorMessagesSettings';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('store/entities', () => ({
  eventHooks: { useUpdate: () => ({ mutate, isPending: false }) },
}));

const dataSchema = {
  type: 'object',
  properties: {
    campers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phone: { type: 'string', title: 'Phone Number', pattern: '^\\+[0-9]+$' },
          lodging: {
            type: 'object',
            title: 'Lodging',
            properties: {
              lodging_requested: {
                type: 'object',
                title: 'Lodging',
                required: ['id'],
                properties: { id: { type: 'number' } },
              },
            },
          },
        },
      },
    },
  },
} as RJSFSchema;

vi.mock('store/registrationApi', () => ({
  useRegistrationFormSchema: () => ({
    data: { dataSchema, uiSchema: { campers: { 'ui:title': 'Campers' } } },
  }),
}));

// Monaco doesn't load in jsdom; a textarea stands in for the JSON editor.
vi.mock('components/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="JSON" value={value} onChange={(e) => onChange(e.currentTarget.value)} />
  ),
}));

const lodgingRule = {
  'campers.*.lodging.lodging_requested.id': { required: '{{camper}}: finish your lodging' },
};

const makeEvent = (registration_error_messages = {}) =>
  ({ id: 7, registration_error_messages }) as unknown as ApiEvent;

beforeEach(() => mutate.mockClear());

describe('ErrorMessagesSettings', () => {
  it('lists the saved messages with their field names', () => {
    renderWithProviders(<ErrorMessagesSettings event={makeEvent(lodgingRule)} />);

    expect(
      screen.getByText('Campers › Lodging › Lodging › Id · Missing (required)'),
    ).toBeInTheDocument();
    expect(screen.getByText('{{camper}}: finish your lodging')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('adds a message through the form, previewing it, and saves the map', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorMessagesSettings event={makeEvent(lodgingRule)} />);

    await user.click(screen.getByRole('button', { name: 'Add message' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByPlaceholderText('Choose a field'));
    await user.click(await screen.findByText('Campers › Phone Number — campers.*.phone'));
    await user.click(within(dialog).getByPlaceholderText('Choose an error type'));
    await user.click(await screen.findByText("Doesn't match the expected pattern"));
    await user.type(
      within(dialog).getByLabelText('Message'),
      '{{{{camper}}: use a number like +15555555555',
    );
    expect(within(dialog).getByTestId('rule-preview')).toHaveTextContent(
      '2nd camper (Alex Sample): use a number like +15555555555',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(screen.getByText('{{camper}}: use a number like +15555555555')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        id: 7,
        registration_error_messages: {
          ...lodgingRule,
          'campers.*.phone': { pattern: '{{camper}}: use a number like +15555555555' },
        },
      },
      expect.anything(),
    );
  });

  it('blocks a second message for the same field and error type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorMessagesSettings event={makeEvent(lodgingRule)} />);

    await user.click(screen.getByRole('button', { name: 'Add message' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByPlaceholderText('Choose a field'));
    await user.click(
      await screen.findByText(
        'Campers › Lodging › Lodging › Id — campers.*.lodging.lodging_requested.id',
      ),
    );
    await user.click(within(dialog).getByPlaceholderText('Choose an error type'));
    await user.click(await screen.findByText('Missing (required)'));

    expect(
      within(dialog).getByText('This field already has a message for this error type'),
    ).toBeInTheDocument();
  });

  it('deletes a message after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorMessagesSettings event={makeEvent(lodgingRule)} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/No custom messages/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(
      { id: 7, registration_error_messages: {} },
      expect.anything(),
    );
  });

  it('edits the map as JSON, blocking save while it is invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorMessagesSettings event={makeEvent()} />);

    await user.click(screen.getByRole('button', { name: 'Edit as JSON' }));
    const editor = screen.getByLabelText('JSON');
    await user.clear(editor);
    await user.type(editor, '{{"campers.*.phone": 5}');
    expect(screen.getByText('Fix before saving')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(editor);
    await user.type(editor, '{{"campers.*.nickname": {{"required": "Nickname?"}}');
    expect(screen.getByText('Fields not on the form')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(
      { id: 7, registration_error_messages: { 'campers.*.nickname': { required: 'Nickname?' } } },
      expect.anything(),
    );
  });
});
