const pricing = {
	full_adult: 880,
	half_adult: 670,

	full_youth: 620,
	half_youth: 470,

	full_kid: 0,
	half_kid: 0,

	meals_adult_full: 505,
	meals_youth_full: 380,

	meals_adult_dinners: 276,
	meals_youth_dinners: 202,

	meals_adult_half: 268,
	meals_youth_half: 192,

	parking_pass: 85,
	parking_pass_at_camp_extra: 20,

	talent_guest_discount: -0.4,

	name_badge: 5,
};

pricing.kitchen_partial = Math.floor(pricing.full_adult / 2);

export default pricing;
