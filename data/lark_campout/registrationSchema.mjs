export default {
	"title": "Lark Campout 2022 Registration",
	"description": `
Read the [Terms of Registration](http://www.larkcamp.org/campterms.html) before you fill out this form.

Please note that registrations are accepted in the order they are received and
your camping preferences are processed on a "first come - first served" basis.

Fields marked with an asterisk (*) are required.
`,
	"type": "object",
	"definitions": {
		"natural": {
			"type": "integer",
			"minimum": 0,
			"default": 0
		},
	},
	"required": [
		"campers"
	],
	"properties": {
		"lta_donation": {
			"type": "integer",
			"minimum": 0,
			"title": "Donation to Lark Traditional Arts (Tax Deductible, Dollars)",
			"description": `Lark Traditional Arts (EIN 83-2424940) is the nonprofit organization that runs Lark Camp. If you would like to support camp with a tax-deductible donation in addition to your registration today, please use the space below to add the amount. Or you may go to: [https://www.larkcamp.org/](https://www.larkcamp.org/)`,
		},
		"how_did_you_hear": {
			"type": "string",
			"maxLength": 50,
			"title": "How did you hear about the Lark Campout?"
		},
		"comments": {
			"type": "string",
			"maxLength": 500,
			"title": "Comments"
		}
	}
};
