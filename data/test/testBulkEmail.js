#!/usr/bin/env node

/**
 * Send test bulk email
 *
 * This script is to help test how the bulk email feature interacts with other
 * concurrent requests. Using the API, it creates a new BulkEmailTask for the
 * given event, adds a bunch of recipients, and sends it via the EMAIL_BACKEND
 * configured in settings.py (that should be
 * django.core.mail.backends.console.EmailBackend). While it's running, try
 * interacting with the API via the registration or admin apps, and watch
 * progress via `docker compose logs -f`.
 */

import fetch from 'node-fetch';
import inquirer from 'inquirer';

import { getAuthToken } from '../getAuthInfo.mjs';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';
const numRecipients = 500;

main();

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.warn('usage: testBulkEmail.mjs <event-id>');
    process.exit(1);
  }

  const authToken = await getAuthToken();
  let event = await getEvent(authToken, eventId);

  const { proceed } = await inquirer.prompt([{
    name: 'proceed',
    type: 'confirm',
    message: `Send test bulk email to ${numRecipients} fake recipients (event: ${event.name})?`,
  }]);

  if (!proceed) {
    process.exit(0);
  }

  const oldEmailAccountId = event.email_account;
  await setEventEmailAccount(authToken, eventId, null);
  try {
    event = await getEvent(authToken, eventId);
    if (event.email_account) {
      throw new Error("failed to clear event email account; can't use console backend");
    }
    console.log('creating task, adding recipients, and sending. Watch logs for progress');
    const task = await createBulkEmailTask(authToken, eventId);
    await addRecipients(authToken, task);
    await sendBulkEmail(authToken, task);
  } finally {
    await setEventEmailAccount(authToken, eventId, oldEmailAccountId);
  }
}

async function getEvent(authToken, eventId) {
  const response = await fetch(`${urlBase}/api/events/${eventId}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`getEvent failed: ${response.status}, ${await response.text()}`);
  }

  return response.json();
}

async function setEventEmailAccount(authToken, eventId, emailAccountId) {
  const response = await fetch(`${urlBase}/api/events/${eventId}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_account: emailAccountId }),
  });

  if (!response.ok) {
    throw new Error(`setEventEmailAccount failed: ${response.status}, ${await response.text()}`);
  }

  return response.json();
}

async function createBulkEmailTask(authToken, eventId) {
  const response = await fetch(`${urlBase}/api/bulkemailtasks/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event: eventId,
      from_email: 'testBulkEmail@example.com',
      subject: 'bulk email test',
      body_template: 'bulk email test',
      messages_per_second: 2,
    }),
  });

  if (!response.ok) {
    throw new Error(`createBulkEmailTask failed: ${response.status}, ${await response.text()}`);
  }

  return response.json();
}

async function addRecipients(authToken, task) {
  for (let i = 0; i < numRecipients; i++) {
    const response = await fetch(`${urlBase}/api/bulkemailrecipients/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: task.id,
        email: `testBulkEmailRecipient${i}@example.com`,
      }),
    });

    if (!response.ok) {
      throw new Error(`addRecipients failed: ${response.status}, ${await response.text()}`);
    }
  }
}

async function sendBulkEmail(authToken, task) {
  const response = await fetch(`${urlBase}/api/bulkemailtasks/${task.id}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`sendBulkEmail failed: ${response.status}, ${await response.text()}`);
  }

  return response.json();
}
