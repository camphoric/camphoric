/**
 * Give money back (SPEC §8.4, §9.7; §15, DR-94). A refund is a negative payment
 * on the invoice. A PayPal or card payment is refunded through PayPal — all or
 * part of what's left of it — and the refund is recorded with PayPal's id; a
 * retried click refunds once (the request id is made when the dialog opens).
 * Anything else — a check mailed back — is recorded here by hand. "Refund the
 * difference" on an overpaid invoice opens this pre-filled with the overpayment.
 */

import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { ApiInvoice, ApiPayment, PaymentType } from 'api-types';
import { useEffect, useMemo, useState } from 'react';
import { useRecordPayment, useRefundPayPal } from 'store/invoices';
import { apiErrorMessage } from 'utils/fetch';
import { formatMoney, roundMoney } from 'utils/money';

const PAYMENT_TYPES: PaymentType[] = ['Check', 'PayPal', 'Card', 'Voucher'];

type Mode = 'paypal' | 'record';

export interface RefundTarget {
  invoice: ApiInvoice;
  /** The payment refunded (from its row); none for "Refund the difference". */
  payment?: ApiPayment;
  /** What to refund, to start with. */
  amount: number;
}

export interface RefundModalProps {
  target: RefundTarget | null;
  /** The invoice's payments, to choose a PayPal one to refund from. */
  payments: ApiPayment[];
  onClose: () => void;
}

const left = (p: ApiPayment) => roundMoney(Number(p.amount) - Number(p.refunded ?? 0));

export function RefundModal({ target, payments, onClose }: RefundModalProps) {
  const refundPayPal = useRefundPayPal();
  const record = useRecordPayment();

  const paypalPayments = useMemo(
    () => payments.filter((p) => p.paypal_refundable && Number(p.amount) > 0),
    [payments],
  );
  const [mode, setMode] = useState<Mode>('record');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>(0);
  const [reason, setReason] = useState('');
  const [type, setType] = useState<PaymentType>('Check');
  const [paidOn, setPaidOn] = useState('');
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    if (!target) return;
    const fromPayPal =
      target.payment?.paypal_refundable ?? (!target.payment && paypalPayments.length > 0);
    setMode(fromPayPal ? 'paypal' : 'record');
    const source = target.payment ?? paypalPayments[0];
    setPaymentId(source ? String(source.id) : null);
    setAmount(source ? Math.min(target.amount, left(source)) : target.amount);
    setType(target.payment?.payment_type ?? 'Check');
    setReason('');
    setPaidOn('');
    setRequestId(crypto.randomUUID());
    refundPayPal.reset();
    record.reset();
    // Start afresh each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;

  const payment = payments.find((p) => String(p.id) === paymentId) ?? target.payment ?? undefined;
  const limit = payment ? left(payment) : undefined;
  const error = refundPayPal.error ?? record.error;

  const done = () => {
    notifications.show({ color: 'green', message: 'Refund recorded' });
    onClose();
  };

  const save = () => {
    const value = Number(amount) || 0;
    if (mode === 'paypal' && payment) {
      refundPayPal.mutate(
        { payment: payment.id, amount: value, reason, requestId },
        { onSuccess: done },
      );
    } else {
      record.mutate(
        {
          registration: target.invoice.registration,
          invoice: target.invoice.id,
          ...(payment ? { refund_of: payment.id } : {}),
          payment_type: type,
          paid_on: paidOn || null,
          amount: -value,
          notes: reason,
          attributes: {},
        },
        { onSuccess: done },
      );
    }
  };

  const canPayPal = target.payment ? !!target.payment.paypal_refundable : paypalPayments.length > 0;

  return (
    <Modal opened onClose={onClose} title={`Refund — invoice #${target.invoice.id}`}>
      <Stack>
        {canPayPal && (
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            data={[
              { value: 'paypal', label: 'Refund through PayPal' },
              { value: 'record', label: 'Record a refund' },
            ]}
          />
        )}
        {mode === 'paypal' && !target.payment && paypalPayments.length > 1 && (
          <Select
            label="From payment"
            data={paypalPayments.map((p) => ({
              value: String(p.id),
              label: `${p.payment_type} ${formatMoney(p.amount)} on ${p.paid_on ?? '—'}`,
            }))}
            value={paymentId}
            onChange={setPaymentId}
            allowDeselect={false}
          />
        )}
        {mode === 'paypal' ? (
          <Text size="sm">
            PayPal returns the money to the payer, and the refund is recorded here.
          </Text>
        ) : (
          <>
            <Select
              label="Refunded by"
              data={PAYMENT_TYPES}
              value={type}
              onChange={(value) => setType((value as PaymentType | null) ?? 'Check')}
              allowDeselect={false}
            />
            <DateInput
              label="Refunded on"
              valueFormat="MM/DD/YYYY"
              value={paidOn || null}
              onChange={(value) => setPaidOn(value ?? '')}
            />
          </>
        )}
        <NumberInput
          label="Amount to refund"
          prefix="$"
          decimalScale={2}
          min={0}
          max={limit}
          value={amount}
          onChange={setAmount}
          description={limit !== undefined ? `Up to ${formatMoney(limit)}` : undefined}
        />
        <TextInput
          label={mode === 'paypal' ? 'Reason (sent to the payer)' : 'Notes'}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        {error && (
          <Alert color="red" variant="light">
            {apiErrorMessage(error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            onClick={save}
            loading={refundPayPal.isPending || record.isPending}
            disabled={!(Number(amount) > 0)}
          >
            {mode === 'paypal' ? 'Refund through PayPal' : 'Record refund'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
