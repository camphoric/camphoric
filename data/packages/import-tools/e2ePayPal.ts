/**
 * PayPal, faked for an event's e2e tests. The throwaway server's PayPal API is
 * e2eFakePayPal.py, and the browser's PayPal script is FAKE_PAYPAL_SDK (the
 * `test` fixture serves it in place of PayPal's), so the payment step's
 * PayPal buttons work without a PayPal account and nothing is paid.
 */

/** What the server asked PayPal for, as e2eFakePayPal.py recorded it. */
export interface PayPalOrder {
  // PayPal's order id, as the browser was given it
  id: string;
  // The order's amount as the server sent it, e.g. '102.50' (a string, so
  // its decimal places can be checked), and its currency
  amount: string;
  currency: string;
  // The whole request the server sent to create the order
  body: Record<string, unknown>;
}

interface RecordedOrder {
  id: string;
  body: { purchase_units?: { amount?: { value?: string, currency_code?: string } }[] };
}

// The client id an event is imported with for online payment (e2eImport.ts):
// only the fakes accept it
export const E2E_PAYPAL_CLIENT_ID = 'camphoric-e2e-fake-paypal';

// PayPal's script, wherever the client loads it from
export const PAYPAL_SDK_URL = /^https:\/\/www\.(sandbox\.)?paypal\.com\/sdk\/js(\?|$)/;

/** The fake PayPal API's record of the orders the server created. */
export class FakePayPal {
  readonly url: string;

  constructor(url: string) {
    this.url = url.replace(/\/$/, '');
  }

  /** Every order the server created, oldest first. */
  async orders(): Promise<PayPalOrder[]> {
    const recorded = await this.get('/e2e/orders') as RecordedOrder[];
    return recorded.map(order);
  }

  /** The order with this id, as the server asked for it. */
  async order(id: string): Promise<PayPalOrder> {
    return order(await this.get(`/e2e/orders/${encodeURIComponent(id)}`) as RecordedOrder);
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.url}${path}`);
    if (!response.ok) {
      throw new Error(`the fake PayPal answered ${response.status} to ${path}: ${await response.text()}`);
    }
    return response.json();
  }
}

function order(recorded: RecordedOrder): PayPalOrder {
  const amount = recorded.body.purchase_units?.[0]?.amount;
  return {
    id: recorded.id,
    amount: amount?.value ?? '',
    currency: amount?.currency_code ?? '',
    body: recorded.body as Record<string, unknown>,
  };
}

/**
 * PayPal's browser script, faked: `paypal.Buttons()` draws a "PayPal" and a
 * "Debit or Credit Card" button, as the client's PayPal library expects. A
 * click does what PayPal's does up to its popup: onClick, then createOrder
 * (which asks the server for the order). The popup then stays "open": the
 * payer never approves or cancels, so nothing is captured.
 */
export const FAKE_PAYPAL_SDK = `(() => {
  const buttons = [['paypal', 'PayPal'], ['card', 'Debit or Credit Card']];
  window.paypal = {
    version: 'camphoric-e2e-fake',
    FUNDING: { PAYPAL: 'paypal', CARD: 'card' },
    Buttons(props) {
      let container = null;
      let disabled = false;
      const actions = {
        enable: () => { disabled = false; return Promise.resolve(); },
        disable: () => { disabled = true; return Promise.resolve(); },
      };
      const pay = async (fundingSource) => {
        if (disabled) return;
        const data = { fundingSource };
        const clickActions = { resolve: () => Promise.resolve(), reject: () => Promise.resolve() };
        if (props.onClick && (await props.onClick(data, clickActions)) === false) return;
        try {
          await props.createOrder(data, {});
        } catch (error) {
          if (props.onError) props.onError(error);
        }
      };
      return {
        isEligible: () => true,
        render(target) {
          container = typeof target === 'string' ? document.querySelector(target) : target;
          const box = document.createElement('div');
          box.setAttribute('data-camphoric-e2e-paypal', '');
          for (const [fundingSource, label] of buttons) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', () => { pay(fundingSource); });
            box.appendChild(button);
          }
          container.appendChild(box);
          if (props.onInit) props.onInit({}, actions);
          return Promise.resolve();
        },
        updateProps: () => Promise.resolve(),
        close() {
          if (container) container.replaceChildren();
          return Promise.resolve();
        },
      };
    },
  };
})();
`;
