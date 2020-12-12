export default [
    {
        var: "parking",
        exp: {
            "*": [
                {"reduce": [
                    {"var": "registration.parking_passes"},
                    {"+":[
                        {"var": "accumulator"},
                        1
                    ]},
                    0
                ]},
                {"var": "pricing.parking_pass"}
            ]
        }
    },
    {
        var: "shirts",
        exp: {
            "+": [
                {"*": [{"var": ["registration.tshirt_sizes.small", 0]}, {"var": "pricing.tshirt"}]},
                {"*": [{"var": ["registration.tshirt_sizes.medium", 0]}, {"var": "pricing.tshirt"}]},
                {"*": [{"var": ["registration.tshirt_sizes.large", 0]}, {"var": "pricing.tshirt"}]},
                {"*": [{"var": ["registration.tshirt_sizes.xl", 0]}, {"var": "pricing.tshirt"}]},
                {"*": [{"var": ["registration.tshirt_sizes.xxl", 0]}, {"var": "pricing.tshirt"}]},
                {"*": [{"var": ["registration.sweatshirt_sizes.small", 0]}, {"var": "pricing.sweatshirt"}]},
                {"*": [{"var": ["registration.sweatshirt_sizes.medium", 0]}, {"var": "pricing.sweatshirt"}]},
                {"*": [{"var": ["registration.sweatshirt_sizes.large", 0]}, {"var": "pricing.sweatshirt"}]},
                {"*": [{"var": ["registration.sweatshirt_sizes.xl", 0]}, {"var": "pricing.sweatshirt"}]},
                {"*": [{"var": ["registration.sweatshirt_sizes.xxl", 0]}, {"var": "pricing.sweatshirt"}]}
            ]
        },
    },
    {
        var: "donation",
        exp: {"var": ["lta_donation", 0]}
    },
    {
        var: "total",
        exp: {
            "+": [
                {var: "parking"},
                {var: "shirts"},
                {var: "donation"},
            ]
        },
    },
];