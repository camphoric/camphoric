export const pricingMatrix = {
  adult: {
    offsite: 75,
    privateroom: 250,
    sharedroom: 200,
    rvlg: 150,
    rvsm: 150,
    tent: 150,
  },
  yadult: {
    offsite: 75,
    privateroom: 125,
    sharedroom: 100,
    rvlg: 75,
    rvsm: 75,
    tent: 75,
  },
  child: {
    offsite: 75,
    privateroom: 125,
    sharedroom: 100,
    rvlg: 75,
    rvsm: 75,
    tent: 75,
  },
  baby: {
    offsite: 0,
    privateroom: 0,
    sharedroom: 0,
    rvlg: 0,
    rvsm: 0,
    tent: 0,
  },
};

const transformPricing = () => {
  const result = {};

  const rf = (obj, labels = []) => {
    if (typeof obj === 'number') {
      result[labels.join('_')] = obj;

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
