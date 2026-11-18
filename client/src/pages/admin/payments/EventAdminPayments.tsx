/**
 * Payments (SPEC §8.11; §15, DR-170): the event's money work in one place.
 * Three views, the open one URL-addressable via `?paymentsTab`:
 *
 * - **Needs attention** (the default): refunds due, overpaid invoices,
 *   balances no invoice asks for, invoices past due, and PayPal orders to
 *   check — built by the server, and current as payments, refunds and
 *   invoices change (the live change feed, DR-112). Each opens its
 *   registration's invoices with the action ready.
 * - **Invoices** and **Payments**: every invoice, and every payment and
 *   refund, filtered, with the totals of the rows shown.
 *
 * Every role reads it; Registrars and Admins take the actions, under the
 * registration screen's rules (Reporters open the registration to look).
 * A registration opens over the page (`?registrationId`).
 */

import { Stack, Tabs, Title } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiPaymentsAttentionItem } from 'api-types';
import { FullScreenLoading, InlineLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { useAugmentedRegistrations } from 'hooks/useAdminData';
import { useSearchTab } from 'hooks/useSearchTab';
import { RegistrationEditorModal } from 'pages/admin/registrations';
import { useMemo } from 'react';
import { eventHooks, invoiceHooks, paymentHooks } from 'store/entities';
import { usePaymentsAttention } from 'store/paymentsAttention';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { attentionAction } from './attention';
import { AttentionList } from './AttentionList';
import { InvoicesLedger } from './InvoicesLedger';
import {
  invoiceFiltersFromSearch,
  invoiceFiltersToSearch,
  paymentFiltersFromSearch,
  paymentFiltersToSearch,
  registrationNames,
} from './ledgers';
import { PaymentsLedger } from './PaymentsLedger';

const FROM = '/admin/organization/$organizationId/event/$eventId';
const TABS = ['attention', 'invoices', 'payments'] as const;

export function EventAdminPayments() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [tab, setTab] = useSearchTab('paymentsTab', TABS);

  const { data: event } = eventHooks.useById(eventId);
  const registrations = useAugmentedRegistrations(eventId);
  const { data: attention } = usePaymentsAttention(eventId);
  // The ledgers' lists load once their view is first shown.
  const { data: invoices } = invoiceHooks.useList(
    { registration__event: eventId },
    tab === 'invoices',
  );
  const { data: payments } = paymentHooks.useList(
    { registration__event: eventId },
    tab === 'payments',
  );

  const names = useMemo(() => registrationNames(registrations ?? []), [registrations]);

  const go = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/payments',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  /** Open a registration over the page, on its fees and payments. */
  const openRegistration = (registration: number | string, patch = {}) =>
    go({ registrationId: String(registration), regTab: 'fees', ...patch });

  const openItem = (item: ApiPaymentsAttentionItem) =>
    openRegistration(item.registration, canEdit ? attentionAction(item).search : {});

  if (!event || !registrations) return <FullScreenLoading />;

  return (
    <Stack>
      <Title order={2}>Payments</Title>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="attention">
            Needs attention{attention && attention.length > 0 ? ` (${attention.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="invoices">Invoices</Tabs.Tab>
          <Tabs.Tab value="payments">Payments and refunds</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="attention">
          {attention ? (
            <AttentionList items={attention} canAct={canEdit} onOpen={openItem} />
          ) : (
            <InlineLoading />
          )}
        </Tabs.Panel>
        <Tabs.Panel value="invoices">
          {tab === 'invoices' &&
            (invoices ? (
              <InvoicesLedger
                invoices={invoices}
                names={names}
                paymentTypes={event.payment_types}
                filters={invoiceFiltersFromSearch(search)}
                onFiltersChange={(next) => go(invoiceFiltersToSearch(next))}
                tableState={tableStateFromSearch(search, 'inv')}
                onTableStateChange={(next) => go(tableStateToSearch(next, 'inv'))}
                onOpen={(invoice) => openRegistration(invoice.registration)}
              />
            ) : (
              <InlineLoading />
            ))}
        </Tabs.Panel>
        <Tabs.Panel value="payments">
          {tab === 'payments' &&
            (payments ? (
              <PaymentsLedger
                payments={payments}
                names={names}
                paymentTypes={event.payment_types}
                filters={paymentFiltersFromSearch(search)}
                onFiltersChange={(next) => go(paymentFiltersToSearch(next))}
                tableState={tableStateFromSearch(search, 'pay')}
                onTableStateChange={(next) => go(tableStateToSearch(next, 'pay'))}
                onOpen={(payment) => openRegistration(payment.registration)}
              />
            ) : (
              <InlineLoading />
            ))}
        </Tabs.Panel>
      </Tabs>
      <RegistrationEditorModal
        eventId={eventId}
        registrationId={search.registrationId}
        registrations={registrations}
        onClose={() => go({ registrationId: undefined, regTab: undefined })}
      />
    </Stack>
  );
}
