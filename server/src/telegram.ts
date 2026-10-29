import express, { type Express, type Request, type Response } from 'express';
import { DEFAULT_CATALOG } from '@party/monetization';
import { PurchaseStore } from './purchaseStore.js';
import { validateInitData } from './telegramAuth.js';

interface TgApiResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface TgUpdate {
  pre_checkout_query?: { id: string };
  message?: {
    from?: { id: number };
    successful_payment?: { invoice_payload?: string; telegram_payment_charge_id?: string };
  };
}

export interface TelegramOptions {
  botToken: string | undefined;
  dataDir: string;
  webhookSecret?: string | undefined;
}

async function callApi<T>(token: string, method: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as TgApiResult<T>;
    return json.ok ? (json.result ?? null) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function mountTelegram(app: Express, opts: TelegramOptions): void {
  const { botToken } = opts;
  const store = new PurchaseStore(opts.dataDir);

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  const json = express.json({ limit: '64kb' });

  const requireToken = (res: Response): string | null => {
    if (!botToken) {
      res.status(501).json({ error: 'telegram_not_configured' });
      return null;
    }
    return botToken;
  };

  app.post('/api/tg/invoice', json, async (req: Request, res: Response) => {
    const token = requireToken(res);
    if (!token) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const auth = validateInitData(str(body.initData), token);
    if (!auth) return void res.status(401).json({ error: 'bad_init_data' });
    const product = DEFAULT_CATALOG.find((p) => p.id === str(body.productId));
    if (!product || !product.starsPrice) {
      return void res.status(404).json({ error: 'unknown_product' });
    }
    const link = await callApi<string>(token, 'createInvoiceLink', {
      title: product.id.slice(0, 32),
      description: product.id,
      payload: JSON.stringify({ productId: product.id, userId: auth.user.id }),
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: product.id.slice(0, 32), amount: product.starsPrice }],
    });
    if (!link) return void res.status(502).json({ error: 'telegram_api_error' });
    res.json({ invoiceLink: link });
  });

  app.post('/api/tg/webhook', json, async (req: Request, res: Response) => {
    const token = requireToken(res);
    if (!token) return;
    if (
      opts.webhookSecret &&
      req.header('x-telegram-bot-api-secret-token') !== opts.webhookSecret
    ) {
      return void res.sendStatus(403);
    }
    const update = (req.body ?? {}) as TgUpdate;
    if (update.pre_checkout_query) {
      await callApi(token, 'answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
    }
    const payment = update.message?.successful_payment;
    if (payment?.invoice_payload && payment.telegram_payment_charge_id) {
      try {
        const p = JSON.parse(payment.invoice_payload) as { productId?: unknown; userId?: unknown };
        const userId = update.message?.from?.id ?? p.userId;
        if (
          typeof p.productId === 'string' &&
          (typeof userId === 'number' || typeof userId === 'string')
        ) {
          store.add(userId, {
            productId: p.productId,
            purchaseToken: payment.telegram_payment_charge_id,
          });
        }
      } catch {
        /* битый payload — игнорируем */
      }
    }
    res.json({ ok: true });
  });

  app.get('/api/tg/purchases', (req: Request, res: Response) => {
    const token = requireToken(res);
    if (!token) return;
    const raw = req.query.initData;
    const auth = validateInitData(typeof raw === 'string' ? raw : '', token);
    if (!auth) return void res.status(401).json({ error: 'bad_init_data' });
    res.json({ purchases: store.list(auth.user.id) });
  });
}
