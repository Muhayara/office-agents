/**
 * Mode grafis panggung (rencana-optimasi-performa-3d.md §2.1).
 * - `low`  (Hemat, bawaan): 0 PointLight, tanpa shadow map (bayangan kontak palsu), pixel ratio 1,
 *          60 FPS saat kamera bergerak lalu 30 FPS setelah 1,5 dtk diam.
 * - `high` (Tinggi): pool 3 PointLight mengikuti fokus kamera, shadow map 1024 mengikuti area pandang,
 *          pixel ratio ≤ 1,5, 60 FPS.
 */
export type GraphicsQuality = 'low' | 'high';

export const GRAPHICS_STORAGE_KEY = 'office.graphicsQuality';

export function loadGraphicsQuality(): GraphicsQuality {
  try {
    return window.localStorage.getItem(GRAPHICS_STORAGE_KEY) === 'high' ? 'high' : 'low';
  } catch {
    return 'low';
  }
}

export function saveGraphicsQuality(q: GraphicsQuality) {
  try {
    window.localStorage.setItem(GRAPHICS_STORAGE_KEY, q);
  } catch {
    /* penyimpanan diblokir (mode privat): pilihan berlaku untuk sesi ini saja */
  }
}

export const QUALITY = {
  low: { pixelRatio: () => 1, shadows: false, idleFps: 30, activeFps: 60, hemi: 2.15, env: 1.12 },
  high: { pixelRatio: () => Math.min(window.devicePixelRatio || 1, 1.5), shadows: true, idleFps: 60, activeFps: 60, hemi: 1.8, env: 1 },
} as const;

/** Lama kamera dianggap masih "aktif" setelah interaksi terakhir (mode Hemat tetap 60 FPS). */
export const ACTIVE_HOLD_MS = 1500;
export const SHADOW_MAP_SIZE = 1024;
