import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const cwd = path.dirname(fileURLToPath(import.meta.url));

function readFile(filename) {
  const fullPathFilename = path.join(cwd, 'reports', filename);

  return fs.readFileSync(fullPathFilename).toString();
}

// Every report renders on the server from Camphoric's variables (DR-41).
const reports = [
  {
    title: 'Lodging Report (Simple)',
    output: 'md',
    template: readFile('Lodging-Report--Simple-.j2'),
  },
  {
    title: 'Chore Report',
    output: 'md',
    template: readFile('Chore-Report.j2'),
  },
  {
    title: 'Payments',
    output: 'md',
    template: readFile('Payments.j2'),
  },
  {
    title: 'Camper Email List For Mailing',
    output: 'md',
    template: readFile('Camper-Email-List-For-Mailing.j2'),
  },
  {
    title: 'Vaccination Report',
    output: 'md',
    template: readFile('Vaccination-Report.j2'),
  },
  {
    title: 'All Campers by Reg Date',
    output: 'md',
    template: readFile('All-Campers-by-Reg-Date.j2'),
  },
  {
    title: 'All Campers Report',
    output: 'md',
    template: readFile('All-Campers-Report.j2'),
  },
  {
    title: 'Pricing Breakdown',
    output: 'md',
    template: readFile('Pricing-Breakdown.j2'),
  },
  {
    title: 'Liability Waiver List',
    output: 'md',
    template: readFile('Liability-Waiver-List.j2'),
  },
  {
    title: 'Donation Report',
    output: 'md',
    template: readFile('Donation-Report.j2'),
  },
];

export default reports.map((report) => ({ ...report, variables_source: 'server' }));
