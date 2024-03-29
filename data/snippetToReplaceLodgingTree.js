async function fixLodging() {
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/);

  const csrf = (match && match[1]) || '';
  const eventId = 2;

  const lodgingConfig = {
    root: {
      name: "Lodging",
      children_title: "Select your lodging preference",
      visible: true,
    },
    // Tent, RV, House,Off Site
    tent: { parentKey: "root", name: "Tent", visible: true },
      tent_1A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 1 Spot A", notes: "Tent"},
      tent_1B: {parentKey:"tent", "capacity":1, visible:false, name:"CS 1 Spot B", notes: "Tent"},
      tent_1C: {parentKey:"tent", "capacity":1, visible:false, name:"CS 1 Spot C", notes: "Tent (possibly vanagon)"},
      tent_1D: {parentKey:"tent", "capacity":1, visible:false, name:"CS 1 Spot D", notes: "Tent (possibly vanagon)"},
      tent_2A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 2 Spot A", notes: "Tent"},
      tent_2B: {parentKey:"tent", "capacity":1, visible:false, name:"CS 2 Spot B", notes: "Tent"},
      tent_3A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 3", notes: "Tent (near marketplace)"},
      tent_4A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 4 Spot A", notes: "Tent/ Small RV (elecrical hook up, near water)"},
      tent_4B: {parentKey:"tent", "capacity":1, visible:false, name:"CS 4 Spot B", notes: "Tent/ Small RV (elecrical hook up, near water)"},
      tent_5A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 5", notes: "Tent"},
      tent_6A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 6", notes: "Tent/ Small RV"},
      tent_7A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 7 Spot A", notes: "Tent"},
      tent_7B: {parentKey:"tent", "capacity":1, visible:false, name:"CS 7 Spot B", notes: "Tent"},
      tent_7C: {parentKey:"tent", "capacity":1, visible:false, name:"CS 7 Spot C", notes: "Tent"},
      tent_9A: {parentKey:"tent", "capacity":1, visible:false, name:"CS 9 Spot A", notes: "Tent (Walk in)"},
      tent_9B: {parentKey:"tent", "capacity":1, visible:false, name:"CS 9 Spot B", notes: "Tent (Walk in)"},
      tent_9C: {parentKey:"tent", "capacity":1, visible:false, name:"CS 9 Spot C", notes: "Tent (Walk in)"},
      tent_10: {parentKey:"tent", "capacity":1, visible:false, name:"CS 10", notes: "Tent/ Small RV"},
      tent_MA: {parentKey:"tent", "capacity":1, visible:false, name:"CS Meadow Spot A", notes: "Tent (group site)"},
      tent_MB: {parentKey:"tent", "capacity":1, visible:false, name:"CS Meadow Spot B", notes: "Tent (group site)"},
      tent_MC: {parentKey:"tent", "capacity":1, visible:false, name:"CS Meadow Spot C", notes: "Tent (group site)"},
      tent_MD: {parentKey:"tent", "capacity":1, visible:false, name:"CS Meadow Spot D", notes: "Tent (group site)"},
      tent_ME: {parentKey:"tent", "capacity":1, visible:false, name:"CS Meadow Spot E", notes: "Tent (group site)"},
      tent_MF: {parentKey:"tent", "capacity":1, visible:false, name:"CS Meadow Spot F", notes: "Tent (group site)"},
      tent_OA: {parentKey:"tent", "capacity":1, visible:false, name:"CS Orchard Spot A", notes: "Tent (Walk in)"},
      tent_OB: {parentKey:"tent", "capacity":1, visible:false, name:"CS Orchard Spot B", notes: "Tent (Walk in)"},
      tent_OC: {parentKey:"tent", "capacity":1, visible:false, name:"CS Orchard Spot C", notes: "Tent (Walk in)"},
      tent_OD: {parentKey:"tent", "capacity":1, visible:false, name:"CS Orchard Spot D", notes: "Tent (Walk in)"},
      tent_OE: {parentKey:"tent", "capacity":1, visible:false, name:"CS Orchard Spot E", notes: "Tent (Walk in)"},

    rv_sm: { parentKey: "root", name: "RV under 15' long", visible: true, capacity: 5, reserved: 5 },
      rv_sm_4A: {parentKey:"rv_sm", "capacity":1, visible:false, name:"CS 4 Spot A", notes: "Tent/ Small RV (elecrical hook up, near water)"},
      rv_sm_4B: {parentKey:"rv_sm", "capacity":1, visible:false, name:"CS 4 Spot B", notes: "Tent/ Small RV (elecrical hook up, near water)"},
      rv_sm_8A: {parentKey:"rv_sm", "capacity":1, visible:false, name:"CS 8 Spot A", notes: "Tent/ Small RV (elecrical hook up, near water)"},
      rv_sm_8B: {parentKey:"rv_sm", "capacity":1, visible:false, name:"CS 8 Spot B", notes: "Tent/ Small RV"},

    rv_lg: { parentKey: "root", name: "RV 15'-20' long", visible: true },
      RV1:  {parentKey:"rv_lg",visible:false, name:"RV1lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV2:  {parentKey:"rv_lg",visible:false, name:"RV2lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV3:  {parentKey:"rv_lg",visible:false, name:"RV3lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV4:  {parentKey:"rv_lg",visible:false, name:"RV4lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV5:  {parentKey:"rv_lg",visible:false, name:"RV5lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV6:  {parentKey:"rv_lg",visible:false, name:"RV6lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV7:  {parentKey:"rv_lg",visible:false, name:"RV7lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV8:  {parentKey:"rv_lg",visible:false, name:"RV8lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV9:  {parentKey:"rv_lg",visible:false, name:"RV9lg", notes: "No hookups, near bunkhouse","capacity": 1},
      RV10: {parentKey:"rv_lg",visible:false, name:"RV0lg", notes: "No hookups, near bunkhouse","capacity": 1},

    cabin: { parentKey: "root", name: "Cabin", visible: true },
      Sitka:       { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Sitka', notes: 'Queen, CPAP' },
      Terrace:     { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Terrace', notes: 'Queen, CPAP' },
      OceanView:   { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Ocean View', notes: '2 Twins, CPAP' },
      Skylight:    { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Skylight', notes: 'Queen , CPAP' },
      GardenView:  { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Garden View', notes: '2 Twins, CPAP' },
      Cypress:     { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Cypress', notes: 'Queen' },
      Osprey:      { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Osprey', notes: '3 Bunk Beds' },
      Library:     { parentKey: 'cabin', capacity: 1, visible: false, name:'FH Library', notes: 'Queen, ADA' },
      GreyFox:     { parentKey: 'cabin', capacity: 1, visible: false, name:'BH Grey Fox', notes: 'Queen, 2 Bunk Beds, ADA' },
      CohoSalmon:  { parentKey: 'cabin', capacity: 1, visible: false, name:'BH Coho Salmon', notes: '4 Bunk Beds, ADA' },
      Redwood:     { parentKey: 'cabin', capacity: 1, visible: false, name:'BH Redwood', notes: 'Queen, Futon, Bunk Bed, ADA, CPAP' },
      PygmyForest: { parentKey: 'cabin', capacity: 1, visible: false, name:'BH Pygmy Forest', notes: 'Queen, Bunk Bed , ADA, CPAP' },
                                                                                                                             
      Orchid:      { parentKey: 'cabin', capacity: 1, visible: false, name:'Orchid Cabin', notes: '2 Double Beds' },
      Eucalyptus:  { parentKey: 'cabin', capacity: 1, visible: false, name:'Eucalyptus Cabin', notes: 'Double, Twin, Semi-ADA' },
      GrandFir:    { parentKey: 'cabin', capacity: 1, visible: false, name:'Grand Fir Cabin', notes: 'Queen, Semi-ADA' },

    off_site: { parentKey: "root", capacity: 50, name: "Off Site", visible: true },
  };


  const allLodging = await fetch('/api/lodgings/')
    .then(r => r.json())
    .then(r => r.filter(l => l.event === eventId));
  const root = allLodging.find(l => l.parent === null);
  const parents = allLodging
    .filter(l => l.parent === root.id)
    .map(lodging => {
      const [configKey] = Object.entries(lodgingConfig).find(([k, l]) => l.name === lodging.name)

      return {
        ...lodging,
        configKey,
      };
    });

  const parentIds = [
    ...parents.map(p => p.id),
    root.id,
  ];
  // delete non-parents
  const nonParents = allLodging.filter(
    l => !parentIds.includes(l.id)
  );

  await Promise.all(
    nonParents.map(p => fetch(`/api/lodgings/${p.id}/`, {
      method: 'DELETE',
      headers: { "X-CSRFToken": csrf },
    })),
  );

  const lodgings = Object.values(lodgingConfig);

  await Promise.all(
    parents.map(parent => Promise.all(
      lodgings
        .filter(l => l.parentKey === parent.configKey)
        .map(lodging => fetch('/api/lodgings/', {
          method: 'POST',
          headers: {
            "X-CSRFToken": csrf,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: eventId,
            parent: parent.id,
            name: lodging.name,
            children_title: lodging.children_title,
            visible: lodging.visible,
            capacity: lodging.capacity || 0,
            sharing_multiplier: 1,
          }),
        }))
    )),
  );

  console.log('root', root, 'parents', parents, 'nonParents', nonParents);
}

fixLodging();
