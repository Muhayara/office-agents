import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AGENT_3D_POSITIONS, WorldSim, createFloor1Nav, floor1Spots, type AgentFrame } from '@office/world';
import { V2Avatar } from '../avatar/agentAvatar';
import { chooseLook, type LookWorld } from '../avatar/lookAt';
import { createAvatarShared } from '../avatar/rig';
import { seatCalibAt, seatKindFor } from '../avatar/seats';
import { BOB_Y, DIM_S, EyeCam, GLANCE_PITCH_MAX, GLANCE_RETURN_DELAY, GLANCE_YAW_MAX, GLIDE_S, type EyeSource } from './eyeCam';

/** F3 (rencana §4 F3, §7): kamera Mata Agen tanpa WebGL. */

const deg = (r: number) => (r * 180) / Math.PI;
const yawOf = (q: THREE.Quaternion) => new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
const rollOf = (q: THREE.Quaternion) => new THREE.Euler().setFromQuaternion(q, 'YXZ').z;

/** Sumber mata buatan yang bisa digerakkan langsung. */
class FakeEye implements EyeSource {
  pos = new THREE.Vector3(0, 1.58, 0);
  quat = new THREE.Quaternion();
  phase: number | null = null;
  sit = false;
  fp: boolean[] = [];
  eye(p: THREE.Vector3, q: THREE.Quaternion) { p.copy(this.pos); q.copy(this.quat); }
  gait() { return this.phase; }
  setFirstPerson(on: boolean) { this.fp.push(on); }
  seated() { return this.sit; }
  anchor(out: THREE.Vector3) { return out.set(this.pos.x, 0, this.pos.z); }
}

function rig() {
  const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
  const log: string[] = [];
  const eye = new EyeCam(cam, { onViewEnter: () => log.push('enter'), onViewLeave: (id) => log.push(`leave:${id}`) });
  const run = (seconds: number, dt = 1 / 30, bob = true, each?: () => void) => {
    for (let t = 0; t < seconds - 1e-9; t += dt) { each?.(); eye.update(dt, { bob }); }
  };
  return { cam, eye, log, run };
}

describe('EyeCam: transisi', () => {
  it('redup 0,2 dtk → luncur 0,8 dtk dari ±2,5 m di belakang-atas kepala → mata; keluar = kebalikannya', () => {
    const { cam, eye, log, run } = rig();
    const src = new FakeEye();
    eye.enter('raka', src);
    run(DIM_S - 0.05);
    expect(log).toEqual([]);
    expect(eye.dim).toBeGreaterThan(0.5);
    run(0.1);
    expect(log).toEqual(['enter']);
    expect(eye.phase).toBe('glideIn');
    const startDist = cam.position.distanceTo(src.pos);
    expect(startDist).toBeGreaterThan(2.3);
    expect(startDist).toBeLessThan(2.6);
    expect(cam.position.y).toBeGreaterThan(src.pos.y); // di atas kepala
    expect(cam.position.z).toBeLessThan(src.pos.z); // di belakang (kepala menghadap +Z)
    run(GLIDE_S + 0.1);
    expect(eye.phase).toBe('on');
    expect(eye.dim).toBe(0);
    expect(cam.position.distanceTo(src.pos)).toBeLessThan(0.01);
    expect(src.fp.at(-1)).toBe(true); // kepala disembunyikan di FPV
    eye.exit();
    run(GLIDE_S + 0.05);
    expect(src.fp.at(-1)).toBe(false); // kepala tampil lagi saat kamera menjauh
    run(DIM_S + 0.05);
    expect(log).toEqual(['enter', 'leave:raka']);
    run(DIM_S + 0.05);
    expect(eye.phase).toBe('off');
    expect(eye.dim).toBe(0);
  });

  it('ganti agen di mode mata: redup → luncur ke agen baru tanpa keluar ke isometrik', () => {
    const { cam, eye, log, run } = rig();
    const a = new FakeEye(), b = new FakeEye();
    b.pos.set(5, 1.24, 3);
    eye.enter('raka', a);
    run(DIM_S + GLIDE_S + 0.2);
    eye.enter('sari', b);
    run(DIM_S + GLIDE_S + 0.2);
    expect(log).toEqual(['enter']);
    expect(eye.agentId).toBe('sari');
    expect(cam.position.distanceTo(b.pos)).toBeLessThan(0.01);
    expect(a.fp.at(-1)).toBe(false);
    expect(b.fp.at(-1)).toBe(true);
  });
});

