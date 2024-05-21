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
    <>
      <div>Total Rows: {data.length}</div>
      <table className="csv-table">
        <thead><tr>
          <th className="csv-table-column"> </th>
          {
            header.map((h: string, i: number) => <th key={`${i}${h}`}>{h}</th>)
          }
        </tr></thead>
        <tbody>
          {
            data.map(
              (row: string[], i: number) => (
                <tr key={`${i}${row.join()}`}>
                  <td className="csv-table-column">{i+1}</td>
                  {
                    row.map((c, i) => <td key={`${i}${c}`}>{c}</td>)
                  }
                </tr>
              )
            )

          }
        </tbody>
      </table>
  </>
  );
}

export default CSVTable;
