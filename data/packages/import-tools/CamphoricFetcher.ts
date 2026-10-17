import type { FetchMethod } from '@camphoric/camphoric-event-import-spec';
import { getAuthToken } from './getAuthInfo.ts';

const tryFetchAgainAfterMs = 2000;
const tryFetchAgainOnTheseErrors = ['ECONNRESET', 'UND_ERR_SOCKET'];

const fetchMethods: FetchMethod[] = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];

/** An Error carrying the event it happened in and what was being attempted. */
export interface CamphoricFetcherError extends Error {
  eventName: string;
  data: unknown[];
}

export default class CamphoricFetcher {
  urlBase: string;
  token?: string;
  // The event being imported, when there is one (named in logs and errors)
  data?: { event: { name: string } };

  constructor(url?: string) {
    this.urlBase = url || process.env.CAMPHORIC_URL || 'http://django:8000';

    // remove trailing slash from urlBase
    if (this.urlBase.charAt(this.urlBase.length - 1) === '/') {
      this.urlBase = this.urlBase.substring(0, this.urlBase.length - 1);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetch(method: FetchMethod, path: string, data?: unknown): Promise<any> {
    if (!fetchMethods.includes(method)) {
      throw new Error(`invalid fetch method '${method}'`);
    }

    const token = await this.getAuthToken();
    // normalize parts with slashes
    let url;
    try {
      url = this.url(path);
    } catch (e) {
      throw this.error(e, {type: 'pathError', method, path, data});
    }

    const runFetch = async (attempt = 1): Promise<{ response: Response, text: string }> => {
      let text: string | undefined;
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
            credentials: 'same-origin',
          },
          body: (data ? JSON.stringify(data) : undefined),
        });

        text = await response.text();

        return { response, text };
      } catch(e) {
        const code = ((e as Error).cause as { code?: string } | undefined)?.code;
        if (attempt <= 5 && code && tryFetchAgainOnTheseErrors.includes(code)) {
          this.logVerbose(`got ECONNRESET on ${method} ${url}, trying again in ${tryFetchAgainAfterMs}ms`);
          await this.wait(tryFetchAgainAfterMs);

          return runFetch(attempt + 1);
        }

        throw this.error(e, {type: 'fetchError', method, url, text, data});
      }
    };

    const { response, text } = await runFetch();
    let json;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch(e) {
        throw this.error(e, {type: 'jsonParse', method, url, text, data});
      }
    }

    if (response.status >= 400) {
      throw this.error(
        `server responded ${response.status}`,
        {method, url, text, data},
      );
    }

    // An empty body (a 204) leaves nothing to attach the response to.
    if (json && typeof json === 'object') {
      json.response = response;
    }


    return json;
  }

  url(path: string): string {
    return [this.urlBase, path]
      .map(p => p.charAt(0) === '/' ? p.substring(1) : p)
      .map(p => p.charAt(p.length - 1) === '/' ? p.substring(0, p.length - 1) : p)
      .concat([''])
      .join('/');
  }

  error(e: unknown, ...data: unknown[]): CamphoricFetcherError {
    const err = (e instanceof Error ? e : new Error(String(e))) as CamphoricFetcherError;

    err.eventName = this.data?.event.name || 'NoEventSet';
    err.data = [
      ...(err.data || []),
      ...data,
    ];
    err.name = 'CamphoricFetcherError';

    return err;
  };

  log(...data: unknown[]) {
    const eventName = this.data?.event.name || 'NoEventSet';

    data.forEach(
      (item) => console.log(`[${eventName}]`, item)
    );
  };

  // log if verbose
  logVerbose(...data: unknown[]) {
    if (!process?.env?.VERBOSE) return;

    this.log(...data);
  };

  async getAuthToken(): Promise<string> {
    if (!this.token) {
      this.token = await getAuthToken(this.urlBase);
    }

    return this.token;
  }

  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
