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
        var: "donation",
        exp: {"var": ["registration.lta_donation", 0]}
    },
    {
        var: "total",
        exp: {
            "+": [
                {var: "parking"},
                {var: "donation"},
            ]
        },
    },
];
