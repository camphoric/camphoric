/**
 * CamphoricEventCreator's steps for an event's emails and promo codes, against
 * a stand-in for the server: no server needed.
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import CamphoricEventCreator, { referenceProblems, templateErrors } from '../CamphoricEventCreator.ts';
import { Organizations } from '../organizations.ts';
import type { FetchMethod, ImportData, Saved } from '../types.ts';

type Request = { method: FetchMethod, path: string, data?: unknown };

const realFetch = globalThis.fetch;

const baseData = (): ImportData => ({
  organization: 'Org',
  event: { name: 'Camp' },
  reports: [],
  registration_types: [
    { name: 'staff', label: 'Staff', invitation_email_subject: 's', invitation_email_template: 'b' },
  ],
});

/**
 * A creator for `data` whose requests are recorded, each answered by
 * `answer` (an empty list for a GET, the data sent with an id otherwise).
 */
function creatorFor(data: ImportData, answer: (r: Request) => unknown = () => undefined) {
  const creator = new CamphoricEventCreator({
    data,
    validate: () => [],
    organizations: new Organizations([{ id: 1, name: 'Org' }]),
    url: 'http://camphoric.test',
  });
  const requests: Request[] = [];
  creator.fetch = async (method: FetchMethod, path: string, body?: unknown) => {
    const request = { method, path, data: body };
    requests.push(request);
    const answered = answer(request);
    if (answered !== undefined) return answered;
    return method === 'GET' ? [] : { id: 100 + requests.length, ...(body as object) };
  };
  return { creator, requests };
}

describe('referenceProblems', () => {
  test('a promo code may exclude only the event\'s registration types', () => {
    const data = {
      ...baseData(),
      promo_codes: [
        { code: 'A', excluded_registration_types: ['staff'] },
        { code: 'B', excluded_registration_types: ['staff', 'crew'] },
      ],
    };
    expect(referenceProblems(data)).toEqual([
      "promo code 'B' excludes registration type 'crew', which the event doesn't have",
    ]);
  });

  test('the creator refuses such data before sending anything', () => {
    const data = { ...baseData(), promo_codes: [{ code: 'A', excluded_registration_types: ['crew'] }] };
    expect(() => creatorFor(data)).toThrow('names what it does not hold');
  });
});

describe('templateErrors', () => {
  test('lists each error, with where it is, and no warnings', () => {
    expect(templateErrors([
      { kind: 'report', label: 'Roster', diagnostics: [{ severity: 'warning', message: 'slow' }] },
      {
        kind: 'group_email',
        label: 'Group email: Hi',
        diagnostics: [
          { severity: 'error', message: "'nope' is undefined", field: 'body', line: 3 },
          { severity: 'error', message: 'bad filter' },
        ],
      },
    ])).toEqual([
      "Group email: Hi (body, line 3): 'nope' is undefined",
      'Group email: Hi: bad filter',
    ]);
  });
});

describe('the event\'s email templates', () => {
  test('sets the confirmation and invoice emails the data gives, and nothing else', async () => {
    const data = baseData();
    data.event = {
      ...data.event,
      confirmation_email_subject: 'Thanks',
      confirmation_email_reply_to: 'questions@example.com',
      invoice_email_subject: 'Invoice',
      invoice_email_template: 'Pay up',
      invoice_email_from: 'treasurer@example.com',
      invoice_email_reply_to: 'treasurer@example.com',
    };
    const { creator, requests } = creatorFor(data, ({ method, path, data: body }) => {
      if (method === 'POST' && path === '/api/events/') {
        return { id: 7, ...(body as object), confirmation_template: 11, invoice_template: 12 };
      }
      return undefined;
    });
    await creator.loadEvent();

    const event = requests.find(r => r.method === 'POST' && r.path === '/api/events/')?.data as Record<string, unknown>;
    expect(Object.keys(event).filter(k => k.startsWith('invoice_') || k.startsWith('confirmation_email_')))
      .toEqual([]);
    expect(requests.filter(r => r.path.startsWith('/api/emailtemplates/'))).toEqual([
      {
        method: 'PATCH',
        path: '/api/emailtemplates/11/',
        data: { subject: 'Thanks', reply_to: 'questions@example.com' },
      },
      {
        method: 'PATCH',
        path: '/api/emailtemplates/12/',
        data: {
          subject: 'Invoice', body: 'Pay up', from_email: 'treasurer@example.com', reply_to: 'treasurer@example.com',
        },
      },
    ]);
  });
});

