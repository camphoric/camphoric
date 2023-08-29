// early reg ends on Nov 1,
// reg closes Dec 12?

export const pricingMatrix = {
  adult: {
    semip: { early: [192, 197], regular: [202, 207] },
    apts:  { early: [192, 197], regular: [202, 207] },
    econ:  { early: [135, 142], regular: [145, 152] },
    rv:    { early: [110, 107], regular: [120, 117] },
    tent:  { early: [110, 107], regular: [120, 117] },
  },
  yadult: {
    semip: { early: [144, 151], regular: [153, 161] },
    apts:  { early: [144, 151], regular: [153, 161] },
    econ:  { early: [105, 112], regular: [115, 122] },
    rv:    { early: [ 96, 103], regular: [106, 113] },
    tent:  { early: [ 96, 103], regular: [106, 113] },
  },
  child: {
    semip: { early: [ 96,  99], regular: [101, 104] },
    apts:  { early: [ 96,  99], regular: [101, 104] },
    econ:  { early: [ 67,  70], regular: [ 72,  75] },
    rv:    { early: [ 55,  58], regular: [ 60,  63] },
    tent:  { early: [ 55,  58], regular: [ 60,  63] },
  },
  baby: {
    semip: { early: [  0,   0], regular: [  0,   0] },
    apts:  { early: [  0,   0], regular: [  0,   0] },
    econ:  { early: [  0,   0], regular: [  0,   0] },
    rv:    { early: [  0,   0], regular: [  0,   0] },
    tent:  { early: [  0,   0], regular: [  0,   0] },
  },
};

const transformPricing = () => {
  const result = {};

  const rf = (obj, labels = []) => {
    if (Array.isArray(obj)) {
      const [full, perday] = obj;
      result[`${labels.join('_')}_full`] = full;
      result[`${labels.join('_')}_perday`] = perday;

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

export default pricing;
