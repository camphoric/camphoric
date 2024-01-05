import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const cwd = path.dirname(fileURLToPath(import.meta.url));

function readFile(filename) {
  const fullPathFilename = path.join(cwd, 'reports', filename);

  return fs.readFileSync(fullPathFilename).toString();
}

export default [
  {
    title: 'Lodging Report (Simple)',
    output: 'hbs',
    template: readFile('Lodging-Report--Simple-.hbs'),
  },
  {
    title: 'Chore Report',
    output: 'hbs',
    template: readFile('Chore-Report.hbs'),
  },
  {
    title: 'Payments',
    output: 'hbs',
    template: readFile('Payments.hbs'),
  },
  {
    title: 'Camper Email List For Mailing',
    output: 'hbs',
    template: readFile('Camper-Email-List-For-Mailing.hbs'),
  },
  {
    title: 'Vaccination Report',
    output: 'hbs',
    template: readFile('Vaccination-Report.hbs'),
  },
  {
    title: 'All Campers by Reg Date',
    output: 'hbs',
    template: readFile('All-Campers-by-Reg-Date.hbs'),
  },
  {
    title: 'All Campers Report',
    output: 'hbs',
    template: readFile('All-Campers-Report.hbs'),
  },
  {
    title: 'Pricing Breakdown',
    output: 'hbs',
    template: readFile('Pricing-Breakdown.hbs'),
  },
  {
    title: 'Liability Waiver List',
    output: 'hbs',
    template: readFile('Liability-Waiver-List.hbs'),
  },
  {
    title: 'Donation Report',
    output: 'hbs',
    template: readFile('Donation-Report.hbs'),
  },
];
