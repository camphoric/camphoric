/* eslint-disable indent */

export default {
  root: {
    name: 'Lodging',
    children_title: 'Select your lodging preference',
    visible: true,
  },

  // ECONOMY
  econ: { parentKey: 'root', name: 'Economy', visible: true },
    vil1: { parentKey: 'econ', name: 'Village 1', visible: false },
      vil1l0: { parentKey: 'vil1', name: 'V1 Level G', visible: false },
        c102A: { parentKey: 'vil1l0', notes: '4 bunkbeds - ground level/front', name: 'Cabin 102A', capacity: 4, visible: false },
        c102B: { parentKey: 'vil1l0', notes: '4 bunkbeds - ground level/front', name: 'Cabin 102B', capacity: 4, visible: false },
        c104A: { parentKey: 'vil1l0', notes: '4 bunkbeds - ground level/front', name: 'Cabin 104A', capacity: 4, visible: false },
        c104B: { parentKey: 'vil1l0', notes: '4 bunkbeds - ground level/front', name: 'Cabin 104B', capacity: 4, visible: false },
      vil1l1: { parentKey: 'vil1', name: 'V1 Level 1', visible: false },
        c106A: { parentKey: 'vil1l1', notes: '4 bunkbeds', name: 'Cabin 106A', capacity: 4, visible: false },
        c106B: { parentKey: 'vil1l1', notes: '4 bunkbeds', name: 'Cabin 106B', capacity: 4, visible: false },
        c108A: { parentKey: 'vil1l1', notes: '4 bunkbeds', name: 'Cabin 108A', capacity: 4, visible: false },
        c108B: { parentKey: 'vil1l1', notes: '4 bunkbeds', name: 'Cabin 108B', capacity: 4, visible: false },
      vil1l2: { parentKey: 'vil1', name: 'V1 Level 2', visible: false },
        c101A: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 101A', capacity: 4, visible: false },
        c101B: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 101B', capacity: 4, visible: false },
        c103A: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 103A', capacity: 4, visible: false },
        c103B: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 103B', capacity: 4, visible: false },
        c105A: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 105A', capacity: 4, visible: false },
        c105B: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 105B', capacity: 4, visible: false },
        c107A: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 107A', capacity: 4, visible: false },
        c107B: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 107B', capacity: 4, visible: false },
        c109A: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 109A', capacity: 4, visible: false },
        c109B: { parentKey: 'vil1l2', notes: '4 bunkbeds', name: 'Cabin 109B', capacity: 4, visible: false },

    vil5: { parentKey: 'econ', name: 'Village 5', visible: false },
      vil5l0: { parentKey: 'vil5', name: 'V5 Level G', visible: false },
        c501A: { parentKey: 'vil5l0', notes: '4 bunkbeds', name: 'Cabin 501A', capacity: 4, visible: false },
        c501B: { parentKey: 'vil5l0', notes: '4 bunkbeds', name: 'Cabin 501B', capacity: 4, visible: false },
        c502A: { parentKey: 'vil5l0', notes: '4 bunkbeds', name: 'Cabin 502A', capacity: 4, visible: false },
        c502B: { parentKey: 'vil5l0', notes: '4 bunkbeds', name: 'Cabin 502B', capacity: 4, visible: false },
      vil5l2: { parentKey: 'vil5', name: 'V5 Level 2', visible: false },
        c503A: { parentKey: 'vil5l2', notes: '4 bunkbeds', name: 'Cabin 503A', capacity: 4, visible: false },
        c503B: { parentKey: 'vil5l2', notes: '4 bunkbeds', name: 'Cabin 503B', capacity: 4, visible: false },
        c504A: { parentKey: 'vil5l2', notes: '4 bunkbeds', name: 'Cabin 504A', capacity: 4, visible: false },
        c504B: { parentKey: 'vil5l2', notes: '4 bunkbeds', name: 'Cabin 504B', capacity: 4, visible: false },

    vil6: { parentKey: 'econ', name: 'Village 6', visible: false },
      vil6l0: { parentKey: 'vil6', name: 'V6 Level G', visible: false },
        c601A: { parentKey: 'vil6l0', notes: '4 bunkbeds', name: 'Cabin 601A', capacity: 4, visible: false },
        c601B: { parentKey: 'vil6l0', notes: '4 bunkbeds', name: 'Cabin 601B', capacity: 4, visible: false },
        c602A: { parentKey: 'vil6l0', notes: '4 bunkbeds', name: 'Cabin 602A', capacity: 4, visible: false },
        c602B: { parentKey: 'vil6l0', notes: '4 bunkbeds', name: 'Cabin 602B', capacity: 4, visible: false },
      vil6l2: { parentKey: 'vil6', name: 'V6 Level 2', visible: false },
        c603A: { parentKey: 'vil6l2', notes: '4 bunkbeds', name: 'Cabin 603A', capacity: 4, visible: false },
        c603B: { parentKey: 'vil6l2', notes: '4 bunkbeds', name: 'Cabin 603B', capacity: 4, visible: false },
        c604A: { parentKey: 'vil6l2', notes: '4 bunkbeds', name: 'Cabin 604A', capacity: 4, visible: false },
        c604B: { parentKey: 'vil6l2', notes: '4 bunkbeds', name: 'Cabin 604B', capacity: 4, visible: false },

  // SEMI PRIVATE
  semip: { parentKey: 'root', name: 'Semi-Private', visible: true },
    vil2: { parentKey: 'semip', name: 'Village 2', visible: false },
      vil2l1: { parentKey: 'vil2', name: 'V2 Level 1', visible: false },
        c201: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 201', capacity: 2, visible: false },
        c202: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 202', capacity: 2, visible: false },
        c203: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 203', capacity: 2, visible: false },
        c204: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 204', capacity: 2, visible: false },
        c205: { parentKey: 'vil2l1', notes: '1 queen', name: 'Cabin 205 ADA', capacity: 1, visible: false },
        c206: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 206', capacity: 2, visible: false },
        c207: { parentKey: 'vil2l1', notes: '1 queen', name: 'Cabin 207 ADA', capacity: 1, visible: false },
        c208: { parentKey: 'vil2l1', notes: '1 queen', name: 'Cabin 208 ADA', capacity: 1, visible: false },
        c209: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 209', capacity: 2, visible: false },
        c210: { parentKey: 'vil2l1', notes: '1 queen', name: 'Cabin 210 ADA', capacity: 1, visible: false },
        c211: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 211', capacity: 2, visible: false },
        c212: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 212', capacity: 2, visible: false },
        c213: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 213', capacity: 2, visible: false },
        c214: { parentKey: 'vil2l1', notes: '2 queen', name: 'Cabin 214', capacity: 2, visible: false },
      vil2l2: { parentKey: 'vil2', name: 'V2 Level 2', visible: false },
        c215: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 215', capacity: 2, visible: false },
        c216: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 216', capacity: 2, visible: false },
        c217: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 217', capacity: 2, visible: false },
        c218: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 218', capacity: 2, visible: false },
        c219: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 219', capacity: 2, visible: false },
        c220: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 220', capacity: 2, visible: false },
        c221: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 221', capacity: 2, visible: false },
        c222: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 222', capacity: 2, visible: false },
        c223: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 223', capacity: 2, visible: false },
        c224: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 224', capacity: 2, visible: false },
        c225: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 225', capacity: 2, visible: false },
        c226: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 226', capacity: 2, visible: false },
        c227: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 227', capacity: 2, visible: false },
        c228: { parentKey: 'vil2l2', notes: '2 queen', name: 'Cabin 228', capacity: 2, visible: false },

    vil7: { parentKey: 'semip', name: 'Village 7', visible: false },
      vil7l0: { parentKey: 'vil7', name: 'V7 Level G', visible: false },
        c701: { parentKey: 'vil7l0', notes: '2 bunkbeds', name: 'Cabin 701', capacity: 2, visible: false },
        c702: { parentKey: 'vil7l0', notes: '2 bunkbeds', name: 'Cabin 702', capacity: 2, visible: false },
        c703: { parentKey: 'vil7l0', notes: '2 bunkbeds', name: 'Cabin 703', capacity: 2, visible: false },
        c704: { parentKey: 'vil7l0', notes: '2 bunkbeds', name: 'Cabin 704', capacity: 2, visible: false },
        c705: { parentKey: 'vil7l0', notes: '2 bunkbeds', name: 'Cabin 705', capacity: 2, visible: false },
        c706: { parentKey: 'vil7l0', notes: '2 bunkbeds', name: 'Cabin 706', capacity: 2, visible: false },
      vil7l2: { parentKey: 'vil7', name: 'V7 Level 2', visible: false },
        c707: { parentKey: 'vil7l2', notes: '2 singles', name: 'Cabin 707', capacity: 2, visible: false },
        c708: { parentKey: 'vil7l2', notes: '2 singles', name: 'Cabin 708', capacity: 2, visible: false },
        c709: { parentKey: 'vil7l2', notes: '2 singles', name: 'Cabin 709', capacity: 2, visible: false },
        c710: { parentKey: 'vil7l2', notes: '2 singles', name: 'Cabin 710', capacity: 2, visible: false },
        c711: { parentKey: 'vil7l2', notes: '2 singles', name: 'Cabin 711', capacity: 2, visible: false },
        c712: { parentKey: 'vil7l2', notes: '2 singles', name: 'Cabin 712', capacity: 2, visible: false },

    well: { parentKey: 'semip', name: 'Wellness', visible: false },
      w01: { parentKey: 'well', notes: '2 singles', name: 'Wellness 01', capacity: 2, visible: false },
      w02: { parentKey: 'well', notes: '2 singles', name: 'Wellness 02', capacity: 2, visible: false },
      w03: { parentKey: 'well', notes: '2 singles', name: 'Wellness 03', capacity: 2, visible: false },
      w04: { parentKey: 'well', notes: '2 singles', name: 'Wellness 04', capacity: 2, visible: false },
      w05: { parentKey: 'well', notes: '2 singles', name: 'Wellness 05', capacity: 2, visible: false },
      w06: { parentKey: 'well', notes: '1 singles', name: 'Wellness Night Nurse', capacity: 1, visible: false },

	// APARTMENTS
  apts: { parentKey: 'root', name: 'Apartments', visible: false },
    c406: { parentKey: 'apts', name: 'Cabin 406', visible: false },
      c406r1: { parentKey: 'c406', name: 'C406 Room 1 (queen)', capacity: 1, visible: false },
      c406r2: { parentKey: 'c406', name: 'C406 Room 2 (bunk)', capacity: 1, visible: false },
    c407: { parentKey: 'apts', name: 'Cabin 407', visible: false },
      c407r1: { parentKey: 'c407', name: 'C407 Room 1 (queen)', capacity: 1, visible: false },
      c407r2: { parentKey: 'c407', name: 'C407 Room 2 (bunk)', capacity: 1, visible: false },
    c408: { parentKey: 'apts', name: 'Cabin 408', visible: false },
      c408r1: { parentKey: 'c408', name: 'C408 Room 1 (queen)', capacity: 1, visible: false },
      c408r2: { parentKey: 'c408', name: 'C408 Room 2 (bunk)', capacity: 1, visible: false },

	// RV
	rv: { parentKey: 'root', name: 'RV Camping', visible: true },
    rvsm: {parentKey: 'rv', name:'RV under 15\' long', visible:true },
    ...Array.apply(null, Array(10)).map(function () {}).reduce(
      (acc, v, i) => {
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
      (acc, v, i) => {
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
      (acc, v, i) => {
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
	tent: { parentKey: 'root', name: 'Tent Camping', visible: true, capacity: 20 },
};
