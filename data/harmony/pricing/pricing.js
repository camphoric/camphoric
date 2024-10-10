// early reg ends on Nov 1,
// reg closes Dec 12?

export const pricingMatrix = {
  adult: {
    apt:   { early: 211, regular: 221 },
		lodge: { early: 204, regular: 214 },
    motel: { early: 197, regular: 207 },
    cabin: { early: 145, regular: 155 },
    rv:    { early: 130, regular: 140 },
    tent:  { early: 130, regular: 140 },
  },
  yadult: {
    apt:   { early: 211, regular: 221 },
    lodge: { early: 150, regular: 160 },
    motel: { early: 148, regular: 158 },
    cabin: { early: 109, regular: 119 },
    rv:    { early:  98, regular: 108 },
    tent:  { early:  98, regular: 108 },
  },
  child: {
    apt:   { early: 211, regular: 221 },
    lodge: { early: 100, regular: 105 },
    motel: { early:  99, regular: 104 },
    cabin: { early:  73, regular:  78 },
    rv:    { early:  65, regular:  70 },
    tent:  { early:  65, regular:  70 },
  },
  baby: {
    apt:   { early:   0, regular:   0 },
    lodge: { early:   0, regular:   0 },
    motel: { early:   0, regular:   0 },
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

export default pricing;
