import React from 'react';

interface Props {
  registration: AugmentedRegistration;
  searchQuery: string;
}

function RegistrationSearchResult({ registration, searchQuery }: Props) {
  return (
    <div>
      {
        !!registration.campers.length &&
          registration.campers.map(c => c.label).join(' - ')
      }
      {
        searchQuery.length > 2 && (
          <div className="search-query-snippet">{searchQuerySnippet(registration, searchQuery)}</div>
        )
      }
    </div>
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
