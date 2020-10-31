import jsonLogic from "json-logic-js";
import { JSONSchema6 } from "json-schema";

import { RegistrationConfig, FormData } from "./RegisterPage";

type PricingData = {
  event: { [key: string]: any };
  registration: FormData;
  pricing: { [key: string]: any };
  [key: string]: any;
};

type PricingResults = {
  [key: string]: any;
  campers: Array<{ [key: string]: any }>;
  total: number;
};

export function calculatePrice(config: RegistrationConfig, formData: FormData) {
  // calculation should be done in whole dollars for sake of
  // avoiding funky issues with floats. If sub-dollar amounts
  // are necessary, we should switch this to cents.

  const { event, pricingLogic, pricing } = config;

  const results: PricingResults = {
    campers: [],
    total: 0,
  };

  const data: PricingData = {
    event,
    registration: formData,
    pricing,
  };

  pricingLogic.registration.forEach(component => {
    const varName = component.var;
    const value = jsonLogic.apply(component.exp, data);
    results[varName] = isNaN(value) ? 0 : value;
    data[varName] = value;
  });

  formData.campers.forEach(camper => {
    data.camper = camper;
    const camperResults: { [key: string]: any } = {};
    pricingLogic.camper.forEach(component => {
      const varName = component.var;
      const value = jsonLogic.apply(component.exp, data);
      camperResults[varName] = value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        const subtotal = (results[varName] || 0) + value;
        results[varName] = subtotal;
        data[varName] = value;
      }
    });
    results.campers.push(camperResults);
  });

  return results;
}
