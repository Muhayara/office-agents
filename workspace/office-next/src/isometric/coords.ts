import type { AgentRole } from '@office/shared';

export interface GridPoint {
  col: number;
  row: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;
export const ISO_GRID_COLS = 10;
export const ISO_GRID_ROWS = 8;

/**
 * Mengubah koordinat petak grid (col, row) menjadi koordinat piksel layar isometrik 2.5D.
 * Rumus standar proyeksi berlian 2:1:
 *   screenX = originX + (col - row) * (tileW / 2)
 *   screenY = originY + (col + row) * (tileH / 2)
 */
export function gridToIso(
  col: number,
  row: number,
  originX = 0,
  originY = 0,
  tileW = ISO_TILE_WIDTH,
  tileH = ISO_TILE_HEIGHT,
): ScreenPoint {
  return {
    x: originX + (col - row) * (tileW / 2),
    y: originY + (col + row) * (tileH / 2),
  };
}

/**
 * Mengubah titik piksel layar isometrik kembali menjadi koordinat grid terdekat.
 */
export function isoToGrid(
  screenX: number,
  screenY: number,
  originX = 0,
  originY = 0,
  tileW = ISO_TILE_WIDTH,
  tileH = ISO_TILE_HEIGHT,
): GridPoint {
  const dx = screenX - originX;
  const dy = screenY - originY;
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  const col = Math.round((dx / halfW + dy / halfH) / 2);
  const row = Math.round((dy / halfH - dx / halfW) / 2);
  return { col, row };
}

/**
 * Kunci pengurutan kedalaman (painter's algorithm) untuk objek isometrik:
 * objek dengan (row + col) lebih besar digambar di depan.
 */
export function computeDepthKey(col: number, row: number, layerOffset = 0): number {
  return (col + row) * 10 + layerOffset;
}

export interface OfficeZoneSpec {
  id: string;
  labelId: string;
  labelEn: string;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  accentColor: string;
  roles: AgentRole[];
}

export const OFFICE_ZONES: ReadonlyArray<OfficeZoneSpec> = [
  {
    id: 'command-hub',
    labelId: 'Zona Komando & Riset',
    labelEn: 'Command & Research Zone',
    minCol: 1,
    maxCol: 4,
    minRow: 1,
    maxRow: 2,
    accentColor: '#E9A23B',
    roles: ['manager', 'researcher', 'writer'],
  },
  {
    id: 'creative-studio',
    labelId: 'Studio Kreatif & Desain',
    labelEn: 'Creative & Design Studio',
    minCol: 1,
    maxCol: 4,
    minRow: 3,
    maxRow: 4,
    accentColor: '#9B7EDE',
    roles: ['designer', 'artist'],
  },
  {
    id: 'engineering-bay',
    labelId: 'Sayap Engineering & Game 2.5D',
    labelEn: 'Engineering & 2.5D Game Bay',
    minCol: 5,
    maxCol: 8,
    minRow: 1,
    maxRow: 4,
    accentColor: '#4DA8DA',
    roles: ['coder', 'gamedev'],
  },
  {
    id: 'qa-security-vault',
    labelId: 'Zona QA, Review & Keamanan',
    labelEn: 'QA, Review & Security Zone',
    minCol: 1,
    maxCol: 8,
    minRow: 5,
    maxRow: 6,
    accentColor: '#5CC8A1',
    roles: ['reviewer', 'visual_qa', 'security'],
  },
];
