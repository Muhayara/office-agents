#!/usr/bin/env node
/**
 * Pipeline optimasi GLB Office Agents 3D (`npm run optimize:models`).
 *
 * Untuk setiap file di `public/models/*.glb`:
 *   1. Sumber = cadangan mentah di `tools/models-raw/` (dibuat otomatis saat file pertama kali diproses
 *      atau saat GLB baru diekspor ulang). Jadi tekstur tidak pernah di-encode WebP dua kali.
 *   2. dequantize → weld → dedup → join aman-kontrak (lihat KEEP_*) → prune
 *      → tekstur WebP (maks 1024 px) → meshopt (quantize + EXT_meshopt_compression).
 *   3. Ditulis kembali in-place ke `public/models/` dengan penanda `office-optimize vN` di asset.generator.
 *   4. Pemeriksaan kontrak: setiap nama node kontrak yang ada di sumber wajib ada di hasil.
 *
 * Idempoten: file yang sudah bertanda versi yang sama dilewati (pakai `--force` untuk memproses ulang
 * dari cadangan mentah). Opsi: `--force`, `--only <substring>`, `--dry` (tanpa menulis).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  compactPrimitive,
  dedup,
  dequantize,
  joinPrimitives,
  meshopt,
  palette,
  prune,
  textureCompress,
  transformPrimitive,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const VERSION = 2;
const MARK = `office-optimize v${VERSION}`;
const MARK_RE = /office-optimize v(\d+)/;
const TEXTURE_MAX = 1024;
const WEBP_QUALITY = 85;

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const MODELS = path.join(ROOT, 'public', 'models');
const RAW = path.join(ROOT, 'tools', 'models-raw');

/**
 * Node yang dipakai kode runtime lewat nama (getObjectByName / regex). Node ini (beserta posisinya di
 * hierarki) tidak pernah digabung ke node lain; turunannya hanya digabung DI DALAM node itu sendiri,
 * sehingga transformasi, visibilitas, dan pemudaran dinding per node tetap berlaku.
 * Sumber: mainWorkspace.ts, boardroom.ts, managerOffice.ts, serverRoom.ts, workshopTraining.ts,
 * lobbyReception.ts, infoWall.ts, collabPods.ts, focusPods.ts, accessHub.ts (lihat §3 rencana optimasi).
 */
const KEEP_NAMES = new Set([
  // office_room_shell.glb (mainWorkspace.ts: WallFader & kaca penutup celah timur)
  'Back_Wall', 'Back_Wall_Inset', 'Back_Baseboard', 'Back_Top_Cap', 'Transom_Window', 'Ceiling_Light_Strip',
  'Left_Wall', 'Left_Wall_Inset', 'Left_Baseboard', 'Left_Top_Cap', 'Left_Wall_Accent',
  'Partition_Left_Glass', 'Floor_Slab',
  // Office_Boardroom_Shell.glb (boardroom.ts)
  'North_Wall', 'West_Wall_Acoustic', 'WW_Baseboard_Pier', 'Floor_Carpet_AcousticCharcoal',
  // Office_Conference_Chair.glb (putaran kursi saat rapat)
  'Chair_Base', 'Chair_Swivel',
  // Layar aktif (fitOverlay / pengepasan kanvas)
  'Screen_ActiveArea_4K', 'Kiosk_Screen', 'InfoWall_Main_Screen', 'Command_Screen_Active', 'Access_Map_Screen',
  // LED yang diwarnai ulang oleh scene
  'Pod_Occupancy_LED', 'Focus_Status_LED',
]);
const KEEP_PATTERNS = [
  /screen/i, // fallback pencarian layar di boardroom/manager/server/lobby/fitOverlay
  /^(Timber_|Front_Cutaway_Threshold$|Partition_Bolt_|Sliding_Door_Handle$)/, // HIDDEN_SHELL_PARTS ruang kerja
  /^(Doorway_Portal|Curb_South|Curb_Corner_Cap_SE)/, // HIDDEN_SHELL_PARTS ruang rapat
];

/** Sama dengan THREE.PropertyBinding.sanitizeNodeName (nama yang dilihat runtime). */
const sanitize = (name) => name.replace(/\s/g, '_').replace(/[[\]./:]/g, '');
const isKeepName = (raw) => {
  if (!raw) return false;
  const n = sanitize(raw);
  return KEEP_NAMES.has(n) || KEEP_PATTERNS.some((re) => re.test(n));
};
const isKeep = (node) => isKeepName(node.getName()) || isKeepName(node.getMesh()?.getName() ?? '');

function readHeaderJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) return null;
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

/** Nama kontrak (tersanitasi) yang ada di dokumen. */
function contractNames(doc) {
  const out = new Set();
  for (const node of doc.getRoot().listNodes()) {
    for (const raw of [node.getName(), node.getMesh()?.getName() ?? '']) if (isKeepName(raw)) out.add(sanitize(raw));
  }
  return out;
}

