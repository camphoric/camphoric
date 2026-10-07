/**
 * What the payment page says when a payment didn't go through after the
 * registrant pressed PayPal or Card (SPEC §7.2; §15, DR-91). They're
 * registered already — the button completed the registration — so it says
 * what's still due, and offers to finish and pay later; they can also try
 * again or pay by check from the page. When PayPal's answer was lost
 * (`unknown`), money may have moved: it asks them not to pay again. When the
 * organizers cancelled the invoice (the `cancelled` code, §15 DR-105), there's nothing
 * to pay here: it gives their message and offers only to finish.
 */

import { Alert, Button, Stack, Text } from '@mantine/core';
import { formatMoney } from 'utils/money';

export interface PaymentNotFinishedProps {
  /** What's still due now, by check. */
  amountDue: number;
  /** The server's or PayPal's reason, if any. */
  reason?: string;
  /** PayPal's answer was lost: don't offer to pay again. */
  unknown?: boolean;
  /** The organizers cancelled the invoice: nothing can be paid here. */
  invoiceCancelled?: boolean;
  onFinish: () => void;
  finishing?: boolean;
}

export function PaymentNotFinished({
  amountDue,
  reason,
  unknown,
  invoiceCancelled,
  onFinish,
  finishing,
}: PaymentNotFinishedProps) {
  if (invoiceCancelled) {
    return (
      <Alert color="yellow" variant="light" title="Please contact the organizers">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">
            You’re registered. {reason ?? 'The organizers have changed what’s due.'}
          </Text>
          <Button onClick={onFinish} loading={finishing}>
            Finish
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (unknown) {
    return (
      <Alert color="yellow" variant="light" title="We couldn’t confirm your payment">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">
            You’re registered, but PayPal didn’t tell us whether your payment went through. Please
            don’t pay again: we’ll check with PayPal and let you know.
          </Text>
          <Button onClick={onFinish} loading={finishing}>
            Finish
          </Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <Alert
      color="orange"
      variant="light"
      title="You’re registered — your payment didn’t go through"
    >
      <Stack gap="sm" align="flex-start">
        {reason && <Text size="sm">{reason}</Text>}
        <Text size="sm">
          {formatMoney(amountDue)} is still due. You can try again, pay by check, or finish now and
          pay later.
        </Text>
        <Button variant="light" onClick={onFinish} loading={finishing}>
          Finish and pay later
        </Button>
      </Stack>
    </Alert>
  );
}
