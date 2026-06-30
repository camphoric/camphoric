/**
 * Render a CSV string as a bordered table with a row count (SPEC §8.7). The
 * first row is treated as the header; a leading ordinal column numbers the
 * data rows.
 */

import { Stack, Table, Text } from '@mantine/core';
import { csvParseRows } from 'd3-dsv';

export function CsvTable({ csv }: { csv: string }) {
  const [header = [], ...rows] = csvParseRows(csv.trim());

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Total rows: {rows.length}
      </Text>
      <Table withTableBorder withColumnBorders striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={48} />
            {header.map((cell, i) => (
              <Table.Th key={`h${i}`}>{cell}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, r) => (
            <Table.Tr key={`r${r}`}>
              <Table.Td c="dimmed">{r + 1}</Table.Td>
              {row.map((cell, c) => (
                <Table.Td key={`c${c}`}>{cell}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
