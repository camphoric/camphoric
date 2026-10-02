/**
 * A registration's fees, invoices and payments (SPEC §8.4, §9.7). The fee
 * breakdown from `server_pricing_results` (Registrars and Admins can override
 * the registration's own price lines; DR-56), the ledger, and each invoice
 * with its payments and refunds. Registrars and Admins record payments, edit,
 * cancel and reopen invoices, check a pending PayPal order and refund; only
 * Admins delete a payment or an invoice (§15, DR-93). Deleted payments can be
 * restored (DR-55). Every role sees everything, invoice notes included.
 */

import { Button, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiEvent, ApiInvoice, ApiPayment, AugmentedRegistration } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { CanEdit, usePermissions } from 'hooks/permissions';
import { PriceLines } from 'pages/admin/pricing';
import { useState } from 'react';
import { useDeletedPayments, useRestore } from 'store/deletes';
import { invoiceHooks, paymentHooks } from 'store/entities';
import { useCheckPayPalOrder, useInvoiceStatusAction } from 'store/invoices';
import { apiErrorMessage } from 'utils/fetch';

import { EditInvoiceModal } from './EditInvoiceModal';
import { InvoiceCard, paymentName } from './InvoiceCard';
import { LedgerSummary } from './LedgerSummary';
import { RecordPaymentModal } from './RecordPaymentModal';
import { RefundModal, type RefundTarget } from './RefundModal';

interface RegistrationInvoicesProps {
  event: ApiEvent;
  registration: AugmentedRegistration;
}

export function RegistrationInvoices({ event, registration }: RegistrationInvoicesProps) {
  const { data: invoices } = invoiceHooks.useList({ registration: registration.id });
  const { data: payments } = paymentHooks.useList({ registration: registration.id });
  const { canEdit, canDeletePayments } = usePermissions();
  const { data: deleted } = useDeletedPayments({ registration: registration.id }, canEdit);
  const deleteInvoice = invoiceHooks.useDelete();
  const deletePayment = paymentHooks.useDelete();
  const cancel = useInvoiceStatusAction('cancel');
  const reopen = useInvoiceStatusAction('reopen');
  const checkPayPal = useCheckPayPalOrder();
  const restore = useRestore('payments');

  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<ApiInvoice | null>(null);
  const [refunding, setRefunding] = useState<RefundTarget | null>(null);

  const paymentsOf = (invoice: ApiInvoice): ApiPayment[] =>
    (payments ?? []).filter((p) => Number(p.invoice) === invoice.id);

  const failed = (error: unknown) =>
    notifications.show({ color: 'red', message: apiErrorMessage(error) });

  const confirmCancel = (invoice: ApiInvoice) => {
    let reason = '';
    modals.openConfirmModal({
      title: `Cancel invoice #${invoice.id}`,
      children: (
        <Stack gap="xs">
          <Text size="sm">Nothing will be owed on it. You can reopen it later.</Text>
          <TextInput
            label="Reason"
            data-autofocus
            onChange={(e) => (reason = e.currentTarget.value)}
          />
        </Stack>
      ),
      labels: { confirm: 'Cancel invoice', cancel: 'Keep it' },
      onConfirm: () => cancel.mutate({ id: invoice.id, reason }, { onError: failed }),
    });
  };

  const confirmDeleteInvoice = (invoice: ApiInvoice) =>
    confirmDelete({
      path: 'invoices',
      id: invoice.id,
      title: 'Delete invoice',
      message: <>Delete invoice #{invoice.id}?</>,
      onConfirm: () => deleteInvoice.mutate({ id: invoice.id }),
    });

  const confirmDeletePayment = (p: ApiPayment) =>
    confirmDelete({
      path: 'payments',
      id: p.id,
      title: Number(p.amount) < 0 ? 'Delete refund' : 'Delete payment',
      message: <>Delete the {paymentName(p)}?</>,
      onConfirm: () => deletePayment.mutate({ id: p.id }),
    });

  const checkOrder = (invoice: ApiInvoice) =>
    checkPayPal.mutate(invoice.id, {
      onSuccess: ({ result }) =>
        notifications.show({
          color: result === 'recorded' ? 'green' : 'blue',
          message:
            result === 'recorded'
              ? 'PayPal captured it: the payment is recorded.'
              : 'PayPal never captured it: no money was taken.',
        }),
      onError: failed,
    });

  return (
    <Stack>
      <Title order={4}>Fees &amp; payments</Title>

      <PriceLines
        event={event}
        results={registration.server_pricing_results}
        logics={[event.registration_pricing_logic, event.camper_pricing_logic]}
        registrationId={registration.id}
        promoLabel={registration.promo?.label}
      />

      <LedgerSummary ledger={registration} />

      <Group justify="space-between">
        <Text fw={600}>Invoices</Text>
        <CanEdit>
          <Button variant="light" size="compact-md" onClick={() => setRecording(true)}>
            Record payment
          </Button>
        </CanEdit>
      </Group>

      {invoices && invoices.length > 0 ? (
        invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            payments={paymentsOf(invoice)}
            paymentSchema={event.payment_schema}
            canEdit={canEdit}
            canDelete={canDeletePayments}
            onEdit={() => setEditing(invoice)}
            onCancel={() => confirmCancel(invoice)}
            onReopen={() => reopen.mutate({ id: invoice.id }, { onError: failed })}
            onCheckPayPal={() => checkOrder(invoice)}
            checkingPayPal={checkPayPal.isPending && checkPayPal.variables === invoice.id}
            onDelete={() => confirmDeleteInvoice(invoice)}
            onDeletePayment={confirmDeletePayment}
            onRefund={(payment) =>
              setRefunding({
                invoice,
                payment,
                amount: Number(payment.amount) - Number(payment.refunded ?? 0),
              })
            }
            onRefundDifference={() => setRefunding({ invoice, amount: Number(invoice.overpaid) })}
          />
        ))
      ) : (
        <Text c="dimmed" size="sm">
          No invoices yet.
        </Text>
      )}

      {canEdit && deleted && deleted.length > 0 && (
        <Stack gap="xs">
          <Text fw={600}>Deleted payments</Text>
          {deleted.map((p) => (
            <Group key={p.id} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {paymentName(p)}
                {p.paid_on ? ` (paid ${p.paid_on})` : ''} — deleted{' '}
                {new Date(p.deleted_at).toLocaleString()}
                {p.deleted_by ? ` by ${p.deleted_by.name}` : ''}
              </Text>
              <Button
                size="compact-sm"
                variant="light"
                loading={restore.isPending && restore.variables === p.id}
                onClick={() =>
                  restore.mutate(p.id, {
                    onSuccess: () =>
                      notifications.show({ color: 'green', message: 'Payment restored' }),
                  })
                }
              >
                Restore
              </Button>
            </Group>
          ))}
        </Stack>
      )}

      <RecordPaymentModal
        event={event}
        registrationId={registration.id}
        invoices={invoices ?? []}
        opened={recording}
        onClose={() => setRecording(false)}
      />
      <EditInvoiceModal
        invoice={editing}
        uninvoicedBalance={registration.uninvoiced_balance}
        handlingPercent={Number(event.epayment_handling) || 0}
        onClose={() => setEditing(null)}
      />
      <RefundModal
        target={refunding}
        payments={refunding ? paymentsOf(refunding.invoice) : []}
        onClose={() => setRefunding(null)}
      />
    </Stack>
  );
}
