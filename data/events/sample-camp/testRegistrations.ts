import type { LodgingLookup, SampleRegistration } from '@camphoric/camphoric-event-import-spec';

import { ages } from './pricing/camperPricingLogic.ts';
import { deposit } from './registrationDepositSchema.ts';
import { year } from './dates.ts';

// Made-up households: names, addresses and contacts are fictional
interface Camper {
  first_name: string;
  last_name: string;
  age: keyof typeof ages;
  // the lodging chosen, from the root down (lodging keys)
  lodging: string[];
  shirt?: string;
  diet?: string[];
  shared_with?: string;
}

interface Household {
  email: string;
  phone: string;
  address: [string, string, string, string];
  campers: Camper[];
  donation?: number;
  paymentOption?: string;
}

const households: Household[] = [
  {
    email: 'alex.example@example.com',
    phone: '+15555550101',
    address: ['1 Example Way', 'Sampletown', 'CA', '90001'],
    donation: 25,
    campers: [
      { first_name: 'Alex', last_name: 'Example', age: 'adult', lodging: ['cabins', 'cabin_1'], shirt: 'Medium', shared_with: 'Jo Example' },
      { first_name: 'Jo', last_name: 'Example', age: 'adult', lodging: ['cabins', 'cabin_1'], diet: ['Vegetarian'], shared_with: 'Alex Example' },
      { first_name: 'Kit', last_name: 'Example', age: 'child', lodging: ['cabins', 'cabin_1'] },
    ],
  },
  {
    email: 'sam.sample@example.com',
    phone: '+15555550102',
    address: ['22 Placeholder Lane', 'Testville', 'OR', '97001'],
    paymentOption: deposit.name,
    campers: [
      { first_name: 'Sam', last_name: 'Sample', age: 'adult', lodging: ['tents', 'tent_small'], shared_with: 'Robin Sample' },
      { first_name: 'Robin', last_name: 'Sample', age: 'youth', lodging: ['tents', 'tent_small'], shirt: 'Small', diet: ['Vegan', 'Nut free'], shared_with: 'Sam Sample' },
    ],
  },
  {
    email: 'casey.demo@example.com',
    phone: '+15555550103',
    address: ['303 Demo Court', 'Mockford', 'WA', '98001'],
    campers: [
      { first_name: 'Casey', last_name: 'Demo', age: 'youth', lodging: ['day'] },
    ],
  },
];

function camperData(camper: Camper, household: Household, lodgingMap: LodgingLookup) {
  const leaf = camper.lodging[camper.lodging.length - 1];
  return {
    first_name: camper.first_name,
    last_name: camper.last_name,
    age: ages[camper.age],
    email: household.email,
    phone: household.phone,
    arrival: `${year}-08-01`,
    ...(camper.diet ? { diet: camper.diet } : {}),
    t_shirt: camper.shirt ? { wanted: true, size: camper.shirt } : { wanted: false },
    lodging: {
      lodging_requested: {
        choices: camper.lodging.map(key => lodgingMap[key].id),
        id: lodgingMap[leaf].id,
        name: lodgingMap[leaf].name,
      },
      ...(camper.shared_with ? { lodging_shared: true, lodging_shared_with: camper.shared_with } : {}),
    },
  };
}

function makeRegistration(household: Household, lodgingMap: LodgingLookup): SampleRegistration {
  const [street_address, city, state_or_province, zip_code] = household.address;
  return {
    formData: {
      registrant_email: household.email,
      campers: household.campers.map(c => camperData(c, household, lodgingMap)),
      address: { street_address, city, state_or_province, zip_code },
      how_heard: 'A friend',
      ...(household.donation ? { donation: household.donation } : {}),
      comments: '',
    },
    // the server works out the real prices; this is only the client's echo
    pricingResults: {
      campers: household.campers.map(() => ({ lodging: 0, t_shirt: 0, total: 0 })),
      donation: household.donation ?? 0,
      total: 0,
    },
    ...(household.paymentOption ? { paymentData: { paymentOption: household.paymentOption } } : {}),
  };
}

export default function makeRegistrations(lodgingMap: LodgingLookup): SampleRegistration[] {
  return households.map(h => makeRegistration(h, lodgingMap));
}
