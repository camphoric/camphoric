export default {
  type: 'object',
  additionalProperties: false,
  required: [
    'organization',
    'event',
    'reports',
    'registration_types',
  ],
  properties: {
    organization: {
      description: 'the name or ID for the organization that this should be attached to',
      type: ['number', 'string'],
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
        camper_admin_schema: obj('JSON schema for special admin fields'),
        payment_schema: obj('JSON schema for payment'),
        registration_deposit_schema: obj('Data for templates used for registration deposit options'),
        registration_template_vars: obj('Data for templates used during registration'),
        registration_schema: obj('JSON schema for registration'),
        registration_ui_schema: obj('JSON schema for registration UI'),
        registration_admin_schema: obj('JSON schema for special admin fields'),
        deposit_schema: obj('JSON schema for extra event deposit attributes'),
        pricing: obj('variables to use in pricing logic'),
        registration_pricing_logic: arr('JSON logic for registration charges outside of individual campers'),
        camper_pricing_logic: arr('JSON logic for individual camper'),
        paypal_enabled: bool('whether to enable paypal payments'),
        paypal_client_id: str('paypal api client id', { maxLength: 200 }),
        pre_submit_template: str('Handlebars template, rendered right before registration submit button', { maxLength: undefined }),
        confirmation_page_template: str('Handlebars template rendered after registration completed', { maxLength: undefined }),
        confirmation_email_subject: str(''),
        confirmation_email_template: str('', { maxLength: undefined }),
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
          template: str('Template for report', { maxLength: undefined }),
        },
      },
    },
    custom_charge_types: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'name',
          'label',
        ],
        properties: {
          name: str('custom charge type name'),
          label: str('custom charge type label'),
        }
      }
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
          invitation_email_template: str('Email template of reg type invitation email', { maxLength: undefined }),
        }
      }
    },
  },
};

function int(description, minimum = 0, otherProps = {}) {
  return generateType('integer', description, { minimum, ...otherProps });
}

function str(description, otherProps = {}) {
  return generateType('string', description, { maxLength: 50, ...otherProps });
}

function bool(description) {
  return generateType('boolean', description);
}

function date(description = '', otherProps = {}) {
  return generateType('string', description, {...otherProps, format: 'date-time' });
}

function obj(description, properties = {}, otherProps = {}) {
  return generateType('object', description, { properties, ...otherProps });
}

function arr(description, items = {}, otherProps = {}) {
  return generateType('array', description, { items, ...otherProps });
}

function eml(description, otherProps = {}) {
  return generateType('string', description, {...otherProps, format: 'email' });
}


function generateType(type, description = '', otherProps = {}) {
  return {
    type,
    description,
    ...otherProps,
  };
}
