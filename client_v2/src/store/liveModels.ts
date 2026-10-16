/**
 * The server's names for kinds of record (`registration`, `camper`, …: its
 * model names, as edit leases give them; SPEC §5) and the client's entity for
 * each — its query-key namespace (store/entities).
 */

export const ENTITY_OF_MODEL: Record<string, string> = {
  event: 'Event',
  registrationtype: 'RegistrationType',
  promocode: 'PromoCode',
  registration: 'Registration',
  camper: 'Camper',
  lodging: 'Lodging',
  customchargetype: 'CustomChargeType',
  customcharge: 'CustomCharge',
  deposit: 'Deposit',
  invoice: 'Invoice',
  payment: 'Payment',
  pricingoverride: 'PricingOverride',
  report: 'Report',
  emailtemplate: 'EmailTemplate',
  invitation: 'Invitation',
};
