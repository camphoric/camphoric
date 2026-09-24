/**
 * "Review registration" (SPEC §7.2): a read-only rundown of everything the
 * registrant entered, shown above the payment options. The registration's own
 * fields come first, then one section per camper; each section ends with the
 * pricing subtotals that belong to it (registration-level components and the
 * grand total; each camper's components and that camper's total).
 *
 * Values are made human-readable from the form schema and uiSchema: field
 * titles label the rows, `ui:enumNames`/`oneOf` titles replace raw enum values,
 * booleans read Yes/No, arrays of choices are joined, nested objects (address,
 * emergency contact, lodging) become indented groups, a requested lodging shows
 * its name, hidden widgets and empty values are skipped, and rows follow
 * `ui:order`. Conditional fields (`$ref`, `dependencies`, `if/then`) are
 * resolved against the entered data with rjsf's own `retrieveSchema`, so the
 * review shows exactly the fields the form did.
 */

import { Box, Divider, Paper, Stack, Text, Title } from '@mantine/core';
import { getUiOptions, retrieveSchema, type UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import type {
  ApiRegister,
  Hash,
  JsonLogicPricing,
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import { feeLabel } from 'components/FeeBreakdown';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { formatMoney } from 'utils/money';
import { ordinal } from 'utils/ordinal';

/** One row of the review: a scalar (`text`) or a nested group (`children`). */
export interface ReviewItem {
  label: string;
  text?: string;
  children?: ReviewItem[];
}

const isPlainObject = (value: unknown): value is Hash =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0);

/** Resolve `$ref`, `dependencies`, `allOf` and `if/then` against the data. */
function resolve(
  schema: JSONSchema7Definition | undefined,
  root: JSONSchema7,
  data: unknown,
): JSONSchema7 {
  if (!schema || typeof schema === 'boolean') return {};
  return retrieveSchema(validator, schema, root, data);
}

/**
 * Sort keys by `ui:order`; keys it doesn't mention go where its `*` is (or at
 * the end). Unlike rjsf's orderProperties this tolerates listed fields that are
 * absent, which is routine for conditional fields.
 */
function orderKeys(keys: string[], order: unknown): string[] {
  if (!Array.isArray(order)) return keys;
  const star = order.indexOf('*');
  const rank = (key: string) => {
    const index = order.indexOf(key);
    if (index >= 0) return index;
    return star >= 0 ? star : order.length;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || keys.indexOf(a) - keys.indexOf(b));
}

/**
 * The display name of an enum/const value: `ui:enumNames` (an array matched
 * by index, or a map matched by value) or a `oneOf`/`anyOf` title.
 */
function enumLabel(schema: JSONSchema7, uiSchema: UiSchema, value: unknown): string | undefined {
  const byIndex = (names: unknown[]) => {
    const index = schema.enum ? schema.enum.findIndex((option) => option === value) : -1;
    const name = index >= 0 ? names[index] : undefined;
    return typeof name === 'string' ? name : undefined;
  };

  const uiNames: unknown = getUiOptions(uiSchema).enumNames;
  if (Array.isArray(uiNames)) {
    const name = byIndex(uiNames as unknown[]);
    if (name !== undefined) return name;
  } else if (isPlainObject(uiNames)) {
    const name = uiNames[String(value)];
    if (typeof name === 'string') return name;
  }

  for (const alternative of schema.oneOf ?? schema.anyOf ?? []) {
    if (typeof alternative !== 'boolean' && alternative.const === value && alternative.title) {
      return alternative.title;
    }
  }
  return undefined;
}

function scalarText(schema: JSONSchema7, uiSchema: UiSchema, value: unknown): string {
  const label = enumLabel(schema, uiSchema, value);
  if (label !== undefined) return label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : JSON.stringify(value);
}

function reviewItem(
  label: string,
  schema: JSONSchema7,
  uiSchema: UiSchema,
  value: unknown,
  root: JSONSchema7,
): ReviewItem | null {
  if (Array.isArray(value)) {
    const itemSchema = Array.isArray(schema.items) ? undefined : schema.items;
    if (!value.some(isPlainObject)) {
      const resolved = resolve(itemSchema, root, undefined);
      return {
        label,
        text: value.map((entry) => scalarText(resolved, uiSchema, entry)).join(', '),
      };
    }
    const itemUi = (uiSchema.items ?? {}) as UiSchema;
    const children = value.flatMap((entry, index) => {
      if (!isPlainObject(entry)) return [];
      const resolved = resolve(itemSchema, root, entry);
      const rows = reviewItems(resolved, itemUi, entry, root);
      return rows.length
        ? [{ label: `${resolved.title ?? label} ${index + 1}`, children: rows }]
        : [];
    });
    return children.length ? { label, children } : null;
  }

  if (isPlainObject(value)) {
    // A requested lodging is {choices, id, name}; the name is what the
    // registrant picked.
    if (getUiOptions(uiSchema).field === 'LodgingRequested') {
      return typeof value.name === 'string' && value.name ? { label, text: value.name } : null;
    }
    const children = reviewItems(schema, uiSchema, value, root);
    return children.length ? { label, children } : null;
  }

  return { label, text: scalarText(schema, uiSchema, value) };
}

/**
 * Build the review rows for an object's data against its (unresolved) schema.
 * Exported for tests.
 */
export function reviewItems(
  schema: JSONSchema7Definition | undefined,
  uiSchema: UiSchema,
  data: Hash,
  root: JSONSchema7,
  omit: string[] = [],
): ReviewItem[] {
  const resolved = resolve(schema, root, data);
  const properties = resolved.properties ?? {};
  const keys = orderKeys(
    [...new Set([...Object.keys(properties), ...Object.keys(data)])],
    uiSchema['ui:order'],
  );

  const items: ReviewItem[] = [];
  for (const key of keys) {
    const value = data[key];
    if (omit.includes(key) || isEmpty(value)) continue;
    const fieldUi = (uiSchema[key] ?? {}) as UiSchema;
    const options = getUiOptions(fieldUi);
    if (options.widget === 'hidden') continue;
    const fieldSchema = resolve(properties[key], root, value);
    const label = String(options.title ?? fieldSchema.title ?? key);
    const item = reviewItem(label, fieldSchema, fieldUi, value, root);
    if (item) items.push(item);
  }
  return items;
}

/** The numeric line items of a pricing result, labeled from the pricing logic. */
function feeLines(results: Hash | undefined, keys: string[], ...logics: JsonLogicPricing[]) {
  if (!results) return [];
  return keys.flatMap((key) => {
    const value = results[key];
    return typeof value === 'number' ? [{ key, label: feeLabel(key, ...logics), value }] : [];
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
