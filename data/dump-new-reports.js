#!/usr/bin/env node

/**
 * USAGE
 *
 * 1. Get a json dump of all reports and save it to this directory
 * 2. Get the eventId of the event you want to copy reports from
 * 3. Run this util like ./dump-new-reports.js <eventId> <dir>
 */

import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const cwd = path.dirname(fileURLToPath(import.meta.url));

main();

async function main() {
  const [,,eventId, dir, dumpfile] = process.argv;

  const data = JSON.parse(
    await fs.readFile(path.join(cwd, dumpfile || 'reportdump.json'))
  ).filter(r => r.event.toString() === eventId);

  await fs.mkdir(
    path.join(cwd, dir, 'reports'), { recursive: true }
  );

  let reports = [];

  await Promise.all(data.map(async (r) => {
    const {
      title,
      output,
      template,
    } = r;

    const filename = `${title.replace(/\W/ig, '-')}.${output === 'hbs' ? 'hbs' : 'j2'}`;

    reports.push({
      title, output, filename,
    });

    const fullFileName = path.join(cwd, dir, 'reports', filename);
    return fs.writeFile(fullFileName, template);
  }));

  await writeReportIndex(reports, dir);
}

async function writeReportIndex(reports, dir) {
  const fullFileName = path.join(cwd, dir, 'reports.js');
  return fs.writeFile(fullFileName, `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const cwd = path.dirname(fileURLToPath(import.meta.url));

function readFile(filename) {
  const fullPathFilename = path.join(cwd, 'reports', filename);

  return fs.readFileSync(fullPathFilename).toString();
}

export default [
${
  reports.map(({ title, output, filename}) => `  {
    title: '${title}',
    output: '${output}',
    template: readFile('${filename}'),
  },`).join('\n')
}
];
`);
}
