export default [
    {
        var: "donation",
        exp: {"var": ["registration.lta_donation", 0]}
    },
    {
        var: "total",
        exp: {
            "+": [
                {var: "donation"},
            ]
        },
    },
];
