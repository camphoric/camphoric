export default [
    {
        var: "tuition",
        exp: {
            "*": [
                {
                    "+": [
                        { "if": [{ ">": [{"var": ["camper.age", 18]}, 11]},
                            { "+": [
                                { "if": [
                                    { "===": ["F", {"var": "camper.session"}]}, {"var": "pricing.full_adult"},
                                    { "===": ["A", {"var": "camper.session"}]}, {"var": "pricing.half_adult"},
                                    { "===": ["B", {"var": "camper.session"}]}, {"var": "pricing.half_adult"},
                                    0
                                ]}
                            ]},
                            { "+": [
                                { "if": [
                                    { ">": [{"var": ["camper.age", 18]}, 3]},
                                    {  "if": [
                                        { "===": ["F", {"var": "camper.session"}]}, {"var": "pricing.full_teen"},
                                        { "===": ["A", {"var": "camper.session"}]}, {"var": "pricing.half_teen"},
                                        { "===": ["B", {"var": "camper.session"}]}, {"var": "pricing.half_teen"},
                                        0
                                    ]},
                                    0
                                ]}
                            ]}
                        ]},
                        {  "if": [
                            { "and": [
                                {"===": ["F", {"var": "camper.session"}]},
                                {"===": [{ "var": "registration.payment_type" }, "Check" ]}
                            ]}, {"var": "pricing.check_discount_full"},
                            { "and": [
                                {"===": ["A", {"var": "camper.session"}]},
                                {"===": [{ "var": "registration.payment_type" }, "Check" ]}
                            ]}, {"var": "pricing.check_discount_half"},
                            { "and": [
                                { "===": ["B", {"var": "camper.session"}]},
                                {"===": [{ "var": "registration.payment_type" }, "Check" ]}
                            ]}, {"var": "pricing.check_discount_half"},
                            0
                        ]}
                    ]
                },
                {  "if": [
                    { "===": ["deposit", {"var": "registration.payment_full_or_deposit"}]}, 0.5,
                    1
                ]}
            ]
        }
    },
    {
        var: "meals",
        exp: {
            "+": [
                { "if": [{ ">": [{"var": ["camper.age", 18]}, 11]},
                    { "+": [
                        { "if": [
                            { "===": ["", {"var": "camper.meals.meal_plan"}]}, 0,
                            { "===": ["F", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_adult_full"},
                            { "===": ["D", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_adult_dinners"},
                            { "===": ["A", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_adult_half"},
                            { "===": ["B", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_adult_half"},
                            0
                        ]}
                    ]},
                    { "+": [
                        { "if": [
                            { "===": ["", {"var": "camper.meals.meal_plan"}]}, 0,
                            { "===": ["F", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_teen_full"},
                            { "===": ["D", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_teen_dinners"},
                            { "===": ["A", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_teen_half"},
                            { "===": ["B", {"var": "camper.meals.meal_plan"}]}, {"var": "pricing.meals_teen_half"},
                            0
                        ]}
                    ]}
                ]}
            ]
        }
    },
    {
        var: "total",
        exp: {
            "+": [
                {var: "tuition"},
                {var: "meals"},
            ]
        }
    }
];

