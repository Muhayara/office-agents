import * as THREE from 'three';

/**
 * Auto-Fade Wall ala The Sims (plan §3C).
 *
 * Setiap dinding penuh didaftarkan dengan normal yang menghadap KE DALAM ruangan dan satu titik
 * di permukaan dalamnya. Bila kamera berada di belakang dinding (dot < 0), dinding memudar ke
 * opacity 0.15 tanpa menulis depth; bila kamera di depan / di dalam ruangan, kembali solid.
 *
 * - Kamera ortografis (isometrik): dipakai arah pandang kamera (posisinya hanya "jauh").
 * - Kamera perspektif (Free Cam): dipakai posisi kamera terhadap bidang dinding.
 */
const FADED_OPACITY = 0.15;

interface FadeMat {
  mat: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
}

interface WallEntry {
  id: string;
  roots: THREE.Object3D[];
  normal: THREE.Vector3;
  point: THREE.Vector3;
  opacity: number;
  fadeMode: boolean;
  mats: FadeMat[];
}

export class WallFader {
  private walls = new Map<string, WallEntry>();
  private tmp = new THREE.Vector3();
  private dir = new THREE.Vector3();

  /** Daftarkan / perbarui dinding. normal & point dalam koordinat dunia. */
  register(id: string, roots: THREE.Object3D[], normal: THREE.Vector3, point: THREE.Vector3) {
    const prev = this.walls.get(id);
    if (prev) this.restore(prev);
    const entry: WallEntry = {
      id,
      roots: roots.filter(Boolean),
      normal: normal.clone().normalize(),
      point: point.clone(),
      opacity: prev?.opacity ?? 1,
      fadeMode: false,
      mats: [],
    };
    this.collect(entry);
    this.walls.set(id, entry);
  }

  /** Kumpulkan ulang material (dipanggil setelah placeholder diganti GLB). */
  refresh(id?: string) {
    for (const entry of this.walls.values()) {
      if (id && entry.id !== id) continue;
      this.restore(entry);
      this.collect(entry);
    }
  }

  update(camera: THREE.Camera, dt: number) {
    const ortho = (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    if (ortho) camera.getWorldDirection(this.dir).negate();
    const k = Math.min(1, dt * 6);
    for (const w of this.walls.values()) {
      let behind: boolean;
      if (ortho) {
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
    for (const f of w.mats) f.mat.opacity = fading ? f.baseOpacity * w.opacity : f.baseOpacity;
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
        // Material GLB sering dipakai bersama lantai / objek lain: klon sekali per mesh.
        if (!mesh.userData.fadeOwned) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => m.clone())
            : mesh.material.clone();
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
          });
        }
      });
    }
    this.apply(w);
  }
}
