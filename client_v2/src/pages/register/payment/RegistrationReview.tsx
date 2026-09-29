/**
 * "Review registration" (SPEC §7.2): a read-only rundown of everything the
 * registrant entered, shown above the payment options. The registration's own
 * fields come first, then one section per camper; each section ends with the
 * pricing subtotals that belong to it (registration-level components and the
 * grand total; each camper's components and that camper's total).
 *
 * Values are made human-readable from the form schema and uiSchema, following
 * `ui:order` and resolving conditional fields against the entered data, so the
 * review shows exactly the fields the form did (see `components/form/reviewItems`).
 */

import { Box, Divider, Paper, Stack, Text, Title } from '@mantine/core';
import type { UiSchema } from '@rjsf/utils';
import type {
  ApiRegister,
  Hash,
  JsonLogicPricing,
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import { feeLabel } from 'components/FeeBreakdown';
import { isPlainObject, type ReviewItem, reviewItems } from 'components/form';
import type { JSONSchema7 } from 'json-schema';
import { formatMoney } from 'utils/money';
import { ordinal } from 'utils/ordinal';

/**
 * The numeric line items of a pricing result, labeled from the pricing logic.
 * Zero amounts are left out: they tell the registrant nothing (#666). Negative
 * ones (discounts, credits) stay; the section's total is shown either way.
 */
function feeLines(results: Hash | undefined, keys: string[], ...logics: JsonLogicPricing[]) {
  if (!results) return [];
  return keys.flatMap((key) => {
    const value = results[key];
    return typeof value === 'number' && value !== 0
      ? [{ key, label: feeLabel(key, ...logics), value }]
      : [];
  });
}

function camperHeading(camper: Hash, index: number): string {
  const name = [camper.first_name, camper.last_name]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' ');
  const heading = `${ordinal(index + 1)} Camper`;
  return name ? `${heading} — ${name}` : heading;
}

/** Width of the label column; values start right after it so each row reads as one phrase. */
const LABEL_COLUMN = 200;

/** A flattened row of the review grid: a group heading or a label/value pair. */
interface ReviewRow {
  label: string;
  text?: string;
  depth: number;
  emphasis?: boolean;
}

/**
 * Flatten nested items into rows: a group contributes a heading row followed
 * by its children one level deeper, so every value stays in the same column.
 */
function flattenRows(items: ReviewItem[], depth = 0): ReviewRow[] {
  return items.flatMap((item) =>
    item.children
      ? [{ label: item.label, depth }, ...flattenRows(item.children, depth + 1)]
      : [{ label: item.label, text: item.text, depth }],
  );
}

/**
 * Two-column rows shared by the entered values and the fee summary: a
 * fixed-width, dimmed label column with left-aligned values beside it,
 * vertically centred so a wrapped label still sits with its value, and (unless `lines` is
 * off) a hairline between rows so long labels stay attached to their answers.
 * On narrow screens each row collapses to label-over-value.
 */
function ReviewRows({ rows, lines = true }: { rows: ReviewRow[]; lines?: boolean }) {
  return (
    <Stack gap={0}>
      {rows.map((row, index) => {
        const heading = row.text === undefined;
        return (
          <Box
            key={`${index}-${row.label}`}
            display={{ base: 'block', sm: 'grid' }}
            py={6}
            style={{
              gridTemplateColumns: `${LABEL_COLUMN}px minmax(0, 1fr)`,
              columnGap: 16,
              alignItems: 'center',
              // Hairlines separate answers; a group heading runs straight into
              // its first row.
              borderTop:
                lines && index && rows[index - 1].text !== undefined
                  ? '1px solid var(--mantine-color-default-border)'
                  : undefined,
            }}
          >
            <Text
              size="sm"
              c={heading || row.emphasis ? undefined : 'dimmed'}
              fw={heading || row.emphasis ? 600 : undefined}
              pl={row.depth * 16}
              style={heading ? { gridColumn: '1 / -1' } : undefined}
            >
              {row.label}
            </Text>
            {!heading && (
              <Text
                size="sm"
                fw={row.emphasis ? 600 : undefined}
                pl={{ base: row.depth * 16, sm: 0 }}
                style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {row.text}
              </Text>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

interface SectionProps {
  title: string;
  items: ReviewItem[];
  fees: { key: string; label: string; value: number }[];
  total?: number;
  totalLabel: string;
}

function Section({ title, items, fees, total, totalLabel }: SectionProps) {
  return (
    <Paper withBorder radius="md" p="md" bg="var(--mantine-color-gray-light)">
      <Title order={5} mb="xs">
        {title}
      </Title>
      {items.length > 0 ? (
        <ReviewRows rows={flattenRows(items)} />
      ) : (
        <Text size="sm" c="dimmed">
          Nothing entered.
        </Text>
      )}
      {(fees.length > 0 || total !== undefined) && (
        <>
          <Divider my="sm" size="md" />
          <ReviewRows
            lines={false}
            rows={[
              ...fees.map((fee) => ({ label: fee.label, text: formatMoney(fee.value), depth: 0 })),
              ...(total !== undefined
                ? [{ label: totalLabel, text: formatMoney(total), depth: 0, emphasis: true }]
                : []),
            ]}
          />
        </>
      )}
    </Paper>
  );
}

interface RegistrationReviewProps {
  config: ApiRegister;
  registration: RegistrationFormData;
  results: PricingResults;
}

export function RegistrationReview({ config, registration, results }: RegistrationReviewProps) {
  const root = config.dataSchema;
  const uiSchema = config.uiSchema as UiSchema;
  const { registration: registrationLogic, camper: camperLogic } = config.pricingLogic;

  const camperSchema = isPlainObject(root.properties?.campers)
    ? (root.properties.campers as JSONSchema7).items
    : undefined;
  const camperItemSchema = Array.isArray(camperSchema) ? undefined : camperSchema;
  const camperUi = ((uiSchema.campers as UiSchema | undefined)?.items ?? {}) as UiSchema;

  // Registration-level components are the ones its pricing logic defines;
  // `handling` is the server-added e-payment fee.
  const registrationKeys = [
    ...registrationLogic.map((component) => component.var).filter((key) => key !== 'total'),
    'handling',
  ];
  const registrationFees = feeLines(results, registrationKeys, registrationLogic, camperLogic).map(
    (fee) => (fee.key === 'handling' ? { ...fee, label: 'Electronic payment handling' } : fee),
  );

  return (
    <Stack>
      <Title order={3}>Review registration</Title>
      <Section
        title="Registration"
        items={reviewItems(root, uiSchema, registration, root, ['campers'])}
        fees={registrationFees}
        total={typeof results.total === 'number' ? results.total : undefined}
        totalLabel="Total"
      />
      {registration.campers.map((camper, index) => {
        const camperResults = results.campers[index];
        const camperKeys = Object.keys(camperResults ?? {}).filter((key) => key !== 'total');
        return (
          <Section
            key={index}
            title={camperHeading(camper, index)}
            items={reviewItems(camperItemSchema, camperUi, camper, root)}
            fees={feeLines(camperResults, camperKeys, camperLogic, registrationLogic)}
            total={typeof camperResults?.total === 'number' ? camperResults.total : undefined}
            totalLabel="Camper total"
          />
        );
      })}
    </Stack>
  );
}
