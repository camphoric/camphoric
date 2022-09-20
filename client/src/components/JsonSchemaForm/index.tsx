import React from 'react';
import { FormProps, withTheme, IChangeEvent } from '@rjsf/core';
// import Form from '@rjsf/bootstrap-4';
import { JSONSchema7 } from 'json-schema';
import jsonLogic from 'json-logic-js';
import get from 'lodash/get';
import debug from 'utils/debug';

import { Theme as Bootstrap4Theme } from '@rjsf/bootstrap-4';

import Spinner from '../Spinner';
import injectGoogleApis from './injectGoogleApis';

import FieldTemplate from './templates/Field';
import ObjectTemplate from './templates/Object';
import ArrayTemplate from './templates/Array';

import DescriptionField from './fields/Description';
import CampersField from './fields/Campers';
import AddressField from './fields/Address';

import NaturalNumberInput from './widgets/NaturalNumberInput';
import PhoneInput from './widgets/PhoneInput';
import SelectWidget from './widgets/Select';
import TextWidget from './widgets/Text';

import './styles.scss';

export type JsonSchemaFormChangeEvent<P> = IChangeEvent<P>;

export type FormData = {
  [key: string]: any;
  campers: Array<Object>;
};

Bootstrap4Theme.widgets = {
  ...Bootstrap4Theme.widgets,
  PhoneInput,
  NaturalNumberInput,
  SelectWidget,
  TextWidget,
};

Bootstrap4Theme.fields = {
  ...Bootstrap4Theme.fields,
  DescriptionField,
  Campers: CampersField,
  // The typedefs of rjsf are still being refined
  // @ts-expect-error
  Address: AddressField,
};

const Form = withTheme(Bootstrap4Theme);

interface Props extends FormProps<any> {
  // custom props here
  templateData: Object,
}

export const JsonSchemaFormTemplateContext = React.createContext({});

function JsonSchemaForm(props: Props) {
  const [googleMapsLoaded, setGoogleMapsLoaded] = React.useState(!process.env.REACT_APP_GOOGLE_API_KEY);

  // If we need to inject google maps, wait until finished injecting, and just
  // load a nice spinner in the mean time
  React.useEffect(() => {
    const tryLoadingGoogleMaps = async () => {
      if (!process.env.REACT_APP_GOOGLE_API_KEY) {
        setGoogleMapsLoaded(true);

        return;
      }

      try {
        await injectGoogleApis(process.env.REACT_APP_GOOGLE_API_KEY);

        setGoogleMapsLoaded(true);
      } catch (e) {
        console.error(e);
        debug('trying again...');

        tryLoadingGoogleMaps();
      }
    };

    tryLoadingGoogleMaps();
  }, []);

  if (!googleMapsLoaded) {
    return <Spinner />;
  }

  return (
    <JsonSchemaFormTemplateContext.Provider value={props.templateData}>
      <Form
        {...props}
        ObjectFieldTemplate={ObjectTemplate}
        ArrayFieldTemplate={ArrayTemplate}
        FieldTemplate={FieldTemplate}
        // liveValidate={true}
      >
        {props.children}
      </Form>
    </JsonSchemaFormTemplateContext.Provider>
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
    registration: {
      ...formData,
      ...(config.registrationType && {
        registration_type: config.registrationType.name
      }),
    },
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

export default JsonSchemaForm;
