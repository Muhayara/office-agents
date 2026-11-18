import * as THREE from 'three';
import type { LightAnchorData } from './rooms/assets';
import type { WalkZone } from './camera/wallFade';

/**
 * Efek lantai murah untuk optimasi performa (rencana-optimasi-performa-3d.md, Task 3):
 * - ContactShadows: bayangan kontak palsu di bawah perabot & avatar (mode Grafis Hemat, tanpa shadow map).
 * - LightPools: genangan cahaya palsu di lantai pada tiap titik lampu ruangan (semua mode), ditambah
 *   maksimal 3 PointLight nyata yang mengikuti fokus kamera (mode Grafis Tinggi).
 * - DeskGlows: pendar layar monitor di permukaan meja (pengganti 10 PointLight screenGlow).
 * Semuanya InstancedMesh: satu draw call per jenis, nol biaya lampu di shader.
 */

const FLOOR_FX_Y = 0.03;

function radialTexture(inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.6})`));
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Persegi lembut (tepi kabur) untuk tapak perabot (dihitung per piksel, tanpa ctx.filter). */
function softRectTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const img = x.createImageData(S, S);
  const edge = (u: number) => {
    // 0 di tepi tekstur → 1 mulai 30% ke dalam (tepi lembut).
    const t = Math.min(1, Math.max(0, Math.min(u, 1 - u) / 0.3));
    return t * t * (3 - 2 * t);
  };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const a = edge((i + 0.5) / S) * edge((j + 0.5) / S);
    const k = (j * S + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
    img.data[k + 3] = Math.round(a * 255);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function flatPlane() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, capacity: number, name: string) {
  const m = new THREE.InstancedMesh(geo, mat, capacity);
  m.name = name;
  m.count = 0;
  m.frustumCulled = false; // satu draw call untuk seluruh gedung, bounding sphere berubah terus
  m.castShadow = false;
  m.receiveShadow = false;
  m.renderOrder = 1;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

// ============================================================================
// Bayangan kontak (mode Hemat)
// ============================================================================

interface Follower {
  index: number;
  slot: THREE.Object3D;
  local: THREE.Matrix4;
}

export class ContactShadows {
  readonly group = new THREE.Group();
  private rect: THREE.InstancedMesh;
  private round: THREE.InstancedMesh;
  private movers: THREE.InstancedMesh;
  private followers: Follower[] = [];
  private avatars: THREE.Object3D[] = [];
  private tmpM = new THREE.Matrix4();
  private tmpM2 = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private box = new THREE.Box3();
  private meshBox = new THREE.Box3();

  constructor() {
    this.group.name = 'FX_ContactShadows';
    const geo = flatPlane();
    const mk = (map: THREE.Texture, opacity: number) => new THREE.MeshBasicMaterial({
      map, color: 0x000000, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const roundTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.rect = instanced(geo, mk(softRectTexture(), 0.42), 768, 'FX_Contact_Rect');
    this.round = instanced(geo, mk(roundTex, 0.45), 256, 'FX_Contact_Round');
    this.movers = instanced(geo, mk(roundTex, 0.5), 64, 'FX_Contact_Movers');
    this.group.add(this.rect, this.round, this.movers);
  }

  /**
   * Daftarkan tapak sebuah model yang sudah terpasang di slot. Model yang tidak menapak lantai
   * (menempel dinding / tergantung) dilewati. `follow` = slot bergerak (mis. kursi rapat yang ditarik).
   */
  addFootprint(slot: THREE.Object3D, model: THREE.Object3D, opts: { round?: boolean; follow?: boolean; pad?: number } = {}): boolean {
    slot.updateWorldMatrix(true, true);
    const inv = this.tmpM.copy(slot.matrixWorld).invert();
    const box = this.box.makeEmpty();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      const geo = mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;
      this.meshBox.copy(geo.boundingBox).applyMatrix4(this.tmpM2.multiplyMatrices(inv, mesh.matrixWorld));
      box.union(this.meshBox);
    });
    if (box.isEmpty() || box.min.y > 0.12) return false;
    const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
    if (w * d < 0.02 || box.max.y - box.min.y < 0.2) return false;
    const pad = opts.pad ?? 1.18;
    const round = opts.round ?? (Math.abs(w - d) / Math.max(w, d) < 0.25 && Math.max(w, d) < 0.9);
    const local = new THREE.Matrix4().compose(
      this.tmpV.set((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2),
      this.tmpQ.identity(),
      this.tmpS.set(w * pad, 1, d * pad),
    );
    const mesh = round ? this.round : this.rect;
    if (mesh.count >= mesh.instanceMatrix.count) return false;
    const index = mesh.count++;
    this.writeWorld(mesh, index, slot, local);
    if (opts.follow) {
      if (mesh !== this.round) {
        // Hanya bayangan bulat yang diperbarui per frame.
        mesh.count--;
        return this.addFootprint(slot, model, { ...opts, round: true });
      }
      this.followers.push({ index, slot, local });
    }
    return true;
  }

  /** Bayangan bulat yang mengikuti avatar (posisi lantai, tersembunyi saat avatar tidak terlihat). */
  addAvatar(avatar: THREE.Object3D) {
    this.avatars.push(avatar);
    this.movers.count = this.avatars.length;
  }

  private writeWorld(mesh: THREE.InstancedMesh, index: number, slot: THREE.Object3D, local: THREE.Matrix4) {
    const m = this.tmpM2.multiplyMatrices(slot.matrixWorld, local);
    // Datar di lantai: hanya putaran Y slot yang dipakai, tinggi tetap.
    m.decompose(this.tmpV, this.tmpQ, this.tmpS);
    const e = new THREE.Euler().setFromQuaternion(this.tmpQ, 'YXZ');
    this.tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, e.y);
    this.tmpV.y = FLOOR_FX_Y;
    this.tmpS.y = 1;
    m.compose(this.tmpV, this.tmpQ, this.tmpS);
    mesh.setMatrixAt(index, m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  update() {
    if (!this.group.visible) return;
    for (const f of this.followers) this.writeWorld(this.round, f.index, f.slot, f.local);
    for (let i = 0; i < this.avatars.length; i++) {
      const a = this.avatars[i]!;
      const s = a.visible ? 0.62 : 0;
      this.tmpM.compose(this.tmpV.set(a.position.x, FLOOR_FX_Y + 0.002, a.position.z), this.tmpQ.identity(), this.tmpS.set(s, 1, s));
      this.movers.setMatrixAt(i, this.tmpM);
    }
    if (this.avatars.length) this.movers.instanceMatrix.needsUpdate = true;
  }

  setVisible(v: boolean) { this.group.visible = v; }

  dispose() {
    for (const m of [this.rect, this.round, this.movers]) {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      m.dispose();
    }
    this.rect.geometry.dispose();
  }
}

// ============================================================================
// Genangan cahaya palsu + pool 3 PointLight (mode Tinggi)
// ============================================================================

export interface LightAnchor {
  pos: THREE.Vector3;
  data: LightAnchorData;
  /** Kekuatan genangan cahaya dasar (warna × k). */
  k: number;
  color: THREE.Color;
}

interface PoolSlot {
  light: THREE.PointLight;
  anchor: number;
  level: number;
  target: number;
}

const POOL_SIZE = 3;
const POOL_FADE_S = 0.45;

export class LightPools {
  readonly group = new THREE.Group();
  readonly anchors: LightAnchor[] = [];
  private decals: THREE.InstancedMesh;
  private pool: PoolSlot[] = [];
  private high = false;
  private tmp = new THREE.Color();
  private lastPick = -1;
  private pickT = 0;

  constructor(anchorObjects: THREE.Object3D[], zones: WalkZone[]) {
    this.group.name = 'FX_LightPools';
    for (const o of anchorObjects) {
      const data = o.userData.lightAnchor as LightAnchorData;
      const pos = o.getWorldPosition(new THREE.Vector3());
      const h = Math.max(0.8, pos.y);
      const k = THREE.MathUtils.clamp((data.intensity / Math.pow(h, data.decay)) * 0.022, 0.035, 0.13);
      this.anchors.push({ pos, data, k, color: new THREE.Color(data.color) });
    }
    const tex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    this.decals = instanced(flatPlane(), mat, Math.max(1, this.anchors.length), 'FX_Light_Pools');
    this.decals.count = this.anchors.length;
    const m = new THREE.Matrix4();
    this.anchors.forEach((a, i) => {
      // Radius genangan: sebagian jangkauan lampu, dipotong di tepi ruangan agar tidak tembus dinding.
      let r = Math.min(a.data.distance * 0.42, 2.6);
      const z = zones.find((zz) => a.pos.x >= zz.minX && a.pos.x <= zz.maxX && a.pos.z >= zz.minZ && a.pos.z <= zz.maxZ);
      if (z) r = Math.min(r, Math.max(0.6, Math.min(a.pos.x - z.minX, z.maxX - a.pos.x, a.pos.z - z.minZ, z.maxZ - a.pos.z) + 0.25));
      m.makeScale(r * 2, 1, r * 2).setPosition(a.pos.x, FLOOR_FX_Y + 0.004, a.pos.z);
      this.decals.setMatrixAt(i, m);
      this.decals.setColorAt(i, this.tmp.copy(a.color).multiplyScalar(a.k));
    });
    this.decals.instanceMatrix.needsUpdate = true;
    if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true;
    this.group.add(this.decals);
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 5, 1.6);
      light.name = `Light_Pool_${i}`;
      light.castShadow = false;
      light.visible = false;
      this.group.add(light);
      this.pool.push({ light, anchor: -1, level: 0, target: -1 });
    }
  }

  /** Grafis Tinggi = 3 PointLight nyata aktif (jumlah lampu shader tetap: 0 atau 3). */
  setHigh(high: boolean) {
    this.high = high;
    for (const s of this.pool) {
      s.light.visible = high;
      if (!high) { s.level = 0; s.anchor = -1; s.target = -1; s.light.intensity = 0; }
    }
    this.refreshDecals();
  }

  /** Pilih 3 titik lampu terdekat fokus kamera dan pudarkan perpindahannya (tanpa popping). */
  update(focus: THREE.Vector3, dt: number) {
    if (!this.high || this.anchors.length === 0) return;
    this.pickT -= dt;
    if (this.pickT <= 0) {
      this.pickT = 0.25;
      const scored = this.anchors.map((a, i) => {
        const dx = a.pos.x - focus.x, dz = a.pos.z - focus.z;
        return { i, s: a.data.intensity / (1 + (dx * dx + dz * dz) / 9) };
      }).sort((a, b) => b.s - a.s).slice(0, POOL_SIZE).map((x) => x.i);
      const key = [...scored].sort((a, b) => a - b).reduce((h, i) => h * 131 + i + 1, 7);
      if (key !== this.lastPick) {
        this.lastPick = key;
        // target: -1 = tetap (menyala), -2 = padam, >= 0 = padam lalu pindah ke titik itu.
        const wanted = new Set(scored);
        const held = new Set<number>();
        for (const s of this.pool) if (s.anchor >= 0 && wanted.has(s.anchor)) { held.add(s.anchor); s.target = -1; }
        const free = scored.filter((i) => !held.has(i));
        for (const s of this.pool) {
          if (s.anchor >= 0 && wanted.has(s.anchor)) continue;
          s.target = free.shift() ?? -2;
        }
      }
    }
    let changed = false;
    for (const s of this.pool) {
      const step = dt / POOL_FADE_S;
      if (s.target !== -1) {
        // Padamkan dulu, lalu pindah ke titik baru.
        s.level = Math.max(0, s.level - step);
        if (s.level === 0) {
          s.anchor = s.target >= 0 ? s.target : -1;
          s.target = -1;
          if (s.anchor >= 0) {
            const a = this.anchors[s.anchor]!;
            s.light.position.copy(a.pos);
            s.light.color.copy(a.color);
            s.light.distance = a.data.distance;
            s.light.decay = a.data.decay;
          }
        }
        changed = true;
      } else if (s.anchor >= 0 && s.level < 1) {
        s.level = Math.min(1, s.level + step);
        changed = true;
      }
      s.light.intensity = s.anchor >= 0 ? this.anchors[s.anchor]!.data.intensity * s.level : 0;
    }
    if (changed) this.refreshDecals();
  }

  private refreshDecals() {
    this.anchors.forEach((a, i) => {
      const lit = this.high ? this.pool.find((s) => s.anchor === i)?.level ?? 0 : 0;
      this.decals.setColorAt(i, this.tmp.copy(a.color).multiplyScalar(a.k * (1 - lit * 0.8)));
    });
    if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true;
  }

  activeLights() {
    return this.pool.filter((s) => s.light.visible).length;
  }

  dispose() {
    const mat = this.decals.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    this.decals.geometry.dispose();
    this.decals.dispose();
    for (const s of this.pool) s.light.dispose();
  }
}

// ============================================================================
// Pendar layar monitor di meja (pengganti PointLight screenGlow)
// ============================================================================

export class DeskGlows {
  readonly mesh: THREE.InstancedMesh;
  private tmp = new THREE.Color();

  constructor(capacity: number) {
    const tex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = instanced(flatPlane(), mat, Math.max(1, capacity), 'FX_Desk_Glows');
    this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    // instanceColor dibuat sejak awal supaya program shader tidak berubah setelah render pertama.
    for (let i = 0; i < Math.max(1, capacity); i++) this.mesh.setColorAt(i, this.tmp.setRGB(0, 0, 0));
  }

  /** Letakkan pendar ke-`i` di permukaan meja (koordinat lokal `deskGroup`). */
  place(i: number, deskGroup: THREE.Object3D, localX: number, localY: number, localZ: number, w: number, d: number) {
    deskGroup.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(localX, localY, localZ), new THREE.Quaternion(), new THREE.Vector3(w, 1, d),
    );
    this.mesh.setMatrixAt(i, local.premultiply(deskGroup.matrixWorld));
    this.mesh.count = Math.max(this.mesh.count, i + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setColor(i: number, color: THREE.Color, k: number) {
    this.mesh.setColorAt(i, this.tmp.copy(color).multiplyScalar(Math.max(0, k)));
  }

  commit() {
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
