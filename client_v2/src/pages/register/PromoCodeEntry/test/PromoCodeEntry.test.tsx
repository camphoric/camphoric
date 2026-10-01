import userEvent from '@testing-library/user-event';
import type { AppliedPromo } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PromoCodeEntry } from '../PromoCodeEntry';
import { UNAPPLIED_MESSAGE, usePromoCodeEntry } from '../usePromoCodeEntry';

const { checkMutate } = vi.hoisted(() => ({ checkMutate: vi.fn() }));

vi.mock('store/registrationApi', () => ({
  useCheckPromoCode: () => ({ mutate: checkMutate, isPending: false }),
}));

const SPRING: AppliedPromo = {
  code: 'SPRING',
  label: 'Spring sale',
  scope: 'registration',
  pricingLogic: 20,
};

type Callbacks = { onSuccess: (promo: AppliedPromo) => void; onError: (error: unknown) => void };

/** The server's answer to the next check. */
function answerCheck(answer: AppliedPromo | ApiError) {
  checkMutate.mockImplementationOnce((_code: string, callbacks: Callbacks) => {
    if (answer instanceof ApiError) callbacks.onError(answer);
    else callbacks.onSuccess(answer);
  });
}

const invalid = new ApiError(400, 'Bad Request', {
  detail: 'That promo code isn’t valid for this event.',
});

/** The field as the registration step uses it, with a stand-in submit button. */
function Harness({ onPromoChange, onSubmit }: { onPromoChange: () => void; onSubmit: () => void }) {
  const entry = usePromoCodeEntry('1', onPromoChange);
  return (
    <>
      <PromoCodeEntry {...entry.props} />
      <button type="button" onClick={() => entry.readyToSubmit() && onSubmit()}>
        Continue
      </button>
    </>
  );
}

function setup() {
  const onPromoChange = vi.fn();
  const onSubmit = vi.fn();
  renderWithProviders(<Harness onPromoChange={onPromoChange} onSubmit={onSubmit} />);
  return { user: userEvent.setup(), onPromoChange, onSubmit };
}

const field = () => screen.getByRole('textbox', { name: 'Promo code' });

beforeEach(() => {
  checkMutate.mockReset();
  useRegistrationStore.getState().reset();
});

describe('PromoCodeEntry', () => {
  it('applies a code the server accepts, and removes it', async () => {
    const { user, onPromoChange } = setup();
    answerCheck(SPRING);

    await user.type(field(), ' spring ');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(checkMutate).toHaveBeenCalledWith('spring', expect.any(Object));
    expect(screen.getByText('Applied: Spring sale')).toBeInTheDocument();
    expect(field()).toHaveValue('SPRING');
    expect(useRegistrationStore.getState().promo).toEqual(SPRING);
    expect(onPromoChange).toHaveBeenLastCalledWith(SPRING);

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(field()).toHaveValue('');
    expect(useRegistrationStore.getState().promo).toBeNull();
    expect(onPromoChange).toHaveBeenLastCalledWith(null);
  });

  it('applies on Enter rather than submitting', async () => {
    const { user } = setup();
    answerCheck(SPRING);
    await user.type(field(), 'spring{Enter}');
    expect(screen.getByText('Applied: Spring sale')).toBeInTheDocument();
  });

  it('shows why the server refused a code', async () => {
    const { user } = setup();
    answerCheck(invalid);
    await user.type(field(), 'nope');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That promo code isn’t valid');
    expect(useRegistrationStore.getState().promo).toBeNull();
  });

  it('un-applies a code once the field no longer holds it', async () => {
    const { user, onPromoChange } = setup();
    answerCheck(SPRING);
    await user.type(field(), 'spring');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await user.type(field(), 'X');
    expect(useRegistrationStore.getState().promo).toBeNull();
    expect(onPromoChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('blocks submitting a code that was typed but not applied', async () => {
    const { user, onSubmit } = setup();
    await user.type(field(), 'spring');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(UNAPPLIED_MESSAGE);
    expect(field()).toHaveFocus();

    await user.clear(field());
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('lets an applied code through', async () => {
    const { user, onSubmit } = setup();
    answerCheck(SPRING);
    await user.type(field(), 'spring');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
