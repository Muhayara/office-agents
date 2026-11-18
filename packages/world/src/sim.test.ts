import { describe, expect, it } from 'vitest';
import { AGENT_3D_POSITIONS, ROOM_BOARDROOM } from './layout';
import { WorldSim, type WorldAgentInfo, type WorldFrame } from './sim';
import { PUBLIC_MEETING_TOPIC, PUBLIC_REDACTED_LINES, WorldEncoder, decodeAgent, type FrameMsg } from './wire';
import { worldEventsFrom } from './events';

const AGENTS: WorldAgentInfo[] = Object.keys(AGENT_3D_POSITIONS).map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1), title: 'Agen' }));

function run(sim: WorldSim, seconds: number, dt = 0.05, each?: (f: WorldFrame) => void) {
  for (let s = 0; s < seconds; s += dt) {
    sim.step(dt);
    if (each) each(sim.frame());
  }
}

const inBoardroom = (x: number, z: number) => Math.abs(x - ROOM_BOARDROOM.origin.x) <= 4 && Math.abs(z - ROOM_BOARDROOM.origin.z) <= 4;

describe('@office/world WorldSim (F2)', () => {
  it('deterministik: seed + input sama → posisi & keadaan identik; seed lain → berbeda', () => {
    const a = new WorldSim({ agents: AGENTS, seed: 42, live: false });
    const b = new WorldSim({ agents: AGENTS, seed: 42, live: false });
    const c = new WorldSim({ agents: AGENTS, seed: 7, live: false });
    run(a, 300); run(b, 300); run(c, 300);
    expect(JSON.stringify(a.frame())).toBe(JSON.stringify(b.frame()));
    expect(JSON.stringify(a.frame().agents)).not.toBe(JSON.stringify(c.frame().agents));
  });

  it('demo 640 dtk: semua agen hadir dari Lobi, rutinitas berjalan, posisi selalu terhingga', () => {
    const sim = new WorldSim({ agents: AGENTS, seed: 1, live: false });
    const seen = new Set<string>();
    const kinds = new Set<string>();
    run(sim, 640, 0.05, (f) => {
      for (const ag of f.agents) {
        seen.add(ag.state);
        if (ag.pose) kinds.add(ag.pose);
        expect(Number.isFinite(ag.x) && Number.isFinite(ag.z) && Number.isFinite(ag.rotY)).toBe(true);
      }
    });
    for (const st of ['walk_in_from_lobby', 'working', 'brewing', 'errand_stay', 'walk_to_errand']) expect(seen.has(st)).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(sim.frame().agents.every((a) => a.vis || a.state === 'away')).toBe(true);
  });

  it('rapat: semua agen hadir duduk di Boardroom, sesi, lalu bubar dan kembali ke meja', () => {
    const sim = new WorldSim({ agents: AGENTS, seed: 3, live: true });
    for (const ag of AGENTS) sim.setStatus(ag.id, 'idle');
    run(sim, 2);
    sim.handleEvent({ kind: 'meeting', host: 'raka', text: '/rapat Evaluasi sprint rahasia' });
    let session = false, maxSeated = 0;
    run(sim, 60, 0.05, (f) => {
      if (f.props.meeting?.phase === 'session') session = true;
      maxSeated = Math.max(maxSeated, f.agents.filter((a) => a.state === 'in_meeting' && inBoardroom(a.x, a.z)).length);
    });
    expect(session).toBe(true);
    expect(maxSeated).toBe(AGENTS.length);
    run(sim, 60);
    expect(sim.frame().props.meeting).toBeNull();
    expect(sim.frame().agents.filter((a) => a.state === 'in_meeting')).toHaveLength(0);
  });

  it('antrean kopi tertib & door mutex: tidak pernah dua agen melewati pintu rapat dalam 0,8 dtk', () => {
    const sim = new WorldSim({ agents: AGENTS, seed: 5, live: false, arriveFromLobby: false });
    run(sim, 1);
    expect(sim.debug.coffee('sari')).toBe(true);
    expect(sim.debug.coffee('dimas')).toBe(true);
    expect(sim.debug.coffee('bima')).toBe(true);
    expect(sim.debug.pantryState().queue).toEqual(['sari', 'dimas', 'bima']);
    sim.debug.meeting('raka', 'Uji mutex');
    // Hitung agen yang melewati garis pintu rapat (z = origin + 4) dari luar ke dalam.
    const lastZ = new Map<string, number>();
    const crossings: number[] = [];
    run(sim, 40, 0.02, (f) => {
      for (const a of f.agents) {
        const prev = lastZ.get(a.id);
        const doorZ = ROOM_BOARDROOM.origin.z + 4.0;
        if (prev !== undefined && prev > doorZ && a.z <= doorZ && Math.abs(a.x - ROOM_BOARDROOM.origin.x) < 1.2) crossings.push(f.time);
        lastZ.set(a.id, a.z);
      }
    });
    expect(crossings.length).toBeGreaterThan(3);
    crossings.sort((a, b) => a - b);
    for (let i = 1; i < crossings.length; i++) expect(crossings[i]! - crossings[i - 1]!).toBeGreaterThanOrEqual(0.75);
  });

  it('live: offline → pulang ke Lobi & hilang; online → datang lagi; ucapan asli ditandai real', () => {
    const sim = new WorldSim({ agents: AGENTS, seed: 9, live: true });
    for (const ag of AGENTS) sim.setStatus(ag.id, ag.id === 'satria' ? 'offline' : 'working');
    run(sim, 1);
    expect(sim.frame().agents.find((a) => a.id === 'satria')!.state).toBe('away');
    sim.setStatus('satria', 'idle');
    run(sim, 0.2);
    expect(sim.frame().agents.find((a) => a.id === 'satria')!.state).toBe('walk_in_from_lobby');
    sim.handleEvent({ kind: 'say', agentId: 'bima', text: 'Token rahasia ada di file X' });
    const bima = sim.frame().agents.find((a) => a.id === 'bima')!;
    expect(bima.bubble).toContain('Token rahasia');
    expect(bima.bubbleReal).toBe(true);
  });

  it('kabel: hello + frame delta merekonstruksi posisi; publik tidak menerima ucapan asli / topik rapat', () => {
    const sim = new WorldSim({ agents: AGENTS, seed: 11, live: true });
    for (const ag of AGENTS) sim.setStatus(ag.id, 'idle');
    const enc = new WorldEncoder(AGENTS);
    const hello = enc.hello(sim.frame(), 0, 'public');
    const state = hello.a.map(decodeAgent);
    sim.handleEvent({ kind: 'say', agentId: 'raka', text: 'Isi repo: kunci API xyz' });
    sim.handleEvent({ kind: 'meeting', host: 'raka', text: 'Rencana akuisisi rahasia' });
    const publicTexts: string[] = [], fullTexts: string[] = [];
    let publicTopic = '', fullTopic = '';
    let bytes = 0, msgs = 0;
    for (let i = 0; i < 300; i++) {
      sim.step(0.05);
      if (i % 2 === 1) {
        const out = enc.tick(sim.frame(), i * 50);
        if (out.public) {
          bytes += out.public.length; msgs++;
          const m = JSON.parse(out.public) as FrameMsg;
          for (const r of m.a ?? []) state[r[0]] = decodeAgent(r);
          for (const b of m.b ?? []) publicTexts.push(b[1]);
          if (m.p?.meeting) publicTopic = m.p.meeting.topic;
        }
        if (out.full) {
          const m = JSON.parse(out.full) as FrameMsg;
          for (const b of m.b ?? []) fullTexts.push(b[1]);
          if (m.p?.meeting) fullTopic = m.p.meeting.topic;
        }
      }
    }
    const f = sim.frame();
    f.agents.forEach((a, i) => {
      expect(Math.abs(state[i]!.x - a.x)).toBeLessThan(0.011);
      expect(Math.abs(state[i]!.z - a.z)).toBeLessThan(0.011);
      expect(state[i]!.state).toBe(a.state);
    });
    expect(fullTexts.some((t) => t.includes('kunci API'))).toBe(true);
    expect(publicTexts.some((t) => t.includes('kunci API') || t.includes('akuisisi'))).toBe(false);
    expect(publicTexts.some((t) => (PUBLIC_REDACTED_LINES as readonly string[]).includes(t))).toBe(true);
    expect(fullTopic).toContain('akuisisi');
    expect(publicTopic).toBe(PUBLIC_MEETING_TOPIC);
    // Puncak (10 agen berjalan ke rapat bersamaan): < 4 KB/dtk JSON mentah sebelum permessage-deflate.
    expect(bytes / 15).toBeLessThan(4096);
    expect(msgs).toBeGreaterThan(0);
  });

  it('bandwidth rata-rata rutinitas harian < 2 KB/dtk per penonton (anggaran §5)', () => {
    const sim = new WorldSim({ agents: AGENTS, seed: 21, live: false });
    const enc = new WorldEncoder(AGENTS);
    run(sim, 30);
    let bytes = 0;
    const seconds = 600;
    for (let i = 0; i < seconds * 20; i++) {
      sim.step(0.05);
      if (i % 2 === 1) bytes += enc.tick(sim.frame(), i * 50).public?.length ?? 0;
    }
    expect(bytes / seconds).toBeLessThan(2048);
  });

  it('event server → event dunia (rapat dari /rapat, kunjungan antar-agen, bicara)', () => {
    const ids = new Set(AGENTS.map((a) => a.id));
    const at = new Date().toISOString();
    const msg = (sender: string, recipient: string, body: string, kind = 'chat') => ({
      type: 'message.created' as const, at,
      message: { id: 'm1', sender, recipient, kind, body, meta: {}, createdAt: at },
    });
    expect(worldEventsFrom(msg('ceo', 'all', '/rapat Evaluasi') as never, ids)).toEqual([{ kind: 'meeting', host: 'raka', text: 'Evaluasi' }]);
    expect(worldEventsFrom(msg('bima', 'laras', 'Tolong review', 'review') as never, ids)).toEqual([{ kind: 'visit', from: 'bima', to: 'laras', text: 'Tolong review', carryDoc: true }]);
    expect(worldEventsFrom({ type: 'agent.say', agentId: 'gita', text: 'Halo', emotion: 'neutral', at } as never, ids)).toEqual([{ kind: 'say', agentId: 'gita', text: 'Halo' }]);
    expect(worldEventsFrom({ type: 'agent.say', agentId: 'orang-asing', text: 'x', emotion: 'neutral', at } as never, ids)).toEqual([]);
  });
});
