import { useSyncExternalStore } from 'react';

/**
 * A tiny localStorage-backed store read through useSyncExternalStore:
 * no load-in-an-effect flash, stays in sync across tabs (storage events),
 * and the server render always sees `empty`. `parse` turns whatever is
 * stored (including older formats) into the current shape.
 */
export function createPersistedStore<T>(key: string, empty: T, parse: (raw: unknown) => T) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T = empty;

  function read(): T {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return empty;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cachedValue = raw ? parse(JSON.parse(raw)) : empty;
      } catch {
        cachedValue = empty; // corrupt storage — start fresh
      }
    }
    return cachedValue;
  }

  function write(next: T) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // storage full/unavailable — keep it in memory for this page
      cachedRaw = undefined;
      cachedValue = next;
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === key && listener();
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  return {
    get: read,
    set: (update: (prev: T) => T) => write(update(read())),
    useValue: () => useSyncExternalStore(subscribe, read, () => empty),
  };
}
