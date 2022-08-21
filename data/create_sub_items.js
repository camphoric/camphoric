#!/usr/bin/env node

const items = {
  // paste items that you want to split into sub-items here.  It will create a
  // number of subitems based on the capacity.
  camp3_rv_sm: { parentKey: "camp3_rv", name: "Camp 3: RV under 15' long", visible: true, capacity: 20, reserved: 10 },
  camp3_rv_lg: { parentKey: "camp3_rv", name: "Camp 3: RV 15'-20' long", visible: true, capacity: 5, reserved: 4 },
};

const result = {};
const tostr = (i) => JSON.stringify(i)

Object.entries(items).forEach(([parentKey, item]) => {
  const capacity = item.capacity;
  delete item.capacity;

  console.log(`  ${parentKey}: ${JSON.stringify(item)},`);
  for (let i = 1; i <= capacity; i++) {
    const key = `${parentKey}_${i}`;

    const child = {
      parentKey,
      capacity: 1,
      visible: false,
      name: `${parentKey} spot ${i}`,
    };

  console.log(`    ${key}: ${JSON.stringify(child)},`);
  }
});

