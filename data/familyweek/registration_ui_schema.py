import re

with open('main_description.md') as f:
	main_description = f.read()

data = {
	'ui:description': main_description,
	'address': {
        'street_address':       { 'classNames': 'col-xs-12 col-sm-12' },
        'city':                 { 'classNames': 'col-xs-12 col-sm-12'  },
        'state_or_province':    { 'classNames': 'col-xs-6  col-sm-6'  },
        'zip_code':             { 'classNames': 'col-xs-6  col-sm-6'  },
        'country':              { 'classNames': 'col-xs-12 col-sm-6'  }
	},
	'primary_phone': { 'classNames': 'col-xs-6  col-sm-6'  },
	'secondary_phone': { 'classNames': 'col-xs-6  col-sm-6'  },
	'ride_share': {
		'ui:widget': 'radio',
	},
	'payment_option': {
		'ui:widget': 'radio',
	},
}