function primKey(prim) {
  const mat = prim.getMaterial();
  const attrs = prim.listSemantics().sort().map((s) => {
    const a = prim.getAttribute(s);
    return `${s}:${a.getElementSize()}:${a.getComponentType()}:${a.getNormalized() ? 1 : 0}`;
  }).join('+');
  return { mat, key: `${attrs}|${prim.getMode()}|${prim.getIndices() ? 1 : 0}` };
}

function deepClonePrim(prim) {
  const dst = prim.clone();
  for (const s of dst.listSemantics()) dst.setAttribute(s, dst.getAttribute(s).clone());
  const idx = dst.getIndices();
  if (idx) dst.setIndices(idx.clone());
  return dst;
}

function invertMat4(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}

function mulMat4(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

/**
 * Join aman-kontrak: tiap "klaster" (adegan, atau node kontrak) menggabungkan semua primitive turunannya
 * (berhenti di node kontrak berikutnya) per material ke satu node baru di bawah akar klaster.
 */
function contractSafeJoin(doc, logger) {
  const root = doc.getRoot();
  let joinedPrims = 0, newPrims = 0;
  const emptied = new Set();

  for (const scene of root.listScenes()) {
    /** @type {Array<{ root: any, isScene: boolean }>} */
    const clusters = [{ root: scene, isScene: true }];
    scene.traverse((n) => { if (isKeep(n)) clusters.push({ root: n, isScene: false }); });

    for (const cl of clusters) {
      const members = [];
      const visit = (node) => {
        for (const child of node.listChildren()) {
          if (isKeep(child)) continue; // klaster sendiri
          if (child.getMesh() && !child.getSkin() && !child.getExtension('EXT_mesh_gpu_instancing')) members.push(child);
          visit(child);
        }
      };
      visit(cl.root);
      // Mesh pada node kontrak itu sendiri tetap utuh (mis. layar, LED, dinding).
      if (members.length === 0) continue;

      const inv = cl.isScene ? null : invertMat4(cl.root.getWorldMatrix());
      if (!cl.isScene && !inv) continue;
      const groups = new Map();
      for (const node of members) {
        const world = node.getWorldMatrix();
        const local = inv ? mulMat4(inv, world) : world;
        for (const prim of node.getMesh().listPrimitives()) {
          if (prim.listTargets().length > 0 || prim.getMode() !== Primitive.Mode.TRIANGLES) continue;
          const { mat, key } = primKey(prim);
          const gk = `${root.listMaterials().indexOf(mat)}#${key}`;
          if (!groups.has(gk)) groups.set(gk, []);
          groups.get(gk).push({ node, prim, local });
        }
      }

      let gi = 0;
      for (const list of groups.values()) {
        const clones = list.map(({ prim, local }) => {
          const c = deepClonePrim(prim);
          compactPrimitive(c);
          transformPrimitive(c, local);
          return c;
        });
        let joined;
        try {
          joined = clones.length === 1 ? clones[0] : joinPrimitives(clones);
        } catch (e) {
          logger(`   ! join dilewati (${e.message})`);
          for (const c of clones) c.dispose();
          continue;
        }
        if (joined !== clones[0]) for (const c of clones) c.dispose();
        const base = cl.isScene ? 'Merged' : sanitize(cl.root.getName());
        const mesh = doc.createMesh(`${base}__m${gi}`).addPrimitive(joined);
        const node = doc.createNode(`${base}__j${gi}`).setMesh(mesh);
        gi++;
        if (cl.isScene) scene.addChild(node); else cl.root.addChild(node);
        for (const { node: src, prim } of list) {
          src.getMesh()?.removePrimitive(prim);
          emptied.add(src);
        }
        joinedPrims += list.length;
        newPrims += 1;
      }
    }
  }

  // Lepas mesh kosong dari node sumber, lalu buang node daun kosong yang bukan kontrak.
  for (const node of emptied) {
    const mesh = node.getMesh();
    if (mesh && mesh.listPrimitives().length === 0) node.setMesh(null);
  }
  let removed = true;
  while (removed) {
    removed = false;
    for (const node of root.listNodes()) {
      if (node.getMesh() || node.listChildren().length > 0 || node.getCamera() || node.getSkin() || isKeep(node)) continue;
      if (node.listExtensions().length > 0) continue;
      node.dispose();
      removed = true;
    }
  }
  return { joinedPrims, newPrims };
}

/**
 * Material milik node kontrak tidak boleh masuk palet: kode runtime mewarnai ulang (LED), memakai ulang
 * materialnya pada geometri lain dengan UV sendiri (kaca partisi, kayu baseboard, karpet), atau
 * mengukur layarnya. `palette()` melewati material bertekstur, jadi material ini diberi tekstur
 * penanda sementara selama palet dibuat.
 */
function shieldContractMaterials(doc) {
  const marker = doc.createTexture('__keep_out_of_palette').setMimeType('image/png').setImage(new Uint8Array([0]));
  const shielded = [];
  for (const node of doc.getRoot().listNodes()) {
    if (!isKeep(node)) continue;
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      const mat = prim.getMaterial();
      if (!mat || mat.getBaseColorTexture() || shielded.includes(mat)) continue;
      mat.setBaseColorTexture(marker);
      shielded.push(mat);
    }
  }
  return () => {
    for (const mat of shielded) mat.setBaseColorTexture(null);
    marker.dispose();
  };
}

