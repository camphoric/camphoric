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
    let response = await fetch(`${urlBase}/api/organizations/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`error creating organization: ${await response.text()}`);
    }

    org = await response.json();

		console.log(`'${name}' organization created!`);

    console.log(`creating email account for '${name}'`);

    const creds = {};
    [
      ['username', 'CAMPHORIC_TEST_GMAIL_USERNAME', 'nobody@example.com'],
      ['password', 'CAMPHORIC_TEST_GMAIL_PASSWORD', 'abc123'],
    ].forEach(([field, variable, defaultValue]) => {
      creds[field] = process.env[variable];
      if (!creds[field]) {
        console.warn(`${variable} not set in env, using default value ${defaultValue}`);
        creds[field] = defaultValue;
      }
    });

    response = await fetch(`${urlBase}/api/emailaccounts/`, {
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
        ...creds,
      }),
    });
    if (!response.ok) {
      throw new Error(`error creating email account: ${await response.text()}`);
    }
  }

  return org;
}


export default loadOrganizations;
