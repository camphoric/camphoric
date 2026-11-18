/**
 * Country flags for the phone widget's country picker (SPEC §9.1, DR-175): the
 * `country-flag-icons` SVGs (3:2) served as the app's own static files, each
 * fetched only when it's shown, so no flag comes from another site and the
 * ~250 of them add only their URLs to the bundle.
 */

const urls = import.meta.glob<string>('/node_modules/country-flag-icons/3x2/*.svg', {
  eager: true,
  import: 'default',
  query: '?url&no-inline',
});

const byCountry = new Map(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/** The flag image's URL for a two-letter country code (`GB`), if there is one. */
export function flagUrl(country: string | undefined): string | undefined {
  return country ? byCountry.get(country.toUpperCase()) : undefined;
}
