import { ageLookup } from './pricing/camperPricingLogic.js';

const registrations = [
  {
    phone: '+15551235678',
    email: 'bobross123456@dontsend.com',
    campers: [
      [64, 'BobCO', 'Ross', 'mrna', 'offsite', 'Cleanup'],
      [64, 'JaneCO', 'Ross', 'mrna', 'offsite', 'Cleanup'],
    ],
  },
  {
    phone: '+15553985678',
    email: 'skywalker123456@dontsend.com',
    campers: [
      [64 , 'AniCO','Skywalker' , 'mrna', 'rvsm', 'Cleanup', 'Padmé Amidala'],
      [64 , 'PadméCO' , 'Amidala' , 'mrna', 'rvsm', 'Cleanup', 'Ani Skywalker'],
      [17 , 'LukeCO' , 'Skywalker' , 'mrna', 'tent', 'Cleanup'],
      [17 , 'LeiaCO' , 'Organa' , 'mrna', 'tent', 'Cleanup'],
    ],
  },
  {
    phone: '+15553985555',
    email: 'vampslayer2345@dontsend.com',
    campers: [
      [49 , 'BuffyCO','Summers' , 'trad', 'tent', 'Cleanup'],
      [49 , 'WillowCO' , 'Rosenberg', 'trad', 'tent', 'Cleanup'],
      [49 , 'XanderCO' , 'Harris' , 'trad', 'tent', 'Cleanup'],
      [17 , 'DawnCO' , 'Summers' , 'trad', 'tent', 'Cleanup'],
    ],
  },

  {
    phone: '+15553755555',
    email: 'notarever3q450@dontsend.com',
    campers: [
      [49 , 'MalcomCO','Reynolds' , 'mrna', 'rvlg', 'Cleanup', 'my crew'],
      [49 , 'JayneCO' , 'Cobb', 'mrna', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'ZoeCO' , 'Washburn', 'mrna', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'HobanCO' , 'Washburn', 'mrna', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'InaraCO' , 'Serra', 'mrna', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'KayleeCO' , 'Frye', 'mrna', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
    ],
  },
];

function destructureCamper(c, email, phone, lodgingMap) {
  const [
    age,
    first_name,
    last_name,
    vax,
    lodging,
    chore,
    lodging_shared_with,
  ] = c;

  const mrna = [
    'First dose',
    'Second dose',
    'Booster'
  ];

  const trad = ['J&J'];

  return {
    age: ageLookup[age],
    first_name,
    last_name,
    email,
    phone,
    vaccination_status: vax === 'mrna' ? mrna : trad,
    lodging: {
      'lodging_requested': {
        'choices': [ lodgingMap[lodging].id ],
        id: lodgingMap[lodging].id,
        'name': 'Something',
      },
      ...(
        !lodging_shared_with ? {} : {
          lodging_shared_with,
          lodging_shared: true,
        }
      )
    },
    chore,
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
      'lta_donation': 0,
      'how_did_you_hear': '',
      'comments': '',
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

