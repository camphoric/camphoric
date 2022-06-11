import { ageLookup } from './pricing/camperPricingLogic.mjs';

const registrations = [
  {
		phone: "555-123-5678",
    email: 'bobross123456@dontsend.com',
    campers: [
      [64, 'Bob', 'Ross', 'Booster', 'Tent', 'Cleanup'],
      [64, 'Jane', 'Ross', 'Booster', 'Tent', 'Cleanup'],
    ],
  },
  {
		phone: "555-398-5678",
    email: 'skywalker123456@dontsend.com',
    campers: [
      [64 , 'Ani','Skywalker' , 'Booster', 'Tent', 'Cleanup'],
      [64 , 'Padmé' , 'Amidala' , 'Booster', 'Tent', 'Cleanup'],
			[17 , 'Luke' , 'Skywalker' , 'Booster', 'Tent', 'Cleanup'],
			[17 , 'Leia' , 'Organa' , 'Booster', 'Tent', 'Cleanup'],
    ],
  },
  {
		phone: "555-398-5555",
    email: 'vampslayer2345@dontsend.com',
    campers: [
      [49 , 'Buffy','Summers' , 'Booster', 'Tent', 'Cleanup'],
      [49 , 'Willow' , 'Rosenberg', 'Booster', 'Tent', 'Cleanup'],
			[49 , 'Xander' , 'Harris' , 'Booster', 'Tent', 'Cleanup'],
			[17 , 'Dawn' , 'Summers' , 'Booster', 'Tent', 'Cleanup'],
    ],
  },

  {
		phone: "555-375-5555",
    email: 'notarever3q450@dontsend.com',
    campers: [
      [49 , 'Malcom','Reynolds' , 'Booster', 'Tent', 'Cleanup'],
      [49 , 'Jayne' , 'Cobb', 'Booster', 'Tent', 'Cleanup'],
			[49 , 'Zoe' , 'Washburn', 'Booster', 'Tent', 'Cleanup'],
			[49 , 'Hoban' , 'Washburn', 'Booster', 'Tent', 'Cleanup'],
			[49 , 'Inara' , 'Serra', 'Booster', 'Tent', 'Cleanup'],
			[49 , 'Kaylee' , 'Frye', 'Booster', 'Tent', 'Cleanup'],
    ],
  },
];

function destructureCamper(c) {
  const [
    age,
    firstName,
    lastName,
    vaccinationStatus,
    lodging,
    chore,
  ] = c;

  return {
    age: ageLookup[age],
    firstName,
    lastName,
    vaccinationStatus,
    lodging,
    chore,
  };
}

function makeRegistration(reg, lodgingMap) {
  return {
    "formData": {
      "campers": reg.campers.map(destructureCamper),
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

