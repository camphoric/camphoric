/**
 * An invoice's status (SPEC §9.7), worked out by the server from its payments:
 * open, partially paid, paid, overpaid (a refund is due) or cancelled.
 */

import { Badge } from '@mantine/core';
import type { InvoiceStatus } from 'api-types';

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: 'Open',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overpaid: 'Overpaid',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  open: 'red',
  partially_paid: 'yellow',
  paid: 'green',
  overpaid: 'orange',
  cancelled: 'gray',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light">
      {STATUS_LABEL[status]}
    </Badge>
  );
}
