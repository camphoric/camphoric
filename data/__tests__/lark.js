import { apiFetch, mockAttributes } from '../test-utils';
import { eventName } from '../lark/index.js';

describe(`Lark Camp`, () => {
  let eventId;
  let organizationId;
  const data = {};
  let event;

  beforeAll(async () => {
    const events = await apiFetch('/api/events/');
    data.event = events.find(e => e.name === eventName);
    event = data.event;
    eventId = data.event.id;

    data.lodgings = (await apiFetch('/api/lodgings/')).filter(
      a => a.event === eventId
    );

    organizationId = data.event.organization;
  })

  it('event should match snapshot', async () => {
    expect(typeof event).toBe('object');

    // set non-deterministic data to 'mocked'
    mockAttributes(event, [
      'registration_start',
      'registration_end',
      'start',
      'end',
      'organization',
      'email_account',
      'confirmation_email_from',
    ]);


    expect(event).toMatchSnapshot();
  })

  it('registrationtypes should match snapshot', async () => {
    const all = await apiFetch('/api/registrationtypes/');
    const regtypes = all.filter(r => r.event === eventId).sort((a, b) =>
      a.name < b.name ? 1 : -1
    ).map(r => mockAttributes(r));

    expect(Array.isArray(regtypes)).toBe(true);
    expect(regtypes).toMatchSnapshot();
  });

  it('lodgings should match snapshot', async () => {
    const all = await apiFetch('/api/lodgings/');
    const lodgings = all.filter(r => r.event === eventId).sort(
      (a, b) => a.name < b.name ? 1 : -1
    ).map(r => mockAttributes(r, ['parent']));

    expect(Array.isArray(lodgings)).toBe(true);
    expect(lodgings).toMatchSnapshot();
  });

  it('campers should match snapshot', async () => {
    let all = await apiFetch('/api/registrations/');
    const regs = all.filter(r => r.event === eventId);
    const regIds = regs.map(r => r.id);

    all = await apiFetch('/api/campers/');
    const name = c => `${c.attributes.last_name}, ${c.attributes.last_name}`;

    const campers = all.filter(c => regIds.includes(c.registration)).sort((a, b) =>
      name(a) < name(b) ? 1 : -1
    ).map(r => mockAttributes(r, ['registration', 'lodging', 'lodging_requested']));

    expect(Array.isArray(campers)).toBe(true);
    expect(campers).toMatchSnapshot();
  });

  it('registrations should match snapshot', async () => {
    const all = await apiFetch('/api/registrations/');
    const regs = all.filter(r => r.event === eventId).sort((a, b) =>
      a.registrant_email < b.registrant_email ? 1 : -1
    ).map(r => mockAttributes(r));

    expect(Array.isArray(regs)).toBe(true);
    expect(regs).toMatchSnapshot();
  });
});
