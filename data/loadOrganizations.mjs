import fetch from 'node-fetch';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

function loadOrganizations(token) {
  return Promise.all(
    [
      'Lark Traditional Arts',
    ].map(name => loadOrganization(name, token))
  );

}

async function loadOrganization(name, token) {
  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());

  let org = organizations.find(o => o.name === name);
  if (!org) {
    console.log(`Could not find '${name}' organization, creating`);
    org = await fetch(`${urlBase}/api/organizations/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify({ name }),
    }).then(res => res.json());

		console.log(`'${name}' organization created!`);

    console.log(`creating email account for '${name}'`);
    fetch(`${urlBase}/api/emailaccounts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify({ 
        organization: org.id,
        name: 'Test gmail account',
        host: 'smtp.gmail.com',
        port: '587',
        username: process.env.CAMPHORIC_TEST_GMAIL_USERNAME,
        password: process.env.CAMPHORIC_TEST_GMAIL_PASSWORD,
      }),
    });

  }

  return org;
}


export default loadOrganizations;
