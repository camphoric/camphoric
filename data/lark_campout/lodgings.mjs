export default {
  root: {
    name: "Lodging",
    children_title: "Select your lodging preference",
    visible: true,
  },
  // Tent, RV, House,Off Site
  tent: { parentKey: "root", name: "Tent", visible: true },
  tent_1A: {"parentKey":"tent","visible":false,"name":"1A Tent (possibly vanagon)"},
    tent_1A_1: {"parentKey":"tent_1A","capacity":1,"visible":false,"name":"tent_1A spot 1"},
    tent_1A_2: {"parentKey":"tent_1A","capacity":1,"visible":false,"name":"tent_1A spot 2"},
  tent_1B: {"parentKey":"tent","visible":false,"name":"1B Tent (possibly vanagon)"},
    tent_1B_1: {"parentKey":"tent_1B","capacity":1,"visible":false,"name":"tent_1B spot 1"},
    tent_1B_2: {"parentKey":"tent_1B","capacity":1,"visible":false,"name":"tent_1B spot 2"},
  tent_2A: {"parentKey":"tent","visible":false,"name":"2A Tent (possibly vanagon)"},
    tent_2A_1: {"parentKey":"tent_2A","capacity":1,"visible":false,"name":"tent_2A spot 1"},
    tent_2A_2: {"parentKey":"tent_2A","capacity":1,"visible":false,"name":"tent_2A spot 2"},
  tent_2B: {"parentKey":"tent","visible":false,"name":"2B Tent (possibly vanagon)"},
    tent_2B_1: {"parentKey":"tent_2B","capacity":1,"visible":false,"name":"tent_2B spot 1"},
    tent_2B_2: {"parentKey":"tent_2B","capacity":1,"visible":false,"name":"tent_2B spot 2"},
  tent_3: {"parentKey":"tent","visible":false,"name":"3 Tent (near marketplace)"},
    tent_3_1: {"parentKey":"tent_3","capacity":1,"visible":false,"name":"tent_3 spot 1"},
    tent_3_2: {"parentKey":"tent_3","capacity":1,"visible":false,"name":"tent_3 spot 2"},
  tent_5: {"parentKey":"tent","visible":false,"name":"5 Tent"},
    tent_5_1: {"parentKey":"tent_5","capacity":1,"visible":false,"name":"tent_5 spot 1"},
    tent_5_2: {"parentKey":"tent_5","capacity":1,"visible":false,"name":"tent_5 spot 2"},
  tent_6: {"parentKey":"tent","visible":false,"name":"6 Tent/ Small RV "},
    tent_6_1: {"parentKey":"tent_6","capacity":1,"visible":false,"name":"tent_6 spot 1"},
    tent_6_2: {"parentKey":"tent_6","capacity":1,"visible":false,"name":"tent_6 spot 2"},
  tent_7A: {"parentKey":"tent","visible":false,"name":"7A Tent"},
    tent_7A_1: {"parentKey":"tent_7A","capacity":1,"visible":false,"name":"tent_7A spot 1"},
    tent_7A_2: {"parentKey":"tent_7A","capacity":1,"visible":false,"name":"tent_7A spot 2"},
  tent_7B: {"parentKey":"tent","visible":false,"name":"7B Tent"},
    tent_7B_1: {"parentKey":"tent_7B","capacity":1,"visible":false,"name":"tent_7B spot 1"},
    tent_7B_2: {"parentKey":"tent_7B","capacity":1,"visible":false,"name":"tent_7B spot 2"},
  tent_7C: {"parentKey":"tent","visible":false,"name":"7C Tent"},
    tent_7C_1: {"parentKey":"tent_7C","capacity":1,"visible":false,"name":"tent_7C spot 1"},
    tent_7C_2: {"parentKey":"tent_7C","capacity":1,"visible":false,"name":"tent_7C spot 2"},
  tent_9A: {"parentKey":"tent","visible":false,"name":"9A Tent (Walk in)"},
    tent_9A_1: {"parentKey":"tent_9A","capacity":1,"visible":false,"name":"tent_9A spot 1"},
    tent_9A_2: {"parentKey":"tent_9A","capacity":1,"visible":false,"name":"tent_9A spot 2"},
  tent_9B: {"parentKey":"tent","visible":false,"name":"9B Tent (Walk in)"},
    tent_9B_1: {"parentKey":"tent_9B","capacity":1,"visible":false,"name":"tent_9B spot 1"},
    tent_9B_2: {"parentKey":"tent_9B","capacity":1,"visible":false,"name":"tent_9B spot 2"},
  tent_9C: {"parentKey":"tent","visible":false,"name":"9C Tent (Walk in)"},
    tent_9C_1: {"parentKey":"tent_9C","capacity":1,"visible":false,"name":"tent_9C spot 1"},
    tent_9C_2: {"parentKey":"tent_9C","capacity":1,"visible":false,"name":"tent_9C spot 2"},
  tent_10: {"parentKey":"tent","visible":false,"name":"10 Tent/ Small RV"},
    tent_10_1: {"parentKey":"tent_10","capacity":1,"visible":false,"name":"tent_10 spot 1"},
    tent_10_2: {"parentKey":"tent_10","capacity":1,"visible":false,"name":"tent_10 spot 2"},
  tent_11A: {"parentKey":"tent","visible":false,"name":"11A Tent (group site)"},
    tent_11A_1: {"parentKey":"tent_11A","capacity":1,"visible":false,"name":"tent_11A spot 1"},
    tent_11A_2: {"parentKey":"tent_11A","capacity":1,"visible":false,"name":"tent_11A spot 2"},
  tent_11B: {"parentKey":"tent","visible":false,"name":"11B Tent (group site)"},
    tent_11B_1: {"parentKey":"tent_11B","capacity":1,"visible":false,"name":"tent_11B spot 1"},
    tent_11B_2: {"parentKey":"tent_11B","capacity":1,"visible":false,"name":"tent_11B spot 2"},
  tent_11C: {"parentKey":"tent","visible":false,"name":"11C Tent (group site)"},
    tent_11C_1: {"parentKey":"tent_11C","capacity":1,"visible":false,"name":"tent_11C spot 1"},
    tent_11C_2: {"parentKey":"tent_11C","capacity":1,"visible":false,"name":"tent_11C spot 2"},
  tent_11D: {"parentKey":"tent","visible":false,"name":"11D Tent (group site)"},
    tent_11D_1: {"parentKey":"tent_11D","capacity":1,"visible":false,"name":"tent_11D spot 1"},
    tent_11D_2: {"parentKey":"tent_11D","capacity":1,"visible":false,"name":"tent_11D spot 2"},
  tent_11E: {"parentKey":"tent","visible":false,"name":"11E Tent (group site)"},
    tent_11E_1: {"parentKey":"tent_11E","capacity":1,"visible":false,"name":"tent_11E spot 1"},
    tent_11E_2: {"parentKey":"tent_11E","capacity":1,"visible":false,"name":"tent_11E spot 2"},
  tent_11F: {"parentKey":"tent","visible":false,"name":"11F Tent (group site)"},
    tent_11F_1: {"parentKey":"tent_11F","capacity":1,"visible":false,"name":"tent_11F spot 1"},
    tent_11F_2: {"parentKey":"tent_11F","capacity":1,"visible":false,"name":"tent_11F spot 2"},

  rv_sm: { parentKey: "root", name: "RV under 15' long", visible: true, capacity: 5, reserved: 5 },
  rv_sm_4A: {"parentKey":"rv_sm","visible":false,"name":"4A Tent/ Small RV (elecrical hook up, near water)"},
    rv_sm_4A_1: {"parentKey":"rv_sm_4A","capacity":1,"visible":false,"name":"rv_sm_4A spot 1"},
    rv_sm_4A_2: {"parentKey":"rv_sm_4A","capacity":1,"visible":false,"name":"rv_sm_4A spot 2"},
  rv_sm_4B: {"parentKey":"rv_sm","visible":false,"name":"4B Tent/ Small RV (elecrical hook up, near water)"},
    rv_sm_4B_1: {"parentKey":"rv_sm_4B","capacity":1,"visible":false,"name":"rv_sm_4B spot 1"},
    rv_sm_4B_2: {"parentKey":"rv_sm_4B","capacity":1,"visible":false,"name":"rv_sm_4B spot 2"},
  rv_sm_8A: {"parentKey":"rv_sm","visible":false,"name":"8A Tent/ Small RV (elecrical hook up, near water)"},
    rv_sm_8A_1: {"parentKey":"rv_sm_8A","capacity":1,"visible":false,"name":"rv_sm_8A spot 1"},
    rv_sm_8A_2: {"parentKey":"rv_sm_8A","capacity":1,"visible":false,"name":"rv_sm_8A spot 2"},
  rv_sm_8B: {"parentKey":"rv_sm","visible":false,"name":"8B Tent/ Small RV (elecrical hook up, near water)"},
    rv_sm_8B_1: {"parentKey":"rv_sm_8B","capacity":1,"visible":false,"name":"rv_sm_8B spot 1"},
    rv_sm_8B_2: {"parentKey":"rv_sm_8B","capacity":1,"visible":false,"name":"rv_sm_8B spot 2"},

  rv_lg: { parentKey: "root", name: "RV 15'-20' long", visible: true },
  RV1: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV1_1: {"parentKey":"RV1","capacity":1,"visible":false,"name":"RV1 spot 1"},
    RV1_2: {"parentKey":"RV1","capacity":1,"visible":false,"name":"RV1 spot 2"},
  RV2: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV2_1: {"parentKey":"RV2","capacity":1,"visible":false,"name":"RV2 spot 1"},
    RV2_2: {"parentKey":"RV2","capacity":1,"visible":false,"name":"RV2 spot 2"},
  RV3: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV3_1: {"parentKey":"RV3","capacity":1,"visible":false,"name":"RV3 spot 1"},
    RV3_2: {"parentKey":"RV3","capacity":1,"visible":false,"name":"RV3 spot 2"},
  RV4: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV4_1: {"parentKey":"RV4","capacity":1,"visible":false,"name":"RV4 spot 1"},
    RV4_2: {"parentKey":"RV4","capacity":1,"visible":false,"name":"RV4 spot 2"},
  RV5: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV5_1: {"parentKey":"RV5","capacity":1,"visible":false,"name":"RV5 spot 1"},
    RV5_2: {"parentKey":"RV5","capacity":1,"visible":false,"name":"RV5 spot 2"},
  RV6: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV6_1: {"parentKey":"RV6","capacity":1,"visible":false,"name":"RV6 spot 1"},
    RV6_2: {"parentKey":"RV6","capacity":1,"visible":false,"name":"RV6 spot 2"},
  RV7: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV7_1: {"parentKey":"RV7","capacity":1,"visible":false,"name":"RV7 spot 1"},
    RV7_2: {"parentKey":"RV7","capacity":1,"visible":false,"name":"RV7 spot 2"},
  RV8: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV8_1: {"parentKey":"RV8","capacity":1,"visible":false,"name":"RV8 spot 1"},
    RV8_2: {"parentKey":"RV8","capacity":1,"visible":false,"name":"RV8 spot 2"},
  RV9: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV9_1: {"parentKey":"RV9","capacity":1,"visible":false,"name":"RV9 spot 1"},
    RV9_2: {"parentKey":"RV9","capacity":1,"visible":false,"name":"RV9 spot 2"},
  RV10: {"parentKey":"rv_lg","visible":false,"name":"RV large - No hookups, near bunkhouse"},
    RV10_1: {"parentKey":"RV10","capacity":1,"visible":false,"name":"RV10 spot 1"},
    RV10_2: {"parentKey":"RV10","capacity":1,"visible":false,"name":"RV10 spot 2"},

  cabin: { parentKey: "root", name: "Cabin", visible: true },
  Sitka:       { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Sitka, Queen, CPAP' },
  Terrace:     { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Terrace, Queen, CPAP' },
  OceanView:   { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Ocean View, 2 Twins, CPAP' },
  Skylight:    { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Skylight, Queen , CPAP' },
  GardenView:  { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Garden View, 2 Twins, CPAP' },
  Cypress:     { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Cypress, Queen' },
  Osprey:      { parentKey: 'cabin', capacity: 6, visible: false, name: 'FH Osprey, 3 Bunk Beds' },
  Library:     { parentKey: 'cabin', capacity: 2, visible: false, name: 'FH Library, Queen, ADA' },
  GreyFox:     { parentKey: 'cabin', capacity: 6, visible: false, name: 'BH Grey Fox, Queen, 2 Bunk Beds, ADA' },
  CohoSalmon:  { parentKey: 'cabin', capacity: 8, visible: false, name: 'BH Coho Salmon, 4 Bunk Beds, ADA' },
  Redwood:     { parentKey: 'cabin', capacity: 6, visible: false, name: 'BH Redwood, Queen, Futon, Bunk Bed, ADA, CPAP' },
  PygmyForest: { parentKey: 'cabin', capacity: 4, visible: false, name: 'BH Pygmy Forest, Queen, Bunk Bed , ADA, CPAP' },

  Orchid:      { parentKey: 'cabin', capacity: 4, visible: false, name: 'Orchid, 2 Double Beds' },
  Eucalyptus:  { parentKey: 'cabin', capacity: 3, visible: false, name: 'Eucalyptus, Double, Twin, Semi-ADA' },
  GrandFir:    { parentKey: 'cabin', capacity: 4, visible: false, name: 'Grand Fir, Queen, Semi-ADA' },

  off_site: { parentKey: "root", capacity: 50, name: "Off Site", visible: true },
};