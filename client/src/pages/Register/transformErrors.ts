//errors, uiSchema
import {
  type ErrorTransformer,
  type RJSFValidationError,
  type RJSFSchema,
  findSchemaDefinition,
} from '@rjsf/utils';

/*
 * Error item:
 * {
 *   // error name
 *   "name": "required",
 *   // full path of property
 *   "property": ".campers[0].first_name",
 *   // error message displayed in-line
 *   "message": "is a required property",
 *   // from ajv
 *   "params": {
 *       "missingProperty": "first_name"
 *   },
 *   // display at top
 *   "stack": ".campers[0].first_name is a required property",
 *   "schemaPath": "#/required"
 * }
 */

const getSchemaPath = (e: RJSFValidationError) => {
  const pathParts = e.property?.replace(/\[[0-9]*\]/g, '').split('.')

  if (!pathParts) return '';

  const path = `#/properties${pathParts.join('/')}`;

  return path;
};

const getCamperPath = (e: RJSFValidationError) => {
  const pathParts = e.property?.replace(/\[[0-9]*\]/g, '').split('.')

  if (!pathParts) return '';

  const index = pathParts.findIndex(p => p === 'campers') + 1;
  const path = `#/definitions/camper/properties/${pathParts.slice(index).join('/')}`;

  return path;
};

const getPaymentPath = (e: RJSFValidationError) => {
  const pathParts = e.property?.replace(/\[[0-9]*\]/g, '').split('.')

  if (!pathParts) return '';

  const index = pathParts.findIndex(p => p === 'payment') + 1;
  const path = `#/properties/payment/properties/${pathParts.slice(index).join('/properties/')}`;

  return path;
};

const getAddressPath = (e: RJSFValidationError) => {
  const pathParts = e.property?.replace(/\[[0-9]*\]/g, '').split('.')

  if (!pathParts) return '';

  const path = `#/definitions/address/properties/${pathParts.pop()}`;

  return path;
};

const getSchema = (e: RJSFValidationError, s: RJSFSchema) => {
  const value = [
    getPaymentPath(e),
    getCamperPath(e),
    getAddressPath(e),
    getSchemaPath(e),
  ].map((path: string) => {
    try {
      const ss = findSchemaDefinition(path, s);

      return ss;
    } catch (e) {
    }

    return undefined;
  }).find(Boolean);

  return value || {};
}

const getCamperNumber = (e: RJSFValidationError) => {
  const matches = e.property?.match(/campers\[([0-9]*)\]/);

  if (!matches) return null;
  if (!matches[1]) return null;

  return Number(matches[1]) + 1;
};

const transformCamperLodging = (e: RJSFValidationError, schema: RJSFSchema, s: RJSFSchema) => {
  const num = getCamperNumber(e);

  return {
    ...e,
    message: 'Lodging selection is incomplete',
    stack: `Camper ${num}: Lodging selection is incomplete`,
  };
};

const transformCamper = (e: RJSFValidationError, schema: RJSFSchema, s: RJSFSchema) => {
  if (e.property?.includes('.lodging.')) {
    return transformCamperLodging(e, schema, s);
  }

  const num = getCamperNumber(e);

  return {
    ...e,
    message: `${schema?.title} ${e.message}`,
    stack: `Camper ${num}: ${schema?.title} ${e.message}`,
  };
};

let transformErrors: (a: RJSFSchema) => ErrorTransformer;
transformErrors = (dataSchema: RJSFSchema) => (errors: Array<RJSFValidationError>) => {
  console.log('errors', errors);
  return errors.map(
    (error: RJSFValidationError) => {
      const schema = getSchema(error, dataSchema);

      if (error.property?.startsWith('.campers[')) {
        return transformCamper(error, schema, dataSchema)
      }

      if (error.name === 'pattern' && error.property === '.payer_number') {
        return {
          ...error,
          message: 'Please enter a valid phone number'
        }
      }

      // if we can't get a sub-schema, further transformation is pointless
      if (!schema.title) {
        return error;
      }

      return {
        ...error,
        message: `${schema.title} ${error.message}`,
        stack: `${schema.title} ${error.message}`,
      };
    }
  ) as Array<RJSFValidationError>;
};

export default transformErrors;
