/**
 * What an organizer does in the admin, for an event's e2e tests: invitations
 * to register as a registration type, and the emails the server sent. It
 * uses the admin API (as the admin client does), signed in as the admin the
 * event was imported as, so tests don't drive the admin's own pages.
 */

import { randomBytes } from 'node:crypto';

/** An invitation to register as one of the event's registration types. */
export interface E2EInvitation {
  id: number;
  // The invitation's code and the address it's for (the registration form's
  // `code` and `email`)
  code: string;
  email: string;
  // The registration form with the invitation, as a path to open (the
  // server's register_link, on whichever server the tests use)
  registerUrl: string;
}

export interface InviteOptions {
  // Who it's for (default: a new @example.com address, so it's unused)
  email?: string;
  name?: string;
  // Also email it, as the admin's "Invite" does (default: no). The email is
  // the registration type's invitation email, read back with emails().
  send?: boolean;
}

/** An email the server sent (or queued), from its outbox. */
export interface SentEmail {
  id: number;
  // confirmation, invitation, invoice, bulk, …
  kind: string;
  // queued, sending, sent, failed or cancelled; the throwaway server sends
  // as it queues, so its email is sent (or failed, with lastError) at once
  status: string;
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  lastError: string;
  registration: number | null;
  invitation: number | null;
}

export interface EmailsOptions {
  // Only email to this address (any case)
  to?: string;
  // Only email of this kind, e.g. 'confirmation'
  kind?: string;
}

interface Page<T> {
  next: string | null;
  results: T[];
}

interface EmailMessage {
  id: number;
  kind: string;
  status: string;
  to: string;
  from_email: string;
  reply_to: string;
  subject: string;
  text: string;
  html: string;
  last_error: string;
  registration: number | null;
  invitation: number | null;
}

// The address in "Name <address>", or the whole of a bare one
const address = (recipient: string) => (/<([^>]*)>\s*$/.exec(recipient)?.[1] ?? recipient).trim().toLowerCase();

export class CamphoricAdmin {
  readonly url: string;
  readonly eventId: number;
  private readonly token: string;

  constructor(url: string, token: string, eventId: number) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.eventId = eventId;
  }

  /**
   * Creates an invitation to register as the registration type with this
   * `name` (its name in the event's data, not its label), as the admin's
   * "Invite a special registration" does. Open its form with
   * `page.goto(invitation.registerUrl)`.
   */
  async invite(registrationType: string, options: InviteOptions = {}): Promise<E2EInvitation> {
    const types = await this.request<{ id: number, name: string }[]>(
      'GET', `/api/registrationtypes/?event=${this.eventId}`);
    const type = types.find(t => t.name === registrationType);
    if (!type) {
      const names = types.map(t => t.name).join(', ') || 'none';
      throw new Error(`the event has no registration type named '${registrationType}' (it has: ${names})`);
    }
    const email = options.email ?? `e2e.invitee.${randomBytes(4).toString('hex')}@example.com`;
    const invitation = await this.request<{ id: number, invitation_code: string, register_link: string }>(
      'POST', '/api/invitations/', {
        registration_type: type.id,
        recipient_name: options.name ?? '',
        recipient_email: email,
      });
    if (options.send) await this.request('POST', `/api/invitations/${invitation.id}/send`);
    const link = new URL(invitation.register_link, this.url);
    return {
      id: invitation.id,
      code: invitation.invitation_code,
      email,
      registerUrl: `${link.pathname}${link.search}`,
    };
  }

  /**
   * The emails the server sent about the event (its outbox), newest first,
   * with what each said. Email is recorded as the request that sends it ends,
   * so after a registration it's there when the page has moved on; to wait
   * for one: `await expect.poll(async () => (await admin.emails({ to })).length).toBe(1)`.
   */
  async emails(options: EmailsOptions = {}): Promise<SentEmail[]> {
    const query = new URLSearchParams({ event: String(this.eventId) });
    if (options.to) query.set('q', address(options.to));
    if (options.kind) query.set('kind', options.kind);
    const listed: { id: number, to: string }[] = [];
    let next: string | null = `/api/emailmessages/?${query}`;
    while (next) {
      const page: Page<{ id: number, to: string }> = await this.request('GET', next);
      listed.push(...page.results);
      next = page.next;
    }
    // (q matches part of the recipient or subject)
    const wanted = options.to ? listed.filter(m => address(m.to) === address(options.to ?? '')) : listed;
    const messages = await Promise.all(wanted.map(m => this.request<EmailMessage>('GET', `/api/emailmessages/${m.id}/`)));
    return messages.map(m => ({
      id: m.id,
      kind: m.kind,
      status: m.status,
      to: m.to,
      from: m.from_email,
      replyTo: m.reply_to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      lastError: m.last_error,
      registration: m.registration,
      invitation: m.invitation,
    }));
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = new URL(path, this.url);
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Token ${this.token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${url.pathname} answered ${response.status}: ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
