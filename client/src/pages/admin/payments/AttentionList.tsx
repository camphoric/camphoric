/**
 * The event's "needs attention" list (SPEC §8.11; §15, DR-170): how many of
 * each kind, then each item under its kind — who it's about, the amount, what
 * to do — with the button that opens the registration's invoices with that
 * action ready. Someone who can't change payments (a Reporter) opens the
 * registration to look instead.
 */

import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { ApiPaymentsAttentionItem } from 'api-types';
import { formatMoney } from 'utils/money';

import {
  ATTENTION_COLOR,
  ATTENTION_KINDS,
  ATTENTION_LABEL,
  attentionAction,
  attentionDetail,
  attentionWho,
} from './attention';
import { AttentionCounts } from './AttentionCounts';

export interface AttentionListProps {
  items: ApiPaymentsAttentionItem[];
  /** Whether the viewer can take the actions (Registrars and Admins). */
  canAct: boolean;
  /** Open the item's registration, its action ready when `canAct`. */
  onOpen: (item: ApiPaymentsAttentionItem) => void;
}

export function AttentionList({ items, canAct, onOpen }: AttentionListProps) {
  if (items.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Nothing needs attention: no refunds due, no balances to invoice, nothing past due, and no
        PayPal orders to check.
      </Text>
    );
  }

  return (
    <Stack>
      <AttentionCounts items={items} />
      {ATTENTION_KINDS.map((kind) => {
        const ofKind = items.filter((item) => item.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <Stack key={kind} gap="xs" component="section" aria-label={ATTENTION_LABEL[kind]}>
            <Title order={4}>
              {ATTENTION_LABEL[kind]} ({ofKind.length})
            </Title>
            {ofKind.map((item) => (
              <Card key={`${item.registration}-${item.invoice ?? 'none'}`} withBorder padding="sm">
                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={600} truncate>
                        {attentionWho(item)}
                      </Text>
                      <Badge
                        color={ATTENTION_COLOR[kind]}
                        variant="light"
                        style={{ flexShrink: 0 }}
                      >
                        {formatMoney(item.amount)}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" truncate>
                      {item.registrant_email}
                    </Text>
                    <Text size="sm">{attentionDetail(item)}</Text>
                  </Stack>
                  <Button
                    variant={canAct ? 'light' : 'default'}
                    size="compact-md"
                    onClick={() => onOpen(item)}
                  >
                    {canAct ? attentionAction(item).label : 'View registration'}
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        );
      })}
    </Stack>
  );
}
