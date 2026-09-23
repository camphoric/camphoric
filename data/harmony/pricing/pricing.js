// early reg ends on Nov 1,
// reg closes Dec 12?

export const pricingMatrix = {
  adult: {
    // apt:   { early: 230, regular: 240 },
    lodge: { early: 230, regular: 240 },
    vil7:  { early: 215, regular: 225 },
    cabin: { early: 165, regular: 175 },
    rv:    { early: 130, regular: 135 },
    tent:  { early: 130, regular: 135 },
  },
  yadult: {
    // apt:   { early: 170, regular: 180 },
    lodge: { early: 170, regular: 180 },
    vil7:  { early: 161, regular: 171 },
    cabin: { early: 124, regular: 134 },
    rv:    { early:  98, regular: 101 },
    tent:  { early:  98, regular: 101 },
  },
  child: {
    // apt:   { early: 115, regular: 120 },
    lodge: { early: 115, regular: 120 },
    vil7:  { early: 108, regular: 113 },
    cabin: { early:  83, regular:  88 },
    rv:    { early:  65, regular:  70 },
    tent:  { early:  65, regular:  70 },
  },
  baby: {
    // apt:   { early:   0, regular:   0 },
    lodge: { early:   0, regular:   0 },
    vil7:  { early:   0, regular:   0 },
    cabin: { early:   0, regular:   0 },
    rv:    { early:   0, regular:   0 },
    tent:  { early:   0, regular:   0 },
  },
};

const transformPricing = () => {
  const result = {};

  const rf = (obj, labels = []) => {
    if (Number.isInteger(obj)) {
      result[`${labels.join('_')}_perday`] = obj;

      return;
    }

    Object.keys(obj).forEach(
      (key) => rf(obj[key], labels.concat([key]))
    );
  };

  rf(pricingMatrix);

  return result;
};

const pricing = transformPricing();

pricing['linen_rate'] = 25;
pricing['private_room_rate'] = 30;
pricing['max_campership_perday'] = 65;

export default pricing;
