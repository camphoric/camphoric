import { describe, expect, it } from 'vitest';

import { attentionAction, attentionDetail, attentionWho, countByKind } from '../attention';
import {
  ATTENTION_ITEMS,
  NOT_INVOICED,
  ONLINE_UNFINISHED,
  OVERPAID_ITEM,
  PAST_DUE,
  PAYPAL_PROCESSING,
  REFUND_BY_HAND,
  REFUND_THROUGH_PAYPAL,
} from './fixtures';

describe('needs attention', () => {
  it('opens each kind’s invoice action', () => {
    expect(attentionAction(REFUND_THROUGH_PAYPAL)).toEqual({
      label: 'Refund through PayPal',
      search: { invoiceAction: 'refund', invoiceId: '2', paymentId: '21', refundBy: undefined },
    });
    expect(attentionAction(REFUND_BY_HAND)).toEqual({
      label: 'Record a refund',
      search: { invoiceAction: 'refund', invoiceId: '3', paymentId: undefined, refundBy: 'hand' },
    });
    expect(attentionAction(OVERPAID_ITEM).search).toEqual({
      invoiceAction: 'refund',
      invoiceId: '4',
    });
    expect(attentionAction(NOT_INVOICED)).toEqual({
      label: 'Make an invoice',
      search: { invoiceAction: 'new-invoice' },
    });
    expect(attentionAction(PAST_DUE)).toEqual({
      label: 'Send invoice',
      search: { invoiceAction: 'send', invoiceId: '9' },
    });
    expect(attentionAction(ONLINE_UNFINISHED)).toEqual({
      label: 'Check PayPal order',
      search: { invoiceAction: 'check-paypal', invoiceId: '10' },
    });
  });

  it('says what to do', () => {
    expect(attentionDetail(REFUND_THROUGH_PAYPAL)).toMatch(/through PayPal/);
    expect(attentionDetail(REFUND_BY_HAND)).toMatch(/another way/);
    expect(attentionDetail(PAST_DUE)).toBe('Invoice #9 was due Nov 1, 2026. Send it again.');
    expect(attentionDetail(ONLINE_UNFINISHED)).toMatch(/never confirmed/);
    expect(attentionDetail(PAYPAL_PROCESSING)).toMatch(/still processing/);
  });

  it('names who it’s about', () => {
    expect(attentionWho(NOT_INVOICED)).toBe('Pat Alpha, Sam Alpha');
    expect(attentionWho(REFUND_BY_HAND)).toBe('kim@example.com');
  });

  it('counts each kind', () => {
    expect(countByKind(ATTENTION_ITEMS)).toEqual({
      refund_due: 2,
      overpaid_invoice: 1,
      not_invoiced: 1,
      past_due: 1,
      online_unfinished: 2,
    });
  });
});
