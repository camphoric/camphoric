import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import userEvent from '@testing-library/user-event';
import { parseSearch, stringifySearch } from 'navigation/search';
import { renderWithProviders, screen, waitFor } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { type RegisterStep, useGoToStep } from '../useGoToStep';

function Step({ next }: { next: RegisterStep }) {
  const goToStep = useGoToStep();
  return (
    <button type="button" onClick={() => goToStep(next)}>
      Go to {next}
    </button>
  );
}

/** The register layout and its three steps, each offering a move to `next`. */
function renderInRouter(initialEntry: string, next: RegisterStep) {
  // The router restores scroll on each navigation; jsdom can't scroll.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const root = createRootRoute();
  const layout = createRoute({ getParentRoute: () => root, path: '/events/$eventId/register' });
  const steps = ['registration', 'payment', 'finished'].map((path) =>
    createRoute({ getParentRoute: () => layout, path, component: () => <Step next={next} /> }),
  );
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren(steps)]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    parseSearch,
    stringifySearch,
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('useGoToStep', () => {
  it.each<[string, RegisterStep]>([
    ['registration', 'payment'],
    ['payment', 'finished'],
    ['payment', 'registration'],
  ])('keeps the invitation in the query string going from %s to %s', async (from, next) => {
    const user = userEvent.setup();
    const router = renderInRouter(
      `/events/7/register/${from}?invitation=abc123&email=a%40b.org`,
      next,
    );

    await user.click(await screen.findByRole('button', { name: `Go to ${next}` }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/events/7/register/${next}`));
    expect(router.state.location.searchStr).toBe('?invitation=abc123&email=a%40b.org');
  });

  it('adds no query string when there was none', async () => {
    const user = userEvent.setup();
    const router = renderInRouter('/events/7/register/registration', 'payment');

    await user.click(await screen.findByRole('button', { name: 'Go to payment' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/events/7/register/payment'));
    expect(router.state.location.searchStr).toBe('');
  });
});
