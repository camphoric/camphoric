/**
 * Payment step when nothing is owed (total ≤ 0) — SPEC §7.2. Completes the
 * registration without collecting payment (no invoice is made) and advances
 * to confirmation. If the server no longer has the registration, it's back to
 * step 1 to send the form again (§7.1); any other refusal (such as an
 * invitation another registration has since redeemed, #803) is shown.
 */

import { Alert, Button, Stack, Title } from '@mantine/core';
import { useGoToStep } from 'hooks/useGoToStep';
import { useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import { paymentProblem, registrationNotFound, useSubmitPayment } from 'store/registrationApi';
import { formatMoney } from 'utils/money';

import { useForgetSentRegistration } from '../useForgetSentRegistration';

interface NoPaymentProps {
  eventId: string;
  registrationUUID: string;
}

export function NoPayment({ eventId, registrationUUID }: NoPaymentProps) {
  const goToStep = useGoToStep();
  const submit = useSubmitPayment(eventId);
  const setConfirmationStep = useRegistrationStore((state) => state.setConfirmationStep);
  const forgetSentRegistration = useForgetSentRegistration();
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    setError(null);
    submit.mutate(
      { registrationUUID },
      {
        onSuccess: (confirmation) => {
          setConfirmationStep(confirmation);
          goToStep('finished');
        },
        onError: (e) => {
          if (registrationNotFound(e)) forgetSentRegistration(registrationUUID);
          else setError(paymentProblem(e).message);
        },
      },
    );
  };

  return (
    <Stack>
      <Title order={3}>Total: {formatMoney(0)}</Title>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <Button onClick={finish} loading={submit.isPending}>
        Finish registration
      </Button>
    </Stack>
  );
}
