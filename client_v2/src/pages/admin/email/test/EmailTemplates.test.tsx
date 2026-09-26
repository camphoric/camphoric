import userEvent from '@testing-library/user-event';
import type { ApiEvent } from 'api-types';
import type { ReactNode } from 'react';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { audienceSummary, EmailTemplates } from '../EmailTemplates';
import { sampleTemplate } from './emailFixtures';

const { duplicate, del, groupEditor } = vi.hoisted(() => ({
  duplicate: vi.fn(),
  del: vi.fn(),
  groupEditor: vi.fn(),
}));

const templates = [
  sampleTemplate({
    id: 1,
    purpose: 'confirmation',
    name: 'Registration confirmation',
    subject: 'Welcome',
  }),
  sampleTemplate({ id: 2, purpose: 'invitation', name: 'Invitation: Staff', subject: 'Join us' }),
  sampleTemplate(),
  sampleTemplate({
    id: 6,
    name: 'Packing list',
    recipient_source: 'manual',
    recipient_list: 'a@x.org\n# not this\nb@x.org\n',
  }),
];

vi.mock('store/entities', () => ({
  emailTemplateHooks: {
    useList: () => ({ data: templates }),
    useDelete: () => ({ mutate: del }),
  },
}));
vi.mock('store/groupEmail', () => ({
  useDuplicateTemplate: () => ({ mutate: duplicate, isPending: false }),
}));
vi.mock('../GroupTemplateEditor', () => ({
  GroupTemplateEditor: (props: { template?: { name: string } }) => {
    groupEditor(props);
    return <div>Editing {props.template?.name ?? 'a new template'}</div>;
  },
}));
vi.mock('../SendDialog', () => ({
  SendDialog: (props: { template: { name: string }; onSent: (batch: { id: number }) => void }) => (
    <button type="button" onClick={() => props.onSent({ id: 31 })}>
      Confirm sending {props.template.name}
    </button>
  ),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const event = { id: 7, organization: 1, confirmation_email_from: 'reg@camp.org' } as ApiEvent;

beforeEach(() => {
  duplicate.mockClear();
  del.mockClear();
  groupEditor.mockClear();
});

function setup(templateId?: string) {
  const onEditTemplate = vi.fn();
  const onSent = vi.fn();
  renderWithProviders(
    <EmailTemplates
      event={event}
      templateId={templateId}
      onEditTemplate={onEditTemplate}
      onSent={onSent}
    />,
  );
  return { user: userEvent.setup(), onEditTemplate, onSent };
}

describe('EmailTemplates', () => {
  it('lists the group emails with their default recipients', () => {
    setup();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[2].textContent)).toEqual([
      'Registrations, 1 condition',
      '2 listed addresses',
    ]);
  });

  it('lists the automatic emails with where they’re edited', () => {
    setup();
    expect(screen.getByText('Edit on Home')).toHaveAttribute(
      'href',
      '/admin/organization/$organizationId/event/$eventId/home',
    );
    expect(screen.getByText('Invitation: Staff')).toBeInTheDocument();
    expect(screen.getByText('Edit in Settings › Registration types')).toBeInTheDocument();
    // They can't be deleted.
    expect(screen.queryByRole('button', { name: 'Delete Registration confirmation' })).toBeNull();
  });

  it('opens a template, or a new one, for editing', async () => {
    const { user, onEditTemplate } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Balance reminder' }));
    expect(onEditTemplate).toHaveBeenLastCalledWith('5');
    await user.click(screen.getByRole('button', { name: 'New template' }));
    expect(onEditTemplate).toHaveBeenLastCalledWith('new');
  });

  it('shows the editor for the template in the URL', () => {
    setup('5');
    expect(screen.getByText('Editing Balance reminder')).toBeInTheDocument();
  });

  it('duplicates a template and opens the copy', async () => {
    const { user, onEditTemplate } = setup();
    await user.click(screen.getByRole('button', { name: 'Duplicate Packing list' }));
    expect(duplicate).toHaveBeenCalledWith(6, expect.anything());
    const { onSuccess } = duplicate.mock.calls[0][1] as { onSuccess: (t: { id: number }) => void };
    onSuccess({ id: 11 });
    expect(onEditTemplate).toHaveBeenLastCalledWith('11');
  });

  it('sends a template from its row', async () => {
    const { user, onSent } = setup();
    await user.click(screen.getByRole('button', { name: 'Send Balance reminder' }));
    await user.click(
      await screen.findByRole('button', { name: 'Confirm sending Balance reminder' }),
    );
    expect(onSent).toHaveBeenCalledWith({ id: 31 });
    expect(screen.queryByRole('button', { name: /Confirm sending/ })).not.toBeInTheDocument();
  });

  it('asks before deleting a template', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete Balance reminder' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(del).toHaveBeenCalledWith({ id: 5 }, expect.anything());
  });
});

describe('audienceSummary', () => {
  it('describes each kind of audience', () => {
    expect(audienceSummary(sampleTemplate({ recipient_source: 'campers', filter: {} }))).toBe(
      'Campers, all',
    );
    expect(
      audienceSummary(
        sampleTemplate({ filter: { rules: [] }, filter_expression: 'registration.balance > 0' }),
      ),
    ).toBe('Registrations, filtered');
    expect(
      audienceSummary(sampleTemplate({ recipient_source: 'manual', recipient_list: 'a@x.org' })),
    ).toBe('1 listed address');
  });
});
