import React from 'react';
import Spinner from 'components/Spinner';

// @ts-ignore
import CsvParser from 'papaparse';

type Props = {
  csv: string;
};

function CSVTable({ csv }: Props) {
  const result = CsvParser.parse(csv.trim(), { delimiter: ',', linebreak: '\n' });
  const [ header, ...data ] = result.data;

  if (!header || !data.length) return <Spinner />;

  return (
    <table className="csv-table">
      <thead><tr>
        {
          header.map((h: string) => <th key={h}>{h}</th>)
        }
      </tr></thead>
      <tbody>
        {
          data.map(
            (row: string[]) => (
              <tr key={row.join()}>
                {
                  row.map(c => <td key={c}>{c}</td>)
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
