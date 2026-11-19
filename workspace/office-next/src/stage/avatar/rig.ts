import * as THREE from 'three';
import type { AvatarConfig } from '@office/shared';
import { BODY, type BuildExtras } from './config';
import { BONE_NAMES, buildAvatarGeometry, skeletonSpec, type BoneName } from './parts';

/**
 * F1 — AvatarRig v2 (rencana §3.2): SATU `SkinnedMesh` per avatar + tulang
 * root → hips → spine → chest → neck → head (+ soket `eye`), bahu → siku → tangan, pinggul → lutut → kaki.
 * Semua avatar memakai satu material vertex-color (`AvatarShared.material`).
 */

/** Sumber daya yang dipakai bersama semua avatar (dibuang sekali oleh panggung). */
export interface AvatarShared {
  material: THREE.MeshStandardMaterial;
  beaconGeo: THREE.BufferGeometry;
  cupGeo: THREE.BufferGeometry;
  cupMat: THREE.MeshStandardMaterial;
  docGeo: THREE.BufferGeometry;
  docMat: THREE.MeshStandardMaterial;
  dispose(): void;
}

export function createAvatarShared(): AvatarShared {
  const s = {
    material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.04 }),
    beaconGeo: new THREE.OctahedronGeometry(0.13, 0),
    cupGeo: new THREE.CylinderGeometry(0.04, 0.032, 0.09, 10),
    cupMat: new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.25, metalness: 0.1 }),
    docGeo: new THREE.BoxGeometry(0.21, 0.006, 0.28),
    docMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 }),
    dispose() {
      s.material.dispose(); s.beaconGeo.dispose(); s.cupGeo.dispose(); s.cupMat.dispose(); s.docGeo.dispose(); s.docMat.dispose();
    },
  };
  s.material.name = 'Avatar_V2_VertexColor';
  return s;
}

export class AvatarRig {
  /** Titik asal = lantai di antara kedua kaki; +Z = arah hadap. Skala = `height`. */
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly bones = {} as Record<BoneName, THREE.Bone>;
  /** Soket kamera FPV (anak tulang `head`, tidak ikut disembunyikan). */
  readonly eye = new THREE.Object3D();
  /** Soket properti: tangan kiri (dokumen) & kanan (cangkir). */
  readonly socketL = new THREE.Object3D();
  readonly socketR = new THREE.Object3D();
  private cfg: AvatarConfig;
  private extras: BuildExtras;
  private firstPerson = false;

  constructor(cfg: AvatarConfig, extras: BuildExtras, shared: AvatarShared) {
    this.cfg = cfg;
    this.extras = extras;
    for (const n of BONE_NAMES) {
      const b = new THREE.Bone();
      b.name = n;
      this.bones[n] = b;
    }
    for (const n of ['neck', 'head'] as const) this.bones[n].rotation.order = 'YXZ';
    for (const n of ['hipL', 'hipR'] as const) this.bones[n].rotation.order = 'ZXY';
    this.mesh = new THREE.SkinnedMesh(buildAvatarGeometry(cfg, extras), shared.material);
    this.mesh.name = 'Avatar_V2';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.add(this.bones.root);
    this.layoutBones();
    this.group.add(this.mesh);
    this.eye.name = 'eye';
    this.bones.head.add(this.eye);
    this.bones.handL.add(this.socketL);
    this.bones.handR.add(this.socketR);
    this.socketL.position.set(0, -0.07, 0.03);
    this.socketR.position.set(0, -0.06, 0.035);
    this.bind();
  }

  get config(): AvatarConfig { return this.cfg; }
  get scale(): number { return this.cfg.height; }

  /** Posisi tulang dari skeletonSpec (bentuk tubuh) + hierarki. */
  private layoutBones() {
    for (const s of skeletonSpec(this.cfg.body)) {
      const b = this.bones[s.name];
      b.position.set(...s.pos);
      if (s.parent && b.parent !== this.bones[s.parent]) this.bones[s.parent].add(b);
    }
    // Soket mata 1,58 m (§2.2), sedikit di depan pusat tengkorak.
    this.eye.position.set(0, BODY.eye - 1.51, 0.09);
    this.group.scale.setScalar(this.cfg.height);
  }

  private bind() {
    this.resetPose();
    // Ikat pada titik asal: matriks ikat hanya bergantung pada pose lokal (tulang anak mesh).
    const parent = this.group.parent;
    const saved = { p: this.group.position.clone(), q: this.group.quaternion.clone(), s: this.group.scale.clone() };
    this.group.removeFromParent();
    this.group.position.set(0, 0, 0);
    this.group.quaternion.identity();
    this.group.scale.setScalar(1);
    this.group.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(BONE_NAMES.map((n) => this.bones[n])));
    this.group.position.copy(saved.p);
    this.group.quaternion.copy(saved.q);
    this.group.scale.copy(saved.s);
    if (parent) parent.add(this.group);
    // Bola batas tetap (pose apa pun masih di dalamnya): culling & raycast tanpa hitung ulang.
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0.1), 1.25);
  }

  /** Ganti bagian (F5 Avatar Studio): gabung ulang geometri & ikat ulang tulang. */
  setConfig(cfg: AvatarConfig, extras: BuildExtras = this.extras) {
    this.cfg = cfg;
    this.extras = extras;
    const old = this.mesh.geometry;
    this.mesh.geometry = buildAvatarGeometry(cfg, extras);
    old.dispose();
    this.layoutBones();
    this.bind();
    this.setFirstPerson(this.firstPerson);
  }

  /** FPV: kepala, rambut, kacamata & hijab kolaps (tulang `headMesh` diskala 0); soket mata tetap. */
  setFirstPerson(on: boolean) {
    this.firstPerson = on;
    this.bones.headMesh.scale.setScalar(on ? 1e-4 : 1);
  }

  /** Semua sendi ke pose ikat (berdiri tegak, lengan lurus ke bawah). */
  resetPose() {
    for (const n of BONE_NAMES) this.bones[n].quaternion.identity();
    const hips = skeletonSpec(this.cfg.body)[1]!;
    this.bones.hips.position.set(...hips.pos);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.skeleton.dispose();
    this.group.removeFromParent();
  }
}
