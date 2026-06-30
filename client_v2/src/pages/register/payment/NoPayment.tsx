/**
 * Payment step when nothing is owed (total ≤ 0) — SPEC §7.2. Completes the flow
 * without collecting payment: posts a zero Check payment and advances to
 * confirmation.
 */

import { Button, Stack, Title } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import type { InitialPaymentBody } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { useSubmitPayment } from 'store/registrationApi';
import { formatMoney } from 'utils/money';

interface NoPaymentProps {
  eventId: string;
  registrationUUID: string;
}

export function NoPayment({ eventId, registrationUUID }: NoPaymentProps) {
  const navigate = useNavigate();
  const submit = useSubmitPayment(eventId);
  const setPaymentInfo = useRegistrationStore((state) => state.setPaymentInfo);
  const setConfirmationStep = useRegistrationStore((state) => state.setConfirmationStep);

  const finish = () => {
    const initialPayment: InitialPaymentBody = {
      registrationUUID,
      paymentType: 'Check',
      paymentData: { type: 'none', total: 0 },
    };
    setPaymentInfo(initialPayment);
    submit.mutate(initialPayment, {
      onSuccess: (confirmation) => {
        setConfirmationStep(confirmation);
        void navigate({ to: '/events/$eventId/register/finished', params: { eventId } });
      },
    });
  };

  return (
    <Stack>
      <Title order={3}>Total: {formatMoney(0)}</Title>
      <Button onClick={finish} loading={submit.isPending}>
        Finish registration
      </Button>
    </Stack>
  );
}
