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
 * Kotak lantai dengan skala UV 1 unit = 1 meter di seluruh sisi (cocok untuk
 * tekstur karpet berpola tile 1 m = 2×2 kotak) beserta tangent normalMap.
 */
export function meterBox(
  w: number, h: number, d: number,
  mat: THREE.Material,
  pos: [number, number, number],
  name?: string,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv');
  const dims: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  if (uv) {
    for (let f = 0; f < 6; f++) {
      const dim = dims[f];
      if (!dim) continue;
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * dim[0], uv.getY(k) * dim[1]);
      }
    }
    uv.needsUpdate = true;
  }
  geo.computeTangents();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (name) m.name = name;
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

/** Material karpet charcoal placeholder sebelum Office_Boardroom_Shell.glb selesai dimuat. */
export function createFallbackCarpetMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const cc = canvas.getContext('2d')!;
  cc.fillStyle = '#1d242b';
  cc.fillRect(0, 0, 128, 128);
  cc.fillStyle = '#242d35';
  cc.fillRect(0, 0, 64, 64);
  cc.fillRect(64, 64, 64, 64);
  cc.strokeStyle = '#161c22';
  cc.lineWidth = 2;
  cc.strokeRect(1, 1, 126, 126);
  const tex = canvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.92, 0.02, { map: tex });
}

/** Gandakan material karpet ruang rapat tanpa menggandakan tekstur di VRAM. */
export function cloneCarpetMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const mat = source.clone();
  if (mat.map) {
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.anisotropy = Math.max(mat.map.anisotropy || 1, 4);
  }
  if (mat.normalMap) {
    mat.normalMap.wrapS = mat.normalMap.wrapT = THREE.RepeatWrapping;
    mat.normalMap.anisotropy = Math.max(mat.normalMap.anisotropy || 1, 4);
  }
  mat.needsUpdate = true;
  return mat;
}

/** Membuat lantai karpet seragam (skala UV 1 m) beserta setter material GLB ruang rapat. */
export function createCarpetFloor(
  w: number,
  d: number,
  pos: [number, number, number],
  name: string,
) {
  let fallback: THREE.MeshStandardMaterial | null = createFallbackCarpetMaterial();
  const mesh = meterBox(w, 0.02, d, fallback, pos, name);
  return {
    mesh,
    applyMaterial: (source: THREE.MeshStandardMaterial) => {
      mesh.material = cloneCarpetMaterial(source);
      if (fallback) {
        fallback.map?.dispose();
        fallback.dispose();
        fallback = null;
      }
    },
  };
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