describe('EyeCam: kenyamanan', () => {
  it('kepala berbalik 180° seketika: lompatan yaw ≤ 25° per frame pada 30 FPS, tanpa roll', () => {
    const { cam, eye, run } = rig();
    const src = new FakeEye();
    eye.enter('bima', src);
    run(DIM_S + GLIDE_S + 0.2);
    src.quat.setFromEuler(new THREE.Euler(0.2, Math.PI, 0.3, 'YXZ')); // + roll palsu dari rig
    let prev = yawOf(cam.quaternion), maxStep = 0;
    run(1.5, 1 / 30, true, () => {
      const y = yawOf(cam.quaternion);
      let d = y - prev;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      maxStep = Math.max(maxStep, Math.abs(deg(d)));
      prev = y;
      expect(Math.abs(rollOf(cam.quaternion))).toBeLessThan(1e-6);
    });
    expect(maxStep).toBeLessThanOrEqual(25);
    expect(eye.maxYawStepDeg).toBeLessThanOrEqual(25);
    // Akhirnya menatap arah baru.
    expect(Math.abs(Math.abs(deg(yawOf(cam.quaternion))) - 0)).toBeLessThan(1); // kepala +Z dibalik → kamera −Z dibalik
  });

  it('berjalan 2,2 m/dtk: kamera tetap di mata (dulu tertinggal ±26 cm di belakang kepala & melihat lehernya)', () => {
    const { cam, eye, run } = rig();
    const src = new FakeEye();
    eye.enter('dimas', src);
    run(DIM_S + GLIDE_S + 0.2);
    run(2, 1 / 30, false, () => { src.pos.z += 2.2 / 30; });
    expect(cam.position.distanceTo(src.pos)).toBeLessThan(0.03);
  });

  it('lirik dibatasi ±60° / ±35° dan kembali ke arah agen setelah 1,5 dtk', () => {
    const { eye, run } = rig();
    eye.enter('gita', new FakeEye());
    run(DIM_S + GLIDE_S + 0.2);
    eye.glanceStart();
    eye.glanceBy(-5000, -5000);
    expect(deg(eye.glanceYaw)).toBeCloseTo(deg(GLANCE_YAW_MAX), 5);
    expect(deg(eye.glancePitch)).toBeCloseTo(deg(GLANCE_PITCH_MAX), 5);
    expect(eye.isMoving()).toBe(true);
    eye.glanceEnd();
    run(GLANCE_RETURN_DELAY - 0.2);
    expect(deg(eye.glanceYaw)).toBeCloseTo(60, 3); // belum kembali
    run(2.5);
    expect(eye.glanceYaw).toBe(0);
    expect(eye.glancePitch).toBe(0);
  });

  it('head-bob ±2 cm saat berjalan; mati bila dimatikan / prefers-reduced-motion', () => {
    const measure = (bob: boolean) => {
      const { cam, eye, run } = rig();
      const src = new FakeEye();
      eye.enter('tari', src);
      run(DIM_S + GLIDE_S + 0.2);
      src.phase = 0;
      let lo = Infinity, hi = -Infinity;
      run(3, 1 / 60, bob, () => {
        src.phase = ((src.phase ?? 0) + (1 / 60) * (10 / (Math.PI * 2))) % 1;
        if (eye.frames > 90) { lo = Math.min(lo, cam.position.y); hi = Math.max(hi, cam.position.y); }
      });
      return hi - lo;
    };
    const withBob = measure(true);
    expect(withBob).toBeGreaterThan(BOB_Y * 1.0); // ±2 cm diredam τ 0,12 dtk
    expect(withBob).toBeLessThan(BOB_Y * 2 + 0.002);
    expect(measure(false)).toBeLessThan(1e-4);
  });

  it('kebijakan FPS: duduk diam = tidak aktif (30 FPS di Hemat), berjalan = aktif (60 FPS)', () => {
    const { eye, run } = rig();
    const src = new FakeEye();
    src.sit = true;
    eye.enter('laras', src);
    run(DIM_S + GLIDE_S + 1.2);
    expect(eye.isMoving()).toBe(false);
    run(1, 1 / 30, true, () => { src.pos.z += 2.2 / 30; });
    expect(eye.isMoving()).toBe(true);
  });
});

