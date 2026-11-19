import * as THREE from 'three';

/**
 * Auto-Fade Wall ala The Sims (plan §3C, diperluas di Tahap 1 untuk gedung banyak ruangan).
 *
 * Ada dua mode tampilan:
 *
 * 1. RUMAH BONEKA: kamera isometrik, atau Free Cam yang berada di luar gedung / lebih tinggi
 *    dari dinding. Dinding yang menghalangi isi ruangan memudar ke opacity 0.15:
 *    - Dinding TEPI (perimeter) didaftarkan dengan normal menghadap KE DALAM dan satu titik di
 *      permukaan dalamnya; ia memudar bila kamera berada di belakangnya (dot < 0).
 *      Kamera ortografis memakai arah pandang, kamera perspektif memakai posisinya.
 *    - Dinding DALAM (`interior`: di antara dua ruangan) selalu memudar, karena dari sisi mana
 *      pun ia menutupi salah satu ruangan di baliknya.
 *
 * 2. JALAN KAKI: Free Cam berada di dalam tapak gedung dan di bawah tinggi dinding. Tidak ada
 *    dinding yang memudar: semua berdiri utuh sehingga bisa menyusuri ruangan lewat pintu.
 */
const FADED_OPACITY = 0.15;

/** Tapak ruangan di dunia (untuk menentukan kamera Free Cam sedang di dalam gedung). */
export interface WalkZone { minX: number; maxX: number; minZ: number; maxZ: number }

interface FadeMat {
  mat: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
  /** Papan / tulisan dinding (`userData.fadeHide`): hilang penuh saat dindingnya memudar penuh. */
  hide: boolean;
}

interface WallEntry {
  id: string;
  roots: THREE.Object3D[];
  normal: THREE.Vector3;
  point: THREE.Vector3;
  interior: boolean;
  opacity: number;
  fadeMode: boolean;
  mats: FadeMat[];
  /** Material sumber → klon milik dinding ini (satu klon per material unik, bukan per mesh). */
  clones: Map<THREE.Material, THREE.Material>;
}

export class WallFader {
  private walls = new Map<string, WallEntry>();
  /** Mesh dinding buram (bukan kaca) untuk garis pandang bubble F3; null = hitung ulang. */
  private occluderCache: THREE.Mesh[] | null = null;

  /**
   * F3: mesh dinding yang buram pada material aslinya (kaca & panel transparan dikecualikan).
   * Dipakai untuk menyembunyikan bubble di balik dinding saat kamera Mata Agen.
   */
  occluders(): THREE.Mesh[] {
    if (this.occluderCache) return this.occluderCache;
    const out: THREE.Mesh[] = [];
    for (const w of this.walls.values()) {
      const clear = new Set(w.mats.filter((f) => f.baseTransparent && f.baseOpacity < 0.9).map((f) => f.mat));
      for (const root of w.roots) {
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || m.userData.fadeHide) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          if (mats.every((mm) => clear.has(mm))) return;
          out.push(m);
        });
      }
    }
    this.occluderCache = out;
    return out;
  }
  private tmp = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private zones: WalkZone[] = [];
  private walkMaxY = 0;

  /** Tapak gedung + tinggi dinding: di dalamnya Free Cam masuk mode jalan kaki (dinding utuh). */
  setWalkZones(zones: WalkZone[], maxY: number) {
    this.zones = zones;
    this.walkMaxY = maxY;
  }

  /**
   * Daftarkan / perbarui dinding. normal & point dalam koordinat dunia.
   * `interior: true` untuk dinding di antara dua ruangan (lihat catatan di atas).
   */
  register(
    id: string,
    roots: THREE.Object3D[],
    normal: THREE.Vector3,
    point: THREE.Vector3,
    opts: { interior?: boolean } = {},
  ) {
    const prev = this.walls.get(id);
    if (prev) this.restore(prev);
    const entry: WallEntry = {
      id,
      roots: roots.filter(Boolean),
      normal: normal.clone().normalize(),
      point: point.clone(),
      interior: opts.interior === true,
      opacity: prev?.opacity ?? 1,
      fadeMode: false,
      mats: [],
      clones: prev?.clones ?? new Map(),
    };
    this.collect(entry);
    this.walls.set(id, entry);
    this.occluderCache = null;
  }

  /** Kumpulkan ulang material (dipanggil setelah placeholder diganti GLB). */
  refresh(id?: string) {
    for (const entry of this.walls.values()) {
      if (id && entry.id !== id) continue;
      this.restore(entry);
      this.collect(entry);
    }
    this.occluderCache = null;
  }

  update(camera: THREE.Camera, dt: number) {
    const ortho = (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    if (ortho) camera.getWorldDirection(this.dir).negate();
    const walking = !ortho && this.isWalking(camera.position);
    const k = Math.min(1, dt * 6);
    for (const w of this.walls.values()) {
      let behind: boolean;
      if (walking) {
        behind = false;
      } else if (w.interior) {
        behind = true;
      } else if (ortho) {
        behind = w.normal.dot(this.dir) < -0.02;
      } else {
        this.tmp.copy(camera.position).sub(w.point);
        behind = w.normal.dot(this.tmp) < 0;
      }
      const target = behind ? FADED_OPACITY : 1;
      if (Math.abs(w.opacity - target) < 0.002 && w.fadeMode === (target < 1)) continue;
      w.opacity += (target - w.opacity) * k;
      if (Math.abs(w.opacity - target) < 0.002) w.opacity = target;
      this.apply(w);
    }
  }

  private isWalking(p: THREE.Vector3) {
    if (p.y >= this.walkMaxY) return false;
    for (const z of this.zones) {
      if (p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ) return true;
    }
    return false;
  }

  private apply(w: WallEntry) {
    const fading = w.opacity < 0.995;
    if (fading !== w.fadeMode) {
      w.fadeMode = fading;
      for (const f of w.mats) {
        f.mat.transparent = fading ? true : f.baseTransparent;
        f.mat.depthWrite = fading ? false : f.baseDepthWrite;
        f.mat.needsUpdate = true;
      }
    }
    const hideK = Math.max(0, (w.opacity - FADED_OPACITY) / (1 - FADED_OPACITY));
    for (const f of w.mats) f.mat.opacity = fading ? f.baseOpacity * (f.hide ? hideK : w.opacity) : f.baseOpacity;
  }

  private restore(w: WallEntry) {
    for (const f of w.mats) {
      f.mat.transparent = f.baseTransparent;
      f.mat.depthWrite = f.baseDepthWrite;
      f.mat.opacity = f.baseOpacity;
      f.mat.needsUpdate = true;
    }
    w.mats = [];
    w.fadeMode = false;
  }

  private collect(w: WallEntry) {
    const seen = new Set<THREE.Material>();
    for (const root of w.roots) {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Material GLB sering dipakai bersama lantai / objek lain: dinding memakai klonnya sendiri,
        // cukup satu klon per material sumber untuk seluruh dinding ini.
        if (!mesh.userData.fadeOwned) {
          const own = (m: THREE.Material) => {
            let c = w.clones.get(m);
            if (!c) { c = m.clone(); w.clones.set(m, c); }
            return c;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
          mesh.userData.fadeOwned = true;
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (seen.has(mat)) continue;
          seen.add(mat);
          w.mats.push({
            mat,
            baseOpacity: mat.opacity,
            baseTransparent: mat.transparent,
            baseDepthWrite: mat.depthWrite,
            hide: mesh.userData.fadeHide === true,
          });
        }
      });
    }
    this.apply(w);
  }
}
