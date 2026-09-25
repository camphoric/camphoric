import userEvent from '@testing-library/user-event';
import type { ApiRegistrationType } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationTypeForm } from './RegistrationTypeForm';

const { create, update } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));

vi.mock('store/entities', () => ({
  registrationTypeHooks: {
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutate: update, isPending: false }),
  },
  invitationHooks: {
    useList: () => ({
      data: [
        { id: 5, registration_type: 3, recipient_name: 'Lee', recipient_email: 'lee@example.com' },
        { id: 6, registration_type: 8, recipient_name: '', recipient_email: 'x@example.com' },
      ],
    }),
  },
}));
vi.mock('components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: (props: {
    engine: string;
    samples: { label: string }[];
    onBodyChange: (value: string) => void;
    onSubjectChange: (value: string) => void;
  }) => (
    <div>
      <span>engine: {props.engine}</span>
      <span>samples: {props.samples.map((s) => s.label).join(', ')}</span>
      <input aria-label="Subject" onChange={(e) => props.onSubjectChange(e.currentTarget.value)} />
      <textarea aria-label="Body" onChange={(e) => props.onBodyChange(e.currentTarget.value)} />
    </div>
  ),
}));

beforeEach(() => {
  create.mockClear();
  update.mockClear();
});

describe('RegistrationTypeForm', () => {
  it('writes new types’ invitations in Jinja', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegistrationTypeForm eventId="4" opened onClose={vi.fn()} />);
    expect(screen.getByText('engine: jinja')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Machine name/), 'staff');
    await user.type(screen.getByLabelText(/Label/), 'Staff');
    await user.type(screen.getByLabelText('Subject'), 'Hi');
    await user.type(screen.getByLabelText('Body'), 'Welcome');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ event: '4', invitation_email_engine: 'jinja' }),
      expect.anything(),
    );
  });

  it('keeps an existing type’s engine and previews its own invitations', () => {
    const regType = {
      id: 3,
      event: 4,
      name: 'staff',
      label: 'Staff',
      invitation_email_subject: 'Hi',
      invitation_email_template: '{{recipient_name}}',
      invitation_email_engine: 'mustache',
    } as ApiRegistrationType;
    renderWithProviders(
      <RegistrationTypeForm eventId="4" regType={regType} opened onClose={vi.fn()} />,
    );
    expect(screen.getByText('engine: mustache')).toBeInTheDocument();
    expect(screen.getByText('samples: Lee <lee@example.com>')).toBeInTheDocument();
  });
});
