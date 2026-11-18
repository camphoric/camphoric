import type { LodgingLookup, SampleRegistration } from '@camphoric/camphoric-event-import-spec';

import { ages } from './pricing/camperPricingLogic.ts';
import { howHeard } from './registrationSchema.ts';
import { deposit } from './registrationDepositSchema.ts';
import { dates } from './dates.ts';

/*
 * Sample registrations, posted when the event is imported with its samples
 * (the importer's loadTestRegs). They go through Camphoric's registration API
 * like a real one, so the server checks each against the form and prices it,
 * and every report then renders against them: they're a smoke test of the
 * form, the pricing and the reports, and give the admin a camp's worth of
 * registrations to work with. So they cover as much of the form as they can:
 *
 * - every age group, and every kind of lodging: cabins, both tent sites
 *   (campers sharing a small tent site count as half a spot) and day visitors
 * - campers arriving on the first day and mid-week, with their own email or
 *   the household's
 * - T-shirts of every size, every dietary need, and 0 to 3 parking passes of
 *   every vehicle
 * - donations, every answer to how they heard of camp, comments, payers
 *   abroad, and the deposit
 * - names, addresses and comments a CSV report has to quote or escape:
 *   commas, quotes, apostrophes, accents, hyphens and line breaks
 *
 * After the first three households, each is a group of fictional characters
 * from a film, show, book, game or actual-play series (no real people), with
 * made-up ages, addresses, emails and license plates, as in the Lark Camp
 * event's samples. Each lodging gets at most 60% of its spots, and they leave
 * Cabins 1 to 3, which the e2e tests choose, to the first household.
 */

interface Camper {
  first_name: string;
  last_name: string;
  age: keyof typeof ages;
  // the lodging chosen, from the root down (lodging keys)
  lodging: string[];
  // when they arrive, if not on the first day
  arrival?: string;
  // their own email, if not the household's
  email?: string;
  shirt?: string;
  diet?: string[];
  parking?: { vehicle: string, plate: string }[];
  shared_with?: string;
}

interface Household {
  email: string;
  phone: string;
  // street, city, state or province, ZIP or postal code
  address: [string, string, string, string];
  campers: Camper[];
  heard?: string;
  donation?: number;
  comments?: string;
  paymentOption?: string;
}

const CABIN_1 = ['cabins', 'cabin_1'];
const bunkhouse = (letter: string) => ['cabins', `bunkhouse_${letter.toLowerCase()}`];
const BUNKHOUSE_A = bunkhouse('A');
const BUNKHOUSE_B = bunkhouse('B');
const BUNKHOUSE_C = bunkhouse('C');
const BUNKHOUSE_D = bunkhouse('D');
const BUNKHOUSE_E = bunkhouse('E');
const BUNKHOUSE_F = bunkhouse('F');
const BUNKHOUSE_G = bunkhouse('G');
const BUNKHOUSE_H = bunkhouse('H');
const TENT_SMALL = ['tents', 'tent_small'];
const TENT_LARGE = ['tents', 'tent_large'];
const DAY = ['day'];

const FIRST_DAY = dates.start.toISODate()!;
const SECOND_HALF = dates.start.plus({ days: 3 }).toISODate()!;

