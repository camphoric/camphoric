import json

import camper_pricing_logic
import camper_schema
import confirmation_email_template
import pricing
import registration_pricing_logic
import registration_schema
import registration_ui_schema


for module in [
        camper_pricing_logic,
        camper_schema,
        confirmation_email_template,
        pricing,
        registration_pricing_logic,
        registration_schema,
        registration_ui_schema,
]:
    with open(module.__name__ +'.json', 'w') as f:
        json.dump(module.data, f, indent=4)
