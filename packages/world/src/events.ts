import type { ServerEvent } from '@office/shared';
import type { WorldEvent } from './sim';

/**
 * Event server → event dunia (bicara, kunjungan meja, rapat). Dulu `toStageEvents` di
 * `office-next/src/state/liveOffice.ts`; sekarang dipakai sutradara dunia di server (F2).
 */
export function worldEventsFrom(event: ServerEvent, agentIds: ReadonlySet<string>): WorldEvent[] {
  if (event.type === 'agent.say') {
    return agentIds.has(event.agentId) ? [{ kind: 'say', agentId: event.agentId, text: event.text }] : [];
  }
  if (event.type === 'message.created') {
    const m = event.message;
    // Salinan broadcast per-agen tidak dikirim ulang ke UI; pesan "all" = rapat.
    if (m.recipient === 'all' || m.kind === 'meeting') {
      const host = agentIds.has(m.sender) ? m.sender : 'raka';
      // "/rapat Evaluasi sprint" -> "Evaluasi sprint"
      const text = m.body.replace(/^\/(rapat|meeting)\s*/i, '').trim() || 'Rapat dimulai.';
      return [{ kind: 'meeting', host, text }];
    }
    if (agentIds.has(m.sender) && agentIds.has(m.recipient) && m.sender !== m.recipient) {
      return [{ kind: 'visit', from: m.sender, to: m.recipient, text: m.body, carryDoc: m.kind === 'review' || m.kind === 'handoff' }];
    }
  }
  return [];
}
