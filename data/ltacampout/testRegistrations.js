import { ageLookup } from './pricing/camperPricingLogic.js';

const registrations = [
  {
    phone: '+15551235678',
    email: 'bobross123456@dontsend.com',
    campers: [
      [64, 'BobCO', 'Ross', 'offsitefull', 'Cleanup'],
      [64, 'JaneCO', 'Ross', 'offsitefull', 'Cleanup'],
    ],
  },
  {
    phone: '+15553985678',
    email: 'skywalker123456@dontsend.com',
    campers: [
      [64 , 'AniCO','Skywalker' , 'rvsm', 'Cleanup', 'Padmé Amidala'],
      [64 , 'PadméCO' , 'Amidala' , 'rvsm', 'Cleanup', 'Ani Skywalker'],
      [17 , 'LukeCO' , 'Skywalker' , 'tent', 'Cleanup'],
      [17 , 'LeiaCO' , 'Organa' , 'tent', 'Cleanup'],
    ],
  },
  {
    phone: '+15553985555',
    email: 'vampslayer2345@dontsend.com',
    campers: [
      [49 , 'BuffyCO','Summers' , 'tent', 'Cleanup'],
      [49 , 'WillowCO' , 'Rosenberg', 'tent', 'Cleanup'],
      [49 , 'XanderCO' , 'Harris' , 'tent', 'Cleanup'],
      [17 , 'DawnCO' , 'Summers' , 'tent', 'Cleanup'],
    ],
  },

  {
    phone: '+15553755555',
    email: 'notarever3q450@dontsend.com',
    campers: [
      [49 , 'MalcomCO','Reynolds' , 'rvlg', 'Cleanup', 'my crew'],
      [49 , 'JayneCO' , 'Cobb', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'ZoeCO' , 'Washburn', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'HobanCO' , 'Washburn', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'InaraCO' , 'Serra', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'KayleeCO' , 'Frye', 'rvlg', 'Cleanup', 'Malcom Reynolds'],
    ],
  },
];

function destructureCamper(c, email, phone, lodgingMap) {
  const [
    age,
    first_name,
    last_name,
    lodging,
    chore,
    lodging_shared_with,
  ] = c;

  return {
    age: ageLookup[age],
    first_name,
    last_name,
    email,
    phone,
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
    },
    // The payment step's type; it isn't part of the registration form.
    'paymentData': {
      paymentType: 'Check',
    },
  };
}

export default function makeRegistrations(lodgingMap) {
  return registrations.map(
    r => makeRegistration(r, lodgingMap)
  );
}

