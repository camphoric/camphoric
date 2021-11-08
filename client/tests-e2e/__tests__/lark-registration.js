const timeout = 5000;
const rootPage = 'http://localhost:3000/events/2/register';

describe('Lark Camp registration', () => {
  let page;
  let utils;

  beforeAll(async () => {
    page = await global.__BROWSER__.newPage();
    utils = require('../utils')(page);
    await page.goto(rootPage)
    await page.waitForSelector('div#root div');
  }, timeout);

  afterAll(async () => {
    await page.close();
  });

  it('should load without error', async () => {
    const text = await utils.getText('h5');
    expect(text).toBe('Lark Camp Registration');
  });

	it('should error when trying to submit a blank form', async () => {
    await utils.click('button[type=submit]');
		const el = await page.evaluateHandle(() => document.activeElement);
		const id = await page.evaluate(e => e.id, el);

    expect(id).toBe('root_registrant_email');
  });

	it('should change price when changing camp session length', async () => {
		let total = await utils.getText('.PriceTicker');
		expect(total).toBe('Total: $0.00');

		await page.select('#root_campers_0_session', 'F');
		total = await utils.getText('.PriceTicker');

		expect(total).toBe('Total: $790.00');
	});
}, timeout);

