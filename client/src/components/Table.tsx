import React from 'react';

interface Props extends React.ComponentPropsWithoutRef<'table'> {
  header?: Array<string>,
  data: Array<Array<any>>,
};

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
                    <td key={d.toString()}>{
                      Array.isArray(d) ? d.join(', ') : d.toString()
                    }</td>
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
