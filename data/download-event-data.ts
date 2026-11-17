#!/usr/bin/env -S npx tsx --conditions=camphoric-source

/**
 * USAGE
 *
 * Save all of an event's data as one JSON file, for analysis with your own
 * scripts (pandas, jq, a notebook), from the server at CAMPHORIC_URL:
 *
 *     CAMPHORIC_URL=https://<server> ./download-event-data.ts <eventId>
 *
 * asks for your personal access token without showing it, and saves the file
 * the server names ("<event name> data <YYYY-MM-DD>.json") in this directory.
 * To give the token without being asked (in a script, say), set
 * CAMPHORIC_API_TOKEN to it, or CAMPHORIC_API_TOKEN_FILE to a file holding it:
 *
 *     CAMPHORIC_URL=https://<server> CAMPHORIC_API_TOKEN=<token> ./download-event-data.ts 12 -o camp.json
 *
 * The token must be an Admin's: the file holds personal and payment data for
 * everyone in the event. A read-only token is enough; make one from your
 * account menu in Camphoric (Personal access tokens), or on the server with
 * `./manage.py camphoric_api_token create <you> --read-only`.
 *
 * It downloads from the event data export, `GET /api/events/<id>/export/`
 * (camphoric/camphoric#1016); from a server without it, it says the server is
 * older than the export. Unlike the import tools, it doesn't need
 * CAMPHORIC_ALLOW_REMOTE=1 for a live server, since it only reads, but it
 * sends the token only over https to a server that isn't local.
 *
 * The file is saved for you alone to read. --output <file> chooses where;
 * --force replaces a file already there. It exits non-zero, saying why, if the
 * download fails, and leaves no partial file behind.
 */

import {
  PromptCancelled, USAGE, downloadEventData, downloadOptions, formatSize, getToken,
  removePartialDownloads, serverUrl,
} from './downloadEventData.ts';

// Stopped mid-download, it removes the partial file first: it holds personal
// data, and ending on the signal would skip the download's own clean-up
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) {
  process.on(signal, () => {
    removePartialDownloads();
    process.exit(code);
  });
}

main().catch((e: unknown) => {
  if (e instanceof PromptCancelled) process.exit(130);
  // These say what to do about it, so they're worth showing without a stack
  console.error(e instanceof Error && !(e instanceof TypeError) ? `error: ${e.message}` : e);
  process.exit(1);
});

async function main() {
  const options = downloadOptions(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const url = serverUrl();
  const token = await getToken({ url });

  console.error(`Downloading event ${options.eventId}'s data from ${url}…`);
  const { file, bytes } = await downloadEventData({ url, token, ...options });

  console.error(
    `Saved it to ${file} (${formatSize(bytes)}). It holds personal and payment data: `
    + 'keep it somewhere safe, and delete it when you\'re done.',
  );
}
