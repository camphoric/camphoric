import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { confirmDelete, ConfirmDeleteView, named } from '../ConfirmDelete';
import { BLOCKED, LODGING, NOTHING_ELSE, REGISTRATION, SENT_TEMPLATE } from './previews';

const preview = vi.hoisted(() => ({ current: {} }));
vi.mock('store/deletes', () => ({ useDeletePreview: () => preview.current }));

function view(props: Partial<Parameters<typeof ConfirmDeleteView>[0]> = {}) {
  const onConfirm = vi.fn();
  renderWithProviders(
    <ConfirmDeleteView
      message="Delete “Cabins”?"
      onConfirm={onConfirm}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onConfirm, user: userEvent.setup() };
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete' });

describe('ConfirmDeleteView', () => {
  it('waits for the preview before offering the delete', () => {
    view();
    expect(screen.getByText('Checking what this would affect…')).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();
  });

  it('shows what goes with it and what changes', async () => {
    const { onConfirm, user } = view({ preview: LODGING });
    expect(screen.getByText('Also deleted with it:')).toBeInTheDocument();
    expect(screen.getByText('2 lodgings: Cabin A, Cabin B')).toBeInTheDocument();
    expect(
      screen.getByText('23 campers will be unassigned from their lodging'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Camper 20, and 3 more$/)).toBeInTheDocument();
    expect(screen.getByText('This can’t be undone.')).toBeInTheDocument();
    await user.click(deleteButton());
    expect(onConfirm).toHaveBeenCalled();
  });

  it('says when nothing else is affected', () => {
    view({ preview: NOTHING_ELSE });
    expect(screen.getByText('Nothing else is affected. This can’t be undone.')).toBeInTheDocument();
  });

  it('says a restorable delete can be undone', () => {
    view({ preview: REGISTRATION });
    expect(
      screen.getByText('These go with it, and come back if it’s restored:'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 campers: Pat Alpha, Sam Alpha')).toBeInTheDocument();
    expect(screen.getByText('It can be restored later.')).toBeInTheDocument();
  });

  it('counts email records without listing them', () => {
    view({ preview: SENT_TEMPLATE });
    expect(screen.getByText('140 email messages stay in the email history')).toBeInTheDocument();
  });

  it('explains what blocks it, without a delete', () => {
    view({ preview: BLOCKED });
    expect(screen.getByText('This can’t be deleted')).toBeInTheDocument();
    expect(screen.getByText('Campers still have this charge.')).toBeInTheDocument();
    expect(screen.getByText('Linens $25.00')).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();
  });

  it('offers only Cancel when the preview fails', () => {
    view({ error: new Error('Network down') });
    expect(screen.getByText('Network down')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('can use another word for it', () => {
    view({ preview: NOTHING_ELSE, confirmLabel: 'Remove' });
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });
});

describe('confirmDelete', () => {
  it('asks the server, then deletes and closes', async () => {
    preview.current = { data: REGISTRATION, error: null };
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <button
        type="button"
        onClick={() =>
          confirmDelete({
            path: 'registrations',
            id: 5,
            title: 'Delete registration',
            message: 'Delete the registration for “pat@example.com”?',
            onConfirm,
          })
        }
      >
        Open
      </button>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Delete registration')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('named', () => {
  it('adds how many more there are', () => {
    expect(named(['A', 'B'], 2)).toBe('A, B');
    expect(named(['A', 'B'], 5)).toBe('A, B, and 3 more');
  });
});
