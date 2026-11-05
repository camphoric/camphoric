import { TextInput } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { anonymousUser, type ApiUser } from 'api-types';
import { PUBLISHED_CONTRACT } from 'components/Contract/test/contractFixtures';
import { WHOAMI_KEY } from 'hooks/auth';
import { useState } from 'react';
import { act, renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractGate } from '../ContractGate';

const route: { params: { organizationId?: string } } = vi.hoisted(() => ({ params: {} }));
const calls = vi.hoisted(() => ({ agree: vi.fn(), logout: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({ useParams: () => route.params }));
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch: () => new Promise(() => undefined),
}));
vi.mock('hooks/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('hooks/auth')>()),
  useLogout: () => ({ mutate: calls.logout, isPending: false }),
}));
vi.mock('store/contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('store/contracts')>()),
  useOrganizationContract: () => ({
    isPending: false,
    isError: false,
    data: { contract: PUBLISHED_CONTRACT, agreed: false },
  }),
  useAgreeToContract: () => ({
    mutate: calls.agree,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

const ORGANIZATION = PUBLISHED_CONTRACT.organization;

const pat = (pending: number[]): ApiUser => ({
  ...anonymousUser,
  id: 3,
  username: 'pat',
  is_active: true,
  role: 'registrar',
  pending_contract_organizations: pending,
});

/** An admin page holding a change it hasn't saved. */
function Editor() {
  const [note, setNote] = useState('');
  return <TextInput label="Note" value={note} onChange={(e) => setNote(e.currentTarget.value)} />;
}

function renderGate(user: ApiUser) {
  const client = new QueryClient();
  client.setQueryData(WHOAMI_KEY, user);
  renderWithProviders(
    <QueryClientProvider client={client}>
      <ContractGate>
        <Editor />
      </ContractGate>
    </QueryClientProvider>,
    { withPortals: true },
  );
  return {
    client,
    becomes: (next: ApiUser) =>
      act(async () => {
        client.setQueryData(WHOAMI_KEY, next);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }),
  };
}

describe('ContractGate', () => {
  beforeEach(() => {
    route.params = { organizationId: String(ORGANIZATION) };
    calls.agree.mockReset();
    calls.logout.mockReset();
  });

  it('lets someone who has agreed through', () => {
    renderGate(pat([]));
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('leaves the choosers open', () => {
    route.params = {};
    renderGate(pat([ORGANIZATION]));
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('gates only the organizations still to agree with', () => {
    renderGate(pat([ORGANIZATION + 1]));
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('asks for agreement in place of the organization', () => {
    renderGate(pat([ORGANIZATION]));
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lark Camp terms' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Liability Waiver' })).toBeInTheDocument();
    expect(screen.getByText(/agree to them\. If you don’t agree/)).toBeInTheDocument();
  });

  it('agrees to exactly the version shown, then goes on', async () => {
    const { becomes } = renderGate(pat([ORGANIZATION]));
    await userEvent.click(screen.getByRole('button', { name: 'I agree' }));
    expect(calls.agree).toHaveBeenCalledWith(
      {
        contract_id: PUBLISHED_CONTRACT.id,
        content_sha256: PUBLISHED_CONTRACT.content_sha256,
        assent_text: 'I agree',
      },
      expect.anything(),
    );
    // The answer is who's signed in, without the organization pending.
    await becomes(pat([]));
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('signs out someone who declines', async () => {
    renderGate(pat([ORGANIZATION]));
    await userEvent.click(screen.getByRole('button', { name: /I don’t agree/ }));
    expect(calls.logout).toHaveBeenCalled();
    expect(calls.agree).not.toHaveBeenCalled();
  });

  it('asks over the admin when a new version is published, keeping unsaved edits', async () => {
    const { becomes } = renderGate(pat([]));
    await userEvent.type(screen.getByLabelText('Note'), 'half done');
    await becomes(pat([ORGANIZATION]));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toHaveValue('half done');
    // Out of reach underneath.
    expect(screen.getByLabelText('Note').closest('[inert]')).not.toBeNull();
    await becomes(pat([]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toHaveValue('half done');
    expect(screen.getByLabelText('Note').closest('[inert]')).toBeNull();
  });

  it('asks in place of another organization reached afterwards', async () => {
    const { becomes } = renderGate(pat([]));
    route.params = { organizationId: String(ORGANIZATION + 1) };
    await becomes(pat([ORGANIZATION + 1]));
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
