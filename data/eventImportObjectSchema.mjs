export default {
  type: 'object',
  additionalProperties: false,
  required: [
    'email_account_id',
    'organization_id',
    'event',
    'lodgings',
    'camper_pricing',
    'reports',
    'registration_types',
    'sample_registrations',
  ],
  properties: {
    email_account_id: {
      description: 'the ID for the email that this should be attached to',
      type: 'integer',
      maxLength: 5,
    },
    organization_id: {
      description: 'the ID for the organization that this should be attached to',
      type: 'integer',
      maxLength: 5,
    },
    event: {
      description: 'an object which has the JSON data to be POSTed to /api/events',
      type: 'object',
      additionalProperties: false,
      required:['name'],
      properties: {
        name: str('event name'),
        registration_start: date('when registration starts'),
        registration_end: date('when registration ends'),
        start: date('when event starts'),
        end: date('when event ends'),
        default_stay_length: int('default stay in days'),
        camper_schema: obj('JSON schema for camper'),
        payment_schema: obj('JSON schema for payment'),
        registration_schema: obj('JSON schema for registration'),
        registration_ui_schema: obj('JSON schema for registration UI'),
        registration_admin_schema: obj('JSON schema for special admin fields'),
        deposit_schema: obj('JSON schema for extra event deposit attributes'),
        pricing: obj('variables to use in pricing logic'),
        registration_pricing_logic: obj('JSON logic for registration charges outside of individual campers'),
        camper_pricing_logic: obj('JSON logic for individual camper'),
        paypal_enabled: bool('whether to enable paypal payments'),
        paypal_client_id: str('paypal api client id'),
        pre_submit_template: str('Handlebars template, rendered right before registration submit button'),
        confirmation_page_template: str('Handlebars template rendered after registration completed'),
        confirmation_email_subject: str(''),
        confirmation_email_template: str(''),
        confirmation_email_from: eml(''),
      },
    },
    lodgings: {
      type: 'object',
      required: ['root'],
      properties: {
        root: {
          type: 'object',
          properties: {
            children_title: str('what the form will say when selecting from here'),
          },
        },
      },
      additionalProperties: {
        type: 'object',
        properties: {
          parentKey: str('key of parent, or null'),
          children_title: str('what the form will say when selecting from here'),
          capacity: int('total that is considered "full"'),
          visible: bool('whether this shows up on the reg form'),
          name: str('name of this lodging node'),
          notes: str('notes about this lodging node'),
        },
      },
    },
    reports: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'title',
          'template',
        ],
        properties: {
          title: str('report title'),
          template: str('Handlebars template for report'),
        },
    },
    registration_types: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'name',
          'label',
          'invitation_email_subject',
          'invitation_email_template',
        ],
        properties: {
          name: str('reg type name'),
          label: str('reg type label'),
          invitation_email_subject: str('subject of reg type invitation email'),
          invitation_email_template: str('Email template of reg type invitation email'),
        }
      }
    },
    sample_registrations: {
      type: 'array',
      items: {
        type: 'object',
        // TBD
      }
    }
};

function int(description, minimum = 0, otherProps = {}) {
  return generateType('integer', description, { minimum, ...otherProps });
}

function str(description, maxLength = 50, otherProps = {}) {
  return generateType('string', description, { maxLength, ...otherProps });
}

function bool(description) {
  return generateType('boolean', description);
}

function date(description = '', otherProps = {}) {
  return generateType('date', description);
}

function obj(description, properties = {} otherProps = {}) {
  return generateType('object', description, , { properties, ...otherProps });
}

function eml(description, otherProps = {}) {
  return generateType('email', description, otherProps);
}

function generateType(type, description = '', otherProps = {}) {
  return {
    type,
    description,
    ...otherProps,
  };
}
