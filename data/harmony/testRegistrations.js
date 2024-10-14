import { ageLookup } from './pricing/camperPricingLogic.js';
import { days } from './camperSchema.js';

const registrations = [
  {
    phone: '+15553985678',
    email: 'bobross123456@dontsend.com',
    campers: [
      ['adult', 'BobCO', 'Ross', '5', 'motel', []],
      ['adult', 'JaneCO', 'Ross', '5', 'motel', []],
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

function destructureCamper(c, email, phone, lodgingMap) {
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
    attendance: days.slice(0, daycnt),
    campership_request: 0,
    linens: 'No',
  };
}

function makeRegistration(reg, lodgingMap) {
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
      'payment_type': 'Check',
      'membership_check': 'Yes, I am a current member',
      'comments': '',
			'read_etiquette': true,
    },
    'pricingResults': {
      'campers': reg.campers.map(() => ({
        'tuition': 0,
        'total': 0
      })),
      'total': 0,
      'tuition': 0,
    }
  };
}

export default function makeRegistrations(lodgingMap) {
  return registrations.map(
    r => makeRegistration(r, lodgingMap)
  );
}

