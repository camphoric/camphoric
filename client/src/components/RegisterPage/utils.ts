import get from 'lodash/get';
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
};

export function calculatePrice(config: RegistrationConfig, formData: FormData) {
  // calculation should be done in whole dollars for sake of
  // avoiding funky issues with floats. If sub-dollar amounts
  // are necessary, we should switch this to cents.

  const { event, pricingLogic, pricing } = config;

  const results: PricingResults = { campers: [] };

  const data: PricingData = {
    event,
    registration: formData,
    pricing,
  };

  const camperSchema = get(config.dataSchema, 'properties.campers.items') as JSONSchema6;
  const camperDateProps = getDateProps(camperSchema);

  pricingLogic.registration.forEach(component => {
    const varName = component.var;
    const value = jsonLogic.apply(component.exp, data);
    results[varName] = Number.isNaN(value) ? 0 : value;
    data[varName] = value;
  });

  formData.campers.forEach(camper => {
    const camperResults: { [key: string]: any } = {};

    data.camper = { ...camper };
    camperDateProps.forEach(dateProp => {
      data.camper[dateProp] = dateStringToObject(data.camper[dateProp]);
    });

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

function getDateProps(schema: JSONSchema6 | undefined): Array<string> {
  if (!schema) {
    return [];
  }

  return Object.entries(schema.properties || {})
    .filter(([propName, propSchema]) =>
      typeof propSchema === 'object'
      && propSchema.type === 'string'
      && propSchema.format === 'date'
    )
    .map(([propName, propSchema]) => propName);
}

function dateStringToObject(s: string) {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}
