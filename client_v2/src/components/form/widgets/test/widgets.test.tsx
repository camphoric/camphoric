import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import userEvent from '@testing-library/user-event';
import { JsonSchemaForm } from 'components/form';
import { renderWithProviders as renderForm, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

describe('custom widgets', () => {
  it('date widget displays MM/DD/YYYY while the data stays ISO', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: { birthdate: { type: 'string', format: 'date', title: 'Birth date' } },
    };
    // Form data is ISO; the input shows the MM/DD/YYYY rendering of it.
    renderForm(<JsonSchemaForm schema={schema} formData={{ birthdate: '2026-06-29' }} />);

    expect(screen.getByLabelText('Birth date')).toHaveValue('06/29/2026');
  });

  it('naturalNumber accepts digits and reports a numeric value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { count: { type: 'integer', title: 'Count' } },
    };
    const uiSchema: UiSchema = { count: { 'ui:widget': 'NaturalNumberInput' } };
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    await user.type(screen.getByLabelText('Count'), '7');

    expect(onChange).toHaveBeenLastCalledWith({ count: 7 }, expect.anything());
  });

  it('textarea truncates input to the schema maxLength', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { note: { type: 'string', title: 'Note', maxLength: 3 } },
    };
    const uiSchema: UiSchema = { note: { 'ui:widget': 'textarea' } };
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    await user.type(screen.getByLabelText('Note'), 'abcdef');

    // Never reports more than maxLength characters.
    const longest = onChange.mock.calls
      .map(([data]) => (data as { note?: string }).note ?? '')
      .reduce((a, b) => (a.length >= b.length ? a : b), '');
    expect(longest).toBe('abc');
  });

  it('phone widget formats typed digits into an E.164 value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { phone: { type: 'string', title: 'Phone' } },
    };
    const uiSchema: UiSchema = { phone: { 'ui:widget': 'PhoneInput' } };
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    await user.type(screen.getByLabelText('Phone'), '2025551234');

    // Default country US: the reported value is E.164 (+1…).
    const reported = onChange.mock.calls.map(([data]) => (data as { phone?: string }).phone ?? '');
    expect(reported.some((phone) => phone.startsWith('+1'))).toBe(true);
  });

  it('select renders the field description', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        size: {
          type: 'string',
          title: 'Size',
          description: 'Sizes run **large**.',
          enum: ['S', 'M'],
        },
      },
    };
    renderForm(<JsonSchemaForm schema={schema} />);

    // Rendered through the markdown template (the bold lands in its own
    // element), between the label and the control.
    const description = screen.getByText('large').closest('.field-description') as HTMLElement;
    expect(description).toHaveTextContent('Sizes run large.');
    const label = screen.getByText('Size');
    const select = screen.getByLabelText('Size');
    expect(
      label.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      description.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  const customWidgetCases: [string, RJSFSchema, UiSchema][] = [
    ['PhoneInput', { type: 'string' }, { 'ui:widget': 'PhoneInput' }],
    ['NaturalNumberInput', { type: 'integer' }, { 'ui:widget': 'NaturalNumberInput' }],
    ['date', { type: 'string', format: 'date' }, {}],
    ['textarea', { type: 'string' }, { 'ui:widget': 'textarea' }],
  ];
  it.each(customWidgetCases)(
    '%s renders the description between the label and the control',
    (_name, field, ui) => {
      const schema: RJSFSchema = {
        type: 'object',
        properties: {
          value: { ...field, title: 'Value', description: 'Help for **this** field.' },
        },
      };
      renderForm(<JsonSchemaForm schema={schema} uiSchema={{ value: ui }} />);

      const label = screen.getByText('Value');
      const description = screen.getByText('this').closest('.field-description') as HTMLElement;
      const control = screen.getByLabelText('Value');
      expect(description).toHaveTextContent('Help for this field.');
      expect(
        label.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        description.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );
});
