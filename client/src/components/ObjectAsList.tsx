import React from 'react';

type SortFn = Parameters<typeof Array.prototype.sort>[0];

const sortByAbc: SortFn = ([a], [b]) => a.localeCompare(b);
const sortByZxy: SortFn = ([a], [b]) => b.localeCompare(a);
const sortNone: SortFn = () => 0;

interface Props extends React.ComponentProps<'ul'> {
  obj: Object;
  sortAbc?: boolean;
  sortZxy?: boolean;
};

export const ObjectAsList = ({obj = {}, sortAbc = false, sortZxy = false, ...props}: Props) => {
  const sortFunc = sortAbc ? sortByAbc : sortZxy ? sortByZxy : sortNone;

  function renderObjectPropsWithSorting() {
    return Object.entries(obj)
      .sort(sortFunc)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return (
            <li key={key}>
              <span className="key title">{key}:</span>
              <ObjectAsList obj={value} {...{sortAbc, sortZxy}} />
            </li>
          );
        }

        return (
          <li key={key}>
            <span className="key title">{key}:</span> <span className="value property">{value}</span>
          </li>
        );
      });
  }

  return (
    <ul {...props}>
      {renderObjectPropsWithSorting()}
    </ul>
  );
};

export default ObjectAsList;
