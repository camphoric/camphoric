const registrations = [
  {
    address: ['1234 Easy St', 'Berkeley', 'CA', '94703'],
    email: 'bobross123456@notasdfwedvicfake.com',
    parking_passes: 1,
    campers: [
      [64, 'M', 'Bob', 'Ross', 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|O', 'Jane Ross'],
      [64, 'F', 'Jane', 'Ross', 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|O', 'Bob Ross'],
    ],
  },
  {
    address: ['5678 Hard St', 'Napa', 'CA', '94558'],
    email: 'skywalker123456@notasdfwedvicfake.com',
    parking_passes: 1,
    campers: [
      [64 , 'M' , 'Ani','Skywalker' , 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|V', 'Padmé Skywalker'] ,
      [64 , 'F' , 'Padmé' , 'Amidala' , 'camp1', 'camp1_tent', 'camp1_tent_area_A', 'F|O', 'Ani Skywalker']  ,
			[17 , 'M' , 'Luke' , 'Skywalker' , 'camp3', 'camp3_tent', 'camp3_tent_area_K', 'D|E']  ,
			[17 , 'F' , 'Leia' , 'Organa' , 'camp3', 'camp3_tent', 'camp3_tent_area_K', 'D|E']  ,
    ],
  },
  {
    address: ['1630 Revello Drive', 'Sunnydale', 'CA', '94008'],
    email: 'vampslayer2345@notasdfwedvicfake.com',
    parking_passes: 1,
    campers: [
      [49 , 'F' , 'Buffy','Summers' , 'camp2', 'camp2_rv', 'camp2_rv_sm', 'F|V', 'Willow Rosenberg'] ,
      [49 , 'F' , 'Willow' , 'Rosenberg', 'camp2', 'camp2_rv', 'camp2_rv_sm', 'F|O', 'Buffy Summers'] ,
			[49 , 'M' , 'Xander' , 'Harris' , 'camp2', 'camp2_rv', 'camp2_rv_sm', 'F|O', 'Willow Rosenberg'] ,
			[17 , 'F' , 'Dawn' , 'Summers' , 'camp3', 'camp3_tent', 'camp3_tent_area_K', 'F|E']  ,
    ],
  },

  {
    address: ['5932 Firefly Ln', 'Verse', 'CA', '94008'],
    email: 'notarever3q450@notasdfwedvicfake.com',
    parking_passes: 1,
    campers: [
      [49 , 'M' , 'Malcom','Reynolds' , 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
      [49 , 'M' , 'Jayne' , 'Cobb', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
			[49 , 'F' , 'Zoe' , 'Washburn', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
			[49 , 'M' , 'Hoban' , 'Washburn', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
			[49 , 'F' , 'Inara' , 'Serra', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
			[49 , 'F' , 'Kaylee' , 'Frye', 'camp2', 'camp2_rv', 'camp2_rv_lg', '', 'Reynolds'] ,
    ],
  },
];

function makeRegistration(reg, lodgingMap) {
  return {
    "formData": {
      "payment": {
        "payment_type": reg.payment_type || "paypal",
        "payer_billing_address": {
          "country": "United States",
          "street_address": reg.address[0],
          "city": reg.address[1],
          "state_or_province": reg.address[2],
          "zip_code": reg.address[3],
        },
        "payment_full_or_deposit": "full",
        "payer_first_name": reg.campers[0][2],
        "payer_last_name": reg.campers[0][3],
        "payer_number": "+15555555555",
        "paypal_email": reg.email,
      },
      "parking_passes": Array.apply(reg.parking_passes || 0).map(
        () => ({ "holder": `${reg.campers[0][2]} ${reg.campers[0][3]}` })
      ),
      "campers": reg.campers.map((c) => ({
        "age": c[0],
        "meals": {
					...(
						!c[7].length ? { meal_plan: '' } : {
							meal_plan: c[7].split('|')[0],
							meal_type: c[7].split('|')[1],
						}
					)
        },
        "session": "F",
        "address_different_than_payer": false,
        "lodging": {
          "lodging_1": lodgingMap[c[4]],
          "lodging_2": lodgingMap[c[5]],
          "lodging_3": lodgingMap[c[6]],
          ...(c[8] ?  { lodging_shared: true, lodging_shared_with: c[8] } : {})
        },
        "first_name": c[2],
        "last_name": c[3],
        "gender": c[1],
      })),
      "registrant_email": reg.email,
    },
    "pricingResults": {
      "campers": reg.campers.map((c) => ({
        "tuition": 0,
        "meals": 0,
        "total": 0
      })),
      "parking": 65 * (reg.parking_passes || 1),
      "donation": 0,
      "total": 0,
      "tuition": 0,
      "meals": 0
    }
	}
}

export default function makeRegistrations(lodgingMap) {
	return registrations.map(
		r => makeRegistration(r, lodgingMap)
	);
};

