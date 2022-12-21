export default [
  {'var': 'age',
    'exp': {if: [
      {'var': 'camper.birthdate'},
      {'-': [{'-': [{'var': 'event.start.year'},
        {'var': 'camper.birthdate.year'}]},
        {'if': [{'<': [{'var': 'event.start.month'},
          {'var': 'camper.birthdate.month'}]},
          1,
          {'and': [{'==': [{'var': 'event.start.month'},
            {'var': 'camper.birthdate.month'}]},
            {'<': [{'var': 'event.start.day'},
              {'var': 'camper.birthdate.day'}]},
          ]},
          1,
          0]},
      ]},
      999
    ]},
  },
  {'var': 'base',
    'exp': {'if': [

      // first adult
      {'and': [
        {'>=': [{'var': 'age'}, {'var': 'pricing.adult_threshold'}]},
        {'==': [{'var': 'camper.index'}, 0]}],
      },
      {'if': [
        // talent
        {'==': [{'var': 'registration.registration_type'}, 'talent']},
        {'var': 'pricing.talent_adult'},
        // management
        {'==': [{'var': 'registration.registration_type'}, 'management']},
        {'var': 'pricing.management_adult'},
        // non-staff
        {'var': 'pricing.adult'}]},

      // additional adult
      {'>=': [{'var': 'age'}, {'var': 'pricing.adult_threshold'}]},
      {'if': [
        {'==': [{'var': 'registration.registration_type'}, 'talent']},
        // talent
        {'var': 'pricing.talent_additional_adult'},
        // non-staff
        {'var': 'pricing.additional_adult'}]},

      // youth
      {'>=': [{'var': 'age'}, {'var': 'pricing.youth_threshold'}]},
      {'if': [
        {'==': [{'var': 'registration.registration_type'}, 'talent']},
        // talent
        {'var': 'pricing.talent_youth'},
        // non-talent
        {'var': 'pricing.youth'}]},

      // old child
      {'>=': [{'var': 'age'}, {'var': 'pricing.old_child_threshold'}]},
      {'if': [
        {'==': [{'var': 'registration.registration_type'}, 'talent']},
        // talent
        {'var': 'pricing.talent_old_child'},
        // non-talent
        {'var': 'pricing.old_child'}]},

      // young child
      {'>=': [{'var': 'age'}, {'var': 'pricing.young_child_threshold'}]},
      {'if': [
        {'==': [{'var': 'registration.registration_type'}, 'talent']},
        // talent
        {'var': 'pricing.talent_young_child'},
        // non-talent
        {'var': 'pricing.young_child'}]},

      // infant
      {'var': 'pricing.infant'},
    ]},
  },
  {'var': 'work_trade_discount',
    'exp': {'if': [{'var': 'camper.work_trade'},
      {'if': [{'and': [{'>=': [{'var': 'age'},
        {'var': 'pricing.adult_threshold'}]},
        {'==': [{'var': 'camper.index'},
          0]},
      ],
      },
        {'var': 'pricing.work_trade_discount_adult'},
        {'>=': [{'var': 'age'},
          {'var': 'pricing.adult_threshold'}]},
        {'var': 'pricing.work_trade_discount_additional_adult'},
        {'>=': [{'var': 'age'},
          {'var': 'pricing.youth_threshold'}]},
        {'var': 'pricing.work_trade_discount_youth'},
        0,
      ],
      },
      0,
    ],
    },
  },
  {'var': 'late_fee',
    'exp': {'if': [{'>': [{'var': 'now'},
      {'var': 'event.late_registration_start'},
    ]},
      {'var': 'pricing.late_fee'},
      0,
    ],
    },
  },
  {'var': 'deposit', 'exp': {'var': 'pricing.deposit_per_camper'}},
  {'var': 'total',
    'exp': {'+': [{'var': 'base'},
      {'var': 'work_trade_discount'},
      {'var': 'late_fee'},
    ]},
  },
]
