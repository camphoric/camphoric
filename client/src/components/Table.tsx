import React from 'react';
import ObjectAsList from 'components/ObjectAsList';

interface Props extends React.ComponentPropsWithoutRef<'table'> {
  header?: Array<string>,
  data: Array<Array<any>>,
};

function dataToDisplay(data: any): React.ReactNode {
  if (Array.isArray(data)) {
    return (
      <ul>
        {
          data.map(d => (
            <li>{dataToDisplay(d)}</li>
          ))
        }
      </ul>
    );
  }

  if (typeof data === 'object') {
    return (
      <ObjectAsList obj={data} />
    )
  }

  return <div>{data.toString()}</div>;
}

function Table({ header, data, ...props }: Props) {
  return (
    <table {...props}>
      {
        !!header && (
          <thead>
            <tr>
              {
                header.map(
                  h => (<th key={h}>{h}</th>)
                )
              }
            </tr>
          </thead>
        )
      }
      <tbody>
        {
          data.map(
            r => (
              <tr>
                {
                  r.map(d => (
                    <td key={d.toString()}>{dataToDisplay(d)}</td>
                  ))
                }
              </tr>
            )
          )
        }
      </tbody>
    </table>
  );
}

export default Table;
