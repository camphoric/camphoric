import type { RJSFSchema } from '@rjsf/utils';
import userEvent from '@testing-library/user-event';
import { renderWithProviders as renderInProvider, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { JsonSchemaForm } from './JsonSchemaForm';

describe('JsonSchemaForm', () => {
  it('renders a data-driven field from the schema', () => {
    const schema: RJSFSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Full name' } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('renders a description as templated markdown against templateData', () => {
    const schema: RJSFSchema = {
      type: 'object',
      description: 'Hello {{who}}',
      properties: { name: { type: 'string', title: 'Name' } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} templateData={{ who: 'World' }} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('reports validation errors on submit instead of submitting', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const onSubmit = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name', minLength: 5 } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} onError={onError} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Name'), 'ab');
    await user.click(screen.getByRole('button'));

    expect(onError).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards form data changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema: RJSFSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Full name' } },
    };
    renderInProvider(<JsonSchemaForm schema={schema} onChange={onChange} />);

    await user.type(screen.getByLabelText('Full name'), 'A');

    expect(onChange).toHaveBeenCalled();
  });

  describe('validation messages', () => {
    // The Camp Harmony lodging picker: "RV Camping" is not a final choice —
    // an RV length must be picked in a second dropdown.
    const lodgingNodes = [
      {
        id: 1,
        parent: null,
        name: 'Lodging',
        children_title: 'Select your lodging',
        remaining_unreserved_capacity: 9,
      },
      {
        id: 2,
        parent: 1,
        name: 'RV Camping',
        children_title: 'RV length',
        remaining_unreserved_capacity: 9,
      },
      {
        id: 3,
        parent: 1,
        name: 'Tent Camping',
        children_title: '',
        remaining_unreserved_capacity: 9,
      },
      {
        id: 4,
        parent: 2,
        name: "RV under 15' long",
        children_title: '',
        remaining_unreserved_capacity: 9,
      },
    ];
    const schema: RJSFSchema = {
      type: 'object',
      properties: {
        campers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              first_name: { type: 'string', title: 'First name' },
              lodging: {
                type: 'object',
                title: 'Lodging',
                properties: {
                  lodging_requested: {
                    type: 'object',
                    title: 'Lodging',
                    required: ['id', 'choices'],
                    properties: {
                      id: { type: 'number' },
                      choices: { type: 'array', minItems: 1, items: { type: 'number' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const uiSchema = {
      campers: {
        items: {
          lodging: {
            lodging_requested: { 'ui:field': 'LodgingRequested', lodging_nodes: lodgingNodes },
          },
        },
      },
    };
    const formData = {
      campers: [{ first_name: 'Child', lodging: { lodging_requested: { choices: [2] } } }],
    };

    it("shows the event's message inline and in the list for an unfinished RV choice", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderInProvider(
        <JsonSchemaForm
          schema={schema}
          uiSchema={uiSchema}
          formData={formData}
          errorMessages={{
            rules: {
              'campers.*.lodging.lodging_requested.id': {
                required: '{{camper}}: please choose your RV length',
              },
            },
          }}
          onSubmit={onSubmit}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).not.toHaveBeenCalled();
      // Once in the list at the top, once under the unfinished dropdown.
      expect(screen.getAllByText('1st camper (Child): please choose your RV length')).toHaveLength(
        2,
      );
      expect(screen.queryByText(/must have required property/)).not.toBeInTheDocument();
    });

    it('shows a readable built-in message in the list when there is no rule', async () => {
      const user = userEvent.setup();
      renderInProvider(<JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={formData} />);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(
        screen.getByText('1st camper (Child) – Lodging: This field is required'),
      ).toBeInTheDocument();
    });
  });
  describe('focusing the first error', () => {
    it('focuses the first field on the page with an error, not the first in schema order', async () => {
      const user = userEvent.setup();
      // Schema rules (not HTML "required", which the browser checks first).
      const schema: RJSFSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', title: 'Email', minLength: 5 },
          name: { type: 'string', title: 'Name', minLength: 5 },
        },
      };
      // ui:order puts Name first on the page.
      renderInProvider(
        <JsonSchemaForm
          schema={schema}
          uiSchema={{ 'ui:order': ['name', 'email'] }}
          formData={{ email: 'a', name: 'b' }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(screen.getByLabelText('Name')).toHaveFocus();
    });

    it('focuses the unfinished dropdown of the lodging picker', async () => {
      const user = userEvent.setup();
      const nodes = [
        {
          id: 1,
          parent: null,
          name: 'Lodging',
          children_title: 'Select your lodging',
          remaining_unreserved_capacity: 9,
        },
        {
          id: 2,
          parent: 1,
          name: 'RV Camping',
          children_title: 'RV length',
          remaining_unreserved_capacity: 9,
        },
        {
          id: 4,
          parent: 2,
          name: "RV under 15' long",
          children_title: '',
          remaining_unreserved_capacity: 9,
        },
      ];
      const schema: RJSFSchema = {
        type: 'object',
        properties: {
          lodging_requested: {
            type: 'object',
            title: 'Lodging',
            required: ['id', 'choices'],
            properties: { id: { type: 'number' }, choices: { type: 'array' } },
          },
        },
      };
      renderInProvider(
        <JsonSchemaForm
          schema={schema}
          uiSchema={{ lodging_requested: { 'ui:field': 'LodgingRequested', lodging_nodes: nodes } }}
          formData={{ lodging_requested: { choices: [2] } }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(screen.getByPlaceholderText('RV length *')).toHaveFocus();
    });
  });
});
