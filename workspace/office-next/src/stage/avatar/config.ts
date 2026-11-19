/**
 * F1 (rencana-fpv-dan-kustomisasi-karakter.md §3.2–§3.3): palet terkurasi & seragam agen.
 *
 * `AvatarConfig` (skema Zod) ada di `@office/shared`; di sini hanya warna hex per indeks palet,
 * seragam agen Navy Tech (K7 final), dan proporsi tubuh 1,70 m (§2.2).
 */
import type { AvatarConfig } from '@office/shared';

/** 8 warna kulit, terang → gelap. */
export const SKIN_PALETTE = [0xf5d7c0, 0xebc2a0, 0xdda97f, 0xc98e63, 0xb0744a, 0x8e5a38, 0x6e4429, 0x4e2f1d] as const;
/** 8 warna rambut: hitam, cokelat tua, cokelat, merah bata, pirang, perak, navy, pastel. */
export const HAIR_PALETTE = [0x141414, 0x3b2618, 0x5c3a21, 0x7a3420, 0xc9a25a, 0xb8bcc2, 0x1f2a44, 0xd8a1b8] as const;
/**
 * 12 warna kain: 0 hitam arang, 1 hitam pekat, 2 navy tua, 3 biru royal, 4 biru elektrik, 5 abu tua,
 * 6 abu muda, 7 putih, 8 khaki, 9 hijau zaitun, 10 marun, 11 terakota. Hijab memakai 8 warna pertama.
 */
export const CLOTH_PALETTE = [
  0x121417, 0x0e0f12, 0x13233f, 0x1f4fbf, 0x3b82f6, 0x374151,
  0x9ca3af, 0xf1f5f9, 0xc8b48a, 0x4d5b3a, 0x6b1e2e, 0xb45a3c,
] as const;
/** 8 warna sepatu: hitam, cokelat tua, cokelat, putih, abu, navy, merah, krem. */
export const SHOE_PALETTE = [0x0b0c0e, 0x3b2618, 0x6b4423, 0xf1f5f9, 0x6b7280, 0x1f2a44, 0x9f1239, 0xd6c7a1] as const;

export const pick = (pal: readonly number[], i: number) => pal[Math.max(0, Math.min(pal.length - 1, Math.round(i)))] ?? pal[0]!;

/** Proporsi §2.2 untuk `height` 1,0 (1,70 m). Semua tinggi dari lantai. */
export const BODY = {
  top: 1.70,
  eye: 1.58,
  shoulder: 1.38,
  /** Sendi pinggul (pangkal paha). */
  hipJoint: 0.87,
  /** Tulang `hips` (pusat panggul) di atas sendi pinggul. */
  pelvisAbove: 0.06,
  knee: 0.47,
  ankle: 0.07,
  thigh: 0.40,
  shin: 0.40,
  upperArm: 0.29,
  forearm: 0.25,
  shoulderX: 0.19,
  hipX: 0.095,
  /** Sendi pinggul di atas permukaan dudukan saat duduk (paha r 0,08 → bawah paha ±1 cm di atas dudukan). */
  hipAboveSeat: 0.09,
} as const;

/**
 * K7 (final, 18 Nov): seragam agen = varian 2 **Navy Tech**. Blazer navy tua, kemeja dalam hitam,
 * celana kain hitam, pantofel hitam, piping kerah & saku biru elektrik `#3B82F6`.
 */
export const AGENT_UNIFORM = {
  name: 'Navy Tech',
  top: 'blazer',
  topColor: 2,
  innerColor: 1,
  bottom: 'celana_kain',
  bottomColor: 0,
  shoes: 'pantofel',
  shoesColor: 0,
  /** Aksen khusus seragam agen (bukan bagian AvatarConfig tamu). */
  trim: 0x3b82f6,
} as const satisfies Partial<AvatarConfig> & { name: string; trim: number };

export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1,
  body: 'netral',
  height: 1,
  skin: 3,
  hair: 'cepak',
  hairColor: 0,
  top: AGENT_UNIFORM.top,
  topColor: AGENT_UNIFORM.topColor,
  innerColor: AGENT_UNIFORM.innerColor,
  bottom: AGENT_UNIFORM.bottom,
  bottomColor: AGENT_UNIFORM.bottomColor,
  shoes: AGENT_UNIFORM.shoes,
  shoesColor: AGENT_UNIFORM.shoesColor,
  acc: { glasses: false, headphones: false, lanyard: false, tie: false },
  name: 'Tamu',
};

/** Opsi bangun yang bukan bagian AvatarConfig (hanya agen). */
export interface BuildExtras {
  /** Warna piping kerah & saku (seragam agen). */
  trim?: number;
  /** Garis warna identitas agen di kartu ID jepit (K7: identitas tetap ada selain di beacon). */
  idColor?: number;
}
