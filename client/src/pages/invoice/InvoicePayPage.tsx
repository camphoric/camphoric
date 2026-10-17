/**
 * An invoice's public pay page, `/invoices/$token` (SPEC §4, §9.7; §15, DR-95).
 * Anyone with the link sees the invoice and, while something is due and the
 * event takes payments online, can pay it with PayPal's buttons: the server
 * creates the order (with the handling fee, added to the invoice only once
 * it's captured) and captures it on approval (DR-90). A check registrant's
 * invoice can be paid here too (#623). No sign-in.
 */

import { Alert, Box, Container, LoadingOverlay, Stack, Text } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { useParams } from '@tanstack/react-router';
import type { PaymentType } from 'api-types';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { FullScreenLoading } from 'components/Loading';
import { PayPalCheckout } from 'components/PayPalCheckout';
import { useState } from 'react';
import {
  invoicePayProblem,
  useCaptureInvoiceOrder,
  useCreateInvoiceOrder,
  useInvoicePay,
} from 'store/invoicePay';
import { formatMoney } from 'utils/money';

import { InvoiceSummary } from './InvoiceSummary';

export function InvoicePayPage() {
  const { token } = useParams({ from: '/invoices/$token' });
  const { data: page, isLoading, isError } = useInvoicePay(token);
  const createOrder = useCreateInvoiceOrder(token);
  const capture = useCaptureInvoiceOrder(token);
  const [message, setMessage] = useState<{ color: string; text: string } | null>(null);
  const [unknown, setUnknown] = useState(false);

  useDocumentTitle(page ? `Invoice #${page.invoice.id} — ${page.event.name}` : 'Invoice');

  if (isLoading) return <FullScreenLoading message="Loading invoice…" />;
  if (isError || !page) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" variant="light" title="Invoice not found">
          This link doesn’t lead to an invoice. Please check it, or contact the organizers.
        </Alert>
      </Container>
    );
  }

  const order = async (paymentType: PaymentType) => {
    setMessage(null);
    try {
      return (await createOrder.mutateAsync(paymentType)).orderID;
    } catch (error) {
      const problem = invoicePayProblem(error);
      setMessage({
        color: 'red',
        text: problem?.detail ?? 'PayPal couldn’t start this payment. Please try again.',
      });
      throw error;
    }
  };

  const approve = (orderID: string, paymentType: PaymentType) =>
    capture.mutate(
      { orderID, paymentType },
      {
        onSuccess: () => setMessage({ color: 'green', text: 'Thank you — your payment is in.' }),
        onError: (error) => {
          const problem = invoicePayProblem(error);
          if (problem?.code === 'unknown') setUnknown(true);
          setMessage({
            color: problem?.code === 'unknown' ? 'yellow' : 'red',
            text:
              problem?.code === 'unknown'
                ? 'We couldn’t confirm your payment with PayPal. Please don’t pay again: ' +
                  'we’ll check and let you know.'
                : (problem?.detail ?? 'Your payment didn’t go through. Please try again.'),
          });
        },
      },
    );

  const { online, invoice } = page;
  const settled = invoice.status === 'paid' || invoice.status === 'overpaid';

  return (
    <Container size="sm" py="xl">
      <ErrorBoundary>
        <Box pos="relative">
          <LoadingOverlay visible={capture.isPending} />
          <Stack>
            <InvoiceSummary page={page} />
            {message && (
              <Alert color={message.color} variant="light">
                {message.text}
              </Alert>
            )}
            {invoice.status === 'cancelled' && (
              <Alert color="gray" variant="light">
                This invoice has been cancelled; nothing is due on it.
              </Alert>
            )}
            {settled && !message && (
              <Alert color="green" variant="light">
                This invoice is paid. Thank you!
              </Alert>
            )}
            {invoice.pending && !unknown && !settled && (
              <Alert color="yellow" variant="light">
                A payment on this invoice is waiting to be confirmed. If you’ve paid, please don’t
                pay again.
              </Alert>
            )}
            {online && !unknown && (
              <Stack gap="xs">
                <Text size="sm">
                  Pay {formatMoney(online.total)} online with your PayPal account, or choose “Debit
                  or Credit Card” to pay by card without one
                  {online.handling > 0
                    ? ` (includes ${formatMoney(online.handling)} electronic payment handling).`
                    : '.'}
                </Text>
                <PayPalCheckout
                  clientId={online.clientId}
                  createOrder={order}
                  onApprove={approve}
                  onStart={() => setMessage(null)}
                  onError={() =>
                    setMessage(
                      (current) =>
                        current ?? {
                          color: 'red',
                          text: 'PayPal ran into a problem. Please try again.',
                        },
                    )
                  }
                  disabled={capture.isPending}
                />
              </Stack>
            )}
            {!online && !settled && invoice.status !== 'cancelled' && (
              <Text size="sm" c="dimmed">
                This invoice can’t be paid online. Please contact the organizers to pay.
              </Text>
            )}
          </Stack>
        </Box>
      </ErrorBoundary>
    </Container>
  );
}