const households: Household[] = [
  {
    email: 'alex.example@example.com',
    phone: '+15555550101',
    address: ['1 Example Way', 'Sampletown', 'CA', '90001'],
    donation: 25,
    campers: [
      { first_name: 'Alex', last_name: 'Example', age: 'adult', lodging: CABIN_1, shirt: 'Medium',
        parking: [{ vehicle: 'Car', plate: '7SAM123' }], shared_with: 'Jo Example' },
      { first_name: 'Jo', last_name: 'Example', age: 'adult', lodging: CABIN_1, diet: ['Vegetarian', 'Gluten free'],
        shared_with: 'Alex Example' },
      { first_name: 'Kit', last_name: 'Example', age: 'child', lodging: CABIN_1 },
    ],
  },
  {
    email: 'sam.sample@example.com',
    phone: '+15555550102',
    address: ['22 Placeholder Lane', 'Testville', 'OR', '97001'],
    paymentOption: deposit.name,
    campers: [
      { first_name: 'Sam', last_name: 'Sample', age: 'adult', lodging: TENT_SMALL, shared_with: 'Robin Sample' },
      { first_name: 'Robin', last_name: 'Sample', age: 'youth', lodging: TENT_SMALL, shirt: 'Small',
        diet: ['Vegan', 'Nut free'], shared_with: 'Sam Sample' },
    ],
  },
  {
    email: 'casey.demo@example.com',
    phone: '+15555550103',
    address: ['303 Demo Court', 'Mockford', 'WA', '98001'],
    campers: [
      { first_name: 'Casey', last_name: 'Demo', age: 'youth', lodging: DAY },
    ],
  },
  {
    // Star Wars: the Skywalker–Solo family, at the Small Tent Site
    email: 'skywalker.solo@dontsend.com',
    phone: '+16025550101',
    address: ['1 Lars Homestead Rd', 'Anchorhead', 'AZ', '85001'],
    campers: [
      { first_name: 'Leia', last_name: 'Organa', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        parking: [{ vehicle: 'Car', plate: 'ORGA100' }], shared_with: 'Skywalker-Solo family' },
      { first_name: 'Han', last_name: 'Solo', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Skywalker-Solo family' },
      { first_name: 'Luke', last_name: 'Skywalker', age: 'adult', lodging: TENT_SMALL,
        email: 'luke.skywalker@dontsend.com', diet: ['Vegetarian'], shared_with: 'Skywalker-Solo family' },
      { first_name: 'Ben', last_name: 'Solo', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Skywalker-Solo family' },
    ],
  },
  {
    // Star Trek: The Next Generation: the senior staff, in Bunkhouse A
    email: 'enterprise.d@dontsend.com',
    phone: '+14155550102',
    address: ['24 Starfleet Way', 'San Francisco', 'CA', '94129'],
    heard: 'Social media',
    campers: [
      { first_name: 'Jean-Luc', last_name: 'Picard', age: 'adult', lodging: BUNKHOUSE_A, shirt: 'Medium',
        shared_with: 'Enterprise crew' },
      { first_name: 'William', last_name: 'Riker', age: 'adult', lodging: BUNKHOUSE_A,
        shared_with: 'Enterprise crew' },
      { first_name: 'Data', last_name: 'Soong', age: 'adult', lodging: BUNKHOUSE_A,
        shared_with: 'Enterprise crew' },
      { first_name: 'Worf', last_name: 'Son of Mogh, House of Martok', age: 'adult', lodging: BUNKHOUSE_A,
        shared_with: 'Enterprise crew' },
      { first_name: 'Beverly', last_name: 'Crusher', age: 'adult', lodging: BUNKHOUSE_A, diet: ['Vegetarian'],
        shared_with: 'Enterprise crew' },
      { first_name: 'Wesley', last_name: 'Crusher', age: 'youth', lodging: BUNKHOUSE_A,
        email: 'wesley.crusher@dontsend.com', diet: ['Vegetarian'], shared_with: 'Enterprise crew' },
    ],
  },
  {
    // Avatar: The Last Airbender: Team Avatar, at the Small Tent Site
    email: 'team.avatar@dontsend.com',
    phone: '+15415550103',
    address: ['1 Air Temple Rd', 'Bend', 'OR', '97701'],
    heard: 'A poster',
    campers: [
      { first_name: 'Iroh', last_name: 'of the Fire Nation', age: 'adult', lodging: TENT_SMALL,
        shirt: 'Large', diet: ['Vegetarian'], parking: [{ vehicle: 'Car', plate: 'OFTH101' }],
        shared_with: 'Team Avatar' },
      { first_name: 'Aang', last_name: 'of the Air Nomads', age: 'youth', lodging: TENT_SMALL,
        diet: ['Vegan'], shared_with: 'Team Avatar' },
      { first_name: 'Katara', last_name: 'of the Southern Water Tribe', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Team Avatar' },
      { first_name: 'Sokka', last_name: 'of the Southern Water Tribe', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Team Avatar' },
      { first_name: 'Toph', last_name: 'Beifong', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Team Avatar' },
      { first_name: 'Zuko', last_name: 'of the Fire Nation', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Team Avatar' },
    ],
  },
  {
    // The Legend of Korra: the new Team Avatar, at the Large Tent Site
    email: 'new.team.avatar@dontsend.com',
    phone: '+12065550104',
    address: ['88 Air Temple Island', 'Republic City', 'WA', '98101'],
    heard: 'I have been before',
    campers: [
      { first_name: 'Korra', last_name: 'of the Southern Water Tribe', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'OFTH102' }], shared_with: 'Korra, Asami, Mako and Bolin' },
      { first_name: 'Asami', last_name: 'Sato', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'Car', plate: 'SATO103' }], shared_with: 'Korra, Asami, Mako and Bolin' },
      { first_name: 'Mako', last_name: 'of Republic City', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'Korra, Asami, Mako and Bolin' },
      { first_name: 'Bolin', last_name: 'of Republic City', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'Korra, Asami, Mako and Bolin' },
    ],
  },
  {
    // Frieren: Beyond Journey's End: Frieren's party, at the Small Tent Site
    email: 'frierens.party@dontsend.com',
    phone: '+14065550105',
    address: ['3 Northern Plateau Trl', 'Missoula', 'MT', '59801'],
    comments: 'Frieren will be looking for grimoires. Please point her at the library, if there is one.',
    campers: [
      { first_name: 'Frieren', last_name: 'the Slayer', age: 'adult', lodging: TENT_SMALL, shirt: 'X-Large',
        diet: ['Vegetarian'], shared_with: 'Frieren\'s party' },
      { first_name: 'Fern', last_name: 'of Heiter\'s Church', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Frieren\'s party' },
      { first_name: 'Stark', last_name: 'of the Warrior Village', age: 'youth', lodging: TENT_SMALL,
        parking: [{ vehicle: 'Van or truck', plate: 'OFTH104' }], shared_with: 'Frieren\'s party' },
    ],
  },
  {
    // Buffy the Vampire Slayer: the Scooby Gang, at the Small Tent Site
    email: 'scooby.gang@dontsend.com',
    phone: '+18055550106',
    address: ['1630 Revello Drive', 'Sunnydale', 'CA', '94008'],
    heard: 'Social media',
    campers: [
      { first_name: 'Rupert', last_name: 'Giles', age: 'adult', lodging: TENT_SMALL,
        parking: [{ vehicle: 'Car', plate: 'GILE105' }], shared_with: 'Scooby Gang' },
      { first_name: 'Buffy', last_name: 'Summers', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        shared_with: 'Scooby Gang' },
      { first_name: 'Willow', last_name: 'Rosenberg', age: 'adult', lodging: TENT_SMALL, diet: ['Vegan'],
        shared_with: 'Scooby Gang' },
      { first_name: 'Xander', last_name: 'Harris', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Scooby Gang' },
      { first_name: 'Dawn', last_name: 'Summers', age: 'youth', lodging: TENT_SMALL, diet: ['Vegetarian'],
        shared_with: 'Scooby Gang' },
    ],
  },
  {
    // Game of Thrones: the Starks of Winterfell, in Bunkhouse B
    email: 'house.stark@dontsend.com',
    phone: '+19075550107',
    address: ['1 Winterfell Keep', 'Fairbanks', 'AK', '99701'],
    heard: 'A poster',
    donation: 50,
    campers: [
      { first_name: 'Eddard', last_name: 'Stark', age: 'adult', lodging: BUNKHOUSE_B, shirt: 'Medium',
        parking: [{ vehicle: 'Car', plate: 'STAR106' }, { vehicle: 'Car', plate: 'STAR107' }],
        shared_with: 'House Stark' },
      { first_name: 'Catelyn', last_name: 'Stark', age: 'adult', lodging: BUNKHOUSE_B,
        shared_with: 'House Stark' },
      { first_name: 'Sansa', last_name: 'Stark', age: 'youth', lodging: BUNKHOUSE_B,
        shared_with: 'House Stark' },
      { first_name: 'Arya', last_name: 'Stark', age: 'youth', lodging: BUNKHOUSE_B,
        shared_with: 'House Stark' },
      { first_name: 'Bran', last_name: 'Stark', age: 'youth', lodging: BUNKHOUSE_B, diet: ['Vegetarian'],
        shared_with: 'House Stark' },
      { first_name: 'Rickon', last_name: 'Stark', age: 'child', lodging: BUNKHOUSE_B,
        shared_with: 'House Stark' },
    ],
  },
  {
    // Firefly: Serenity's crew, in their RVs, at the Large Tent Site, on the 50% deposit
    email: 'serenity.crew@dontsend.com',
    phone: '+16505550108',
    address: ['5932 Firefly Ln', 'Persephone', 'CA', '94008'],
    heard: 'I have been before',
    paymentOption: deposit.name,
    campers: [
      { first_name: 'Malcolm', last_name: 'Reynolds', age: 'adult', lodging: TENT_LARGE, shirt: 'Large',
        parking: [{ vehicle: 'RV', plate: 'REYN108' }], shared_with: 'Serenity' },
      { first_name: 'Zoë', last_name: 'Washburne', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'Serenity' },
      { first_name: 'Hoban', last_name: 'Washburne', age: 'adult', lodging: TENT_LARGE, shirt: 'X-Large',
        shared_with: 'Serenity' },
      { first_name: 'Inara', last_name: 'Serra', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'SERR109' }], shared_with: 'Inara\'s shuttle' },
      { first_name: 'Jayne', last_name: 'Cobb', age: 'adult', lodging: TENT_LARGE, shared_with: 'Serenity' },
      { first_name: 'Kaywinnet Lee', last_name: 'Frye', age: 'adult', lodging: TENT_LARGE, shirt: 'Small',
        shared_with: 'Serenity' },
    ],
  },
  {
    // The X-Files: the FBI's X-Files unit, at the Large Tent Site
    email: 'x.files@dontsend.com',
    phone: '+12025550109',
    address: ['935 Pennsylvania Ave NW', 'Washington', 'DC', '20535'],
    comments: 'The truth is out there.',
    campers: [
      { first_name: 'Fox', last_name: 'Mulder', age: 'adult', lodging: TENT_LARGE, shirt: 'Medium',
        parking: [{ vehicle: 'Van or truck', plate: 'MULD110' }] },
      { first_name: 'Dana', last_name: 'Scully', age: 'adult', lodging: TENT_LARGE,
        email: 'dana.scully@dontsend.com' },
      { first_name: 'Walter', last_name: 'Skinner', age: 'adult', lodging: TENT_LARGE },
    ],
  },
  {
    // The Witcher: Geralt's family, paid for from Poland, at the Small Tent Site
    email: 'kaer.morhen@dontsend.com',
    phone: '+48125550110',
    address: ['Kaer Morhen', 'Kraków', 'Małopolskie', '30-001'],
    heard: 'Social media',
    campers: [
      { first_name: 'Geralt', last_name: 'of Rivia', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Geralt\'s family' },
      { first_name: 'Yennefer', last_name: 'of Vengerberg', age: 'adult', lodging: TENT_SMALL,
        diet: ['Vegetarian'], shared_with: 'Geralt\'s family' },
      { first_name: 'Cirilla', last_name: 'Fiona Elen Riannon', age: 'youth', lodging: TENT_SMALL,
        shirt: 'Large', shared_with: 'Geralt\'s family' },
      { first_name: 'Julian', last_name: 'Alfred Pankratz, Viscount de Lettenhove', age: 'adult',
        lodging: TENT_SMALL, shirt: 'X-Large' },
    ],
  },
  {
    // Supernatural: the Winchesters and Castiel; the Impala parks anywhere, at the Small Tent Site
    email: 'winchester.bros@dontsend.com',
    phone: '+17855550111',
    address: ['1 Bunker Rd', 'Lebanon', 'KS', '66952'],
    heard: 'A poster',
    campers: [
      { first_name: 'John', last_name: 'Winchester, Sr.', age: 'adult', lodging: TENT_SMALL,
        parking: [{ vehicle: 'Van or truck', plate: 'WINC111' }, { vehicle: 'Van or truck', plate: 'WINC112' }, { vehicle: 'Car', plate: 'WINC113' }] },
      { first_name: 'Dean', last_name: 'Winchester', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        shared_with: 'Sam Winchester' },
      { first_name: 'Sam', last_name: 'Winchester', age: 'adult', lodging: TENT_SMALL, diet: ['Vegetarian'],
        shared_with: 'Dean Winchester' },
      { first_name: 'Castiel', last_name: 'Angel of the Lord', age: 'adult', lodging: TENT_SMALL,
        shirt: 'Medium' },
    ],
  },
  {
    // Stranger Things: the Party and their parents, in Bunkhouse C
    email: 'hawkins.party@dontsend.com',
    phone: '+13175550112',
    address: ['1 Maple St', 'Hawkins', 'IN', '46201'],
    heard: 'I have been before',
    campers: [
      { first_name: 'Joyce', last_name: 'Byers', age: 'adult', lodging: BUNKHOUSE_C,
        parking: [{ vehicle: 'Car', plate: 'BYER114' }], shared_with: 'Hawkins party' },
      { first_name: 'Jim', last_name: 'Hopper', age: 'adult', lodging: BUNKHOUSE_C, shirt: 'Large',
        shared_with: 'Hawkins party' },
      { first_name: 'Jane', last_name: 'Hopper', age: 'youth', lodging: BUNKHOUSE_C, shirt: 'X-Large',
        shared_with: 'Hawkins party' },
      { first_name: 'Mike', last_name: 'Wheeler', age: 'youth', lodging: BUNKHOUSE_C,
        shared_with: 'Hawkins party' },
      { first_name: 'Dustin', last_name: 'Henderson', age: 'youth', lodging: BUNKHOUSE_C,
        shared_with: 'Hawkins party' },
      { first_name: 'Will', last_name: 'Byers', age: 'youth', lodging: BUNKHOUSE_C, diet: ['Vegetarian'],
        shared_with: 'Hawkins party' },
    ],
  },
  {
    // Stargate SG-1: SG-1, at the Small Tent Site
    email: 'sg1@dontsend.com',
    phone: '+17195550113',
    address: ['1 Cheyenne Mountain Complex', 'Colorado Springs', 'CO', '80914'],
    campers: [
      { first_name: 'Jack', last_name: 'O\'Neill', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        parking: [{ vehicle: 'Car', plate: 'ONEI115' }], shared_with: 'SG-1' },
      { first_name: 'Samantha', last_name: 'Carter', age: 'adult', lodging: TENT_SMALL, shared_with: 'SG-1' },
      { first_name: 'Daniel', last_name: 'Jackson', age: 'adult', lodging: TENT_SMALL, diet: ['Vegetarian'],
        shared_with: 'SG-1' },
      { first_name: 'Teal\'c', last_name: 'of Chulak', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'SG-1' },
    ],
  },
  {
    // The Boys: the Boys, paid for from London, at the Large Tent Site
    email: 'the.boys@dontsend.com',
    phone: '+442075550114',
    address: ['221 Leman St', 'London', 'Greater London', 'E1 8PY'],
    heard: 'Social media',
    campers: [
      { first_name: 'Billy', last_name: 'Butcher', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'BUTC116' }], shared_with: 'The Boys' },
      { first_name: 'Hughie', last_name: 'Campbell', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'The Boys' },
      { first_name: 'Annie', last_name: 'January', age: 'adult', lodging: TENT_LARGE, shirt: 'Medium',
        diet: ['Vegetarian'], shared_with: 'The Boys' },
      { first_name: 'Marvin', last_name: 'Milk', age: 'adult', lodging: TENT_LARGE, shirt: 'Large',
        shared_with: 'The Boys' },
      { first_name: 'Serge', last_name: 'Frenchie', age: 'adult', lodging: TENT_LARGE, diet: ['Vegetarian'],
        shared_with: 'The Boys' },
      { first_name: 'Kimiko', last_name: 'Miyashiro', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'The Boys' },
    ],
  },
  {
    // Babylon 5: the station's command staff and ambassadors, in Bunkhouse D
    email: 'babylon5@dontsend.com',
    phone: '+15205550115',
    address: ['5 Babylon Station', 'Tucson', 'AZ', '85701'],
    heard: 'A poster',
    donation: 250,
    campers: [
      { first_name: 'John', last_name: 'Sheridan', age: 'adult', lodging: BUNKHOUSE_D,
        shared_with: 'Babylon 5' },
      { first_name: 'Delenn', last_name: 'of Minbar', age: 'adult', lodging: BUNKHOUSE_D, shirt: 'X-Large',
        diet: ['Vegan'], shared_with: 'Babylon 5' },
      { first_name: 'Michael', last_name: 'Garibaldi', age: 'adult', lodging: BUNKHOUSE_D,
        shared_with: 'Babylon 5' },
      { first_name: 'Susan', last_name: 'Ivanova', age: 'adult', lodging: BUNKHOUSE_D,
        shared_with: 'Babylon 5' },
      { first_name: 'G\'Kar', last_name: 'of Narn', age: 'adult', lodging: BUNKHOUSE_D,
        shared_with: 'Babylon 5' },
      { first_name: 'Londo', last_name: 'Mollari', age: 'adult', lodging: BUNKHOUSE_D,
        shared_with: 'Babylon 5' },
    ],
  },
  {
    // The Avengers: the original six, with the biggest donation, in Bunkhouse E
    email: 'avengers.assemble@dontsend.com',
    phone: '+12125550116',
    address: ['890 Fifth Avenue', 'New York', 'NY', '10021'],
    heard: 'I have been before',
    donation: 10000,
    campers: [
      { first_name: 'Tony', last_name: 'Stark', age: 'adult', lodging: BUNKHOUSE_E,
        parking: [{ vehicle: 'Van or truck', plate: 'STAR117' }, { vehicle: 'Car', plate: 'STAR118' }],
        shared_with: 'Avengers' },
      { first_name: 'Steve', last_name: 'Rogers', age: 'adult', lodging: BUNKHOUSE_E,
        shared_with: 'Avengers' },
      { first_name: 'Natasha', last_name: 'Romanoff', age: 'adult', lodging: BUNKHOUSE_E,
        shared_with: 'Avengers' },
      { first_name: 'Bruce', last_name: 'Banner', age: 'adult', lodging: BUNKHOUSE_E, diet: ['Vegetarian'],
        shared_with: 'Avengers' },
      { first_name: 'Thor', last_name: 'Odinson', age: 'adult', lodging: BUNKHOUSE_E,
        shared_with: 'Avengers' },
      { first_name: 'Clint', last_name: 'Barton', age: 'adult', lodging: BUNKHOUSE_E,
        shared_with: 'Avengers' },
    ],
  },
  {
    // Harry Potter: the Malfoys, at the Large Tent Site
    email: 'malfoy.manor@dontsend.com',
    phone: '+18025550117',
    address: ['1 Malfoy Manor Dr', 'Wiltshire', 'VT', '05001'],
    comments: 'Lucius asks that the Malfoys are not lodged near the Weasleys.',
    campers: [
      { first_name: 'Lucius', last_name: 'Malfoy', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'MALF119' }], shared_with: 'Malfoy family' },
      { first_name: 'Narcissa', last_name: 'Malfoy', age: 'adult', lodging: TENT_LARGE, diet: ['Vegetarian'],
        shared_with: 'Malfoy family' },
      { first_name: 'Draco', last_name: 'Malfoy', age: 'youth', lodging: TENT_LARGE,
        shared_with: 'Malfoy family' },
    ],
  },
  {
    // Harry Potter: the Weasleys, at the Small Tent Site
    email: 'the.burrow@dontsend.com',
    phone: '+14135550118',
    address: ['1 The Burrow', 'Ottery St Catchpole', 'MA', '01001'],
    heard: 'Social media',
    campers: [
      { first_name: 'Arthur', last_name: 'Weasley', age: 'adult', lodging: TENT_SMALL,
        parking: [{ vehicle: 'Car', plate: 'WEAS120' }], shared_with: 'Weasley family' },
      { first_name: 'Molly', last_name: 'Weasley', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Weasley family' },
      { first_name: 'Ron', last_name: 'Weasley', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Weasley family' },
      { first_name: 'Ginny', last_name: 'Weasley', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Weasley family' },
      { first_name: 'Fred', last_name: 'Weasley', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Weasley family' },
      { first_name: 'George', last_name: 'Weasley', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Weasley family' },
    ],
  },
  {
    // X-Men: the first class, at the Large Tent Site
    email: 'xavier.school@dontsend.com',
    phone: '+19145550119',
    address: ['1407 Graymalkin Ln', 'Salem Center', 'NY', '10560'],
    heard: 'A poster',
    campers: [
      { first_name: 'Charles', last_name: 'Xavier', age: 'adult', lodging: TENT_LARGE, shirt: 'Small' },
      { first_name: 'Jean', last_name: 'Grey', age: 'adult', lodging: TENT_LARGE },
      { first_name: 'Scott', last_name: 'Summers', age: 'adult', lodging: TENT_LARGE, shirt: 'Medium' },
      { first_name: 'Ororo', last_name: 'Munroe', age: 'adult', lodging: TENT_LARGE, shirt: 'Large',
        diet: ['Vegetarian'] },
      { first_name: 'James "Logan"', last_name: 'Howlett', age: 'adult', lodging: TENT_LARGE,
        shirt: 'X-Large', parking: [{ vehicle: 'Van or truck', plate: 'HOWL121' }] },
      { first_name: 'Kitty', last_name: 'Pryde', age: 'youth', lodging: TENT_LARGE, diet: ['Vegetarian'] },
    ],
  },
  {
    // Jurassic Park: the park's first tour group, at the Large Tent Site
    email: 'isla.nublar@dontsend.com',
    phone: '+14065550120',
    address: ['1 Isla Nublar Way', 'Choteau', 'MT', '59422'],
    heard: 'I have been before',
    campers: [
      { first_name: 'Alan', last_name: 'Grant', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'GRAN122' }], shared_with: 'Jurassic Park tour' },
      { first_name: 'Ellie', last_name: 'Sattler', age: 'adult', lodging: TENT_LARGE, diet: ['Vegetarian'],
        shared_with: 'Jurassic Park tour' },
      { first_name: 'Ian', last_name: 'Malcolm', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'Jurassic Park tour' },
      { first_name: 'Lex', last_name: 'Murphy', age: 'youth', lodging: TENT_LARGE, diet: ['Vegetarian'],
        shared_with: 'Jurassic Park tour' },
      { first_name: 'Tim', last_name: 'Murphy', age: 'youth', lodging: TENT_LARGE,
        shared_with: 'Jurassic Park tour' },
    ],
  },
  {
    // Ghostbusters (Afterlife, Frozen Empire): the Spenglers, arriving mid-week, at the Small Tent Site
    email: 'spengler.farm@dontsend.com',
    phone: '+19185550121',
    address: ['1 Spengler Farm Rd', 'Summerville', 'OK', '74001'],
    campers: [
      { first_name: 'Callie', last_name: 'Spengler', age: 'adult', lodging: TENT_SMALL, arrival: SECOND_HALF,
        parking: [{ vehicle: 'Car', plate: 'SPEN123' }], shared_with: 'Spenglers' },
      { first_name: 'Gary', last_name: 'Grooberson', age: 'adult', lodging: TENT_SMALL, arrival: SECOND_HALF,
        shared_with: 'Spenglers' },
      { first_name: 'Trevor', last_name: 'Spengler', age: 'youth', lodging: TENT_SMALL, arrival: SECOND_HALF,
        shared_with: 'Spenglers' },
      { first_name: 'Phoebe', last_name: 'Spengler', age: 'youth', lodging: TENT_SMALL, arrival: SECOND_HALF,
        diet: ['Vegetarian'], shared_with: 'Spenglers' },
      { first_name: 'Podcast', last_name: '(Podcast)', age: 'youth', lodging: TENT_SMALL,
        arrival: SECOND_HALF, shared_with: 'Spenglers' },
    ],
  },
  {
    // The Matrix: the crew of the Nebuchadnezzar, at the Small Tent Site
    email: 'nebuchadnezzar@dontsend.com',
    phone: '+13125550122',
    address: ['101 Zion Way', 'Chicago', 'IL', '60601'],
    heard: 'Social media',
    campers: [
      { first_name: 'Morpheus', last_name: 'of Zion', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Nebuchadnezzar' },
      { first_name: 'Thomas', last_name: 'Anderson', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        diet: ['Vegan'], shared_with: 'Nebuchadnezzar' },
      { first_name: 'Trinity', last_name: 'of Zion', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Nebuchadnezzar' },
      { first_name: 'Niobe', last_name: 'of Zion', age: 'adult', lodging: TENT_SMALL },
    ],
  },
  {
    // Young Justice: the Team, at the Small Tent Site
    email: 'the.team@dontsend.com',
    phone: '+14015550123',
    address: ['1 Mount Justice', 'Happy Harbor', 'RI', '02840'],
    heard: 'A poster',
    campers: [
      { first_name: 'Kaldur\'ahm', last_name: 'of Atlantis', age: 'adult', lodging: TENT_SMALL,
        shirt: 'Medium', shared_with: 'The Team' },
      { first_name: 'Dick', last_name: 'Grayson', age: 'adult', lodging: TENT_SMALL, shirt: 'Large',
        shared_with: 'The Team' },
      { first_name: 'Wally', last_name: 'West', age: 'adult', lodging: TENT_SMALL, shared_with: 'The Team' },
      { first_name: 'M\'gann', last_name: 'M\'orzz', age: 'adult', lodging: TENT_SMALL, shirt: 'X-Large',
        diet: ['Vegetarian'], shared_with: 'The Team' },
      { first_name: 'Conner', last_name: 'Kent', age: 'adult', lodging: TENT_SMALL, shared_with: 'The Team' },
    ],
  },
  {
    // Adventure Time: the Land of Ooo, at the Small Tent Site
    email: 'tree.fort@dontsend.com',
    phone: '+16145550124',
    address: ['1 Tree Fort Ln', 'Ooo', 'OH', '43001'],
    heard: 'I have been before',
    campers: [
      { first_name: 'Finn', last_name: 'Mertens', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Tree Fort' },
      { first_name: 'Jake', last_name: 'the Dog', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Tree Fort' },
      { first_name: 'Bonnibel', last_name: 'Bubblegum', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        diet: ['Vegan'] },
      { first_name: 'Marceline', last_name: 'Abadeer', age: 'adult', lodging: TENT_SMALL, shirt: 'Medium' },
      { first_name: 'BMO', last_name: 'Mertens', age: 'child', lodging: TENT_SMALL,
        shared_with: 'Tree Fort' },
    ],
  },
  {
    // Scott Pilgrim vs. the World: Sex Bob-Omb and friends, paid from Toronto, at the Large Tent Site
    email: 'sex.bob.omb@dontsend.com',
    phone: '+14165550125',
    address: ['1 Casa Loma Ave', 'Toronto', 'ON', 'M5R 1X8'],
    campers: [
      { first_name: 'Scott', last_name: 'Pilgrim', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'PILG124' }], shared_with: 'Sex Bob-Omb' },
      { first_name: 'Ramona', last_name: 'Flowers', age: 'adult', lodging: TENT_LARGE,
        email: 'ramona.flowers@dontsend.com', diet: ['Vegan'], shared_with: 'Sex Bob-Omb' },
      { first_name: 'Kim', last_name: 'Pine', age: 'adult', lodging: TENT_LARGE, shared_with: 'Sex Bob-Omb' },
      { first_name: 'Stephen', last_name: 'Stills', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'Sex Bob-Omb' },
      { first_name: 'Wallace', last_name: 'Wells', age: 'adult', lodging: TENT_LARGE, shirt: 'Large' },
    ],
  },
  {
    // Veronica Mars: the Mars family and friends, at the Small Tent Site
    email: 'mars.investigations@dontsend.com',
    phone: '+19495550126',
    address: ['1 Neptune High Rd', 'Neptune', 'CA', '92651'],
    heard: 'Social media',
    campers: [
      { first_name: 'Keith', last_name: 'Mars', age: 'adult', lodging: TENT_SMALL,
        parking: [{ vehicle: 'Van or truck', plate: 'MARS125' }] },
      { first_name: 'Veronica', last_name: 'Mars', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Keith Mars' },
      { first_name: 'Wallace', last_name: 'Fennel', age: 'youth', lodging: TENT_SMALL },
      { first_name: 'Logan', last_name: 'Echolls', age: 'youth', lodging: TENT_SMALL, diet: ['Vegetarian'] },
    ],
  },
  {
    // Critical Role: Vox Machina, in Bunkhouse F
    email: 'vox.machina@dontsend.com',
    phone: '+13235550127',
    address: ['1 Whitestone Castle Rd', 'Whitestone', 'WA', '98001'],
    heard: 'A poster',
    campers: [
      { first_name: 'Vex\'ahlia', last_name: 'de Rolo', age: 'adult', lodging: BUNKHOUSE_F, shirt: 'X-Large',
        shared_with: 'Vox Machina' },
      { first_name: 'Vax\'ildan', last_name: 'Vessar', age: 'adult', lodging: BUNKHOUSE_F,
        shared_with: 'Vox Machina' },
      { first_name: 'Percival', last_name: 'Fredrickstein von Musel Klossowski de Rolo III', age: 'adult',
        lodging: BUNKHOUSE_F, shirt: 'Small', shared_with: 'Vox Machina' },
      { first_name: 'Grog', last_name: 'Strongjaw', age: 'adult', lodging: BUNKHOUSE_F,
        shared_with: 'Vox Machina' },
      { first_name: 'Keyleth', last_name: 'of the Air Ashari', age: 'adult', lodging: BUNKHOUSE_F,
        diet: ['Vegan'], shared_with: 'Vox Machina' },
      { first_name: 'Pike', last_name: 'Trickfoot', age: 'adult', lodging: BUNKHOUSE_F, diet: ['Vegetarian'],
        shared_with: 'Vox Machina' },
      { first_name: 'Scanlan', last_name: 'Shorthalt', age: 'adult', lodging: BUNKHOUSE_F,
        parking: [{ vehicle: 'Car', plate: 'SHOR126' }], shared_with: 'Vox Machina' },
      { first_name: 'Taryon', last_name: 'Darrington', age: 'adult', lodging: BUNKHOUSE_F,
        shared_with: 'Vox Machina' },
    ],
  },
  {
    // Dimension 20: the Fantasy High party (the Bad Kids), in Bunkhouse G
    email: 'bad.kids@dontsend.com',
    phone: '+13235550128',
    address: ['1 Aguefort Adventuring Academy', 'Elmville', 'OR', '97301'],
    heard: 'I have been before',
    campers: [
      { first_name: 'Figueroth', last_name: 'Faeth', age: 'youth', lodging: BUNKHOUSE_G, shirt: 'Medium',
        shared_with: 'Bad Kids' },
      { first_name: 'Gorgug', last_name: 'Thistlespring', age: 'youth', lodging: BUNKHOUSE_G,
        shared_with: 'Bad Kids' },
      { first_name: 'Kristen', last_name: 'Applebees', age: 'youth', lodging: BUNKHOUSE_G,
        diet: ['Vegetarian'], shared_with: 'Bad Kids' },
      { first_name: 'Fabian', last_name: 'Aramais Seacaster', age: 'youth', lodging: BUNKHOUSE_G,
        shared_with: 'Bad Kids' },
      { first_name: 'Riz', last_name: 'Gukgak', age: 'youth', lodging: BUNKHOUSE_G, shirt: 'Large',
        shared_with: 'Bad Kids' },
      { first_name: 'Adaine', last_name: 'Abernant', age: 'youth', lodging: BUNKHOUSE_G, diet: ['Vegan'],
        shared_with: 'Bad Kids' },
      { first_name: 'Arthur', last_name: 'Aguefort', age: 'adult', lodging: BUNKHOUSE_G,
        email: 'headmaster.aguefort@dontsend.com', parking: [{ vehicle: 'Car', plate: 'AGUE127' }] },
    ],
  },
  {
    // Ted Lasso: AFC Richmond's coaches and front office, at the Small Tent Site
    email: 'afc.richmond@dontsend.com',
    phone: '+13165550129',
    address: ['1 Nelson Rd', 'Wichita', 'KS', '67202'],
    comments: 'The sign over the door says "Believe." We\'d like to camp near it, please.',
    campers: [
      { first_name: 'Ted', last_name: 'Lasso', age: 'adult', lodging: TENT_SMALL, shirt: 'X-Large',
        parking: [{ vehicle: 'Car', plate: 'LASS128' }], shared_with: 'Lasso family' },
      { first_name: 'Henry', last_name: 'Lasso', age: 'youth', lodging: TENT_SMALL,
        shared_with: 'Lasso family' },
      { first_name: 'Rebecca', last_name: 'Welton', age: 'adult', lodging: TENT_SMALL, diet: ['Vegetarian'] },
      { first_name: 'Roy', last_name: 'Kent', age: 'adult', lodging: TENT_SMALL,
        shared_with: 'Keeley Jones' },
      { first_name: 'Keeley', last_name: 'Jones', age: 'adult', lodging: TENT_SMALL, diet: ['Vegan'],
        shared_with: 'Roy Kent' },
      { first_name: 'Coach', last_name: 'Beard', age: 'adult', lodging: TENT_SMALL },
    ],
  },
  {
    // Spider-Man: the Parkers and friends, at the Small Tent Site
    email: 'friendly.neighborhood@dontsend.com',
    phone: '+17185550130',
    address: ['20 Ingram St', 'Queens', 'NY', '11375'],
    heard: 'Social media',
    campers: [
      { first_name: 'May', last_name: 'Parker', age: 'adult', lodging: TENT_SMALL,
        parking: [{ vehicle: 'Car', plate: 'PARK129' }], shared_with: 'Parkers' },
      { first_name: 'Peter', last_name: 'Parker', age: 'adult', lodging: TENT_SMALL, shared_with: 'Parkers' },
      { first_name: 'Mary Jane', last_name: 'Watson', age: 'adult', lodging: TENT_SMALL, shirt: 'Small',
        diet: ['Vegetarian'], shared_with: 'Parkers' },
      { first_name: 'Miles', last_name: 'Morales', age: 'youth', lodging: TENT_SMALL },
      { first_name: 'Gwen', last_name: 'Stacy', age: 'youth', lodging: TENT_SMALL, diet: ['Vegan'] },
    ],
  },
  {
    // Interview with the Vampire: the coven, arriving mid-week, at the Small Tent Site
    email: 'rue.royale@dontsend.com',
    phone: '+15045550131',
    address: ['1 Royal St, "The Townhouse"', 'New Orleans', 'LA', '70130'],
    heard: 'A poster',
    comments: 'Late arrivals; we prefer evenings.\nNo garlic, please.',
    campers: [
      { first_name: 'Louis', last_name: 'de Pointe du Lac', age: 'adult', lodging: TENT_SMALL,
        arrival: SECOND_HALF, shared_with: 'Lestat de Lioncourt' },
      { first_name: 'Lestat', last_name: 'de Lioncourt', age: 'adult', lodging: TENT_SMALL,
        arrival: SECOND_HALF, shirt: 'Medium', shared_with: 'Louis de Pointe du Lac' },
      { first_name: 'Claudia', last_name: 'de Pointe du Lac', age: 'youth', lodging: TENT_SMALL,
        arrival: SECOND_HALF },
      { first_name: 'Armand', last_name: 'of Paris', age: 'adult', lodging: TENT_SMALL,
        arrival: SECOND_HALF },
      { first_name: 'Daniel', last_name: 'Molloy', age: 'adult', lodging: TENT_SMALL, arrival: SECOND_HALF,
        parking: [{ vehicle: 'Van or truck', plate: 'MOLL130' }] },
    ],
  },
  {
    // The Pitt: the Pittsburgh Trauma Medical Center ED, in Bunkhouse H
    email: 'pttmc.ed@dontsend.com',
    phone: '+14125550132',
    address: ['1 Trauma Center Blvd', 'Pittsburgh', 'PA', '15213'],
    heard: 'I have been before',
    campers: [
      { first_name: 'Michael', last_name: 'Robinavitch', age: 'adult', lodging: BUNKHOUSE_H, shirt: 'Large' },
      { first_name: 'Dana', last_name: 'Evans', age: 'adult', lodging: BUNKHOUSE_H },
      { first_name: 'Cassie', last_name: 'McKay', age: 'adult', lodging: BUNKHOUSE_H, diet: ['Vegetarian'] },
      { first_name: 'Mel', last_name: 'King', age: 'adult', lodging: BUNKHOUSE_H, diet: ['Vegetarian'] },
    ],
  },
  {
    // Inglourious Basterds: the Basterds, at the Small Tent Site
    email: 'the.basterds@dontsend.com',
    phone: '+18655550133',
    address: ['1 Smoky Mountain Rd', 'Maynardville', 'TN', '37807'],
    campers: [
      { first_name: 'Aldo', last_name: 'Raine', age: 'adult', lodging: TENT_SMALL, shirt: 'X-Large',
        parking: [{ vehicle: 'Car', plate: 'RAIN131' }] },
      { first_name: 'Donny', last_name: 'Donowitz', age: 'adult', lodging: TENT_SMALL, shirt: 'Small' },
      { first_name: 'Hugo', last_name: 'Stiglitz', age: 'adult', lodging: TENT_SMALL },
      { first_name: 'Shosanna', last_name: 'Dreyfus', age: 'adult', lodging: TENT_SMALL,
        diet: ['Vegetarian'] },
    ],
  },
  {
    // Spider-Noir: Ben Reilly, on his own, a day visitor
    email: 'spider.noir@dontsend.com',
    phone: '+12125550134',
    address: ['1 Gumshoe Alley', 'New York', 'NY', '10002'],
    heard: 'Social media',
    campers: [
      { first_name: 'Ben', last_name: 'Reilly', age: 'adult', lodging: DAY, shirt: 'Medium',
        parking: [{ vehicle: 'RV', plate: 'REIL132' }, { vehicle: 'Van or truck', plate: 'REIL133' }] },
    ],
  },
  {
    // Delicious in Dungeon: Laios's party, at the Large Tent Site, on the 50% deposit
    email: 'laios.party@dontsend.com',
    phone: '+81115550135',
    address: ['1 Golden Kingdom Rd', 'Sapporo', 'Hokkaido', '060-0001'],
    heard: 'A poster',
    comments: 'Senshi will cook for the party, but they would like all meals anyway.',
    paymentOption: deposit.name,
    campers: [
      { first_name: 'Laios', last_name: 'Touden', age: 'adult', lodging: TENT_LARGE,
        parking: [{ vehicle: 'RV', plate: 'TOUD134' }], shared_with: 'Laios\'s party' },
      { first_name: 'Falin', last_name: 'Touden', age: 'adult', lodging: TENT_LARGE, diet: ['Vegetarian'],
        shared_with: 'Laios\'s party' },
      { first_name: 'Marcille', last_name: 'Donato', age: 'adult', lodging: TENT_LARGE, diet: ['Vegetarian'],
        shared_with: 'Laios\'s party' },
      { first_name: 'Chilchuck', last_name: 'Tims', age: 'adult', lodging: TENT_LARGE,
        shared_with: 'Laios\'s party' },
      { first_name: 'Senshi', last_name: 'of Izganda', age: 'adult', lodging: TENT_LARGE, shirt: 'Large',
        shared_with: 'Laios\'s party' },
    ],
  },
];

function camperData(camper: Camper, household: Household, lodgingMap: LodgingLookup) {
  const leaf = camper.lodging[camper.lodging.length - 1];
  return {
    first_name: camper.first_name,
    last_name: camper.last_name,
    age: ages[camper.age],
    email: camper.email ?? household.email,
    phone: household.phone,
    arrival: camper.arrival ?? FIRST_DAY,
    ...(camper.diet ? { diet: camper.diet } : {}),
    ...(camper.parking ? { parking_passes: camper.parking } : {}),
    t_shirt: camper.shirt ? { wanted: true, size: camper.shirt } : { wanted: false },
    lodging: {
      lodging_requested: {
        choices: camper.lodging.map(key => lodgingMap[key].id),
        id: lodgingMap[leaf].id,
        name: lodgingMap[leaf].name,
      },
      ...(camper.shared_with ? { lodging_shared: true, lodging_shared_with: camper.shared_with } : {}),
    },
  };
}

function makeRegistration(household: Household, lodgingMap: LodgingLookup): SampleRegistration {
  const [street_address, city, state_or_province, zip_code] = household.address;
  return {
    formData: {
      registrant_email: household.email,
      campers: household.campers.map(c => camperData(c, household, lodgingMap)),
      address: { street_address, city, state_or_province, zip_code },
      how_heard: household.heard ?? howHeard[0],
      ...(household.donation ? { donation: household.donation } : {}),
      comments: household.comments ?? '',
    },
    // the server works out the real prices; this is only the client's echo
    pricingResults: {
      campers: household.campers.map(() => ({ lodging: 0, t_shirt: 0, total: 0 })),
      donation: household.donation ?? 0,
      total: 0,
    },
    ...(household.paymentOption ? { paymentData: { paymentOption: household.paymentOption } } : {}),
  };
}

export default function makeRegistrations(lodgingMap: LodgingLookup): SampleRegistration[] {
  return households.map(h => makeRegistration(h, lodgingMap));
}
