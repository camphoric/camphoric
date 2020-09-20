import json
import camper_schema
import camper_pricing_logic
import pricing
import registration_pricing_logic
import registration_schema
import registration_ui_schema


for module in [registration_schema, camper_schema, registration_ui_schema]:
	with open(module.__name__ +'.json', 'w') as f:
		json.dump(module.data, f, indent=4)
