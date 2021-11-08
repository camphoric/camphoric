const timeout = 5000;

describe('Lark Camp admin', () => {
  let page;
  let utils;

  beforeAll(async () => {
    page = await global.__BROWSER__.newPage();
    utils = require('../utils')(page);
    await page.goto('http://localhost:3000/admin/organization/2/event/2/home');
		const username = 'input[name=username]';
    await page.waitForSelector(username);
		await page.type(username, process.env.CAMPHORIC_USERNAME, {delay: 20});
		const password = 'input[name=password]';
		await page.waitForSelector(password);
		await page.type(password, process.env.CAMPHORIC_PASSWORD, {delay: 20});
		await utils.click('button');
		await page.waitForSelector('.navbar-brand');
		
  }, timeout);

  afterAll(async () => {
    await page.close();
  });

  it('should be logged in', async () => {
    const text = await utils.getText('.navbar-brand');
    expect(text).toBe('Lark 2021(Lark Traditional Arts)');
  });

	it('should navigate correctly using navbar', async () => {
    await utils.clickAByText('Lodging');
		const url = await page.url();
		expect(url).toBe('http://localhost:3000/admin/organization/2/event/2/lodging');

    await page.waitForSelector('.event-admin-section-lodging');
		const el = await page.$('.event-admin-section-lodging');

		expect(el).not.toBe(undefined);
  });

	// it('should change price when changing camp session length', async () => {
	// 	let total = await utils.getText('.PriceTicker');
	// 	expect(total).toBe('Total: $0.00');

	// 	await page.select('#root_campers_0_session', 'F');
	// 	total = await utils.getText('.PriceTicker');

	// 	expect(total).toBe('Total: $790.00');
	// });
}, timeout);

