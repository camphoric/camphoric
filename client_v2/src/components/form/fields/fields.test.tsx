import { MantineProvider } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonSchemaForm } from 'components/form';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

function renderForm(node: ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>);
}

describe('Campers field', () => {
  const schema: RJSFSchema = {
    type: 'object',
    properties: {
      campers: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string', title: 'Name' } } },
      },
    },
  };
  const uiSchema: UiSchema = { campers: { 'ui:field': 'Campers' } };

  it('labels each camper with an ordinal and offers to add the next', () => {
    renderForm(
      <JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={{ campers: [{}, {}] }} />,
    );
    expect(screen.getByText('1st Camper')).toBeInTheDocument();
    expect(screen.getByText('2nd Camper')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add a 3rd Camper/ })).toBeInTheDocument();
  });

  it('adds a camper when the add button is clicked', async () => {
    const user = userEvent.setup();
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={{ campers: [{}] }} />);

    expect(screen.queryByText('2nd Camper')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add a 2nd Camper/ }));
    expect(screen.getByText('2nd Camper')).toBeInTheDocument();
  });
});

describe('LodgingRequested field', () => {
  const schema: RJSFSchema = {
    type: 'object',
    properties: { lodging_requested: { type: 'object' } },
  };
  const lodgingNodes = [
    { id: 1, parent: null, name: 'Camp', children_title: 'Area', remaining_unreserved_capacity: 10 },
    { id: 2, parent: 1, name: 'Cabins', children_title: 'Cabin', remaining_unreserved_capacity: 10 },
    { id: 3, parent: 2, name: 'Cabin A', children_title: '', remaining_unreserved_capacity: 4 },
    { id: 4, parent: 2, name: 'Cabin B', children_title: '', remaining_unreserved_capacity: 0 },
  ];
  const uiSchema: UiSchema = {
    lodging_requested: { 'ui:field': 'LodgingRequested', lodging_nodes: lodgingNodes },
  };

  it('cascades level by level and resolves a leaf to id + name', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} onChange={onChange} />);

    // Level 0: the root's children (placeholder from children_title).
    await user.click(screen.getByPlaceholderText('Area *'));
    await user.click(screen.getByText('Cabins'));

    type LodgingForm = { lodging_requested?: { choices?: number[]; id?: number; name?: string } };
    // Choosing a non-leaf records the path but not a leaf id yet.
    let last = onChange.mock.calls.at(-1)?.[0] as LodgingForm;
    expect(last.lodging_requested?.choices).toEqual([2]);
    expect(last.lodging_requested?.id).toBeUndefined();

    // Level 1 appears; pick a leaf.
    await user.click(screen.getByPlaceholderText('Cabin *'));
    await user.click(screen.getByText('Cabin A'));

    last = onChange.mock.calls.at(-1)?.[0] as LodgingForm;
    expect(last.lodging_requested?.choices).toEqual([2, 3]);
    expect(last.lodging_requested?.id).toBe(3);
    expect(last.lodging_requested?.name).toBe('Cabin A');
  });

  it('disables a full lodging option', async () => {
    const user = userEvent.setup();
    renderForm(<JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={{ lodging_requested: { choices: [2] } }} />);

    await user.click(screen.getByPlaceholderText('Cabin *'));
    const fullOption = screen.getByText('Cabin B (full)').closest('[role="option"]');
    expect(fullOption).toHaveAttribute('data-combobox-disabled', 'true');
  });
});
