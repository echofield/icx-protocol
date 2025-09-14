class ICX {
  constructor() {
    this.handlers = new Map();
    this.chains = new Map();
    this.middleware = [];
  }

  on(intent, handler, chain = null) {
    const key = this.normalize(intent);
    this.handlers.set(key, handler);
    if (chain) {
      const list = (Array.isArray(chain) ? chain : [chain])
        .map(x => typeof x === 'object' ? x : { intent: x, weight: 1 })
        .map(x => ({ intent: x.intent, weight: x.weight ?? 1 }));
      this.chains.set(key, list);
    }
    return this;
  }

  fallback(intent, weight = 1.0) {
    const last = [...this.handlers.keys()].pop();
    if (!last) return this;
    const chain = this.chains.get(last) || [];
    chain.push(typeof intent === 'object' ? intent : { intent, weight });
    this.chains.set(last, chain);
    return this;
  }

  connect(name, actions) {
    Object.entries(actions).forEach(([action, handler]) => {
      this.on(`${name}:${action}`, handler);
    });
    return this;
  }

  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  async resolve(intent, params = {}, threshold = 0.5, visited = new Set()) {
    const key = this.normalize(intent);
    if (visited.has(key)) {
      return { ok: false, error: `Cycle detected: ${key}` };
    }
    visited.add(key);

    let handler = this.handlers.get(key);
    let chain = this.chains.get(key) || [];

    if (handler) {
      const result = await this.execute(handler, intent, params, key);
      if (result.ok) return result;
      const sorted = [...chain].sort((a, b) => b.weight - a.weight);
      const nextT = Math.max(threshold * 0.8, 0.1);
      for (const fallback of sorted) {
        if (fallback.weight >= threshold) {
          const fbResult = await this.resolve(fallback.intent, params, nextT, visited);
          if (fbResult.ok) return fbResult;
        }
      }
      return result;
    }

    const prefix = key.split(':')[0] + ':';
    const candidates = [...this.handlers.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));

    if (candidates.length) {
      const [matchKey, h] = candidates[0];
      return this.execute(h, intent, params, matchKey);
    }

    return { ok: false, error: `No handler for: ${key}` };
  }

  async execute(handler, intent, params, key) {
    try {
      let ctx = { intent, params, handler, key };
      for (const mw of this.middleware) {
        ctx = await mw(ctx) || ctx;
      }
      const value = await ctx.handler(ctx.params);
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  normalize(intent) {
    if (typeof intent === 'string') return intent;
    if (intent.intent) return intent.intent;
    if (intent.s && intent.a) return `${intent.s}:${intent.a}`;
    return JSON.stringify(intent);
  }

  static compose(...instances) {
    const root = new ICX();
    instances.forEach(icx => {
      icx.handlers.forEach((h, k) => root.handlers.set(k, h));
      icx.chains.forEach((c, k) => root.chains.set(k, c));
      icx.middleware.forEach(m => root.middleware.push(m));
    });
    return root;
  }
}