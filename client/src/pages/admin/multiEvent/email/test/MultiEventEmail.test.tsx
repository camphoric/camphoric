import userEvent from '@testing-library/user-event';
import type { AudienceResolution } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LINK } from '../../../../unsubscribe/test/fixtures';
import { UnsubscribeCard } from '../../../../unsubscribe/UnsubscribeCard';
import { OrganizationEmailEditor } from '../OrganizationEmailEditor';
import { OrganizationSendDialog } from '../OrganizationSendDialog';
import { OrganizationUnsubscribes } from '../OrganizationUnsubscribes';
import { sampleOrganizationEmail, UNSUBSCRIBED } from './fixtures';

const { create, send, test, addUnsubscribe } = vi.hoisted(() => ({
  create: vi.fn(),
  send: vi.fn(),
  test: vi.fn(),
  addUnsubscribe: vi.fn(),
}));

const AUDIENCE: AudienceResolution = {
  recipients: [
    {
      key: 'person:1',
      email: 'ann@example.com',
      name: 'Ann Lee',
      label: 'Ann Lee',
      registration: 1,
      camper: 3,
      already_sent: true,
    },
    {
      key: 'camper:9',
      email: 'ng@example.com',
      name: 'Bo Ng',
      label: 'Bo Ng',
      registration: 2,
      camper: 9,
      already_sent: false,
    },
  ],
  skipped: [
    {
      label: 'Cy Day',
      reason: 'unsubscribed',
      detail: '',
      email: 'cy@example.com',
      registration: 4,
      camper: 11,
    },
  ],
  diagnostics: [],
};

vi.mock('store/entities', () => ({
  emailAccountHooks: { useList: () => ({ data: [{ id: 3, name: 'Camp Gmail' }] }) },
  organizationEmailHooks: {
    useCreate: () => ({ mutate: create, isPending: false, error: null }),
    useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  },
  organizationUnsubscribeHooks: {
    useList: () => ({ data: UNSUBSCRIBED }),
    useDelete: () => ({ mutate: vi.fn() }),
    useCreate: () => ({ mutate: addUnsubscribe, isPending: false, error: null }),
  },
}));
vi.mock('store/multiEventEmail', () => ({
  useOrganizationRecipientFields: () => ({
    data: [{ key: 'person.attended', label: 'Events attended', group: 'Person', type: 'number' }],
  }),
  useOrganizationAudience: () => ({ data: AUDIENCE, isFetching: false, error: null }),
  useOrganizationEmailDescription: () => ({ data: undefined }),
  useOrganizationEmailPreview: () => ({ data: undefined, isFetching: false, error: null }),
  useSendOrganizationEmail: () => ({ mutate: send, isPending: false }),
  useTestOrganizationEmail: () => ({ mutate: test, isPending: false }),
}));
vi.mock('hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({ confirmDiscard: (go: () => void) => go(), release: vi.fn() }),
}));
// Monaco doesn't load in jsdom; a textarea stands in for the editor.
vi.mock('components/TemplateEditor', () => ({
  requestErrorMessage: (error: unknown) => String(error),
  TemplateEditorView: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea aria-label="Body" value={value} onChange={(e) => onChange(e.currentTarget.value)} />
  ),
}));

function asRole(node: React.ReactNode, userRole: 'registrar' | 'reporter' = 'registrar') {
  return renderWithProviders(<PermissionsProvider userRole={userRole}>{node}</PermissionsProvider>);
}

beforeEach(() => {
  for (const fn of [create, send, test, addUnsubscribe]) fn.mockClear();
});

describe('OrganizationEmailEditor', () => {
  it('saves a new email for the organization once it has a name, subject and sender', async () => {
    const user = userEvent.setup();
    asRole(<OrganizationEmailEditor organizationId="1" onDone={vi.fn()} />);
    expect(screen.getByText('2 recipients, 1 skipped')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Come back');
    await user.type(screen.getByRole('textbox', { name: /^Subject/ }), 'Hello');
    await user.type(screen.getByRole('textbox', { name: /^From/ }), 'camp@example.com');
    await user.click(save);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: 1,
        name: 'Come back',
        subject: 'Hello',
        from_email: 'camp@example.com',
        filter: { combinator: 'and', rules: [] },
      }),
      expect.anything(),
    );
  });
});

describe('OrganizationSendDialog', () => {
  it('sends to the reviewed people, skipping those already sent it', async () => {
    const user = userEvent.setup();
    asRole(
      <OrganizationSendDialog
        email={sampleOrganizationEmail()}
        onClose={vi.fn()}
        onSent={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 left out/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
    await user.click(await screen.findByRole('button', { name: 'Send' }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        emailId: 9,
        recipient_keys: ['person:1', 'camper:9'],
        skip_already_sent: true,
        from_email: 'camp@example.com',
        send_at: null,
      }),
      expect.anything(),
    );
  });

  it('sends a test written for the first chosen person', async () => {
    asRole(
      <OrganizationSendDialog
        email={sampleOrganizationEmail()}
        onClose={vi.fn()}
        onSent={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send a test to me' }));
    expect(test).toHaveBeenCalledWith({ emailId: 9, recipient_key: 'person:1' }, expect.anything());
  });

  it('lets a Reporter look but not send', () => {
    asRole(
      <OrganizationSendDialog
        email={sampleOrganizationEmail()}
        onClose={vi.fn()}
        onSent={vi.fn()}
      />,
      'reporter',
    );
    expect(screen.queryByRole('button', { name: /^Send to/ })).not.toBeInTheDocument();
  });
});

describe('OrganizationUnsubscribes', () => {
  it('lists who left and unsubscribes an address an organizer adds', async () => {
    const user = userEvent.setup();
    asRole(<OrganizationUnsubscribes organizationId={1} />);
    expect(screen.getByText('Unsubscribe link')).toBeInTheDocument();
    expect(screen.getByText('Added by will')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Address to unsubscribe' }), 'lee@x.org');
    await user.click(screen.getByRole('button', { name: 'Unsubscribe address' }));
    expect(addUnsubscribe).toHaveBeenCalledWith(
      { organization: 1, email: 'lee@x.org' },
      expect.anything(),
    );
  });
});

describe('UnsubscribeCard', () => {
  it('names the organization for its email to past campers', () => {
    renderWithProviders(
      <UnsubscribeCard
        state="ask"
        link={{ ...LINK, scope: 'organization', event: { name: 'Lark Camp' } }}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/to people who came to its events/)).toBeInTheDocument();
  });
});
