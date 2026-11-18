/**
 * PRNG ber-seed (mulberry32) untuk sutradara dunia (F2). Semua keacakan rutinitas lewat sini,
 * sehingga simulasi dengan seed + input yang sama selalu menghasilkan keadaan yang sama.
 */
export interface Rng {
  /** 0 ≤ n < 1 */
  next(): number;
  rand(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Salinan acak (Fisher–Yates). */
  shuffle<T>(arr: readonly T[]): T[];
  /** Keadaan internal (untuk snapshot / uji determinisme). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    rand: (a, b) => a + next() * (b - a),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)]!,
    shuffle: <T>(arr: readonly T[]) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    state: () => s,
  };
}
