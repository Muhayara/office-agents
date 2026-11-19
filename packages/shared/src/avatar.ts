/**
 * Konfigurasi avatar (rencana-fpv-dan-kustomisasi-karakter.md §3.3), dipakai bersama klien & server.
 *
 * Warna disimpan sebagai INDEKS palet terkurasi (bukan hex bebas): gaya visual konsisten dan validasi
 * sederhana. Palet warnanya sendiri ada di klien (`office-next/src/stage/avatar/config.ts`).
 */
import { z } from 'zod';

export const AVATAR_BODIES = ['tegap', 'ramping', 'netral'] as const;
export const AVATAR_HAIRS = ['botak', 'cepak', 'belah_samping', 'ikal', 'kuncir', 'bob', 'hijab'] as const;
export const AVATAR_TOPS = ['kemeja', 'kaos', 'hoodie', 'blazer'] as const;
export const AVATAR_BOTTOMS = ['celana_kain', 'jeans', 'rok', 'chino'] as const;
export const AVATAR_SHOES = ['sneaker', 'pantofel', 'loafer'] as const;

/** Ukuran palet (indeks 0..n-1). */
export const AVATAR_PALETTE_SIZE = { skin: 8, hair: 8, cloth: 12, shoes: 8 } as const;

/** `height` 1,0 = 1,70 m; tamu 0,94–1,06 (1,60–1,80 m), agen selalu 1,0 (K1). */
export const AVATAR_HEIGHT_MIN = 0.94;
export const AVATAR_HEIGHT_MAX = 1.06;

const idx = (n: number) => z.number().int().min(0).max(n - 1);

export const AvatarConfigSchema = z.object({
  v: z.literal(1),
  body: z.enum(AVATAR_BODIES),
  height: z.number().min(AVATAR_HEIGHT_MIN).max(AVATAR_HEIGHT_MAX),
  skin: idx(AVATAR_PALETTE_SIZE.skin),
  hair: z.enum(AVATAR_HAIRS),
  /** Indeks palet rambut; untuk hijab = indeks 8 warna pertama palet kain. */
  hairColor: idx(AVATAR_PALETTE_SIZE.hair),
  top: z.enum(AVATAR_TOPS),
  /** Warna luar (blazer / kaos / hoodie / kemeja). */
  topColor: idx(AVATAR_PALETTE_SIZE.cloth),
  /** Kemeja dalam (hanya untuk blazer). */
  innerColor: idx(AVATAR_PALETTE_SIZE.cloth),
  bottom: z.enum(AVATAR_BOTTOMS),
  bottomColor: idx(AVATAR_PALETTE_SIZE.cloth),
  shoes: z.enum(AVATAR_SHOES),
  shoesColor: idx(AVATAR_PALETTE_SIZE.shoes),
  acc: z.object({ glasses: z.boolean(), headphones: z.boolean(), lanyard: z.boolean(), tie: z.boolean() }).strict(),
  name: z.string().trim().min(1).max(24).regex(/^[\p{L}\p{N} .'\-]+$/u),
  title: z.string().trim().max(28).regex(/^[\p{L}\p{N} .'\-—]*$/u).optional(),
}).strict();

export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;
export type AvatarBody = AvatarConfig['body'];
export type AvatarHair = AvatarConfig['hair'];
export type AvatarTop = AvatarConfig['top'];
export type AvatarBottom = AvatarConfig['bottom'];
export type AvatarShoes = AvatarConfig['shoes'];

/** Validasi tanpa melempar (dipakai server untuk `PUT /api/me/avatar` di F5). */
export function parseAvatarConfig(input: unknown): { ok: true; value: AvatarConfig } | { ok: false; error: string } {
  const r = AvatarConfigSchema.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
}
