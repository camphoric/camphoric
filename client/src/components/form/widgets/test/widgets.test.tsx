import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import userEvent from '@testing-library/user-event';
import { JsonSchemaForm } from 'components/form';
import { phoneNumberProblem } from 'components/form/phoneNumber';
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

  describe('phone widget', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: { phone: { type: 'string', title: 'Phone' } },
    };
    const phoneUi = (options?: Record<string, unknown>): UiSchema => ({
      phone: { 'ui:widget': 'PhoneInput', ...(options && { 'ui:options': options }) },
    });

    /** The phone the form last reported. */
    const reportedPhone = (onChange: ReturnType<typeof vi.fn>) =>
      (onChange.mock.lastCall?.[0] as { phone?: string } | undefined)?.phone;

    /** The country the picker shows (`ZZ` for International). */
    const country = () =>
      screen.getByRole('button', { name: /country/i }).getAttribute('data-country');

    function renderPhone(uiSchema = phoneUi(), formData?: unknown) {
      const onChange = vi.fn();
      renderForm(
        <JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={formData} onChange={onChange} />,
      );
      return { onChange, input: screen.getByLabelText<HTMLInputElement>('Phone') };
    }

    it('formats typed digits as a US number and reports it in E.164 form', async () => {
      const user = userEvent.setup();
      const { onChange, input } = renderPhone();
      expect(input).toHaveValue('');
      expect(country()).toBe('US');

      await user.type(input, '2025551234');

      expect(reportedPhone(onChange)).toBe('+12025551234');
      expect(input).toHaveValue('(202) 555-1234');
    });

    it('keeps letters out when typing', async () => {
      const user = userEvent.setup();
      const { onChange, input } = renderPhone();
      await user.type(input, '202x555');
      expect(reportedPhone(onChange)).toBe('+1202555');
    });

    describe('filled all at once, as autofill and paste do', () => {
      function fill(value: string, uiSchema = phoneUi()) {
        const { onChange, input } = renderPhone(uiSchema);
        fireEvent.change(input, { target: { value } });
        return reportedPhone(onChange);
      }

      it.each([
        '2025551234',
        '(202) 555-1234',
        '202-555-1234',
        '1 (202) 555-1234',
        '+1 202-555-1234',
        '+1 202 555 1234',
        '+1 (202) 555-1234',
      ])('reads %s as a US number', (value) => {
        expect(fill(value)).toBe('+12025551234');
        expect(country()).toBe('US');
      });

      it('switches the country for a number with another country code', () => {
        expect(fill('+44 20 7946 0958')).toBe('+442079460958');
        expect(country()).toBe('GB');
      });

      it('reads a pasted national number as a US number', async () => {
        const user = userEvent.setup();
        const { onChange, input } = renderPhone();
        await user.click(input);
        await user.paste('(202) 555-1234');
        expect(reportedPhone(onChange)).toBe('+12025551234');
        expect(country()).toBe('US');
      });

      it.each([
        ['020 7946 0958', '+442079460958'],
        ['07700 900123', '+447700900123'],
      ])("reads %s by the field's own country's rules (ui:options)", (value, phone) => {
        expect(fill(value, phoneUi({ defaultCountry: 'GB' }))).toBe(phone);
        expect(country()).toBe('GB');
      });

      it('starts in the US when the uiSchema names no country it knows', () => {
        expect(fill('(202) 555-1234', phoneUi({ defaultCountry: 'Narnia' }))).toBe('+12025551234');
        expect(country()).toBe('US');
      });
    });

    it('reads a national number in the country picked from the list', async () => {
      const user = userEvent.setup();
      const { onChange, input } = renderPhone();

      await user.click(screen.getByRole('button', { name: /country/i }));
      await user.type(screen.getByRole('textbox', { name: 'Search countries' }), 'kingdom');
      await user.click(screen.getByRole('option', { name: /United Kingdom/ }));
      expect(country()).toBe('GB');
      expect(input).toHaveFocus();
      await user.type(input, '02079460958');

      expect(reportedPhone(onChange)).toBe('+442079460958');
      expect(input).toHaveValue('020 7946 0958');
    });

    it('finds a country in the list by its dial code', async () => {
      const user = userEvent.setup();
      renderPhone();
      await user.click(screen.getByRole('button', { name: /country/i }));
      await user.type(screen.getByRole('textbox', { name: 'Search countries' }), '+353');
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Ireland+353',
      ]);
    });

    describe("a number dialled with the country's exit code", () => {
      it.each([
        ['US', '011 44 20 7946 0958', '+442079460958'],
        ['GB', '00 1 707 397 5275', '+17073975275'],
        ['GB', '0044 20 7946 0958', '+442079460958'],
      ])('in %s reads %s as the number it dials', (defaultCountry, value, phone) => {
        const { onChange, input } = renderPhone(phoneUi({ defaultCountry }));
        fireEvent.change(input, { target: { value } });
        expect(reportedPhone(onChange)).toBe(phone);
      });

      it('reads one typed digit by digit as the number it dials', async () => {
        const user = userEvent.setup();
        const { onChange, input } = renderPhone();
        await user.type(input, '011442079460958');
        expect(reportedPhone(onChange)).toBe('+442079460958');
        // Typing never jumps the cursor: the field keeps what was typed.
        await user.type(input, '{Backspace}8');
        expect(reportedPhone(onChange)).toBe('+442079460958');
      });

      it.each([
        ['555-1234', '+15551234'], // a US local number, not Antigua's +1 268 555 1234
        ['455-1234', '+14551234'],
        ['011 1 707 397 5275', '+17073975275'],
      ])('in the US leaves %s as the number it is (%s)', (value, phone) => {
        const { onChange, input } = renderPhone();
        fireEvent.change(input, { target: { value } });
        expect(reportedPhone(onChange)).toBe(phone);
      });

      it.each(['0207946', '020794609'])(
        'in the UK never makes %s, a number cut short, look whole',
        (value) => {
          const { onChange, input } = renderPhone(phoneUi({ defaultCountry: 'GB' }));
          fireEvent.change(input, { target: { value } });
          const phone = reportedPhone(onChange);
          expect(phone).toMatch(/^\+44/);
          expect(phoneNumberProblem(phone ?? '')).toBeDefined();
        },
      );

      it("leaves a national number as the library reads it", () => {
        const { onChange, input } = renderPhone(phoneUi({ defaultCountry: 'GB' }));
        fireEvent.change(input, { target: { value: '020 7946 0958' } });
        expect(reportedPhone(onChange)).toBe('+442079460958');
      });
    });

    it('shows a saved value not in E.164 form as a number in the field’s country', () => {
      const { onChange, input } = renderPhone(phoneUi(), { phone: '(707) 397-5275' });
      expect(input).toHaveValue('(707) 397-5275');
      expect(country()).toBe('US');
      // Saved in E.164 form once edited.
      fireEvent.change(input, { target: { value: '(707) 397-5276' } });
      expect(reportedPhone(onChange)).toBe('+17073975276');
    });

    it('shows a saved number in its own country', () => {
      const { input } = renderPhone(phoneUi(), { phone: '+442079460958' });
      expect(input).toHaveValue('020 7946 0958');
      expect(country()).toBe('GB');
    });

    describe('with no number past the dial code', () => {
      const required: RJSFSchema = { ...schema, required: ['phone'] };

      it('is required when nothing is entered, like any required text field', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderForm(<JsonSchemaForm schema={required} uiSchema={phoneUi()} onSubmit={onSubmit} />);

        // The browser's own check comes first, as for every required input.
        expect(screen.getByRole('textbox', { name: /Phone/ })).toBeRequired();
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('is required with a dial code alone (#986)', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderForm(<JsonSchemaForm schema={required} uiSchema={phoneUi()} onSubmit={onSubmit} />);

        await user.type(screen.getByRole('textbox', { name: /Phone/ }), '+44');
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
      });

      it.each(['+1', '+44'])('reports no answer for a dial code filled in alone (%s)', (value) => {
        const { onChange, input } = renderPhone();
        fireEvent.change(input, { target: { value } });
        expect(reportedPhone(onChange)).toBeUndefined();
        expect(input).toHaveValue(value);
      });

      it('reports no answer once a number is erased back to its dial code, and keeps it', async () => {
        const user = userEvent.setup();
        const { onChange, input } = renderPhone();
        await user.type(input, '+4420');
        expect(reportedPhone(onChange)).toBe('+4420');

        await user.type(input, '{Backspace}{Backspace}');

        expect(reportedPhone(onChange)).toBeUndefined();
        expect(input).toHaveValue('+44');
        await user.type(input, '2079460958');
        expect(reportedPhone(onChange)).toBe('+442079460958');
      });

      it('reports no answer once a number is cleared', async () => {
        const user = userEvent.setup();
        const { onChange, input } = renderPhone();
        await user.type(input, '2025551234');
        await user.clear(input);
        expect(reportedPhone(onChange)).toBeUndefined();
        expect(input).toHaveValue('');
      });
    });
  });

  describe('phone widget given a number cut short (#1034)', () => {
    // Lark Camp's phone: a pattern any E.164 value matches.
    const schema: RJSFSchema = {
      type: 'object',
      required: ['phone'],
      properties: { phone: { type: 'string', title: 'Phone', pattern: '^\\+[0-9]+$' } },
    };
    const uiSchema: UiSchema = { phone: { 'ui:widget': 'PhoneInput' } };

    it('rejects an area code alone, and takes the whole number', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onSubmit={onSubmit} />);
      const input = screen.getByRole('textbox', { name: /Phone/ });

      await user.type(input, '707');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getAllByText(/Please enter the whole phone number/).length).toBeGreaterThan(0);

      await user.type(input, '3975275');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).toHaveBeenLastCalledWith({ phone: '+17073975275' });
      expect(screen.queryByText(/Please enter the whole phone number/)).not.toBeInTheDocument();
    });

    it('rejects a saved number cut short', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm(
        <JsonSchemaForm
          schema={schema}
          uiSchema={uiSchema}
          formData={{ phone: '+1707' }}
          onSubmit={onSubmit}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getAllByText(/Please enter the whole phone number/).length).toBeGreaterThan(0);
    });
  });

  describe('number fields keep to the schema without changing an answer (#988)', () => {
    const donationSchema = (limits: RJSFSchema = {}): RJSFSchema => ({
      type: 'object',
      properties: { donation: { type: 'integer', title: 'Donation', minimum: 0, ...limits } },
    });

    function renderNumber(schema: RJSFSchema, uiSchema: UiSchema = {}) {
      const onChange = vi.fn();
      const onSubmit = vi.fn();
      renderForm(
        <JsonSchemaForm
          schema={schema}
          uiSchema={uiSchema}
          onChange={onChange}
          onSubmit={onSubmit}
        />,
      );
      return { onChange, onSubmit, input: screen.getByRole('textbox', { name: /Donation/ }) };
    }

    const reported = (onChange: ReturnType<typeof vi.fn>) =>
      (onChange.mock.lastCall?.[0] as { donation?: number } | undefined)?.donation;

    it("won't take a minus sign when the minimum is 0, and keeps the prefix", async () => {
      const user = userEvent.setup();
      const { onChange, input } = renderNumber(donationSchema(), {
        donation: { 'ui:options': { prefix: '$' } },
      });

      await user.type(input, '-10');
      await user.tab();

      expect(input).toHaveValue('$10');
      expect(reported(onChange)).toBe(10);
    });

    it("won't take a decimal point for an integer", async () => {
      const user = userEvent.setup();
      const { onChange, input } = renderNumber(donationSchema());

      await user.type(input, '1.5');

      expect(input).toHaveValue('15');
      expect(reported(onChange)).toBe(15);
    });

    it('takes negative and decimal numbers when the schema allows them', async () => {
      const user = userEvent.setup();
      const schema: RJSFSchema = {
        type: 'object',
        properties: { donation: { type: 'number', title: 'Donation' } },
      };
      const { onChange, input } = renderNumber(schema);

      await user.type(input, '-2.5');

      expect(reported(onChange)).toBe(-2.5);
    });

    it.each([
      ['below the minimum', { minimum: 5 }, '3', 'Please enter 5 or more'],
      ['above the maximum', { maximum: 100 }, '150', 'Please enter 100 or less'],
    ])(
      'keeps a value %s as typed and rejects it with the limit message',
      async (_case, limits, typed, message) => {
        const user = userEvent.setup();
        const { onChange, onSubmit, input } = renderNumber(donationSchema(limits));

        await user.type(input, typed);
        await user.tab();

        // Not clamped on blur: the answer is still what was typed.
        expect(input).toHaveValue(typed);
        expect(reported(onChange)).toBe(Number(typed));
        await user.click(screen.getByRole('button', { name: 'Submit' }));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getAllByText(message).length).toBeGreaterThan(0);
      },
    );

    it('reports no answer when the field is cleared', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderForm(
        <JsonSchemaForm
          schema={donationSchema()}
          formData={{ donation: 25 }}
          onChange={onChange}
        />,
      );

      await user.clear(screen.getByRole('textbox', { name: /Donation/ }));

      expect(reported(onChange)).toBeUndefined();
    });

    it.each([
      [{ type: 'integer', minimum: 0 }, -5, '-5', 'Please enter 0 or more'],
      [{ type: 'integer' }, 2.5, '2.5', 'Please enter a number'],
    ])(
      'shows a saved %j answer the keyboard rules exclude as it is (%s)',
      async (field, saved, shown, message) => {
        const user = userEvent.setup();
        const schema: RJSFSchema = {
          type: 'object',
          properties: { donation: { ...(field as RJSFSchema), title: 'Donation' } },
        };
        renderForm(<JsonSchemaForm schema={schema} formData={{ donation: saved }} />);

        expect(screen.getByRole('textbox', { name: /Donation/ })).toHaveValue(shown);
        await user.click(screen.getByRole('button', { name: 'Submit' }));
        expect(screen.getAllByText(message).length).toBeGreaterThan(0);
      },
    );

    it("offers the schema's examples as suggestions", () => {
      renderForm(<JsonSchemaForm schema={donationSchema({ examples: [25, 50] })} />);
      // With suggestions, the input is a combobox.
      const input = screen.getByRole('combobox', { name: /Donation/ });
      const list = document.getElementById(input.getAttribute('list') ?? '');
      expect([...(list?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual([
        '25',
        '50',
      ]);
    });

    it('naturalNumber still keeps to the schema maximum and minimum', async () => {
      const user = userEvent.setup();
      const schema: RJSFSchema = {
        type: 'object',
        properties: { donation: { type: 'number', title: 'Donation', minimum: 2, maximum: 9 } },
      };
      const { onChange, onSubmit, input } = renderNumber(schema, {
        donation: { 'ui:widget': 'NaturalNumberInput' },
      });

      await user.type(input, '-1.5');
      await user.tab();

      expect(input).toHaveValue('15');
      expect(reported(onChange)).toBe(15);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getAllByText('Please enter 9 or less').length).toBeGreaterThan(0);
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

  it("checkboxes are a group named by the field's label", () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          title: 'Days',
          uniqueItems: true,
          items: { type: 'string', enum: ['Fri', 'Sat'] },
        },
      },
    };
    const uiSchema: UiSchema = { days: { 'ui:widget': 'checkboxes' } };
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} />);

    expect(screen.getByRole('group', { name: 'Days' })).toBeInTheDocument();
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
    // No widget named: rjsf's default text widget, which is NumberWidget for numbers (#987).
    ['an integer', { type: 'integer' }, {}],
    ['a number', { type: 'number' }, {}],
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

  const choices: RJSFSchema = {
    type: 'array',
    uniqueItems: true,
    minItems: 1,
    items: { type: 'string', enum: ['S', 'M'] },
  };
  /** Each widget, and the error it shows when left empty (an empty list isn't missing). */
  const describedCases: [string, RJSFSchema, UiSchema, string][] = [
    ...customWidgetCases.map(([name, field, ui]): [string, RJSFSchema, UiSchema, string] => [
      name,
      field,
      ui,
      'This field is required',
    ]),
    ['select', { type: 'string', enum: ['S', 'M'] }, {}, 'This field is required'],
    ['a multiple select', choices, {}, 'Please choose at least 1'],
    ['checkboxes', choices, { 'ui:widget': 'checkboxes' }, 'Please choose at least 1'],
  ];
  describe.each(describedCases)('%s', (_name, field, ui, errorMessage) => {
    const schema = (required: string[] = []): RJSFSchema => ({
      type: 'object',
      required,
      properties: { value: { ...field, title: 'Value', description: 'Help for **this** field.' } },
    });

    /** The control a screen reader announces for the field: its input, or the checkbox group. */
    const control = () =>
      screen.queryByRole('group', { name: /Value/ }) ?? screen.getByLabelText(/Value/);

    it('names its description to screen readers', () => {
      renderForm(<JsonSchemaForm schema={schema()} uiSchema={{ value: ui }} />);
      expect(control()).toHaveAccessibleDescription('Help for this field.');
    });

    it('still names its error, after a failed submit', () => {
      renderForm(<JsonSchemaForm schema={schema(['value'])} uiSchema={{ value: ui }} />);
      // Submitted as an event: a click would stop at the browser's own check of
      // the `required` attribute (jsdom runs it), before the form's validation.
      fireEvent.submit(document.querySelector('form')!);
      expect(control()).toHaveAccessibleDescription(expect.stringContaining(errorMessage));
      expect(control()).toHaveAccessibleDescription(
        expect.stringContaining('Help for this field.'),
      );
    });
  });
});
