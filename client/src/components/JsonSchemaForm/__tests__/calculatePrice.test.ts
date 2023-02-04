import { calculatePrice, FormData } from '../../JsonSchemaForm';

// These tests are based on server/tests/test_pricing.py
type PricingLogic = ApiRegister['pricingLogic'];

describe('calculatePrice', () => {

  it('returns empty results for an empty form', () => {
    const config: ApiRegister = {
      dataSchema: {},
      uiSchema: {},
      event: {},
      templateVars: {},
      pricingLogic: {
        camper: [],
        registration: [],
      },
      pricing: {},
      preSubmitTemplate: '',
    };
    const formData: FormData = {
      campers: [],
    };

    expect(calculatePrice(config, formData)).toStrictEqual({
      campers: [],
    });
  });

  it('returns the correct totals for a populated form', () => {

    const registrationPricingLogic: PricingLogic['registration'] = [
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

    const camperPricingLogic: PricingLogic['camper'] = [
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

    const config: ApiRegister = {
      dataSchema: {},
      templateVars: {},
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
      },
      preSubmitTemplate: '',
    };
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

  it('handles date calculations correctly', () => {

    const registrationPricingLogic: PricingLogic['registration'] = [
      {
        var: "date_parts",
        exp: [
            { var: "event.start.year" },
            { var: "event.start.month" },
            { var: "event.start.day" },
        ],
      },
    ];

    const camperPricingLogic: PricingLogic['camper'] = [
      {
          var: "birthdate_parts",
          exp: [
              { var: "camper.birthdate.year" },
              { var: "camper.birthdate.month" },
              { var: "camper.birthdate.day" },
          ],
      },
    ];
    const config: ApiRegister = {
      templateVars: {},
      dataSchema: {
        type: 'object',
        properties: {
          campers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                  birthdate: {
                      type: "string",
                      format: "date",
                  },
              },
            },
          },
        },
      },
      uiSchema: {},
      event: {
        start: {
          year: 2019,
          month: 2,
          day: 25,
        },
      },
      pricingLogic: {
        camper: camperPricingLogic,
        registration: registrationPricingLogic,
      },
      pricing: {},
      preSubmitTemplate: '',
    };

    const formData: FormData = {
      campers: [
        {
          birthdate: '2000-12-31',
        },
      ],
    };

    expect(calculatePrice(config, formData)).toStrictEqual({
      date_parts: [2019, 2, 25],
      campers: [{ birthdate_parts: [2000, 12, 31] }],
    });
  });

  it('it handles registration_type', () => {
    const registrationPricingLogic = [
        {
            'var': 'total',
            'exp': {
                'if': [
                    {'==': [
                        {'var': 'registration.registration_type'},
                        'worktrade',
                    ]},
                    100,
                    200,
                ]
            },
        },
    ];

    let config: ApiRegister = {
      templateVars: {},
      dataSchema: {
        type: 'object',
        properties: {
          campers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {}
            },
          },
        },
      },
      uiSchema: {},
      event: {},
      pricingLogic: {
        camper: [],
        registration: registrationPricingLogic,
      },
      pricing: {},
      preSubmitTemplate: '',
    };

    const formData: FormData = { campers: [] };

    expect(calculatePrice(config, formData)).toStrictEqual({
      campers: [],
      total: 200,
    });

    config.registrationType = {
      name: 'worktrade',
      label: 'Work-trade',
    };
    expect(calculatePrice(config, formData)).toStrictEqual({
      campers: [],
      total: 100,
    });
  });
});
