import fetch from 'node-fetch';
import fs from 'fs';
import inquirer from 'inquirer';

const urlBase = 'http://127.0.0.1:8000';

const modules = {
	camper_pricing_logic: (await import('./camperPricingLogic.mjs')).default,
	camper_schema: (await import('./camperSchema.mjs')).default,
	confirmation_page_template: (await import('./confirmationPageTemplate.mjs')).default,
	pricing: (await import('./pricing.mjs')).default,
	registration_pricing_logic: (await import('./registrationPricingLogic.mjs')).default,
	registration_schema: (await import('./registrationSchema.mjs')).default,
	registration_ui_schema: (await import('./registrationUISchema.mjs')).default,
};

main();

async function main() {
	const token = await getAuthToken();
	const org = await getOrganizations(token);
	const evt = await getEvent(token, org);
}


async function getAuthToken() {
	try {
		return fs.readFileSync('.auth-token');
	}
	catch { }
	const answers = await inquirer.prompt([
		{ name: 'username' },
		{ name: 'password', type: 'password' },
	]);

	const response = await fetch(`${urlBase}/api-token-auth/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `username=${answers.username}&password=${answers.password}`,
	});
	const json = await response.json();
	const { token } = json;
	if (!token) {
		throw new Error(JSON.stringify(json));
	}
	fs.writeFileSync('.auth-token', token);
	console.log("Saved token to .auth-token");

	return token;
}


async function getOrganizations(token) {
	const organizations = await fetch(`${urlBase}/api/organizations/`, {
		headers: { 'Authorization': `Token ${token}` },
	}).then(r => r.json());
	
	let org = organizations.find(o => o.name === "Lark Traditional Arts");
	if (!org) {
		console.log('Could not find Lark Traditional Arts, creating');
		org = await fetch(`${urlBase}/api/organizations/`, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `Token ${token}`, 
			},
			body: JSON.stringify({
				name: "Lark Traditional Arts"
			}),
		}).then(res => res.json());
	}
	console.log(org);
	return org;
}

async function getEvent(token, org) {
	let response = await fetch(`${urlBase}/api/events/`, {
		headers: { 'Authorization': `Token ${token}` },
	});
	
	const events = await response.json();
	const existingEvent = events.find(event => event.name === "Lark 2021");
	
	const event = {
		organization: org.id,
		name: "Lark 2021",
		confirmation_email_from: 'lark-test@example.com',
		...modules,
	};
	if (existingEvent) {
		event.id = existingEvent.id;
	}
	response = await fetch(`${urlBase}/api/events/${existingEvent ? `${event.id}/` : ''}`, {
		method: existingEvent ? 'PUT' : 'POST',
		headers: {
			'Authorization': `Token ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(event),
	});
	const json = await response.json();
	
	console.log(json);
}





