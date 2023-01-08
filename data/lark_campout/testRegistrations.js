import { ageLookup } from './pricing/camperPricingLogic.js';

const registrations = [
  {
    phone: "+15551235678",
    email: 'bobross123456@dontsend.com',
    campers: [
      [64, 'Bob', 'Ross', 'mrna', 'off_site', 'Cleanup'],
      [64, 'Jane', 'Ross', 'mrna', 'off_site', 'Cleanup'],
    ],
  },
  {
    phone: "+15553985678",
    email: 'skywalker123456@dontsend.com',
    campers: [
      [64 , 'Ani','Skywalker' , 'mrna', 'rv_sm', 'Cleanup', 'Padmé Amidala'],
      [64 , 'Padmé' , 'Amidala' , 'mrna', 'rv_sm', 'Cleanup', 'Ani Skywalker'],
      [17 , 'Luke' , 'Skywalker' , 'mrna', 'tent', 'Cleanup'],
      [17 , 'Leia' , 'Organa' , 'mrna', 'tent', 'Cleanup'],
    ],
  },
  {
    phone: "+15553985555",
    email: 'vampslayer2345@dontsend.com',
    campers: [
      [49 , 'Buffy','Summers' , 'trad', 'tent', 'Cleanup'],
      [49 , 'Willow' , 'Rosenberg', 'trad', 'tent', 'Cleanup'],
      [49 , 'Xander' , 'Harris' , 'trad', 'tent', 'Cleanup'],
      [17 , 'Dawn' , 'Summers' , 'trad', 'tent', 'Cleanup'],
    ],
  },

  {
    phone: "+15553755555",
    email: 'notarever3q450@dontsend.com',
    campers: [
      [49 , 'Malcom','Reynolds' , 'mrna', 'rv_lg', 'Cleanup', 'my crew'],
      [49 , 'Jayne' , 'Cobb', 'mrna', 'rv_lg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'Zoe' , 'Washburn', 'mrna', 'rv_lg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'Hoban' , 'Washburn', 'mrna', 'rv_lg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'Inara' , 'Serra', 'mrna', 'rv_lg', 'Cleanup', 'Malcom Reynolds'],
      [49 , 'Kaylee' , 'Frye', 'mrna', 'rv_lg', 'Cleanup', 'Malcom Reynolds'],
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
    "First dose",
    "Second dose",
    "Booster"
  ];

  const trad = ["J&J"];

  return {
    age: ageLookup[age],
    first_name,
    last_name,
    email,
    phone,
    vaccination_status: vax === 'mrna' ? mrna : trad,
    lodging: {
      lodging_1: lodgingMap[lodging],
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
    "formData": {
      "campers": reg.campers.map(
        c => destructureCamper(
          c,
          reg.email,
          reg.phone,
          lodgingMap,
        )
      ),
      "registrant_email": reg.email,
      "payment_type": "Check",
      "lta_donation": 0,
      "how_did_you_hear": "",
      "comments": "",
    },
    "pricingResults": {
      "campers": reg.campers.map((c) => ({
        "tuition": 0,
        "total": 0
      })),
      "total": 0,
      "tuition": 0,
    }
  }
}

export default function makeRegistrations(lodgingMap) {
  return registrations.map(
    r => makeRegistration(r, lodgingMap)
  );
};

