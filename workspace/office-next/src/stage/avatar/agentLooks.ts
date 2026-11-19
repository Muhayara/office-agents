/**
 * Tampilan per agen (K7): semua memakai seragam Navy Tech; yang berbeda hanya bentuk tubuh, kulit,
 * rambut, warna rambut, dan kacamata. Usulan F0 disetujui CEO 19 Nov (rencana §8.2).
 */
import type { AvatarConfig } from '@office/shared';
import { AGENT_UNIFORM, DEFAULT_AVATAR } from './config';

export interface AgentLook {
  body: AvatarConfig['body'];
  /** Indeks SKIN_PALETTE (0 = paling terang). */
  skin: number;
  hair: AvatarConfig['hair'];
  hairColor: number;
  glasses: boolean;
}

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

/** AvatarConfig lengkap untuk satu agen (seragam + tampilan pribadi). */
export function agentAvatarConfig(agentId: string, name: string): AvatarConfig {
  const look = AGENT_LOOKS[agentId] ?? { body: 'netral', skin: 3, hair: 'cepak', hairColor: 0, glasses: false };
  return {
    ...DEFAULT_AVATAR,
    body: look.body,
    skin: look.skin,
    hair: look.hair,
    hairColor: look.hairColor,
    top: AGENT_UNIFORM.top,
    topColor: AGENT_UNIFORM.topColor,
    innerColor: AGENT_UNIFORM.innerColor,
    bottom: AGENT_UNIFORM.bottom,
    bottomColor: AGENT_UNIFORM.bottomColor,
    shoes: AGENT_UNIFORM.shoes,
    shoesColor: AGENT_UNIFORM.shoesColor,
    acc: { glasses: look.glasses, headphones: false, lanyard: false, tie: false },
    name: name.slice(0, 24) || 'Agen',
  };
}