function stats(doc) {
  const root = doc.getRoot();
  let prims = 0;
  for (const m of root.listMeshes()) prims += m.listPrimitives().length;
  return { nodes: root.listNodes().length, prims, mats: root.listMaterials().length, tex: root.listTextures().length };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dry = args.includes('--dry');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

  fs.mkdirSync(RAW, { recursive: true });
  const files = fs.readdirSync(MODELS).filter((f) => f.toLowerCase().endsWith('.glb') && (!only || f.includes(only))).sort();
  let totalBefore = 0, totalAfter = 0, failed = 0, skipped = 0;

  for (const file of files) {
    const pub = path.join(MODELS, file);
    const raw = path.join(RAW, file);
    const header = readHeaderJson(pub);
    if (!header) { console.log(`- ${file}: bukan GLB, dilewati`); continue; }
    const mark = MARK_RE.exec(String(header.asset?.generator ?? ''));
    const current = !!mark && Number(mark[1]) === VERSION;
    if (current && !force) {
      skipped++;
      const sz = fs.statSync(pub).size;
      totalBefore += fs.existsSync(raw) ? fs.statSync(raw).size : sz;
      totalAfter += sz;
      continue;
    }
    if (!mark) {
      // File mentah baru (ekspor pertama / ekspor ulang dari generator): simpan sebagai sumber.
      fs.copyFileSync(pub, raw);
    } else if (!fs.existsSync(raw)) {
      // Hasil versi lama tanpa cadangan mentah: jangan proses ulang hasil yang sudah lossy.
      console.log(`- ${file}: sudah dioptimasi tetapi cadangan mentah tidak ada, dilewati`);
      skipped++;
      continue;
    }

    const srcBytes = fs.statSync(raw).size;
    const doc = await io.read(raw);
    const before = stats(doc);
    const contractsBefore = contractNames(doc);
    const log = (m) => console.log(m);

    await doc.transform(
      dequantize(),
      weld(),
      dedup(),
      // Tekstur dikompres SEBELUM palet: tekstur palet (blok warna, filter NEAREST) tetap PNG lossless.
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_MAX, TEXTURE_MAX], quality: WEBP_QUALITY }),
      prune({ keepLeaves: true, keepAttributes: false, keepIndices: false }),
    );
    // Material warna polos digabung ke tekstur palet → lebih banyak primitive bermaterial sama → join lebih besar.
    const unshield = shieldContractMaterials(doc);
    await doc.transform(palette({ min: 3 }));
    unshield();
    const j = contractSafeJoin(doc, log);
    await doc.transform(
      prune({ keepLeaves: true, keepAttributes: false, keepIndices: false }),
      dedup(),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const asset = doc.getRoot().getAsset();
    asset.generator = `${asset.generator ?? 'glTF'} · ${MARK}`;

    const after = stats(doc);
    const contractsAfter = contractNames(doc);
    const missing = [...contractsBefore].filter((n) => !contractsAfter.has(n));
    if (missing.length) {
      console.log(`✗ ${file}: kontrak hilang → ${missing.join(', ')} (file TIDAK ditulis)`);
      failed++;
      continue;
    }
    const bytes = await io.writeBinary(doc);
    // Pemeriksaan ulang hasil tulis: bisa dibaca, ber-meshopt, tekstur ≤ batas.
    const check = await io.readBinary(bytes);
    const used = check.getRoot().listExtensionsUsed().map((e) => e.extensionName);
    const meshCount = check.getRoot().listMeshes().length;
    if (meshCount > 0 && !used.includes('EXT_meshopt_compression')) {
      console.log(`✗ ${file}: hasil tanpa EXT_meshopt_compression (file TIDAK ditulis)`);
      failed++;
      continue;
    }
    for (const tex of check.getRoot().listTextures()) {
      const size = tex.getSize();
      if (size && (size[0] > TEXTURE_MAX || size[1] > TEXTURE_MAX)) {
        console.log(`✗ ${file}: tekstur ${tex.getName()} ${size.join('×')} melebihi ${TEXTURE_MAX}`);
        failed++;
      }
    }
    if (!dry) fs.writeFileSync(pub, bytes);
    totalBefore += srcBytes;
    totalAfter += bytes.byteLength;
    const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
    console.log(
      `✓ ${file}: ${kb(srcBytes)} → ${kb(bytes.byteLength)} · prim ${before.prims} → ${after.prims}` +
      ` · node ${before.nodes} → ${after.nodes} · mat ${before.mats} → ${after.mats}` +
      ` · join ${j.joinedPrims}→${j.newPrims} · kontrak ${contractsAfter.size}`,
    );
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(`\nTotal: ${mb(totalBefore)} MB → ${mb(totalAfter)} MB (${files.length} file, ${skipped} dilewati, ${failed} gagal)`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
