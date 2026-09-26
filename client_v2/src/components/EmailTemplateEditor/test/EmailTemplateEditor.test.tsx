import userEvent from '@testing-library/user-event';
import type { TemplateEngine } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EmailTemplateEditor } from '../EmailTemplateEditor';

const { templateEditor } = vi.hoisted(() => ({ templateEditor: vi.fn() }));

// Monaco doesn't load in jsdom: textareas stand in for both editors.
vi.mock('components/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Mustache body"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  ),
}));
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

function setup(engine: TemplateEngine, body = 'Hello') {
  const onEngineChange = vi.fn();
  renderWithProviders(
    <EmailTemplateEditor
      eventId={4}
      context="invitation_email"
      engine={engine}
      onEngineChange={onEngineChange}
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
  return { onEngineChange };
}

describe('EmailTemplateEditor', () => {
  it('previews Jinja with the subject and the chosen sample', async () => {
    const user = userEvent.setup();
    setup('jinja');
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

  it('keeps Mustache in a plain editor, linking the mapping guide', () => {
    setup('mustache');
    expect(screen.getByLabelText('Mustache body')).toBeInTheDocument();
    expect(screen.queryByLabelText('Jinja body')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See how its variables map' })).toHaveAttribute(
      'href',
      '/help?context=invitation_email&helpTab=guide&topic=mustache',
    );
  });

  it('asks before switching engines when there is text', async () => {
    const user = userEvent.setup();
    const { onEngineChange } = setup('mustache');
    await user.click(screen.getByText('Jinja'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('aren’t converted');
    expect(onEngineChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Switch' }));
    expect(onEngineChange).toHaveBeenCalledWith('jinja');
  });
});
