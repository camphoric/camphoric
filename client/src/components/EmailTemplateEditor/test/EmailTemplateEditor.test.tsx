import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EmailTemplateEditor } from '../EmailTemplateEditor';

const { templateEditor } = vi.hoisted(() => ({ templateEditor: vi.fn() }));

// Monaco doesn't load in jsdom: a textarea stands in for the editor.
vi.mock('components/TemplateEditor', () => ({
  TemplateEditor: (props: { value: string; onChange: (value: string) => void }) => {
    templateEditor(props);
    return (
      <textarea
        aria-label="Jinja body"
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
      />
    );
  },
}));

function setup(body = 'Hello') {
  renderWithProviders(
    <EmailTemplateEditor
      eventId={4}
      context="invitation_email"
      subject="Hi {{ invitation.recipient_name }}"
      onSubjectChange={vi.fn()}
      body={body}
      onBodyChange={vi.fn()}
      samples={[
        { value: '1', label: 'Lee', sample: { invitation_id: 1 } },
        { value: '2', label: 'Sam', sample: { invitation_id: 2 } },
      ]}
      baseSample={{ registration_type_id: 9 }}
      helpHref="/help?context=invitation_email"
    />,
  );
}

describe('EmailTemplateEditor', () => {
  it('previews Jinja with the subject and the chosen sample', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByLabelText('Jinja body')).toHaveValue('Hello');
    expect(templateEditor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: 'invitation_email',
        output: 'email',
        subject: 'Hi {{ invitation.recipient_name }}',
        sample: { registration_type_id: 9, invitation_id: 1 },
      }),
    );

    await user.click(screen.getByRole('textbox', { name: 'Preview for' }));
    await user.click(await screen.findByRole('option', { name: 'Sam', hidden: true }));
    expect(templateEditor).toHaveBeenLastCalledWith(
      expect.objectContaining({ sample: { registration_type_id: 9, invitation_id: 2 } }),
    );
  });
});
