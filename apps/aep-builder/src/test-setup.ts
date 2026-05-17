/**
 * @file Vitest setup — jsdom storage + matchMedia shim.
 *
 * Node 24+ exposes an experimental `globalThis.localStorage` (and
 * `sessionStorage`) that resolves to a null-storage stub unless launched
 * with `--localstorage-file=…`. That built-in masks the jsdom-backed
 * storage on `window`, so specs that touch `localStorage.clear()` or
 * `.getItem()` blow up with "is not a function". Install an in-memory
 * Storage implementation on both `globalThis` and `window` before each
 * test (the shim is re-installed per test in case a TestBed reset swaps
 * the underlying globals back to the Node built-in).
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

// Re-install before every test so a per-test jsdom reset cannot wipe the
// shim back to the Node 24+ null-storage built-in.
if (typeof beforeEach === 'function') {
  beforeEach(() => {
    installStorageShim();
  });
}
