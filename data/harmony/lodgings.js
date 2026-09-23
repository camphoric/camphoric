/* eslint-disable indent */

const cabinFactory = (parentKey, notes, capacity = 4, visible = false) => (acc, cbn) => {
  return {
    ...acc,
    [`c${cbn}`]: {
      name: `Cabin ${cbn}`,
      parentKey,
      notes,
      capacity,
      visible,
    },
  };
}

export default {
  root: {
    name: 'Lodging',
    children_title: 'Select your lodging preference',
    visible: true,
  },

  // ECONOMY
  cabin: { parentKey: 'root', name: 'Cabin', visible: true },
    vil1: { parentKey: 'cabin', name: 'Village 1', visible: false },
      vil1l1: { parentKey: 'vil1', name: 'V1 Level G', visible: false },
      ...[
        '102A',
        '102B',
        '105A',
        '105B',
        '107A',
        '107B',
        '109A',
        '109B',
      ].reduce(cabinFactory('vil1l1', '4 bunkbeds',), {}),

      vil1l2: { parentKey: 'vil1', name: 'V1 Level 2', visible: false },
      ...[
        '101A',
        '101B',
        '103A',
        '103B',
        '104A',
        '104B',
        '106A',
        '106B',
        '108A',
        '108B',
      ].reduce(cabinFactory('vil1l2', '4 bunkbeds',), {}),

    vil5: { parentKey: 'cabin', name: 'Village 5', visible: false },
      vil5l0: { parentKey: 'vil5', name: 'V5 Level G', visible: false },
      ...[
        '501A',
        '501B',
        '502A',
        '502B',
        '505A',
        '505B',
        '506A',
        '506B',
        '509A',
        '509B',
        '510A',
        '510B',
      ].reduce(cabinFactory('vil5l0', '4 bunkbeds',), {}),
      ...[
        '501A',
        '501B',
        '502A',
        '502B',
        '505A',
        '505B',
        '506A',
        '506B',
        '509A',
        '509B',
        '510A',
        '510B',
      ].reduce(cabinFactory('vil5l0', '5 bunkbeds',), {}),

      vil5l2: { parentKey: 'vil5', name: 'V5 Level 2', visible: false },
      ...[
        '503A',
        '503B',
        '504A',
        '504B',
        '507A',
        '507B',
        '508A',
        '508B',
        '511A',
        '511B',
        '512A',
        '512B',
      ].reduce(cabinFactory('vil5l2', '4 bunkbeds',), {}),
      ...[
        '503A',
        '503B',
        '504A',
        '504B',
        '507A',
        '507B',
        '508A',
        '508B',
        '511A',
        '511B',
        '512A',
        '512B',
      ].reduce(cabinFactory('vil5l2', '5 bunkbeds',), {}),

    vil6: { parentKey: 'cabin', name: 'Village 6', visible: false },
      vil6l0: { parentKey: 'vil6', name: 'V6 Level G', visible: false },
      ...[
        '601A',
        '601B',
        '602A',
        '602B',
      ].reduce(cabinFactory('vil6l0', '4 bunkbeds',), {}),
      vil6l2: { parentKey: 'vil6', name: 'V6 Level 2', visible: false },
      ...[
        '603A',
        '603B',
        '604A',
        '604B',
      ].reduce(cabinFactory('vil6l2', '4 bunkbeds',), {}),

  // SEMI PRIVATE
  vil7: { parentKey: 'root', name: 'Village 7', visible: false },
    vil7l0: { parentKey: 'vil7', name: 'V7 Level G', visible: false },
      c701: { parentKey: 'vil7l0', notes: '1 bunk, 1 single - ADA', name: 'Cabin 701', capacity: 2, visible: false },
      c705: { parentKey: 'vil7l0', notes: '1 bunk, 1 single - ADA', name: 'Cabin 705', capacity: 2, visible: false },

      ...[ // old building
        '702',
        '703',
        '704',
      ].reduce(cabinFactory('vil7l0', '1 bunk, 1 single', 2), {}),
      ...[ // new building
        '711',
        '712',
        '713',
        '714',
        '715',
        '716',
      ].reduce(cabinFactory('vil7l0', '2 bunks', 2), {}),
    
    vil7l2: { parentKey: 'vil7', name: 'V7 Level 2', visible: false },
      ...[ // old building
        '706',
        '707',
        '708',
        '709',
        '710',
      ].reduce(cabinFactory('vil7l2', '1 bunk, 1 single', 2), {}),
      ...[ // new building
        '717',
        '718',
        '719',
        '720',
        '721',
        '722',
      ].reduce(cabinFactory('vil7l2', '2 bunks', 2), {}),

	// LODGE
  lodge: { parentKey: 'root', name: 'Lodge', visible: true },
    vil2: { parentKey: 'lodge', name: 'Village 2', visible: false },
      vil2l1: { parentKey: 'vil2', name: 'V2 Level G', visible: false },
        ...[
          '201',
          '202',
          '203',
          '204',
          '206',
          '209',
          '211',
          '212',
          '213',
          '214',
        ].reduce(cabinFactory('vil2l1', '2 queen', 2), {}),
        ...[
          '205',
          '207',
          '208',
          '210',
        ].reduce(cabinFactory('vil2l1', '1 queen - ADA', 2), {}),
      vil2l2: { parentKey: 'vil2', name: 'V2 Level 2', visible: false },
        ...[
          '215',
          '216',
          '217',
          '218',
          '219',
          '220',
          '221',
          '222',
          '223',
          '224',
          '225',
          '226',
          '227',
          '228',
        ].reduce(cabinFactory('vil2l2', '2 queen', 2), {}),
        // ...[
        // ].reduce(cabinFactory('vil2l2', '1 queen - ADA', 2), {}),

  /*
  well: { parentKey: 'root', name: 'Wellness', visible: false },
    w01: { parentKey: 'well', notes: '2 singles', name: 'Wellness 01', capacity: 2, visible: false },
    w02: { parentKey: 'well', notes: '2 singles', name: 'Wellness 02', capacity: 2, visible: false },
    w03: { parentKey: 'well', notes: '2 singles', name: 'Wellness 03', capacity: 2, visible: false },
    w04: { parentKey: 'well', notes: '2 singles', name: 'Wellness 04', capacity: 2, visible: false },
    w05: { parentKey: 'well', notes: '2 singles', name: 'Wellness 05', capacity: 2, visible: false },

  // APARTMENTS
  apt: { parentKey: 'root', name: 'Apartments', visible: false },
    c406: { parentKey: 'apt', name: 'Cabin 406', visible: false },
      c406r1: { parentKey: 'c406', name: 'C406 Room 1 (queen)', capacity: 1, visible: false },
      c406r2: { parentKey: 'c406', name: 'C406 Room 2 (bunk)', capacity: 1, visible: false },
    c407: { parentKey: 'apt', name: 'Cabin 407', visible: false },
      c407r1: { parentKey: 'c407', name: 'C407 Room 1 (queen)', capacity: 1, visible: false },
      c407r2: { parentKey: 'c407', name: 'C407 Room 2 (bunk)', capacity: 1, visible: false },
    c408: { parentKey: 'apt', name: 'Cabin 408', visible: false },
      c408r1: { parentKey: 'c408', name: 'C408 Room 1 (queen)', capacity: 1, visible: false },
      c408r2: { parentKey: 'c408', name: 'C408 Room 2 (bunk)', capacity: 1, visible: false },

*/

	// RV
	rv: { parentKey: 'root', name: 'RV Camping', visible: true },
    rvsm: {parentKey: 'rv', name:'RV under 15\' long', visible:true },
    ...Array.apply(null, Array(10)).map(function () {}).reduce(
      (acc, _v, i) => {
        return {
          ...acc,
          [`rvsm_${i}`]: {
            parentKey: 'rvsm',
            name: `RV Small ${i}`,
            visible: false,
            capacity: 1,
          },
        };
      },
      {},
    ),
      
    rvmd: {parentKey: 'rv', name:'RV 15\'-20\' long',visible:true },
    ...Array.apply(null, Array(10)).map(function () {}).reduce(
      (acc, _v, i) => {
        return {
          ...acc,
          [`rvmd_${i}`]: {
            parentKey: 'rvmd',
            name: `RV Medium ${i}`,
            visible: false,
            capacity: 1,
          },
        };
      },
      {},
    ),

    rvlg: {parentKey: 'rv', name:'RV 21+\' long', visible:true },
    ...Array.apply(null, Array(10)).map(function () {}).reduce(
      (acc, _v, i) => {
        return {
          ...acc,
          [`rvlg_${i}`]: {
            parentKey: 'rvlg',
            name: `RV Large ${i}`,
            visible: false,
            capacity: 1,
          },
        };
      },
      {},
    ),

	// TENT
	tent: { parentKey: 'root', name: 'Tent Camping', visible: true },
    ...Array.apply(null, Array(20)).map(function () {}).reduce(
      (acc, _v, i) => {
        return {
          ...acc,
          [`tent_${i}`]: {
            parentKey: 'tent',
            name: `Tent ${i}`,
            visible: false,
            capacity: 1,
          },
        };
      },
      {},
    ),
};
