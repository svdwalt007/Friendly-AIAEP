/**
 * @file Vitest setup — jsdom storage + matchMedia shim (mirrors aep-builder).
 *
 * Node 24+ exposes an experimental `globalThis.localStorage` (and
 * `sessionStorage`) that resolves to a null-storage stub unless launched
 * with `--localstorage-file=…`. That built-in masks the jsdom-backed
 * storage on `window`, so specs that touch `localStorage.clear()` or
 * `.getItem()` blow up with "is not a function". Install an in-memory
 * Storage implementation on both `globalThis` and `window` before each
 * test.
 */
function makeMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key, value) => {
      data.set(String(key), String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    key: (index) => {
      let i = 0;
      for (const k of data.keys()) {
        if (i === index) return k;
        i++;
      }
      return null;
    },
  };
}

function installStorageShim(): void {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    const existing = (globalThis as unknown as Record<string, unknown>)[key];
    if (!existing || typeof (existing as Storage).clear !== 'function') {
      const fresh = makeMemoryStorage();
      Object.defineProperty(globalThis, key, {
        value: fresh,
        configurable: true,
        writable: true,
      });
      if (typeof window !== 'undefined') {
        Object.defineProperty(window, key, {
          value: fresh,
          configurable: true,
          writable: true,
        });
      }
    }
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
}

installStorageShim();

if (typeof beforeEach === 'function') {
  beforeEach(() => {
    installStorageShim();
  });
}
