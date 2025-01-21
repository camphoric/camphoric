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
    title: 'Food Dietary Notes from Campers',
    output: 'csv',
    template: readFile('Food-Dietary-Notes-from-Campers.j2'),
  },
  {
    title: 'Linens',
    output: 'md',
    template: readFile('Linens.j2'),
  },
  {
    title: 'Newman Housing Report',
    output: 'csv',
    template: readFile('Newman-Housing-Report.j2'),
  },
  {
    title: 'Total camper nights',
    output: 'md',
    template: readFile('Total-camper-nights.j2'),
  },
  {
    title: 'Arrivals and Departures',
    output: 'md',
    template: readFile('Arrivals-and-Departures.j2'),
  },
  {
    title: 'Campers who owe us money',
    output: 'csv',
    template: readFile('Campers-who-owe-us-money.j2'),
  },
  {
    title: 'Campership donations',
    output: 'csv',
    template: readFile('Campership-donations.j2'),
  },
  {
    title: 'Registration Check-in',
    output: 'md',
    template: readFile('Registration-Check-in.j2'),
  },
  {
    title: 'Arrivals - Drivers and Passengers',
    output: 'md',
    template: readFile('Arrivals---Drivers-and-Passengers.j2'),
  },
  {
    title: 'Chore and Dance Lead',
    output: 'csv',
    template: readFile('Chore-and-Dance-Lead.j2'),
  },
  {
    title: 'Payments',
    output: 'hbs',
    template: readFile('Payments.hbs'),
  },
  {
    title: 'Camperships Awarded',
    output: 'md',
    template: readFile('Camperships-Awarded.j2'),
  },
  {
    title: 'All Campers',
    output: 'csv',
    template: readFile('All-Campers.j2'),
  },
  {
    title: 'Food Prefs',
    output: 'md',
    template: readFile('Food-Prefs.j2'),
  },
];
