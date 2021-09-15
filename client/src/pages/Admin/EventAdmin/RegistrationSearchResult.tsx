import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  registration: AugmentedRegistration;
  searchQuery: string;
  selected: boolean;
  path: string;
}

function RegistrationSearchResult({ registration, ...props }: Props) {
  return (
    <Link to={props.path} className={props.selected ? 'selected' : ''}>
      {props.selected ? '✔ ' : ''}
      {
        !!registration.campers.length &&
          registration.campers.map(c => c.label).join(' - ')
      }
      {
        props.searchQuery.length > 2 && (
          <div className="search-query-snippet">{searchQuerySnippet(registration, props.searchQuery)}</div>
        )
      }
    </Link>
  );
}

function searchQuerySnippet(r: AugmentedRegistration, q: string) {
  const regex = new RegExp(q, 'i');

  const matches = r.searchStrJson.match(regex);

  if (!matches) return '';

  const caseSensitiveMatch = matches.pop() || '';
  const start = Math.max(
    0,
    r.searchStrJson.indexOf(caseSensitiveMatch) - 10,
  );
  const snippet = r.searchStrJson.substr(
    start,
    Math.max(q.length + 15, 35),
  ).split(caseSensitiveMatch, 2);

  const snippetStart = snippet.shift();

  return (
    <pre>
      {snippetStart}
      <span className="highlight">{caseSensitiveMatch}</span>
      {snippet}
    </pre>
  );
}

export default RegistrationSearchResult;
