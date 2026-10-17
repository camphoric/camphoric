import type { ApiEditLease } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BeingEdited, BeingEditedView, EventLeasesProvider } from '../BeingEdited';
import { ALEX_EDITING } from './leases';

const state = vi.hoisted(() => ({ leases: [] as ApiEditLease[] }));

vi.mock('store/leases', () => ({
  CLIENT_ID: 'my-tab',
  useEventLeases: () => ({ data: state.leases }),
}));
vi.mock('hooks/auth', () => ({ useCurrentUser: () => ({ data: { id: 9 } }) }));

const mine = { ...ALEX_EDITING, id: 2, object_id: 14, holder: { id: 9, name: 'Me' } };

function list() {
  renderWithProviders(
    <EventLeasesProvider eventId={4}>
      <span data-testid="13">
        <BeingEdited model="registration" id={13} />
      </span>
      <span data-testid="14">
        <BeingEdited model="registration" id={14} />
      </span>
      <span data-testid="camper-13">
        <BeingEdited model="camper" id={13} />
      </span>
    </EventLeasesProvider>,
  );
}

beforeEach(() => {
  state.leases = [];
});

describe('BeingEditedView', () => {
  it('says who is editing, and since when', () => {
    renderWithProviders(<BeingEditedView lease={ALEX_EDITING} isYou={false} />);
    expect(
      screen.getByRole('img', { name: /^Alex Registrar is editing this \(since / }),
    ).toBeInTheDocument();
  });

  it('knows it may be you in another tab', () => {
    renderWithProviders(<BeingEditedView lease={ALEX_EDITING} isYou />);
    expect(
      screen.getByRole('img', { name: /^You are editing this in another tab/ }),
    ).toBeInTheDocument();
  });
});

describe('BeingEdited', () => {
  it('marks the records someone else is editing, by kind and id', () => {
    state.leases = [ALEX_EDITING];
    list();
    expect(screen.getByTestId('13')).not.toBeEmptyDOMElement();
    expect(screen.getByTestId('14')).toBeEmptyDOMElement();
    expect(screen.getByTestId('camper-13')).toBeEmptyDOMElement();
  });

  it('doesn’t mark what this tab is editing', () => {
    state.leases = [{ ...mine, client_id: 'my-tab' }];
    list();
    expect(screen.getByTestId('14')).toBeEmptyDOMElement();
  });

  it('marks what you’re editing in another tab as yours', () => {
    state.leases = [{ ...mine, client_id: 'other-tab' }];
    list();
    expect(
      screen.getByRole('img', { name: /^You are editing this in another tab/ }),
    ).toBeInTheDocument();
  });

  it('marks nothing outside an event', () => {
    renderWithProviders(<BeingEdited model="registration" id={13} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
