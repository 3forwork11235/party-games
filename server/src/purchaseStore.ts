import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface StoredPurchase {
  productId: string;
  purchaseToken: string;
}

type Data = Record<string, StoredPurchase[]>;

/** Простое JSON-хранилище покупок: userId → покупки. Запись через temp-файл. */
export class PurchaseStore {
  private data: Data = {};
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = join(dataDir, 'purchases.json');
    if (existsSync(this.file)) {
      try {
        this.data = JSON.parse(readFileSync(this.file, 'utf8')) as Data;
      } catch {
        this.data = {};
      }
    }
  }

  list(userId: number | string): StoredPurchase[] {
    return [...(this.data[String(userId)] ?? [])];
  }

  /** Идемпотентно по purchaseToken. */
  add(userId: number | string, purchase: StoredPurchase): void {
    const key = String(userId);
    const list = (this.data[key] ??= []);
    if (list.some((p) => p.purchaseToken === purchase.purchaseToken)) return;
    list.push(purchase);
    this.save();
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
  }
}
