export {};

class TTLCache {
  storage: Map<string, { value: unknown; expiresAt: number }>;

  constructor() {
    this.storage = new Map();
  }

  get(key: string) {
    const item = this.storage.get(key);
    if (!item) {
      return undefined;
    }

    if (Date.now() > item.expiresAt) {
      this.storage.delete(key);
      return undefined;
    }

    return item.value;
  }

  set(key: string, value: unknown, ttlMs: number) {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  getOrSet(key: string, ttlMs: number, resolver: () => unknown) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = resolver();
    return this.set(key, value, ttlMs);
  }
}

module.exports = {
  TTLCache,
};