describe('group emails', () => {
  test('creates new ones and updates the event\'s by name, with defaults for what is left out', async () => {
    const data = {
      ...baseData(),
      email_templates: [
        { name: 'Hello', subject: 'Hi', body: 'Hello' },
        { name: 'Again', subject: 'Hi', body: 'Again', recipient_source: 'campers' },
      ],
    };
    const saved: Saved[] = [
      { id: 5, event: 7, purpose: 'group', name: 'Again' },
      // the same name in another event, or not a group email: not this one
      { id: 6, event: 8, purpose: 'group', name: 'Hello' },
      { id: 9, event: 7, purpose: 'invitation', name: 'Hello' },
    ];
    const { creator, requests } = creatorFor(data, ({ method, path }) => (
      method === 'GET' && path === '/api/emailtemplates/' ? saved : undefined
    ));
    creator.results.event = { id: 7 };
    await creator.loadGroupEmails();

    const writes = requests.filter(r => r.method !== 'GET');
    expect(writes.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: 'POST', path: '/api/emailtemplates/' },
      { method: 'PUT', path: '/api/emailtemplates/5/' },
    ]);
    expect(writes[0].data).toEqual({
      name: 'Hello',
      subject: 'Hi',
      body: 'Hello',
      from_email: '',
      reply_to: '',
      recipient_source: 'registrations',
      filter: {},
      filter_expression: '',
      address_expression: '',
      name_expression: '',
      recipient_list: '',
      include_incomplete: false,
      purpose: 'group',
      event: 7,
    });
    expect(writes[1].data).toMatchObject({ recipient_source: 'campers', purpose: 'group', event: 7 });
    expect(creator.results.email_templates).toHaveLength(2);
  });

  test('sends nothing when the data has none', async () => {
    const { creator, requests } = creatorFor(baseData());
    creator.results.event = { id: 7 };
    await creator.loadGroupEmails();
    expect(requests).toEqual([]);
  });
});

describe('reports', () => {
  test('creates new ones and updates the event\'s by title, with their category and description', async () => {
    const data = {
      ...baseData(),
      reports: [
        { title: 'Balances', template: 'b', category: 'Finance', description: 'What each family owes' },
        { title: 'Roster', template: 'r', variables_source: 'server' as const },
      ],
    };
    const saved: Saved[] = [
      // a legacy Handlebars report, which the data now makes a server one
      { id: 5, event: 7, title: 'Roster', category: 'Old', description: 'Old', output: 'hbs' },
      // the same title in another event: not this one
      { id: 6, event: 8, title: 'Balances' },
    ];
    const { creator, requests } = creatorFor(data, ({ method, path }) => (
      method === 'GET' && path === '/api/reports/' ? saved : undefined
    ));
    creator.results.event = { id: 7 };
    await creator.loadReports();

    const writes = requests.filter(r => r.method !== 'GET');
    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/api/reports/',
        data: {
          title: 'Balances', template: 'b', category: 'Finance', description: 'What each family owes',
          output: 'csv', variables_source: 'client', variables_schema: {}, event: 7,
        },
      },
      {
        method: 'PUT',
        path: '/api/reports/5/',
        // What the data leaves out is reset, so it ends up as the data declares it.
        data: {
          title: 'Roster', template: 'r', category: '', description: '',
          output: 'csv', variables_source: 'server', variables_schema: {}, event: 7,
        },
      },
    ]);
    expect(creator.results.reports).toHaveLength(2);
  });
});

describe('promo codes', () => {
  test('resolve excluded registration types by name, and match saved codes ignoring case', async () => {
    const data = {
      ...baseData(),
      promo_codes: [
        {
          label: 'Early', code: 'early', pricing_logic: 10, expiration_date: '2030-05-01T00:00:00-07:00',
          excluded_registration_types: ['staff'],
        },
        { label: 'Late', code: 'LATE', pricing_logic: 5 },
      ],
    };
    const { creator, requests } = creatorFor(data, ({ method, path }) => (
      method === 'GET' && path === '/api/promocodes/'
        ? [{ id: 3, event: 7, code: 'Early ' }, { id: 4, event: 8, code: 'late' }]
        : undefined
    ));
    creator.results.event = { id: 7 };
    creator.results.registration_types = [{ id: 21, name: 'staff' }];
    await creator.loadPromoCodes();

    const writes = requests.filter(r => r.method !== 'GET');
    expect(writes).toEqual([
      {
        method: 'PUT',
        path: '/api/promocodes/3/',
        data: {
          label: 'Early',
          code: 'early',
          pricing_logic: 10,
          scope: 'registration',
          enabled: true,
          expiration_date: '2030-05-01T07:00:00.000Z',
          excluded_registration_types: [21],
          excludes_uninvited: false,
          event: 7,
        },
      },
      {
        method: 'POST',
        path: '/api/promocodes/',
        data: expect.objectContaining({ code: 'LATE', expiration_date: null, excluded_registration_types: [] }),
      },
    ]);
  });
});

