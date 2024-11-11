import { getAuthToken } from './getAuthInfo.js';

const tryFetchAgainAfterMs = 2000;
const tryFetchAgainOnTheseErrors = ['ECONNRESET', 'UND_ERR_SOCKET'];

export default class CamphoricFetcher {
  constructor(url) {
    this.urlBase = url || process.env.CAMPHORIC_URL || 'http://django:8000';

    // remove trailing slash from urlBase
    if (this.urlBase.charAt(this.urlBase.length - 1) === '/') {
      this.urlBase = this.urlBase.substring(0, this.urlBase.length - 1);
    }
  }

  async fetch(method, path, data) {
    if (!['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
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

    const runFetch = async (attempt = 1) => {
      let text;
      let response;
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
        if (attempt <= 5 && tryFetchAgainOnTheseErrors.includes(e.cause?.code)) {
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

    json.response = response;


    return json;
  }

  url(path) {
    return [this.urlBase, path]
      .map(p => p.charAt(0) === '/' ? p.substring(1) : p)
      .map(p => p.charAt(p.length - 1) === '/' ? p.substring(0, p.length - 1) : p)
      .concat([''])
      .join('/');
  }

  error(e, ...data) {
    if (!(e instanceof Error)) {
      e = new Error(e);
    }

    e.eventName = this.data?.event.name || 'NoEventSet';
    e.data = [
      ...(e.data || []),
      ...data,
    ];
    e.name = 'CamphoricFetcherError';

    return e;
  };

  log(...data) {
    const eventName = this.data?.event.name || 'NoEventSet';

    data.forEach(
      (item) => console.log(`[${eventName}]`, item)
    );
  };

  // log if verbose
  logVerbose(...data) {
    if (!process?.env?.VERBOSE) return;

    this.log(...data);
  };

  async getAuthToken() {
    if (!this.token) {
      this.token = await getAuthToken(this.urlBase);
    }

    return this.token;
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
