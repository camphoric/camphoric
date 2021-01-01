import React from 'react';
import Form, { FormProps } from '@rjsf/core';
import { JSONSchema7 } from 'json-schema';
import jsonLogic from 'json-logic-js';
import get from 'lodash/get';
import {
  IChangeEvent,
} from '@rjsf/core';

import PhoneInput from 'react-phone-input-2';
import DescriptionField from '../DescriptionField';
import ObjectFieldTemplate from '../ObjectFieldTemplate';
import NaturalNumberInput from '../NaturalNumberInput';

import 'react-phone-input-2/lib/style.css'
import './JsonForm.scss';

export type JsonFormChangeEvent<P> = IChangeEvent<P>;

export type FormData = {
  [key: string]: any;
  campers: Array<Object>;
};

// TODO(evinism): Make this better typed
const widgetMap: any = {
  PhoneInput: (props: any) => (
    <PhoneInput
      country="us"
      value={props.value}
      onChange={(value: string) => props.onChange(value)}
    />
    ),
  NaturalNumberInput: (props: any) => (
    <NaturalNumberInput
      value={props.value}
      onChange={(value: string) => props.onChange(value)}
    />
    )
};

interface Props extends FormProps<any> {

}

function JsonForm(props: Props) {

  return (
    <Form
      {...props}
      widgets={widgetMap}
      fields={{ DescriptionField: DescriptionField }}
      ObjectFieldTemplate={ObjectFieldTemplate}
      // liveValidate={true}
    >
      {props.children}
    </Form>
  );
}

type PricingData = {
  event: { [key: string]: any };
  registration: FormData;
  pricing: { [key: string]: any };
  [key: string]: any;
};

export type PricingResults = {
  [key: string]: any;
  campers: Array<{ [key: string]: any }>;
};

/**
 * Calculate pricing results for the given config and form data
 *
 * This should produce identical results to camphoric.pricing.calculate_price
 * (see server/camphoric/pricing.py)
 */
export function calculatePrice(config: ApiRegister, formData: FormData): PricingResults {
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


  const camperSchema = get(config.dataSchema, 'properties.campers.items') as JSONSchema7;
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

function getDateProps(schema: JSONSchema7 | undefined): Array<string> {
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

export default JsonForm;
