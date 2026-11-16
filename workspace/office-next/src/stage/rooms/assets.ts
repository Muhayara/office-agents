import * as THREE from 'three';

/** Memuat GLB; callback tidak dipanggil lagi setelah panggung dilepas. */
export type ModelLoader = (
  url: string,
  onLoad: (scene: THREE.Group) => void,
  onError?: (e: unknown) => void,
) => void;

/** Membebaskan geometri, material, dan tekstur sebuah objek beserta anak-anaknya. */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      mat.dispose();
    }
  });
}

export function enableShadow(g: THREE.Object3D, cast = true, receive = true) {
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
}

export function std(color: number, roughness = 0.6, metalness = 0.1, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

export function box(
  w: number, h: number, d: number,
  mat: THREE.Material,
  pos: [number, number, number],
  name?: string,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (name) m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Slot aset: menampilkan placeholder prosedural, lalu otomatis menggantinya dengan GLB
 * begitu file ada di public/models. Bila GLB belum ada (404 / fallback HTML), placeholder tetap.
 */
export function mountAsset(
  slot: THREE.Group,
  url: string,
  placeholder: THREE.Object3D,
  load: ModelLoader,
  onGlb?: (model: THREE.Group) => void,
) {
  slot.add(placeholder);
  load(
    url,
    (model) => {
      enableShadow(model);
      slot.remove(placeholder);
      disposeObject(placeholder);
      slot.add(model);
      onGlb?.(model);
    },
    () => { /* GLB belum dibuat: tetap memakai placeholder */ },
  );
}

/**
 * Memotong mesh kotak (rel / ambang lantai) yang melintang di celah pintu menjadi dua
 * segmen, sehingga kaki agen tidak menembus rel saat melewati pintu.
 * Mesh asli disembunyikan; segmen baru memakai material yang sama.
 */
export function splitMeshAlongZ(mesh: THREE.Mesh, gapMin: number, gapMax: number, parent: THREE.Object3D) {
  mesh.updateWorldMatrix(true, false);
  const bb = new THREE.Box3().setFromObject(mesh);
  if (bb.isEmpty() || bb.min.z >= gapMin || bb.max.z <= gapMax) return;
  mesh.visible = false;
  const material = mesh.material as THREE.Material;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const segs: Array<[number, number]> = [[bb.min.z, gapMin], [gapMax, bb.max.z]];
  segs.forEach(([z0, z1], i) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, z1 - z0), material);
    const world = new THREE.Vector3(cx, cy, (z0 + z1) / 2);
    seg.position.copy(parent.worldToLocal(world));
    seg.name = `${mesh.name}_Split_${i}`;
    seg.castShadow = mesh.castShadow;
    seg.receiveShadow = mesh.receiveShadow;
    parent.add(seg);
  });
}

/** CanvasTexture sRGB siap pakai untuk material layar / karpet. */
export function canvasTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
