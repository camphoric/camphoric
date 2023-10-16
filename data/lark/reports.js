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
    title: 'Campers, All Camp 3',
    output: 'csv',
    template: readFile('Campers--All-Camp-3.j2'),
  },
  {
    title: 'Camper Vaccinations by Last Name',
    output: 'csv',
    template: readFile('Camper-Vaccinations-by-Last-Name.j2'),
  },
  {
    title: 'Camper Vaccinations',
    output: 'csv',
    template: readFile('Camper-Vaccinations.j2'),
  },
  {
    title: 'Crew, Special Invites',
    output: 'csv',
    template: readFile('Crew--Special-Invites.j2'),
  },
  {
    title: 'PayPal Invoice Bulk',
    output: 'hbs',
    template: readFile('PayPal-Invoice-Bulk.hbs'),
  },
  {
    title: 'Campers by Reg Date (Paid)',
    output: 'hbs',
    template: readFile('Campers-by-Reg-Date--Paid-.hbs'),
  },
  {
    title: 'Camper, Parking Passes',
    output: 'csv',
    template: readFile('Camper--Parking-Passes.j2'),
  },
  {
    title: 'Camper Lodging by Alpha',
    output: 'csv',
    template: readFile('Camper-Lodging-by-Alpha.j2'),
  },
  {
    title: 'Registration Payments',
    output: 'hbs',
    template: readFile('Registration-Payments.hbs'),
  },
  {
    title: 'Campers by Reg Date',
    output: 'hbs',
    template: readFile('Campers-by-Reg-Date.hbs'),
  },
  {
    title: 'Camper Email List for All Campers',
    output: 'hbs',
    template: readFile('Camper-Email-List-for-All-Campers.hbs'),
  },
  {
    title: 'Camper Meal Tallies',
    output: 'hbs',
    template: readFile('Camper-Meal-Tallies.hbs'),
  },
  {
    title: 'Camper Lodging by Lodging',
    output: 'csv',
    template: readFile('Camper-Lodging-by-Lodging.j2'),
  },
  {
    title: 'Camper Confirmation Email Info',
    output: 'csv',
    template: readFile('Camper-Confirmation-Email-Info.j2'),
  },
  {
    title: 'Crew, Managers',
    output: 'csv',
    template: readFile('Crew--Managers.j2'),
  },
  {
    title: 'Crew, Kitchen, w/ Lodging',
    output: 'csv',
    template: readFile('Crew--Kitchen--w--Lodging.j2'),
  },
  {
    title: 'Camper Meals by Camp',
    output: 'hbs',
    template: readFile('Camper-Meals-by-Camp.hbs'),
  },
  {
    title: 'Crew, Reg, C1',
    output: 'csv',
    template: readFile('Crew--Reg--C1.j2'),
  },
  {
    title: 'Crew, Clean, C2&3',
    output: 'csv',
    template: readFile('Crew--Clean--C2-3.j2'),
  },
  {
    title: 'Camper Early Arrivals',
    output: 'csv',
    template: readFile('Camper-Early-Arrivals.j2'),
  },
  {
    title: 'Crew, Clean, C1',
    output: 'csv',
    template: readFile('Crew--Clean--C1.j2'),
  },
  {
    title: 'Crew, Reg, C2',
    output: 'csv',
    template: readFile('Crew--Reg--C2.j2'),
  },
  {
    title: 'Crew, Setup',
    output: 'csv', template: readFile('Crew--Setup.j2'),
  },
  {
    title: 'Camper Minors',
    output: 'csv',
    template: readFile('Camper-Minors.j2'),
  },
  {
    title: 'Donation Report - Lark',
    output: 'hbs',
    template: readFile('Donation-Report---Lark.hbs'),
  },
  {
    title: 'Camper Email List by Crew',
    output: 'hbs',
    template: readFile('Camper-Email-List-by-Crew.hbs'),
  },
  {
    title: 'All Campers',
    output: 'csv',
    template: readFile('All-Campers.j2'),
  },
  {
    title: 'Crew, Security',
    output: 'csv',
    template: readFile('Crew--Security.j2'),
  },
  {
    title: 'TEST Camper Lodging by Entry Date',
    output: 'hbs',
    template: readFile('TEST-Camper-Lodging-by-Entry-Date.hbs'),
  },
  {
    title: 'Campers, Half Campers',
    output: 'csv',
    template: readFile('Campers--Half-Campers.j2'),
  }
];

