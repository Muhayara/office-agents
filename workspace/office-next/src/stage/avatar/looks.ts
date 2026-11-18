/**
 * F0 (rencana-fpv-dan-kustomisasi-karakter.md §3.3): palet terkurasi, 3 varian seragam agen hitam-biru,
 * dan usulan rambut / kulit / bentuk tubuh per agen (direvisi CEO di F1).
 *
 * Warna disimpan sebagai indeks palet (bukan hex bebas) supaya nanti cocok dengan `AvatarConfig`.
 */

/** 8 warna kulit, terang → gelap. */
export const SKIN_PALETTE = [0xf5d7c0, 0xebc2a0, 0xdda97f, 0xc98e63, 0xb0744a, 0x8e5a38, 0x6e4429, 0x4e2f1d] as const;
/** 8 warna rambut: hitam, cokelat tua, cokelat, merah bata, pirang, perak, navy, pastel. */
export const HAIR_PALETTE = [0x141414, 0x3b2618, 0x5c3a21, 0x7a3420, 0xc9a25a, 0xb8bcc2, 0x1f2a44, 0xd8a1b8] as const;

export type HairStyle = 'botak' | 'cepak' | 'belah_samping' | 'ikal' | 'kuncir' | 'bob' | 'hijab';
export type BodyShape = 'tegap' | 'ramping' | 'netral';

export interface AgentLook {
  body: BodyShape;
  skin: number;
  hair: HairStyle;
  hairColor: number;
  glasses: boolean;
}

/** Usulan awal per agen (bukan keputusan CEO). Hijab hanya bila dipilih CEO (§3.3). */
export const AGENT_LOOKS: Record<string, AgentLook> = {
  raka:   { body: 'tegap',   skin: 3, hair: 'belah_samping', hairColor: 0, glasses: false },
  sari:   { body: 'ramping', skin: 2, hair: 'bob',           hairColor: 1, glasses: false },
  dimas:  { body: 'netral',  skin: 4, hair: 'cepak',         hairColor: 0, glasses: false },
  bima:   { body: 'tegap',   skin: 5, hair: 'ikal',          hairColor: 0, glasses: false },
  gita:   { body: 'ramping', skin: 2, hair: 'kuncir',        hairColor: 1, glasses: false },
  tari:   { body: 'ramping', skin: 3, hair: 'bob',           hairColor: 0, glasses: true },
  wulan:  { body: 'netral',  skin: 1, hair: 'kuncir',        hairColor: 3, glasses: false },
  laras:  { body: 'ramping', skin: 4, hair: 'ikal',          hairColor: 2, glasses: true },
  fajar:  { body: 'netral',  skin: 3, hair: 'cepak',         hairColor: 0, glasses: true },
  satria: { body: 'tegap',   skin: 5, hair: 'botak',         hairColor: 0, glasses: false },
};

export const DEFAULT_LOOK: AgentLook = { body: 'netral', skin: 3, hair: 'cepak', hairColor: 0, glasses: false };

export type UniformVariant = 1 | 2 | 3;

/** Keputusan CEO 18 Nov (K7, hasil F0 §10.1): Navy Tech, paling terbaca dari kamera isometrik. */
export const AGENT_UNIFORM: UniformVariant = 2;

export interface UniformSpec {
  id: UniformVariant;
  name: string;
  outer: number;
  inner: number;
  bottom: number;
  shoes: number;
  /** Aksen: lanyard + kartu ID (1), piping kerah & saku (2), dasi (3). */
  accent: 'lanyard' | 'piping' | 'tie';
  accentColor: number;
}

/** Tabel §3.3 (K7). Varian 1 = rekomendasi awal; hasil F0 lihat §10.1. */
export const UNIFORMS: Record<UniformVariant, UniformSpec> = {
  1: { id: 1, name: 'Midnight Blue',     outer: 0x15181d, inner: 0x1f4fbf, bottom: 0x121417, shoes: 0x0b0c0e, accent: 'lanyard', accentColor: 0x3b82f6 },
  2: { id: 2, name: 'Navy Tech',         outer: 0x13233f, inner: 0x0e0f12, bottom: 0x121417, shoes: 0x0b0c0e, accent: 'piping',  accentColor: 0x3b82f6 },
  3: { id: 3, name: 'Corporate Classic', outer: 0x121417, inner: 0xf1f5f9, bottom: 0x121417, shoes: 0x0b0c0e, accent: 'tie',     accentColor: 0x1e40af },
};
