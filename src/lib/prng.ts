// Mulberry32 seeded PRNG
export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function createSeededRandom(seed: string) {
  const numSeed = seedFromString(seed);
  const rng = mulberry32(numSeed);
  return {
    next: rng,
    pick: <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)],
    pickN: <T>(arr: T[], n: number): T[] => {
      const copy = [...arr];
      const result: T[] = [];
      for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(rng() * copy.length);
        result.push(copy.splice(idx, 1)[0]);
      }
      return result;
    },
    range: (min: number, max: number): number =>
      Math.floor(rng() * (max - min + 1)) + min,
  };
}
