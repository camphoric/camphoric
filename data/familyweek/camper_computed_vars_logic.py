
# data = {
# 	'age': {
# 		'/': [
# 			{'-': [{'var': 'event.start'}, {'var': 'birthdate'},]},
# 			100000
# 		]
# 	},
# }

data = {
	'age': {
		'-': [
			{'-': [{'var': 'event.start.year'}, {'var': 'birthdate_date.year'}]},

			{'if': [
				{'<': [{'var': 'event.start.month'}, {'var': 'birthdate_date.month'}]},
				1,

				{'and': [
					{'==': [{'var': 'event.start.month'},{'var': 'birthdate_date.month'}]},
					{'<': [{'var': 'event.start.day'}, {'var': birthdate_date.day}]},
				]},
				1,

				0
			]},
		],
	},
}

