import userEvent from '@testing-library/user-event';
import type { EmailAudience } from 'api-types';
import { recipientFields } from 'components/RecipientFilterBuilder/test/recipientFields';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupTemplateEditor } from '../GroupTemplateEditor';
import { sampleAudience, sampleTemplate } from './emailFixtures';

const { create, update, emailEditor, useAudience } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  emailEditor: vi.fn(),
  useAudience: vi.fn(),
}));

vi.mock('store/entities', () => ({
  emailTemplateHooks: {
    useCreate: () => ({ mutate: create, isPending: false, error: null }),
    useUpdate: () => ({ mutate: update, isPending: false, error: null }),
  },
  emailAccountHooks: {
    useList: () => ({ data: [{ id: 3, name: 'Camp Gmail' }] }),
  },
}));
vi.mock('store/groupEmail', () => ({
  useRecipientFields: () => ({ data: recipientFields }),
  useAudience,
}));
vi.mock('components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: (props: { subject: string; onSubjectChange: (value: string) => void }) => {
    emailEditor(props);
    return (
      <input
        aria-label="Subject"
        value={props.subject}
        onChange={(e) => props.onSubjectChange(e.currentTarget.value)}
      />
    );
  },
}));

beforeEach(() => {
  create.mockClear();
  update.mockClear();
  emailEditor.mockClear();
  useAudience.mockReset();
  useAudience.mockReturnValue({ data: sampleAudience(), isFetching: false, error: null });
});

function renderEditor(template = sampleTemplate()) {
  renderWithProviders(
    <GroupTemplateEditor
      eventId={7}
      organizationId={1}
      defaultFrom="reg@camp.org"
      template={template}
      helpBase="/help"
      onDone={vi.fn()}
    />,
  );
  return userEvent.setup();
}

describe('GroupTemplateEditor', () => {
  it('creates a group template for campers with no conditions', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <GroupTemplateEditor
        eventId={7}
        organizationId={1}
        defaultFrom="reg@camp.org"
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Add a name, a subject to save.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Welcome');
    await user.type(screen.getByLabelText('Subject'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 7,
        purpose: 'group',
        name: 'Welcome',
        subject: 'Hello',
        recipient_source: 'campers',
        filter: { combinator: 'and', rules: [] },
        account: null,
        from_email: '',
      }),
      expect.anything(),
    );
  });

  it('saves an existing template’s changes', async () => {
    const user = renderEditor();
    await user.clear(screen.getByRole('textbox', { name: /Name/ }));
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Reminder');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        name: 'Reminder',
        recipient_source: 'registrations',
        filter: {
          combinator: 'and',
          rules: [{ field: 'registration.balance', op: 'gt', value: 0 }],
        },
      }),
      expect.anything(),
    );
  });

  it('counts with finished conditions only, and won’t save an unfinished one', async () => {
    const user = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText(/a field and value for a condition/)).toBeInTheDocument();
    const audience = useAudience.mock.calls.at(-1)?.[1] as EmailAudience;
    expect(audience.filter.rules).toEqual([{ field: 'registration.balance', op: 'gt', value: 0 }]);
    expect(useAudience.mock.calls.at(-1)?.[2]).toBe(5);
  });

  it('shows who the audience reaches and previews for them in the source’s context', async () => {
    const user = renderEditor(sampleTemplate({ recipient_source: 'campers', filter: {} }));
    expect(screen.getByText('2 recipients, 1 skipped')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByText('Already sent')).toBeInTheDocument();
    const props = emailEditor.mock.calls.at(-1)?.[0] as {
      context: string;
      samples: { value: string; sample: unknown }[];
      helpHref: string;
    };
    expect(props.context).toBe('bulk_email_camper');
    expect(props.helpHref).toBe('/help?context=bulk_email_camper');
    expect(props.samples[0]).toMatchObject({
      value: 'camper:3',
      sample: { registration_id: 2, camper_id: 3 },
    });
  });

  it('drops the conditions when the source changes', async () => {
    const user = renderEditor();
    await user.click(screen.getByText('Campers'));
    const audience = useAudience.mock.calls.at(-1)?.[1] as EmailAudience;
    expect(audience).toMatchObject({
      recipient_source: 'campers',
      filter: { combinator: 'and', rules: [] },
    });
  });

  it('shows the expressions’ problems from the recipients check', () => {
    useAudience.mockReturnValue({
      data: sampleAudience({
        recipients: [],
        skipped: [],
        diagnostics: [
          {
            severity: 'error',
            kind: 'syntax',
            message: "unexpected '}'",
            field: 'recipient_filter',
            line: 1,
            column: 4,
          },
        ],
      }),
      isFetching: false,
      error: null,
    });
    renderEditor(sampleTemplate({ filter_expression: 'x }' }));
    expect(screen.getByText("Line 1: unexpected '}'")).toBeInTheDocument();
  });
});
