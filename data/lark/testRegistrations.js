import { mealsLookup, ageLookup } from './pricing/camperPricingLogic.js';

const genderLookup = {
  M: 'Male',
  F: 'Female',
  N: 'Non-binary',
};

const mealTypeLookup = {
  'O': 'Non-Vegetarian',
  'V': 'Vegetarian',
  'E': 'Vegan',
};

const registrations = [
  {
    address: ['1234 Easy St', 'Berkeley', 'CA', '94703'],
    email: 'bobross123456@dontsend.com',
    parking_passes: 1,
    campers: [
      [64, 'M', 'BobLC', 'Ross', 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|O', 'Jane Ross'],
      [64, 'F', 'JaneLC', 'Ross', 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|O', 'Bob Ross'],
    ],
  },
  {
    address: ['5678 Hard St', 'Napa', 'CA', '94558'],
    email: 'skywalker123456@dontsend.com',
    parking_passes: 1,
    campers: [
      [64 , 'M' , 'AniLC','Skywalker' , 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|V', 'Padmé Skywalker'] ,
      [64 , 'F' , 'PadméLC' , 'Amidala' , 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|O', 'Ani Skywalker']  ,
      [17 , 'M' , 'LukeLC' , 'Skywalker' , 'camp3', 'camp3_tent', 'camp3_tent_area_K', 'D|E']  ,
      [17 , 'F' , 'LeiaLC' , 'Organa' , 'camp3', 'camp3_tent', 'camp3_tent_area_K', 'D|E']  ,
    ],
  },
  {
    address: ['1630 Revello Drive', 'Sunnydale', 'CA', '94008'],
    email: 'vampslayer2345@dontsend.com',
    parking_passes: 1,
    campers: [
      [49 , 'F' , 'BuffyLC','Summers' , 'camp2', 'camp2_rv', 'camp2_rv_sm', 'F|V', 'Willow Rosenberg'] ,
      [49 , 'F' , 'WillowLC' , 'Rosenberg', 'camp2', 'camp2_rv', 'camp2_rv_sm', 'F|O', 'Buffy Summers'] ,
      [49 , 'M' , 'XanderLC' , 'Harris' , 'camp2', 'camp2_rv', 'camp2_rv_sm', 'F|O', 'Willow Rosenberg'] ,
      [17 , 'F' , 'DawnLC' , 'Summers' , 'camp3', 'camp3_tent', 'camp3_tent_area_K', 'F|E']  ,
    ],
  },

  {
    address: ['5932 Firefly Ln', 'Verse', 'CA', '94008'],
    email: 'notarever3q450@dontsend.com',
    parking_passes: 1,
    campers: [
      [49 , 'M' , 'MalcomLC','Reynolds' , 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
      [49 , 'M' , 'JayneLC' , 'Cobb', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
      [49 , 'F' , 'ZoeLC' , 'Washburn', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
      [49 , 'M' , 'HobanLC' , 'Washburn', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
      [49 , 'F' , 'InaraLC' , 'Serra', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
      [49 , 'F' , 'KayleeLC' , 'Frye', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
    ],
  },
];

function makeRegistration(reg, lodgingMap) {
  return {
    'formData': {
      'payment': {
        'payment_type': reg.payment_type || 'Check',
        'payer_billing_address': {
          'country': 'United States',
          'street_address': reg.address[0],
          'city': reg.address[1],
          'state_or_province': reg.address[2],
          'zip_code': reg.address[3],
        },
        'payment_full_or_deposit': 'Full Payment',
        'payer_first_name': reg.campers[0][2],
        'payer_last_name': reg.campers[0][3],
        'payer_number': '+15555555555',
        'paypal_email': reg.email,
      },
      'parking_passes': Array.apply(reg.parking_passes || 0).map(
        () => ({ 'holder': `${reg.campers[0][2]} ${reg.campers[0][3]}` })
      ),
      'campers': reg.campers.map((c) => ({
        'age': ageLookup[c[0]],
        'meals': {
          ...(
            !c[7].length ? { meal_plan: '' } : {
              meal_plan: mealsLookup[c[7].split('|')[0]],
              meal_type: mealTypeLookup[c[7].split('|')[1]],
            }
          )
        },
        vaccination_status: [
          'First dose',
          'Second dose',
          'Booster'
        ],
        'session': 'Full camp',
        'address_different_than_payer': false,
        'lodging': {
          'lodging_requested': {
            'choices': [ lodgingMap[c[4]].id, lodgingMap[c[5]].id, lodgingMap[c[6]].id ],
            'id': lodgingMap[c[6]].id,
            'name': 'Something',
          },
          ...(c[8] ?  { lodging_shared: true, lodging_shared_with: c[8].id } : {})
        },
        'first_name': c[2],
        'last_name': c[3],
        'gender': genderLookup[c[1]],
      })),
      'registrant_email': reg.email,
    },
    'pricingResults': {
      'campers': reg.campers.map(() => ({
        'tuition': 0,
        'meals': 0,
        'total': 0
      })),
      'parking': 65 * (reg.parking_passes || 1),
      'donation': 0,
      'total': 0,
      'tuition': 0,
      'meals': 0
    },
    'paymentData': {
      paymentType: reg.payment_type || 'Check',
    }
  };
}

export default function makeRegistrations(lodgingMap) {
  return registrations.map(
    r => makeRegistration(r, lodgingMap)
  );
}

