/**
 * Shared plumbing for the add*Registrations.js scripts, which post batches of
 * generated registrations to an event that loadAllData.js has already imported.
 * See the docblock at the top of any of those scripts for how to run them.
 *
 * runBulkRegistrations({ eventName, makeRegistration }) finds the event by
 * name, then for each of COUNT registrations:
 *   1. reads the public registration form, for the lodging tree as a registrant
 *      sees it (visible nodes, with full ones flagged),
 *   2. calls makeRegistration(key, gen) for the formData, where `key` (seed and
 *      index) keeps registrant emails unique across runs with different seeds,
 *   3. posts the registration step, then the payment step choosing "check",
 *      which completes the registration with its balance due.
 * Afterwards it records check payments, as an organizer would, for a share of
 * them: PAID_SHARE in full, PART_PAID_SHARE in part; the rest stay unpaid.
 *
 * `gen` hands makeRegistration a seeded random source and some common pools,
 * so a run with the same SEED makes the same people.
 */

import 'dotenv/config';

import Fetcher from './CamphoricFetcher.js';

export const firstNames = [
  'Ada', 'Ben', 'Cora', 'Dmitri', 'Elena', 'Felix', 'Grace', 'Hiro', 'Iris',
  'Jamal', 'Keiko', 'Liam', 'Maya', 'Nico', 'Olive', 'Priya', 'Quinn', 'Rosa',
  'Sam', 'Tara', 'Uma', 'Victor', 'Wren', 'Xavier', 'Yara', 'Zeke', 'Arlo',
  'Bea', 'Caleb', 'Delia', 'Ezra', 'Fern', 'Gus', 'Hazel', 'Ivan', 'June',
];
export const lastNames = [
  'Abbott', 'Baker', 'Chen', 'Delgado', 'Evans', 'Fischer', 'Garcia', 'Haddad',
  'Ibarra', 'Jensen', 'Kowalski', 'Lopez', 'Moreau', 'Nakamura', 'Okafor',
  'Patel', 'Quintero', 'Rossi', 'Schmidt', 'Tanaka', 'Underwood', 'Vasquez',
  'Whitfield', 'Xu', 'Yilmaz', 'Zimmerman',
];
const cities = [
  ['Berkeley', '94703'], ['Oakland', '94610'], ['San Francisco', '94110'],
  ['Petaluma', '94952'], ['Santa Rosa', '95404'], ['Sacramento', '95816'],
  ['San Jose', '95126'], ['Davis', '95616'], ['Mendocino', '95460'],
];
const streets = ['Easy St', 'Oak Ave', 'Fiddle Ln', 'Banjo Way', 'Harmony Rd', 'Elm St'];

// small deterministic PRNG (LCG), so reruns with the same SEED match
function makeRandom(seed) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  return {
    rand,
    int,
    pick,
    chance: p => rand() < p,
    phone: () => `+1555${String(int(0, 9999999)).padStart(7, '0')}`,
    fullName: () => `${pick(firstNames)} ${pick(lastNames)}`,
    address: () => {
      const [city, zip_code] = pick(cities);
      return {
        street_address: `${int(100, 9999)} ${pick(streets)}`,
        city,
        state_or_province: 'CA',
        zip_code,
      };
    },
  };
}

/**
 * Every finishing choice a registrant can make in the lodging dropdowns: a
 * visible node with no visible children, along with its path from the root.
 * Returns [{ choices: [id, ...], id, name, path: [name, ...], full }].
 */
function lodgingLeaves(nodes) {
  const root = nodes.find(n => n.parent === null);
  const leaves = [];
  // a choice under a full node is full too: the dropdowns won't reach it
  const walk = (node, ids, names, full) => {
    const children = nodes.filter(n => n.parent === node.id);
    if (node !== root && children.length === 0) {
      leaves.push({ choices: ids, id: node.id, name: node.name, path: names, full });
    }
    children.forEach(c => walk(c, [...ids, c.id], [...names, c.name], full || Boolean(c.full)));
  };
  walk(root, [], [], false);
  return leaves;
}

class BulkRegistrar extends Fetcher {
  async findEvent(eventName) {
    const events = await this.fetch('GET', '/api/events/');
    const event = events.find(e => e.name === eventName);
    if (!event) throw new Error(`no event named "${eventName}" — has loadAllData.js imported it?`);
    return event;
  }

  async lodging(event) {
    const res = await fetch(`${this.urlBase}/api/events/${event.id}/register`);
    if (!res.ok) throw new Error(`could not read the registration form (${res.status})`);
    const form = await res.json();
    const nodes = form.uiSchema?.campers?.items?.lodging?.lodging_requested?.lodging_nodes;
    if (!nodes) throw new Error('registration form has no lodging_nodes');
    return lodgingLeaves(nodes);
  }

