import React from 'react';

// @ts-ignore
import CsvParser from 'papaparse';

type Props = {
  csv: string;
};

function CSVTable({ csv }: Props) {
  const result = CsvParser.parse(csv.trim(), { delimiter: ',', linebreak: '\n' });
  const [ header, ...data ] = result.data;

  return (
    <table className="csv-table">
      <thead><tr>
        {
          header.map((h: string, i: number) => <th key={`${i}${h}`}>{h}</th>)
        }
      </tr></thead>
      <tbody>
        {
          data.map(
            (row: string[], i: number) => (
              <tr key={`${i}${row.join()}`}>
                {
                  row.map((c, i) => <td key={`${i}${c}`}>{c}</td>)
                }
              </tr>
            )
          )

        }
      </tbody>
    </table>
  );
}

export default CSVTable;
