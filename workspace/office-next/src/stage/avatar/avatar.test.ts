import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AVATAR_BODIES, AVATAR_BOTTOMS, AVATAR_HAIRS, AVATAR_SHOES, AVATAR_TOPS, AvatarConfigSchema, parseAvatarConfig, type AvatarConfig,
} from '@office/shared';
import { AGENT_LOOKS, agentAvatarConfig } from './agentLooks';
import { AGENT_UNIFORM, BODY, DEFAULT_AVATAR } from './config';
import { BONE_NAMES, bindPositions, buildAvatarGeometry, skeletonSpec } from './parts';
import { POLE, poseSit, poseStand, rootPos, solveArm } from './poses';
import { AvatarRig, createAvatarShared } from './rig';
import { SEAT_CALIB } from './seats';

/** F1 (rencana-fpv-dan-kustomisasi-karakter.md §3.2–§3.3, §7): pembangun geometri & IK tanpa WebGL. */

const shared = createAvatarShared();

describe('AvatarConfig', () => {
  it('10 agen memakai seragam Navy Tech dan lolos skema', () => {
    for (const id of Object.keys(AGENT_LOOKS)) {
      const cfg = agentAvatarConfig(id, id);
      expect(AvatarConfigSchema.safeParse(cfg).success).toBe(true);
      expect(cfg.top).toBe(AGENT_UNIFORM.top);
      expect(cfg.topColor).toBe(AGENT_UNIFORM.topColor);
      expect(cfg.height).toBe(1);
    }
  });

  it('menolak warna di luar palet, tinggi di luar 1,60–1,80 m, nama berisi HTML, dan kunci asing', () => {
    expect(parseAvatarConfig({ ...DEFAULT_AVATAR, topColor: 12 }).ok).toBe(false);
    expect(parseAvatarConfig({ ...DEFAULT_AVATAR, height: 1.2 }).ok).toBe(false);
    expect(parseAvatarConfig({ ...DEFAULT_AVATAR, name: '<img src=x>' }).ok).toBe(false);
    expect(parseAvatarConfig({ ...DEFAULT_AVATAR, url: 'http://x' }).ok).toBe(false);
    expect(parseAvatarConfig({ ...DEFAULT_AVATAR, name: "Dewi O'Neil-Saputra" }).ok).toBe(true);
  });
});

describe('Geometri avatar', () => {
  const attrsOk = (g: THREE.BufferGeometry) => {
    for (const a of ['position', 'normal', 'color', 'skinIndex', 'skinWeight']) expect(g.getAttribute(a), a).toBeTruthy();
    expect(g.getAttribute('uv')).toBeUndefined();
    const sw = g.getAttribute('skinWeight');
    const si = g.getAttribute('skinIndex');
    for (let i = 0; i < sw.count; i += 7) {
      const sum = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-5);
      expect(si.getX(i)).toBeLessThan(BONE_NAMES.length);
    }
  };

  it('setiap pilihan bagian (tubuh, rambut, atasan, bawahan, sepatu, aksesori) bisa dibangun', () => {
    const variants: AvatarConfig[] = [];
    const n = Math.max(AVATAR_BODIES.length, AVATAR_HAIRS.length, AVATAR_TOPS.length, AVATAR_BOTTOMS.length, AVATAR_SHOES.length);
    for (let i = 0; i < n * 2; i++) {
      variants.push({
        ...DEFAULT_AVATAR,
        body: AVATAR_BODIES[i % AVATAR_BODIES.length]!,
        hair: AVATAR_HAIRS[i % AVATAR_HAIRS.length]!,
        top: AVATAR_TOPS[(i * 3) % AVATAR_TOPS.length]!,
        bottom: AVATAR_BOTTOMS[(i * 5) % AVATAR_BOTTOMS.length]!,
        shoes: AVATAR_SHOES[(i * 2) % AVATAR_SHOES.length]!,
        acc: { glasses: i % 2 === 0, headphones: i % 3 === 0, lanyard: i % 4 === 1, tie: i % 2 === 1 },
      });
    }
    for (const cfg of variants) {
      expect(AvatarConfigSchema.safeParse(cfg).success).toBe(true);
      const g = buildAvatarGeometry(cfg, { trim: AGENT_UNIFORM.trim, idColor: 0xff8800 });
      attrsOk(g);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      // Puncak kepala ±1,70 m (rambut/hijab boleh sedikit di atas), sol di lantai.
      expect(b.max.y).toBeGreaterThan(1.68);
      expect(b.max.y).toBeLessThan(1.8);
      expect(b.min.y).toBeGreaterThan(-0.01);
      expect(b.min.y).toBeLessThan(0.01);
      g.dispose();
    }
  });

  it('agen ringan: < 3.000 segitiga per avatar, satu material', () => {
    const rig = new AvatarRig(agentAvatarConfig('bima', 'Bima'), { trim: AGENT_UNIFORM.trim, idColor: 0xd9735f }, shared);
    const tris = (rig.mesh.geometry.index?.count ?? 0) / 3;
    expect(tris).toBeGreaterThan(500);
    expect(tris).toBeLessThan(3000);
    expect(Array.isArray(rig.mesh.material)).toBe(false);
    expect(rig.mesh.skeleton.bones.length).toBe(BONE_NAMES.length);
    rig.dispose();
  });

  it('proporsi §2.2: bahu 1,38, sendi pinggul 0,87, lutut 0,47, pergelangan kaki 0,07, mata 1,58', () => {
    const bind = bindPositions(skeletonSpec('netral'));
    expect(bind.shoulderL.y).toBeCloseTo(BODY.shoulder, 3);
    expect(bind.hipL.y).toBeCloseTo(BODY.hipJoint, 3);
    expect(bind.kneeL.y).toBeCloseTo(BODY.knee, 3);
    expect(bind.ankleL.y).toBeCloseTo(BODY.ankle, 3);
    // Sisi L = kiri pemakai = +X (avatar menghadap +Z).
    expect(bind.shoulderL.x).toBeGreaterThan(0);
    expect(bind.hipR.x).toBeLessThan(0);
    const rig = new AvatarRig(DEFAULT_AVATAR, {}, shared);
    rig.group.updateMatrixWorld(true);
    expect(rig.eye.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(BODY.eye, 3);
    rig.dispose();
  });
});

