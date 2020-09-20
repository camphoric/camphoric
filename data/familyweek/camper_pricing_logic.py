data = [
    {
        'var': 'age',
        'value': {
            '-': [
                {'-': [{'var': 'event.start.year'}, {'var': 'birthdate_date.year'}]},

                {'if': [
                    {'<': [{'var': 'event.start.month'}, {'var': 'birthdate_date.month'}]},
                    1,

                    {'and': [
                        {'==': [{'var': 'event.start.month'},{'var': 'birthdate_date.month'}]},
                        {'<': [{'var': 'event.start.day'}, {'var': 'birthdate_date.day'}]},
                    ]},
                    1,

                    0
                ]},
            ],
        },
    },
    {
        'var': 'base',
        'value': {
            'if': [
                {
                    'and': [
                        {'>=': [{'var': 'age'}, {'var': 'pricing.adult_threshold'}]},
                        {'==': [{'var': 'index'}, 0]},
                    ],
                },
                {
                    'if': [
                        {'==': [{'var': 'registration.registration_type'}, 'talent']},
                        {'var': 'pricing.talent_adult'},

                        {'==': [{'var': 'registration.registration_type'}, 'management']},
                        {'var': 'pricing.management_adult'},

                        {'var': 'pricing.adult'}
                    ]
                },

                {'>=': [{'var': 'age'}, {'var': 'pricing.adult_threshold'}]},
                {
                    'if': [
                        {'==': [{'var': 'registration.registration_type'}, 'talent']},
                        {'var': 'pricing.talent_additional_adult'},
                        {'var': 'pricing.additiona_adult'}
                    ]
                },

                {'>=': [{'var': 'age'}, {'var': 'pricing.youth_threshold'}]},
                {
                    'if': [
                        {'==': [{'var': 'registration.registration_type'}, 'talent']},
                        {'var': 'pricing.talent_youth'},
                        {'var': 'pricing.youth'}
                    ]
                },

                {'>=': [{'var': 'age'}, {'var': 'pricing.old_child_threshold'}]},
                {
                    'if': [
                        {'==': [{'var': 'registration.registration_type'}, 'talent']},
                        {'var': 'pricing.talent_old_child'},
                        {'var': 'pricing.old_child'}
                    ]
                },

                {'>=': [{'var': 'age'}, {'var': 'pricing.young_child_threshold'}]},
                {
                    'if': [
                        {'==': [{'var': 'registration.registration_type'}, 'talent']},
                        {'var': 'pricing.talent_young_child'},
                        {'var': 'pricing.young_child'}
                    ]
                },

                {'var': 'pricing.infant'},
            ]
        },
    },
    {
        'var': 'work_trade_discount',
        'value': {
            'if': [
                {'var': 'camper.work_trade'},
                {
                    'if': [
                        {
                            'and': [
                                {'>=': [{'var': 'age'}, {'var': 'pricing.adult_threshold'}]},
                                {'==': [{'var': 'index'}, 0]},
                            ],
                        },
                        {'var': 'pricing.work_trade_discount_adult'},

                        {'>=': [{'var': 'age'}, {'var': 'pricing.adult_threshold'}]},
                        {'var': 'pricing.work_trade_discount_additional_adult'},

                        {'>=': [{'var': 'age'}, {'var': 'pricing.youth_threshold'}]},
                        {'var': 'pricing.work_trade_discount_youth'},

                        0,
                    ],
                },
                0,
            ],
        },
    },
    {
        'var': 'late_fee',
        'value': {
            'if': [
                {'>': [{'var': 'now'}, {'var': 'event.late_registration_start'},]},
                {'var': 'pricing.late_fee'},
                0,
            ],
        },
    },
    {
        'var': 'total',
        'value': {
            '+': [
                {'var': 'base'},
                {'var': 'work_trade_discount'},
                {'var': 'late_fee'},
            ]
        },
    },
]
