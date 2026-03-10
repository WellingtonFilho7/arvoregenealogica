class TTLCache {
  constructor() {
    this.storage = new Map();
  }

  get(key) {
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

  set(key, value, ttlMs) {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  getOrSet(key, ttlMs, resolver) {
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