describe('IK & dudukan', () => {
  const rig = new AvatarRig(DEFAULT_AVATAR, {}, shared);
  const ankleRoot = (side: 'L' | 'R') => rootPos(rig, side === 'L' ? 'ankleL' : 'ankleR', new THREE.Vector3());

  it('berdiri: kedua pergelangan kaki di 0,07 m (telapak menapak lantai)', () => {
    rig.resetPose();
    poseStand(rig);
    expect(ankleRoot('L').y).toBeCloseTo(BODY.ankle, 2);
    expect(ankleRoot('R').y).toBeCloseTo(BODY.ankle, 2);
  });

  it('12 jenis dudukan: kaki sampai target (celah 0) dan pergelangan tepat di target', () => {
    for (const seat of Object.values(SEAT_CALIB)) {
      rig.resetPose();
      const gap = poseSit(rig, { top: seat.top, hipFwd: seat.hipFwd, lean: seat.lean, footL: seat.footL, footR: seat.footR }, 1);
      expect(gap, seat.kind).toBe(0);
      for (const [side, ft] of [['L', seat.footL], ['R', seat.footR]] as const) {
        const a = ankleRoot(side);
        expect(a.y, `${seat.kind} ${side} y`).toBeCloseTo(ft.y, 2);
        expect(a.z, `${seat.kind} ${side} z`).toBeCloseTo(ft.fwd, 2);
        expect(Math.abs(a.x), `${seat.kind} ${side} x`).toBeCloseTo(ft.lat, 2);
      }
      // Panggul di atas dudukan, tidak tenggelam.
      const hips = rootPos(rig, 'hips', new THREE.Vector3());
      expect(hips.y - 0.13).toBeGreaterThanOrEqual(seat.top);
    }
  });

  it('tangan sampai ke permukaan kerja setiap dudukan yang punya meja', () => {
    for (const seat of Object.values(SEAT_CALIB)) {
      if (!seat.work) continue;
      rig.resetPose();
      poseSit(rig, { top: seat.top, hipFwd: seat.hipFwd, lean: seat.lean, footL: seat.footL, footR: seat.footR }, 1);
      for (const side of ['L', 'R'] as const) {
        const target = new THREE.Vector3(side === 'L' ? 0.13 : -0.13, seat.work.y, seat.work.fwd);
        const err = solveArm(rig, side, target, POLE[side]);
        expect(err, `${seat.kind} ${side}`).toBe(0);
        const wrist = rootPos(rig, side === 'L' ? 'handL' : 'handR', new THREE.Vector3());
        expect(wrist.distanceTo(target), `${seat.kind} ${side}`).toBeLessThan(0.005);
      }
    }
  });

  it('FPV menyembunyikan kepala tanpa memindahkan soket mata', () => {
    rig.resetPose();
    rig.group.updateMatrixWorld(true);
    const before = rig.eye.getWorldPosition(new THREE.Vector3());
    rig.setFirstPerson(true);
    rig.group.updateMatrixWorld(true);
    expect(rig.bones.headMesh.scale.x).toBeLessThan(0.001);
    expect(rig.eye.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-6);
    rig.setFirstPerson(false);
  });
});
