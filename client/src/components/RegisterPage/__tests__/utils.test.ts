import { FormData, RegistrationConfig, PricingLogic } from '../RegisterPage';
import { calculatePrice } from '../utils';

// These tests are based on server/tests/test_pricing.py
describe('calculatePrice', () => {
  const registrationPricingLogic: PricingLogic = [
    {
        "label": "Cabins",
        "var": "cabins",
        "exp": {
            "*": [
                {"var": "registration.number_of_cabins"},
                {"var": "pricing.cabin"},
            ]
        },
    },
    {
        "label": "Parking Passes",
        "var": "parking_passes",
        "exp":  {
            "*": [
                {"var": "registration.number_of_parking_passes"},
                {"var": "pricing.parking_pass"}
            ]
        },
    },
    {
        "label": "Total",
        "var": "total",
        "exp":  {
            "+": [
                {"var": "cabins"},
                {"var": "parking_passes"}
            ]
        },
    },
  ];

  const camperPricingLogic: PricingLogic = [
    {
        "label": "Is Adult",
        "var": "is_adult",
        "exp": {">=": [{"var": "camper.age"}, 18]},
    },
    {
        "label": "Tuition",
        "var": "tuition",
        "exp": {
            "if": [
                {"var": "is_adult"},
                {"var": "pricing.tuition_adult"},
                {"var": "pricing.tuition_child"}
            ]
        },
    },
    {
        "label": "Meals",
        "var": "meals",
        "exp": {
            "if": [
                {"var": "is_adult"},
                {"var": "pricing.meals_adult"},
                {"var": "pricing.meals_child"}
            ]
        },
    },
    {
        "label": "Camper total",
        "var": "total",
        "exp": {
            "+": [
                {"var": "tuition"},
                {"var": "meals"}
            ]
        },
    },
  ];

  const config: RegistrationConfig = {
    dataSchema: {},
    uiSchema: {},
    event: {},
    pricingLogic: {
      camper: camperPricingLogic,
      registration: registrationPricingLogic,
    },
    pricing: {
      cabin: 100,
      parking_pass: 50,
      tuition_adult: 400,
      tuition_child: 200,
      meals_adult: 300,
      meals_child: 50,
    }
  };

  it('returns zeroes for empty form', () => {
    expect(calculatePrice(config, { campers: [] })).toStrictEqual({
      campers: [],
      cabins: 0,
      parking_passes: 0,
      total: 0,
    });
  });

  it('returns the correct totals for a populated form', () => {
    const formData: FormData = {
      number_of_cabins: 3,
      number_of_parking_passes: 2,
      campers: [
        { age: 2 },
        { age: 17 },
        { age: 18 },
        { age: 42 },
      ],
    };
    expect(calculatePrice(config, formData)).toStrictEqual({
      is_adult: 2,
      tuition: 1200,
      meals: 700,
      cabins: 300,
      parking_passes: 100,
      campers: [
          { is_adult: false, meals: 50, total: 250, tuition: 200 },
          { is_adult: false, meals: 50, total: 250, tuition: 200 },
          { is_adult: true, meals: 300, total: 700, tuition: 400 },
          { is_adult: true, meals: 300, total: 700, tuition: 400 },
      ],
      total: 2300,
    });
  });
});
