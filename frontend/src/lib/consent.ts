/**
 * The visitor's privacy choice for non-essential tracking (today: the Meta
 * Pixel, lib/metaPixel.ts). OPT-IN: until the visitor explicitly accepts,
 * `marketingAllowed()` is false — no choice, a rejected choice, an unreadable
 * or outdated record all mean "no".
 *
 * Framework-free (unit-tested with `npm test`); components use it through
 * lib/analytics.ts. Stored in localStorage as {marketing, decidedAt, version};
 * bumping CONSENT_VERSION (e.g. when what's collected changes) asks again.
 *
 * Essential storage (cart, sign-in, this choice itself) needs no consent and
 * isn't covered here.
 */

export const CONSENT_KEY = 'ecobel_consent';
export const CONSENT_VERSION = 1;

export interface ConsentChoice {
  marketing: boolean;
  decidedAt: string;
  version: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function parse(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || v.version !== CONSENT_VERSION || typeof v.marketing !== 'boolean') return null;
    return { marketing: v.marketing, decidedAt: String(v.decidedAt ?? ''), version: v.version };
  } catch {
    return null;
  }
}

export function createConsentStore(storage: KeyValueStore | null, now: () => Date = () => new Date()) {
  let current: ConsentChoice | null | undefined; // undefined = not read yet
  const listeners = new Set<(c: ConsentChoice | null) => void>();

  function read(): ConsentChoice | null {
    try {
      return parse(storage?.getItem(CONSENT_KEY) ?? null);
    } catch {
      return null;
    }
  }

  function notify() {
    for (const l of listeners) l(current ?? null);
  }

  return {
    /** The recorded choice, or null if the visitor hasn't decided. */
    get(): ConsentChoice | null {
      if (current === undefined) current = read();
      return current;
    },
    /** True only after an explicit "accept". */
    marketingAllowed(): boolean {
      return this.get()?.marketing === true;
    },
    /** Records an explicit choice (accept = true, reject = false). */
    set(marketing: boolean): ConsentChoice {
      const choice = { marketing, decidedAt: now().toISOString(), version: CONSENT_VERSION };
      current = choice;
      try {
        storage?.setItem(CONSENT_KEY, JSON.stringify(choice));
      } catch {
        // storage blocked: the choice holds for this visit only
      }
      notify();
      return choice;
    },
    /** Re-reads storage (another tab changed it). */
    refresh(): void {
      const next = read();
      if (JSON.stringify(next) === JSON.stringify(current ?? null)) return;
      current = next;
      notify();
    },
    subscribe(listener: (c: ConsentChoice | null) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ConsentStore = ReturnType<typeof createConsentStore>;
