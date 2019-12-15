import jsonLogic from 'json-logic-js';
import { AppState } from './App/appTypes';

export function calculatePrice(state: AppState) {
	// calculation should be done in whole dollars for sake of
	// avoiding funky issues with floats. If sub-dollar amounts
	// are necessary, we should switch this to cents.
	if (state.status === 'fetching' || !state.formData) return { total: 0 };

	const pricingLogic = state.config.pricingLogic;

	const data = {
		registration: state.formData,
		pricing: state.config.pricing,
	};

	const campers = (state.formData.campers || []).map(
		camper => jsonLogic.apply(
			pricingLogic.camper,
			{
				...data,
				camper,
			}
		)
	);

	const meals = (state.formData.campers || []).map(
		camper => jsonLogic.apply(
			pricingLogic.meals,
			{
				...data,
				camper,
			}
		)
	);

	const parking = jsonLogic.apply(
		pricingLogic.parking,
		data,
	);

	const shirts = jsonLogic.apply(
		pricingLogic.shirts,
		data,
	);

	const donation = jsonLogic.apply(
		pricingLogic.donation,
		data,
	);

	const total = (
		campers.reduce((t, c) => c + t) +
		meals.reduce((t, c) => c + t) +
		parking +
		shirts +
		donation
	);

	const result = {
		campers,
		meals,
		parking,
		shirts,
		donation,
		total,
	};

	Object.entries({
		parking,
		shirts,
		donation,
		total,
		...campers.reduce((o, c, k) => ({...o, [`campers${k}`]: c}), {}),
		...meals.reduce((o, c, k) => ({...o, [`meals${k}`]: c}), {}),
	}).forEach(
		([key, value]) => {
			if (typeof value !== 'number') {
				console.log(result);
				throw new Error(
					`Pricing returned incorrect type for ${key} (expected number, got ${typeof value})`);
			} else if (Math.floor(value) !== value) {
				console.log(result);
				throw new Error(`Pricing returned non-natural number for ${key} (got ${value}).`);
			}
		}
	)

	return result;
}
