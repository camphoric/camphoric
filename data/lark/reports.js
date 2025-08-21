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
    title: 'Campers, Parking Exceptions',
    output: 'csv',
    template: readFile('Campers--Parking-Exceptions.j2'),
  },
  {
    title: 'Kitchen, Meal Location Exceptions',
    output: 'csv',
    template: readFile('Kitchen--Meal-Location-Exceptions.j2'),
  },
  {
    title: 'Crew, Clean, C2&3',
    output: 'csv',
    template: readFile('Crew--Clean--C2-3.j2'),
  },
  {
    title: 'Crew, Special Invites',
    output: 'csv',
    template: readFile('Crew--Special-Invites.j2'),
  },
  {
    title: 'Campers, Lodging by Lodging',
    output: 'csv',
    template: readFile('Campers--Lodging-by-Lodging.j2'),
  },
  {
    title: 'Kitchen, All Meal Tickets',
    output: 'csv',
    template: readFile('Kitchen--All-Meal-Tickets.j2'),
  },
  {
    title: 'Registration, All reg workers',
    output: 'csv',
    template: readFile('Registration--All-reg-workers.j2'),
  },
  {
    title: 'Campers, NOT Checked In',
    output: 'csv',
    template: readFile('Campers--NOT-Checked-In.j2'),
  },
  {
    title: 'Campers, By Reg Date',
    output: 'csv',
    template: readFile('Campers--By-Reg-Date.j2'),
  },
  {
    title: 'Kitchen, Meal Totals',
    output: 'csv',
    template: readFile('Kitchen--Meal-Totals.j2'),
  },
  {
    title: 'Crew, Kitchen, w/ Lodging',
    output: 'csv',
    template: readFile('Crew--Kitchen--w--Lodging.j2'),
  },
  {
    title: 'Campers, Lodging by Alpha',
    output: 'csv',
    template: readFile('Campers--Lodging-by-Alpha.j2'),
  },
  {
    title: 'Crew, Managers and Others',
    output: 'csv',
    template: readFile('Crew--Managers-and-Others.j2'),
  },
  {
    title: 'Donation Report - Lark',
    output: 'csv',
    template: readFile('Donation-Report---Lark.j2'),
  },
  {
    title: 'Campers, Vaccinations by Last Name',
    output: 'csv',
    template: readFile('Campers--Vaccinations-by-Last-Name.j2'),
  },
  {
    title: 'Campers, Confirmation Email Info',
    output: 'csv',
    template: readFile('Campers--Confirmation-Email-Info.j2'),
  },
  {
    title: 'Campers, Email List for All Campers',
    output: 'md',
    template: readFile('Campers--Email-List-for-All-Campers.j2'),
  },
  {
    title: 'Crew, Clean, C1',
    output: 'csv',
    template: readFile('Crew--Clean--C1.j2'),
  },
  {
    title: 'Campers, By Zip Code (For Carpool)',
    output: 'csv',
    template: readFile('Campers--By-Zip-Code--For-Carpool-.j2'),
  },
  {
    title: 'Registration, Values for July Email',
    output: 'csv',
    template: readFile('Registration--Values-for-July-Email.j2'),
  },
  {
    title: 'Crew, Camper Email List by Crew',
    output: 'md',
    template: readFile('Crew--Camper-Email-List-by-Crew.j2'),
  },
  {
    title: 'Campers, Parking Passes',
    output: 'csv',
    template: readFile('Campers--Parking-Passes.j2'),
  },
  {
    title: 'Campers, Registration Payments',
    output: 'csv',
    template: readFile('Campers--Registration-Payments.j2'),
  },
  {
    title: 'Crew, Community Care',
    output: 'csv',
    template: readFile('Crew--Community-Care.j2'),
  },
  {
    title: 'Registration, Late Arrivals',
    output: 'md',
    template: readFile('Registration--Late-Arrivals.j2'),
  },
  {
    title: 'Campers, Early Arrivals',
    output: 'csv',
    template: readFile('Campers--Early-Arrivals.j2'),
  },
  {
    title: 'Registration, PayPal Invoices',
    output: 'csv',
    template: readFile('Registration--PayPal-Invoices.j2'),
  },
  {
    title: 'Campers, Name Badges',
    output: 'csv',
    template: readFile('Campers--Name-Badges.j2'),
  },
  {
    title: 'Campers, Registration Volunteers',
    output: 'csv',
    template: readFile('Campers--Registration-Volunteers.j2'),
  },
  {
    title: 'Campers, Half Campers',
    output: 'csv',
    template: readFile('Campers--Half-Campers.j2'),
  },
  {
    title: 'Registration, Early Arrivals',
    output: 'csv',
    template: readFile('Registration--Early-Arrivals.j2'),
  },
  {
    title: 'Community Care, Campers',
    output: 'csv',
    template: readFile('Community-Care--Campers.j2'),
  },
  {
    title: 'Crew, Setup and Teardown',
    output: 'csv',
    template: readFile('Crew--Setup-and-Teardown.j2'),
  },
  {
    title: 'Campers, All Camp 3',
    output: 'csv',
    template: readFile('Campers--All-Camp-3.j2'),
  },
  {
    title: 'Registration, First Half Arrivals',
    output: 'csv',
    template: readFile('Registration--First-Half-Arrivals.j2'),
  },
  {
    title: 'Crew, Office, Camp 1',
    output: 'csv',
    template: readFile('Crew--Office--Camp-1.j2'),
  },
  {
    title: 'Registration, Second Half Arrivals',
    output: 'csv',
    template: readFile('Registration--Second-Half-Arrivals.j2'),
  },
  {
    title: 'Campers, Minors',
    output: 'csv',
    template: readFile('Campers--Minors.j2'),
  },
  {
    title: 'Crew, Office, Camp 3',
    output: 'csv',
    template: readFile('Crew--Office--Camp-3.j2'),
  },
  {
    title: 'MWCA Final Report',
    output: 'md',
    template: readFile('MWCA-Final-Report.j2'),
  },
  {
    title: 'Campers, Tent Tags',
    output: 'csv',
    template: readFile('Campers--Tent-Tags.j2'),
  },
  {
    title: 'Kitchen, No Meal Ticket',
    output: 'csv',
    template: readFile('Kitchen--No-Meal-Ticket.j2'),
  },
  {
    title: 'Crew, Office, Camp 2',
    output: 'csv',
    template: readFile('Crew--Office--Camp-2.j2'),
  },
  {
    title: 'All Campers',
    output: 'csv',
    template: readFile('All-Campers.j2'),
  },
];
