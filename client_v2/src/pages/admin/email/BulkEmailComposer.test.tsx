import userEvent from '@testing-library/user-event';
import type { ApiBulkEmailTask } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkEmailComposer } from './BulkEmailComposer';

const { create, update, emailEditor } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  emailEditor: vi.fn(),
}));

vi.mock('store/entities', () => ({
  bulkEmailTaskHooks: {
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutate: update, isPending: false }),
  },
}));
vi.mock('store/bulkEmail', () => ({
  useRecipientPreview: () => ({
    data: {
      recipients: [
        {
          email: 'lee@example.com',
          name: 'Lee',
          label: 'Lee (camper #3)',
          registration: 2,
          camper: 3,
        },
      ],
      skipped: [],
      diagnostics: [],
    },
    isFetching: false,
    error: null,
  }),
}));
vi.mock('components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: (props: { onSubjectChange: (value: string) => void }) => {
    emailEditor(props);
    return (
      <input aria-label="Subject" onChange={(e) => props.onSubjectChange(e.currentTarget.value)} />
    );
  },
}));

beforeEach(() => {
  create.mockClear();
  update.mockClear();
});

describe('BulkEmailComposer', () => {
  it('creates a Jinja email to registrations by default', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BulkEmailComposer
        eventId="4"
        defaultFrom="reg@camp.org"
        helpBase="/help"
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(screen.getByLabelText('Subject'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: '4',
        from_email: 'reg@camp.org',
        engine: 'jinja',
        subject: 'Hello',
        recipient_kind: 'registrations',
        messages_per_second: null,
      }),
      expect.anything(),
    );
  });

  it('previews for the recipients the list reaches, in the matching context', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BulkEmailComposer eventId="4" defaultFrom="" helpBase="/help" onDone={vi.fn()} />,
    );
    await user.click(screen.getByText('Campers'));
    expect(emailEditor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: 'bulk_email_camper',
        helpHref: '/help?context=bulk_email_camper',
        samples: [
          {
            value: 'lee@example.com',
            label: 'Lee (camper #3) — lee@example.com',
            sample: { registration_id: 2, camper_id: 3 },
          },
        ],
      }),
    );
  });

  it('updates an existing email', async () => {
    const user = userEvent.setup();
    const task = {
      id: 9,
      event: 4,
      from_email: 'a@camp.org',
      subject: 'Hi',
      body_template: 'x',
      engine: 'mustache',
      recipient_kind: 'manual',
      recipient_list: 'b@example.com',
      recipient_filter: '',
      address_expression: '',
      name_expression: '',
      include_incomplete: false,
      messages_per_second: '1.000',
    } as ApiBulkEmailTask;
    renderWithProviders(
      <BulkEmailComposer eventId="4" defaultFrom="" task={task} onDone={vi.fn()} />,
    );
    expect(screen.getByLabelText('Addresses')).toHaveValue('b@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        engine: 'mustache',
        recipient_kind: 'manual',
        messages_per_second: '1.000',
      }),
      expect.anything(),
    );
  });
});
