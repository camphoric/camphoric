module.exports = (page) => ({
  getText: async (selector) => {
    await page.waitForSelector(selector);

    const e = await page.$(selector);

    return page.evaluate(el => el.textContent, e);
  },
  click: async (selector) => {
    await page.waitForSelector(selector);

    const e = await page.$(selector);

    return e.click();
  },
	clickAByText: async (text) => {
		const xpathSelector = `//a[text()='${text}']`;
		
		const el = await page.evaluate((xpath) => {
			const matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

			return matchingElement.click();
		}, xpathSelector);
	},
	clickButtonByText: async (text) => {
		const xpathSelector = `//button[text()='${text}']`;

		const el = await page.evaluate((xpath) => {
			const matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

			return matchingElement;
		}, xpathSelector);

		return el.click();
	},
	wait: async (ms) => {
		await new Promise((resolve) => { 
			setTimeout(resolve, ms)
		});
	},
});
