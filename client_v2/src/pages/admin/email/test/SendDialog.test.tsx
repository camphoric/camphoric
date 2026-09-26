import userEvent from '@testing-library/user-event';
import type { ApiEvent, AudienceResolution, EmailAudience } from 'api-types';
import { recipientFields } from 'components/RecipientFilterBuilder/test/recipientFields';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localToIso, SendDialog } from '../SendDialog';
import { sampleAudience, sampleTemplate } from './emailFixtures';

const { send, test, more } = vi.hoisted(() => ({
  send: vi.fn(),
  test: vi.fn(),
  more: { current: undefined as AudienceResolution | undefined },
}));

vi.mock('store/entities', () => ({
  emailAccountHooks: { useList: () => ({ data: [{ id: 3, name: 'Camp Gmail' }] }) },
}));
vi.mock('store/groupEmail', () => ({
  useRecipientFields: () => ({ data: recipientFields }),
  // The template's audience has a condition; the ad-hoc filter starts with none.
  useAudience: (_event: unknown, audience: EmailAudience | null) => {
    if (!audience) return { data: undefined, isFetching: false, error: null };
    const adhoc = !audience.filter.rules?.length;
    return { data: adhoc ? more.current : sampleAudience(), isFetching: false, error: null };
  },
  useSendTemplate: () => ({ mutate: send, isPending: false }),
  useTestTemplate: () => ({ mutate: test, isPending: false }),
}));

const event = { id: 7, organization: 1, confirmation_email_from: 'reg@camp.org' } as ApiEvent;
const template = sampleTemplate({ recipient_source: 'campers' });

beforeEach(() => {
  send.mockClear();
  test.mockClear();
  more.current = sampleAudience({
    recipients: [
      ...sampleAudience().recipients,
      {
        key: 'camper:8',
        email: 'ari@example.com',
        name: 'Ari Lin',
        label: 'Ari Lin (camper #8)',
        registration: 6,
        camper: 8,
        already_sent: false,
      },
    ],
    skipped: [],
  });
});

function setup() {
  const onSent = vi.fn();
  renderWithProviders(
    <SendDialog
      event={event}
      template={template}
      onClose={vi.fn()}
      onSent={onSent}
      now={() => new Date('2026-09-26T12:00:00')}
    />,
  );
  return { user: userEvent.setup(), onSent };
}

async function confirm(user: ReturnType<typeof userEvent.setup>, button: RegExp) {
  await user.click(screen.getByRole('button', { name: button }));
  return screen.findByRole('dialog', { name: /this email\?/ });
}

describe('SendDialog', () => {
  it('starts with the template’s recipients and skips those it already reached', async () => {
    const { user } = setup();
    expect(screen.getByText('Recipients: 2 of 2 selected')).toBeInTheDocument();
    expect(screen.getByText('Already sent: skipped')).toBeInTheDocument();
    const dialog = await confirm(user, /^Send to 1 recipient$/);
    expect(dialog).toHaveTextContent('goes to 1 recipient from reg@camp.org');
    expect(dialog).toHaveTextContent('1 already received it and is skipped.');
    expect(dialog).toHaveTextContent('1 left out');
    expect(dialog).toHaveTextContent('It’s sent now.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(send).toHaveBeenCalledWith(
      {
        templateId: 5,
        recipient_keys: ['camper:3', 'camper:4'],
        account: null,
        from_email: '',
        reply_to: '',
        skip_already_sent: true,
        send_at: null,
      },
      expect.anything(),
    );
  });

  it('sends again to those who got it when asked, to the checked recipients only', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('switch', { name: /haven’t received this email yet/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Send to Lee Park (camper #3)' }));
    await confirm(user, /^Send to 1 recipient$/);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(send.mock.calls[0][0]).toMatchObject({
      recipient_keys: ['camper:4'],
      skip_already_sent: false,
    });
  });

  it('adds recipients found with an ad-hoc filter', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Choose more recipients' }));
    // The source and address come from the template.
    expect(screen.queryByRole('radiogroup', { name: 'Send to' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add 1 new' }));
    expect(screen.getByText('Recipients: 3 of 3 selected')).toBeInTheDocument();
    expect(screen.getByText('Ari Lin (camper #8)')).toBeInTheDocument();
  });

  it('replaces the list with an ad-hoc filter’s recipients', async () => {
    more.current = sampleAudience({ recipients: more.current!.recipients.slice(2), skipped: [] });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Choose more recipients' }));
    await user.click(screen.getByRole('button', { name: 'Replace the list with 1' }));
    expect(screen.getByText('Recipients: 1 of 1 selected')).toBeInTheDocument();
    expect(screen.queryByText('Lee Park (camper #3)')).not.toBeInTheDocument();
    expect(screen.queryByText(/left out/)).not.toBeInTheDocument();
  });

  it('needs a time to send later', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Later'));
    expect(screen.getByRole('button', { name: 'Schedule for 1 recipient' })).toBeDisabled();
  });

  it('sends a test rendered for the first chosen recipient', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Send a test to me' }));
    expect(test).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 5,
        recipient_key: 'camper:3',
        include_incomplete: true,
      }),
      expect.anything(),
    );
  });

  it('sends through the chosen account and address', async () => {
    const { user, onSent } = setup();
    await user.type(screen.getByRole('textbox', { name: 'From' }), 'news@camp.org');
    await confirm(user, /^Send to 1 recipient$/);
    expect(screen.getByRole('dialog', { name: /this email\?/ })).toHaveTextContent(
      'from news@camp.org, through the event’s account',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(send.mock.calls[0][0]).toMatchObject({ from_email: 'news@camp.org' });
    const { onSuccess } = send.mock.calls[0][1] as { onSuccess: (b: { id: number }) => void };
    onSuccess({ id: 40 });
    expect(onSent).toHaveBeenCalledWith({ id: 40 });
  });
});

describe('localToIso', () => {
  it('reads a picker value as local time', () => {
    expect(localToIso('2026-10-01 09:30:00')).toBe(new Date(2026, 9, 1, 9, 30, 0).toISOString());
    expect(localToIso('2026-10-01 09:30')).toBe(new Date(2026, 9, 1, 9, 30).toISOString());
  });
});
