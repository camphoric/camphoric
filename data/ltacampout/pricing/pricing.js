export const pricingMatrix = {
  adult: {
    offsitefull: 75,
    offsiteday: 50,
    premium: 300,
    privateroom: 250,
    sharedroom: 200,
    rvlg: 150,
    rvsm: 150,
    tent: 150,
  },
  yadult: {
    offsitefull: 75,
    offsiteday: 25,
    premium: 300,
    privateroom: 125,
    sharedroom: 100,
    rvlg: 75,
    rvsm: 75,
    tent: 75,
  },
  child: {
    offsitefull: 75,
    offsiteday: 25,
    premium: 300,
    privateroom: 125,
    sharedroom: 100,
    rvlg: 75,
    rvsm: 75,
    tent: 75,
  },
  baby: {
    offsitefull: 0,
    offsiteday: 0,
    premium: 0,
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
