import userEvent from '@testing-library/user-event';
import type { ApiRegistrationType } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationTypeForm } from '../RegistrationTypeForm';

const { create, update, draft } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  draft: {
    loaded: true,
    subject: 'Join us',
    body: '{{ invitation.register_url }}',
    setSubject: vi.fn(),
    setBody: vi.fn(),
    changed: false,
    save: vi.fn(),
    saving: false,
  },
}));

vi.mock('store/entities', () => ({
  registrationTypeHooks: {
    useCreate: () => ({ mutateAsync: create, isPending: false }),
    useUpdate: () => ({ mutateAsync: update, isPending: false }),
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
vi.mock('store/emailTemplates', () => ({ useTemplateDraft: () => draft }));
vi.mock('components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: (props: {
    subject: string;
    body: string;
    samples: { label: string }[];
    onBodyChange: (value: string) => void;
  }) => (
    <div>
      <span>subject: {props.subject}</span>
      <span>samples: {props.samples.map((s) => s.label).join(', ')}</span>
      <textarea aria-label="Body" onChange={(e) => props.onBodyChange(e.currentTarget.value)} />
    </div>
  ),
}));

const REG_TYPE = {
  id: 3,
  event: 4,
  name: 'staff',
  label: 'Staff',
  invitation_template: 11,
} as ApiRegistrationType;

beforeEach(() => {
  create.mockReset().mockResolvedValue({ ...REG_TYPE, id: 9 });
  update.mockReset().mockResolvedValue(REG_TYPE);
  draft.save.mockReset().mockResolvedValue(undefined);
  draft.setBody.mockReset();
});

describe('RegistrationTypeForm', () => {
  it('creates a type, which starts with a standard invitation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<RegistrationTypeForm eventId="4" opened onClose={onClose} />);
    expect(screen.getByText(/starts with a standard invitation email/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Body')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Machine name/), 'staff');
    await user.type(screen.getByLabelText(/Label/), 'Staff');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(create).toHaveBeenCalledWith({ event: '4', name: 'staff', label: 'Staff' });
    expect(onClose).toHaveBeenCalled();
  });

  it('edits an existing type’s invitation and previews its own invitations', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RegistrationTypeForm eventId="4" regType={REG_TYPE} opened onClose={vi.fn()} />,
    );
    expect(screen.getByText('subject: Join us')).toBeInTheDocument();
    expect(screen.getByText('samples: Lee <lee@example.com>')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Body'), 'x');
    expect(draft.setBody).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith({ id: 3, name: 'staff', label: 'Staff' });
    expect(draft.save).toHaveBeenCalled();
  });
});