describe('promo code checks', () => {
  test('an expiry that can\'t be read fails, sending nothing, rather than never expiring', async () => {
    const data = {
      ...baseData(),
      promo_codes: [
        { label: 'Ok', code: 'OK', pricing_logic: 1 },
        // a leap second: valid as a format, but Date can't read it
        { label: 'Leap', code: 'LEAP', pricing_logic: 1, expiration_date: '2030-06-30T23:59:60Z' },
      ],
    };
    const { creator, requests } = creatorFor(data);
    creator.results.event = { id: 7 };
    await expect(creator.loadPromoCodes()).rejects.toThrow("promo code 'LEAP' has an expiration_date that can't be read");
    expect(requests).toEqual([]);
  });
});

describe('registration types', () => {
  test('set the invitation email\'s sender and reply-to on its template, not the type', async () => {
    const data = baseData();
    data.registration_types[0] = {
      ...data.registration_types[0],
      invitation_email_from: 'staff@example.com',
      invitation_email_reply_to: 'coordinator@example.com',
      camper_schema_overrides: { properties: {} },
    };
    const { creator, requests } = creatorFor(data, ({ method, path, data: body }) => (
      method === 'POST' && path === '/api/registrationtypes/'
        ? { id: 21, ...(body as object), invitation_template: 31 }
        : undefined
    ));
    creator.results.event = { id: 7 };
    await creator.loadRegTypes();

    const type = requests.find(r => r.method === 'POST')?.data as Record<string, unknown>;
    expect(Object.keys(type).filter(k => k.startsWith('invitation_'))).toEqual([]);
    expect(type.camper_schema_overrides).toEqual({ properties: {} });
    expect(requests.find(r => r.path.startsWith('/api/emailtemplates/'))).toEqual({
      method: 'PATCH',
      path: '/api/emailtemplates/31/',
      data: { subject: 's', body: 'b', from_email: 'staff@example.com', reply_to: 'coordinator@example.com' },
    });
    expect(creator.results.registration_types).toEqual([expect.objectContaining({ id: 21, name: 'staff' })]);
  });
});

describe('lodging', () => {
  test('sends each node\'s availability (auto when it gives none)', async () => {
    const data = {
      ...baseData(),
      lodgings: {
        root: { name: 'Lodging' },
        day: { parentKey: 'root', name: 'Day', availability: 'open' as const },
      },
    };
    const { creator, requests } = creatorFor(data);
    creator.results.event = { id: 7 };
    await creator.loadLodgings();

    const sent = requests.filter(r => r.method === 'POST').map(r => r.data as Record<string, unknown>);
    expect(sent.map(({ name, availability }) => ({ name, availability }))).toEqual([
      { name: 'Lodging', availability: 'auto' },
      { name: 'Day', availability: 'open' },
    ]);
  });
});

describe('the template check', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function checking(body: unknown, status = 200) {
    const urls: string[] = [];
    globalThis.fetch = async (url: string | URL | globalThis.Request) => {
      urls.push(String(url));
      return new Response(JSON.stringify(body), { status });
    };
    const { creator } = creatorFor(baseData());
    creator.token = 'token';
    creator.results.event = { id: 7 };
    return { creator, urls };
  }

  test('asks the server to check the event\'s templates, and passes when none has an error', async () => {
    const { creator, urls } = checking({ ok: true, results: [{ kind: 'report', label: 'R', diagnostics: [] }] });
    await expect(creator.checkTemplates()).resolves.toBeUndefined();
    expect(urls).toEqual(['http://camphoric.test/api/events/7/templates/check']);
  });

  test('fails the import when a template has an error', async () => {
    const { creator } = checking({
      ok: false,
      results: [{
        kind: 'group_email',
        label: 'Group email: Hi',
        diagnostics: [{ severity: 'error', message: "'nope' is undefined", field: 'body', line: 2 }],
      }],
    });
    await expect(creator.checkTemplates()).rejects.toThrow("Group email: Hi (body, line 2): 'nope' is undefined");
  });

  test('fails when the server refuses the check', async () => {
    const { creator } = checking({ detail: 'no' }, 403);
    await expect(creator.checkTemplates()).rejects.toThrow('template check failed (403)');
  });
});
