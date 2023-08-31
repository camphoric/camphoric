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
    privateroom: 250,
    sharedroom: 200,
    rvlg: 150,
    rvsm: 150,
    tent: 150,
  },
  child: {
    offsite: 75,
    privateroom: 100,
    sharedroom: 100,
    rvlg: 100,
    rvsm: 100,
    tent: 100,
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
