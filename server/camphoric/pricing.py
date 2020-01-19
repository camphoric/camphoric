from json_logic import jsonLogic


def calculate_price(registration):
    event = registration.event
    data = {
        "registration": registration.attributes,
        "pricing": event.pricing
    }
    results = {"total": 0}
    for reg_component, logic in event.registration_pricing_logic.items():
        results[reg_component] = jsonLogic(logic, data)
        results["total"] += results[reg_component]
    return results
