// PRNG determinístico (mulberry32). O estado interno é um único uint32 (`a`),
// então dá pra pausar/retomar em O(1) — nada de "replay" da sequência.

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// seedInput: string ou número (semente). resumeState: uint32 opcional para
// retomar exatamente de onde uma sessão anterior parou.
export function createRng(seedInput, resumeState) {
  let a = resumeState != null
    ? resumeState >>> 0
    : (typeof seedInput === 'number' ? seedInput >>> 0 : hashSeed(seedInput));

  function nextFloat() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const rng = {
    get state() { return a >>> 0; },
    float: nextFloat,
    int(min, max) { return Math.floor(nextFloat() * (max - min + 1)) + min; },
    range([min, max]) { return min + nextFloat() * (max - min); },
    rangeInt([min, max]) { return Math.round(min + nextFloat() * (max - min)); },
    chance(p) { return nextFloat() < p; },
    pick(arr) { return arr[Math.floor(nextFloat() * arr.length)]; },
    weighted(items, weightFn = (x) => x.peso ?? 1) {
      const weights = items.map((it) => Math.max(0, weightFn(it)));
      const total = weights.reduce((s, w) => s + w, 0);
      if (total <= 0) return rng.pick(items);
      let r = nextFloat() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    shuffle(arr) {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(nextFloat() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    gauss(mean = 0, sd = 1) {
      const u = 1 - nextFloat();
      const v = nextFloat();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return rng;
}

// Stream independente e determinístico, semeado por um rótulo — O(1), não
// consome nem depende da sequência principal.
export function streamRng(seed, ...labels) {
  return createRng(hashSeed(`${seed}|${labels.join('|')}`));
}

export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}
