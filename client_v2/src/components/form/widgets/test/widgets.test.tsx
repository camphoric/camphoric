import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import userEvent from '@testing-library/user-event';
import { JsonSchemaForm } from 'components/form';
import { fireEvent, renderWithProviders as renderForm, screen } from 'test/utils';
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

  describe('phone widget filled all at once, as autofill and paste do', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: { phone: { type: 'string', title: 'Phone' } },
    };
    const uiSchema: UiSchema = { phone: { 'ui:widget': 'PhoneInput' } };

    /** The phone the form last reported. */
    const reportedPhone = (onChange: ReturnType<typeof vi.fn>) =>
      (onChange.mock.lastCall?.[0] as { phone?: string } | undefined)?.phone;

    function fill(value: string) {
      const onChange = vi.fn();
      renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Phone'), { target: { value } });
      return reportedPhone(onChange);
    }

    /** The country the flag selector shows. */
    const flag = () =>
      document
        .querySelector('.react-international-phone-country-selector-button')
        ?.querySelector('img')
        ?.getAttribute('data-country');

    it.each([
      '2025551234',
      '(202) 555-1234',
      '202-555-1234',
      '1 (202) 555-1234',
      '+1 202-555-1234',
      '+1 202 555 1234',
    ])('reads %s as a US number', (value) => {
      expect(fill(value)).toBe('+12025551234');
      expect(flag()).toBe('us');
    });

    it('reads a number inserted in one go, as some autofill does, as a US number', () => {
      const onChange = vi.fn();
      renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);
      const value = '+1 (202) 555-1234';
      fireEvent.input(screen.getByLabelText('Phone'), {
        target: { value },
        inputType: 'insertText',
        data: value,
      });
      expect(reportedPhone(onChange)).toBe('+12025551234');
      expect(flag()).toBe('us');
      expect(screen.getByLabelText('Phone')).toHaveValue('+1 (202) 555-1234');
    });

    it('still keeps letters out when typing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);
      await user.type(screen.getByLabelText('Phone'), '202x555');
      expect(reportedPhone(onChange)).toBe('+1202555');
    });

    it('switches the country for a number with another country code', () => {
      expect(fill('+44 20 7946 0958')).toBe('+442079460958');
      expect(flag()).toBe('gb');
    });

    it('reads a pasted national number as a US number', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);
      const input = screen.getByLabelText('Phone');
      await user.tripleClick(input);
      await user.paste('(202) 555-1234');
      expect(reportedPhone(onChange)).toBe('+12025551234');
      expect(flag()).toBe('us');
    });
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

  describe('select', () => {
    const firstTimeSchema = (required: boolean): RJSFSchema => ({
      type: 'object',
      ...(required ? { required: ['first_time'] } : {}),
      properties: {
        first_time: { type: 'boolean', title: 'First time at camp?', default: false },
      },
    });
    const firstTimeUi: UiSchema = {
      first_time: { 'ui:enumNames': { false: 'No', true: 'Yes' } },
    };
    const chooseAgain = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
      await user.click(screen.getByLabelText(/First time at camp/));
      // The dropdown is still mid-transition in jsdom, so its options count as hidden.
      await user.click(screen.getByRole('option', { name: label, hidden: true }));
    };

    it('keeps an answer when it is chosen again', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderForm(
        <JsonSchemaForm schema={firstTimeSchema(true)} uiSchema={firstTimeUi} onChange={onChange} />,
      );
      await chooseAgain(user, 'No');

      expect(screen.getByLabelText(/First time at camp/)).toHaveValue('No');
      for (const [data] of onChange.mock.calls) expect(data).toEqual({ first_time: false });
    });

    it('clears an optional answer with its clear button, not by choosing it again', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = renderForm(
        <JsonSchemaForm schema={firstTimeSchema(false)} uiSchema={firstTimeUi} onChange={onChange} />,
      );
      await chooseAgain(user, 'No');
      expect(screen.getByLabelText(/First time at camp/)).toHaveValue('No');

      await user.click(container.querySelector('.mantine-Select-section button')!);
      expect(screen.getByLabelText(/First time at camp/)).toHaveValue('');
      expect(onChange).toHaveBeenLastCalledWith({}, expect.anything());
    });

    it('offers no clear button when an answer is required', () => {
      const { container } = renderForm(
        <JsonSchemaForm schema={firstTimeSchema(true)} uiSchema={firstTimeUi} />,
      );
      expect(container.querySelector('.mantine-Select-section button')).toBeNull();
    });
  });

  it('checkboxes save the choices in option order, not click order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          title: 'Days',
          items: { type: 'string', enum: ['Thu', 'Fri', 'Sat', 'Sun'] },
          uniqueItems: true,
        },
      },
    };
    const uiSchema: UiSchema = { days: { 'ui:widget': 'checkboxes' } };
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    await user.click(screen.getByLabelText('Fri'));
    await user.click(screen.getByLabelText('Sun'));
    await user.click(screen.getByLabelText('Sat'));

    expect(onChange).toHaveBeenLastCalledWith({ days: ['Fri', 'Sat', 'Sun'] }, expect.anything());
  });

  it('checkboxes render the field description', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          title: 'Days',
          description: 'Check-in is at **2pm**.',
          items: { type: 'string', enum: ['Thu', 'Fri'] },
          uniqueItems: true,
        },
      },
    };
    const uiSchema: UiSchema = { days: { 'ui:widget': 'checkboxes' } };
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} />);

    // Rendered through the markdown template, between the label and the boxes.
    const description = screen.getByText('2pm').closest('.field-description') as HTMLElement;
    expect(description).toHaveTextContent('Check-in is at 2pm.');
    expect(screen.getAllByText('Days')).toHaveLength(1);
    expect(
      screen.getByText('Days').compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      description.compareDocumentPosition(screen.getByLabelText('Thu')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
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