  async post(event, body) {
    const res = await fetch(`${this.urlBase}/api/events/${event.id}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': await this.getAuthToken() },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${body.step} step rejected (${res.status}): ${text.slice(0, 2000)}\nsent: ${JSON.stringify(body.formData ?? body)}`);
    }
    return JSON.parse(text);
  }
}

// a whole-number setting from the environment, or its default
function intSetting(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number, not "${raw}"`);
  return Number(raw);
}

// a share (0 to 1) setting from the environment, or its default
function shareSetting(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const share = Number(raw);
  if (!(share >= 0 && share <= 1)) throw new Error(`${name} must be between 0 and 1, not "${raw}"`);
  return share;
}

export async function runBulkRegistrations({ eventName, makeRegistration }) {
  const count = intSetting('COUNT', 75);
  const seed = intSetting('SEED', 42);
  const paidShare = shareSetting('PAID_SHARE', 0.5);
  const partPaidShare = shareSetting('PART_PAID_SHARE', 0.2);
  if (paidShare + partPaidShare > 1) throw new Error('PAID_SHARE + PART_PAID_SHARE must not be over 1');
  const gen = makeRandom(seed);

  const registrar = new BulkRegistrar();
  const event = await registrar.findEvent(eventName);
  console.log(`adding ${count} registrations to ${event.name} (event ${event.id}) at ${registrar.urlBase}`);

  const toPay = []; // [{ uuid, amount }]
  let campers = 0;
  for (let i = 0; i < count; ++i) {
    const leaves = await registrar.lodging(event);
    const open = leaves.filter(l => !l.full);
    // A lodging picker, optionally narrowed by a test on the path of names. It
    // picks a top-level option first and then a choice under it, so one option
    // with many sub-choices (e.g. RV sizes) isn't over-picked, and skips full
    // lodging unless that leaves nothing.
    const lodging = (test = () => true) => {
      const fits = open.filter(l => test(l.path));
      const any = leaves.filter(l => test(l.path));
      const pool = fits.length ? fits : any.length ? any : leaves;
      const top = gen.pick([...new Set(pool.map(l => l.path[0]))]);
      const l = gen.pick(pool.filter(p => p.path[0] === top));
      return { choices: l.choices, id: l.id, name: l.name, path: l.path };
    };

    // `key` makes each registrant's email unique across runs with different seeds
    const formData = makeRegistration(`${seed}.${i}`, { ...gen, lodging });
    const reg = await registrar.post(event, {
      step: 'registration',
      formData,
      // the server works out the real prices; this is only the client's echo
      pricingResults: { campers: formData.campers.map(() => ({ tuition: 0, total: 0 })), total: 0, tuition: 0 },
    });

    // Choosing "pay by check" completes the registration (unpaid until the
    // check comes in, which is recorded below for some of them).
    await registrar.post(event, { step: 'payment', registrationUUID: reg.registrationUUID, paymentType: 'Check' });

    const total = Number(reg.serverPricingResults?.total) || 0;
    const roll = gen.rand();
    if (total > 0 && roll < paidShare) {
      toPay.push({ uuid: reg.registrationUUID, amount: total });
    } else if (total > 0 && roll < paidShare + partPaidShare) {
      toPay.push({ uuid: reg.registrationUUID, amount: Math.max(1, Math.round(total * gen.pick([0.25, 0.5]))) });
    }

    campers += formData.campers.length;
    process.stdout.write(`\r${i + 1}/${count} registrations, ${campers} campers`);
  }
  process.stdout.write('\n');

  // the checks arrive: record them as an organizer would
  if (toPay.length) {
    // (the fetcher puts a slash after any path, so filter here, not by query)
    const regs = await registrar.fetch('GET', '/api/registrations/');
    const idByUuid = new Map(regs.filter(r => r.event === event.id).map(r => [String(r.uuid), r.id]));
    const today = new Date().toISOString().slice(0, 10);
    for (const [n, { uuid, amount }] of toPay.entries()) {
      const registration = idByUuid.get(String(uuid));
      if (!registration) throw new Error(`registration ${uuid} not found to record its payment`);
      await registrar.fetch('POST', '/api/payments/', {
        registration,
        payment_type: 'Check',
        amount: amount.toFixed(2),
        paid_on: today,
        notes: `Check #${1000 + gen.int(0, 8999)}`,
      });
      process.stdout.write(`\r${n + 1}/${toPay.length} check payments recorded`);
    }
    process.stdout.write('\n');
  }
}

export function main(options) {
  runBulkRegistrations(options).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
