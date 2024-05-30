/* eslint-disable indent */

export default {
  root: {
    name: 'Lodging',
    children_title: 'Select your lodging preference',
    visible: true,
  },
  // Tent, RV, House,Off Site
  tent: { parentKey: 'root', name: 'Tent', visible: true },
    tent_1A: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 1 Spot A', notes: 'Tent'},
    tent_1B: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 1 Spot B', notes: 'Tent'},
    tent_1C: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 1 Spot C', notes: 'Tent'},
    tent_1D: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 1 Spot D', notes: 'Tent'},

    tent_2A: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 2 Spot A', notes: 'Tent'},
    tent_2B: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 2 Spot B', notes: 'Tent'},
    tent_2C: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 2 Spot C', notes: 'Tent'},
    tent_2D: {parentKey:'tent', 'capacity':1, visible:false, name:'CS 2 Spot D', notes: 'Tent'},

    tent_OA: {parentKey:'tent', 'capacity':1, visible:false, name:'CS Orchard Spot A', notes: 'Tent (Walk in)'},
    tent_OB: {parentKey:'tent', 'capacity':1, visible:false, name:'CS Orchard Spot B', notes: 'Tent (Walk in)'},
    tent_OC: {parentKey:'tent', 'capacity':1, visible:false, name:'CS Orchard Spot C', notes: 'Tent (Walk in)'},
    tent_OD: {parentKey:'tent', 'capacity':1, visible:false, name:'CS Orchard Spot D', notes: 'Tent (Walk in)'},
    tent_OE: {parentKey:'tent', 'capacity':1, visible:false, name:'CS Orchard Spot E', notes: 'Tent (Walk in)'},

  rvsm: { parentKey: 'root', name: 'RV under 15\' long', visible: true },
    rvsm_1: {parentKey:'rvsm', 'capacity':1, visible:false, name:'Sm RV 1 (CS1)', notes: 'no hookups'},
    rvsm_2: {parentKey:'rvsm', 'capacity':1, visible:false, name:'Sm RV 2 (CS2)', notes: 'no hookups'},
    rvsm_3: {parentKey:'rvsm', 'capacity':1, visible:false, name:'Sm RV 3', notes: 'no hookups'},
    rvsm_4: {parentKey:'rvsm', 'capacity':1, visible:false, name:'Sm RV 4', notes: 'no hookups'},

  rvlg: { parentKey: 'root', name: 'RV 15\'-20\' long', visible: true },
    RV1:  {parentKey:'rvlg',visible:false, name:'Lg RV 1', notes: 'No hookups','capacity': 1},
    RV2:  {parentKey:'rvlg',visible:false, name:'Lg RV 2', notes: 'No hookups','capacity': 1},
    RV3:  {parentKey:'rvlg',visible:false, name:'Lg RV 3', notes: 'No hookups','capacity': 1},
    RV4:  {parentKey:'rvlg',visible:false, name:'Lg RV 4', notes: 'No hookups','capacity': 1},
    RV5:  {parentKey:'rvlg',visible:false, name:'Lg RV 5', notes: 'No hookups','capacity': 1},

  privateroom: { parentKey: 'root', name: 'Private Room', visible: true },
    FH_Cypress:     { parentKey: 'privateroom', capacity: 1, visible: false, name:'FH Cypress', notes: 'Queen, CPAP' },
		FH_Library:     { parentKey: 'privateroom', capacity: 1, visible: false, name:'FH Library', notes: 'Queen, ADA' },
    FH_Sitka:       { parentKey: 'privateroom', capacity: 1, visible: false, name:'FH Sitka', notes: 'Queen, CPAP' },
    FH_Skylight:    { parentKey: 'privateroom', capacity: 1, visible: false, name:'FH Skylight', notes: 'Queen (double?), CPAP' },
    FH_Terrace:     { parentKey: 'privateroom', capacity: 1, visible: false, name:'FH Terrace', notes: 'Queen' },
		GrandFir:       { parentKey: 'privateroom', capacity: 1, visible: false, name:'Grand Fir Cabin', notes: 'Queen' },

	sharedroom: { parentKey: 'root', name: 'Shared Room', visible: true },
    FH_Osprey:     { parentKey: 'sharedroom', capacity: 3, visible: false, name:'FH Osprey', notes: '3 Bunk Beds' },
    Orchard:       { parentKey: 'sharedroom', capacity: 2, visible: false, name:'Orchard Cabin', notes: '2 Double Beds' },
    Eucalyptus:    { parentKey: 'sharedroom', capacity: 2, visible: false, name:'Eucalyptus Cabin', notes: 'Double, Twin' },
    FH_GardenView: { parentKey: 'sharedroom', capacity: 2, visible: false, name:'FH Garden View', notes: '2 Twins, CPAP' },
		FH_OceanView:  { parentKey: 'sharedroom', capacity: 2, visible: false, name:'FH Ocean View', notes: '2 Twins, CPAP' },
		Osprey:        { parentKey: 'sharedroom', capacity: 2, visible: false, name:'Osprey Cabin', notes: 'Queen, Twin, Semi-ADA' },
		Pelican:       { parentKey: 'sharedroom', capacity: 2, visible: false, name:'Pelican Cabin', notes: 'Queen, Twin, Semi-ADA' },

  offsite: { parentKey: 'root', capacity: 50, name: 'Off Site', visible: true },
};
