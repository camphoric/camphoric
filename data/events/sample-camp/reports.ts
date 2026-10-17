import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { Report } from '@camphoric/camphoric-event-import-spec';

const cwd = path.dirname(fileURLToPath(import.meta.url));

function readFile(filename: string): string {
  return fs.readFileSync(path.join(cwd, 'reports', filename)).toString();
}

// Every output format, rendered from the server's variables (DR-41, in
// reports/server/) and, for the legacy reports, from the browser's variable
// bundle (DR-37, at the top of reports/, where the server's legacy report
// tests find them). Handlebars reports are retired, so there is no hbs report.
export default [
  { title: 'Payments', output: 'md', variables_source: 'server', template: readFile('server/Payments.md.j2') },
  { title: 'Lodging', output: 'html', variables_source: 'server', template: readFile('server/Lodging.html.j2') },
  { title: 'Summary', output: 'txt', variables_source: 'server', template: readFile('server/Summary.txt.j2') },
  { title: 'Campers', output: 'csv', variables_source: 'server', template: readFile('server/Campers.csv.j2') },
  { title: 'Legacy roster', output: 'csv', variables_source: 'client', template: readFile('Legacy-Roster.csv.j2') },
  { title: 'Legacy balances', output: 'md', variables_source: 'client', template: readFile('Legacy-Balances.md.j2') },
] satisfies Report[];
