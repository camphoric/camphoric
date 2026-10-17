import type { LodgingLookup, SampleRegistration } from 'camphoric-event-import-spec';
import { ageLookup } from './pricing/camperPricingLogic.ts';
import { days } from './camperSchema.ts';

// age, first name, last name, days attending, lodging, meal exceptions, and
// who they share lodging with
type CamperRow = [
  keyof typeof ageLookup, string, string, string, string, string[], string?,
];

interface Household {
  phone: string;
  email: string;
  campers: CamperRow[];
}

const registrations: Household[] = [
  {
    phone: '+15553985678',
    email: 'bobross123456@dontsend.com',
    campers: [
      ['adult', 'BobCO', 'Ross', '5', 'vil7', []],
      ['adult', 'JaneCO', 'Ross', '5', 'vil7', []],
    ],
  },
  {
    phone: '+15553985678',
    email: 'skywalker123456@dontsend.com',
    campers: [
      ['adult' , 'AniCO','Skywalker' , '5', 'cabin', [], 'Padmé Amidala'],
      ['adult' , 'PadméCO' , 'Amidala' , '5', 'cabin', [], 'Ani Skywalker'],
      ['child' , 'LukeCO' , 'Skywalker' , '5', 'tent', []],
      ['child' , 'LeiaCO' , 'Organa' , '5', 'tent', []],
    ],
  },
  {
    phone: '+15553985555',
    email: 'vampslayer2345@dontsend.com',
    campers: [
      ['yadult' , 'BuffyCO','Summers' , '3', 'rvmd', []],
      ['yadult' , 'WillowCO' , 'Rosenberg', '3', 'rvmd', []],
      ['yadult' , 'XanderCO' , 'Harris' , '3', 'rvmd', []],
      ['yadult' , 'DawnCO' , 'Summers' , '3', 'rvmd', []],
    ],
  },

  {
    phone: '+15553755555',
    email: 'notarever3q450@dontsend.com',
    campers: [
      ['adult' , 'MalcomCO','Reynolds' , '5', 'rvlg', [], 'my crew'],
      ['adult' , 'JayneCO' , 'Cobb', '5', 'rvlg', [], 'Malcom Reynolds'],
      ['adult' , 'ZoeCO' , 'Washburn', '5', 'rvlg', [], 'Malcom Reynolds'],
      ['adult' , 'HobanCO' , 'Washburn', '5', 'rvlg', [], 'Malcom Reynolds'],
      ['adult' , 'InaraCO' , 'Serra', '5', 'rvlg', [], 'Malcom Reynolds'],
      ['yadult' , 'KayleeCO' , 'Frye', '5', 'rvlg', [], 'Malcom Reynolds'],
    ],
  },
];

function destructureCamper(c: CamperRow, email: string, phone: string, lodgingMap: LodgingLookup) {
  const [
    age,
    first_name,
    last_name,
    daycnt,
    lodging,
    meal_exceptions,
    lodging_shared_with,
  ] = c;

  return {
    age: ageLookup[age][0],
    first_name,
    last_name,
    email,
    phone,
    meal_exceptions,
    first_time: false,
    driving: 'Passenger',
    lodging: {
      'lodging_requested': {
        'choices': [ lodgingMap[lodging].id ],
        id: lodgingMap[lodging].id,
        'name': lodgingMap[lodging].name,
      },
      ...(
        !lodging_shared_with ? {} : {
          lodging_shared_with,
          lodging_shared: true,
        }
      )
    },
    attendance: days.slice(0, Number(daycnt)),
    campership_request: 0,
    linens: false,
  };
}

function makeRegistration(reg: Household, lodgingMap: LodgingLookup): SampleRegistration {
  return {
    'formData': {
      'campers': reg.campers.map(
        c => destructureCamper(
          c,
          reg.email,
          reg.phone,
          lodgingMap,
        )
      ),
      'registrant_email': reg.email,
      // The registration schema requires an address; sample registrations share one.
      'address': {
        'street_address': '1234 Easy St',
        'city': 'Berkeley',
        'state_or_province': 'CA',
        'zip_code': '94703',
      },
      'is_member': true,
      'comments': '',
    },
    'pricingResults': {
      'campers': reg.campers.map(() => ({
        'tuition': 0,
        'total': 0
      })),
      'total': 0,
      'tuition': 0,
    },
  };
}

export default function makeRegistrations(lodgingMap: LodgingLookup): SampleRegistration[] {
  return registrations.map(
    r => makeRegistration(r, lodgingMap)
  );
}

