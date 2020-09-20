data = [
	'Dear ',
	{'var': 'campers.0.name'}, ',\n\n'
	'Thank you for your online registration for BACDS Family Week June 28th to July 4th, 2020. This email confirms the following:\n',
	'Camper Info:\n\n',
	{'map': [
		{'var': 'campers'},
		[
			'Name: ', {'var': 'name'}, '\n',
			'Age: ',
			{'if': [
				{'>=': [{'var': 'computed.age'}, {'var': 'pricing.adult_threshold'}]},
				'Adult',
				{'var': 'computed.age'},
			]},
			'\n',
			'Email: ', {'var': 'email'}, '\n',
			'Meals: ', {'var': 'meal_preferences.meal_type'}, '\n',
			'Total: $', {'var': 'camper_pricing_results.total'}, '\n\n',
		]
	]},
	'No other registrants have been entered.\n\n',
	'Family week donation: ',
	'\n',
	{'var': 'pricing_results.donation'},
	'TOTAL FOR THIS REGISTRATION: ',
	{'var': 'pricing_results.total'},
	'\n\n',
	'Please make all checks payable to "BACDS"\n\n',
	'Payment: Please mail your check for the above amount to the address below.\n',
	'<registrar"s name>\n',
	'Family Week Registrar\n',
	'<registrar"s street address>\n',
	'<registrar"s city address>\n\n',
	"Your registration is complete when we receive your payment. All payments must be received by June 1st. If you cancel before then, your payment will be refunded, less a $25 per camper administration fee. If you cancel between June 1st and June 25th, 50% of your payment will be retained. We're sorry, but there will be no refunds for cancellations after June 25th. All cancellations must be made in writing or by email and take effect upon the day they're sent, but are final only when you receive acknowledgement from us. Registrations are not transferable.\n\n",
	'If you have any questions about the registration process, please contact registrar <name> at <phone number> or <email address>.\n\n',
	'Thank you for registering for BACDS Family Week!\n\n',
]