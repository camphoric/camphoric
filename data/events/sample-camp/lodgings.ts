import type { Lodgings } from '@camphoric/camphoric-event-import-spec';

// Every lodging feature the importer sends: a tree of choices, capacity,
// spots held back (reserved), campers sharing a spot (sharing_multiplier),
// a node registrants never see (visible: false), notes and the prompts for
// each level (children_title).
export default {
  root: {
    name: 'Lodging',
    children_title: 'Where would you like to stay?',
    visible: true,
  },

  cabins: { parentKey: 'root', name: 'Meadow Cabins', children_title: 'Choose a cabin', visible: true },
  cabin_1: { parentKey: 'cabins', name: 'Cabin 1', capacity: 4, visible: true, notes: 'Two bunk beds' },
  cabin_2: { parentKey: 'cabins', name: 'Cabin 2', capacity: 4, visible: true, notes: 'Two bunk beds' },
  cabin_3: { parentKey: 'cabins', name: 'Cabin 3', capacity: 6, reserved: 2, visible: true, notes: 'Two spots held for staff' },
  cabin_staff: { parentKey: 'cabins', name: 'Staff Cabin', capacity: 4, visible: false, notes: 'Assigned by the registrar' },

  tents: { parentKey: 'root', name: 'Tent Field', children_title: 'Choose a tent site', visible: true },
  tent_small: {
    parentKey: 'tents',
    name: 'Small Tent Site',
    capacity: 10,
    sharing_multiplier: 0.5,
    visible: true,
    notes: 'Campers sharing a tent count as half a spot',
  },
  tent_large: { parentKey: 'tents', name: 'Large Tent Site', capacity: 6, visible: true },

  day: { parentKey: 'root', name: 'Day Visitor', capacity: 50, visible: true, notes: 'No overnight stay' },
} satisfies Lodgings;