describe('EyeCam + WorldSim + Rig v2 (integrasi, 30 FPS)', () => {
  it('perjalanan meja → Boardroom (rapat): lompatan yaw kamera ≤ 25° per frame', () => {
    const ids = Object.keys(AGENT_3D_POSITIONS);
    const sim = new WorldSim({ agents: ids.map((id) => ({ id, name: id, title: id })), seed: 11, live: false });
    const nav = createFloor1Nav();
    const spots = floor1Spots();
    const shared = createAvatarShared();
    const avs = new Map(ids.map((id, i) => [id, new V2Avatar(id, id, new THREE.Color('#5b9bd5'), i, shared)] as const));
    const scene = new THREE.Scene();
    for (const av of avs.values()) scene.add(av.group);
    const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
    const eye = new EyeCam(cam, { onViewEnter: () => {}, onViewLeave: () => {} });
    const dt = 1 / 30;
    let t = 0;
    const tmp = new THREE.Vector3();
    const tv = new THREE.Vector3(7.3, 1.45, -1.6);
    const step = () => {
      t += dt;
      sim.step(dt);
      const fr = sim.frame();
      const rooms = new Map(fr.agents.map((f) => [f.id, f.vis ? nav.roomAt({ x: f.x, z: f.z }) ?? '' : ''] as const));
      const lw: LookWorld = {
        frames: fr.agents,
        headOf: (id, out) => avs.get(id)?.headWorld(out) ?? null,
        roomOf: (f: AgentFrame) => rooms.get(f.id) ?? '',
        meetingSession: fr.props.meeting?.phase === 'session',
        tv,
        workshopDisplay: tv,
      };
      fr.agents.forEach((f, i) => {
        const kind = seatKindFor(f, rooms.get(f.id) ?? '');
        const seat = kind ? seatCalibAt(kind, f.x, f.z, spots) : null;
        avs.get(f.id)!.apply(f, { t, dt, seat, look: chooseLook(f, i, seat, lw, tmp) });
      });
      scene.updateMatrixWorld();
      eye.update(dt, { bob: true });
      return fr;
    };
    // Agen tiba dari Lobi dan duduk di meja (rutinitas kopi dsb. bisa menunda; tunggu sampai bekerja).
    const who = 'bima';
    for (let i = 0; i < 30 * 15; i++) step();
    for (let i = 0; i < 30 * 90 && sim.frame().agents.find((f) => f.id === who)?.state !== 'working'; i++) step();
    expect(sim.frame().agents.find((f) => f.id === who)?.state).toBe('working');
    eye.enter(who, avs.get(who)!.eyeSource());
    for (let i = 0; i < 30 * 2; i++) step();
    expect(eye.phase).toBe('on');
    sim.debug.meeting('raka', 'Uji F3 Mata Agen');
    let walked = false, seated = false;
    for (let i = 0; i < 30 * 45; i++) {
      const fr = step();
      const st = fr.agents.find((f) => f.id === who)!.state;
      if (st === 'walk_to_meeting') walked = true;
      if (st === 'in_meeting') seated = true;
    }
    expect(walked).toBe(true);
    expect(seated).toBe(true);
    expect(eye.frames).toBeGreaterThan(1000);
    expect(eye.maxYawStepDeg).toBeLessThanOrEqual(25);
    // Kamera tetap di mata agen (duduk di kursi rapat ±1,25 m).
    expect(cam.position.y).toBeGreaterThan(1.1);
    expect(cam.position.y).toBeLessThan(1.4);
    shared.dispose();
  });
});
