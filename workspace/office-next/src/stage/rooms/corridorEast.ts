import * as THREE from 'three';
import { CORRIDOR_EAST } from '../layout';
import { box, mountAsset, std, type ModelLoader } from './assets';

/**
 * LAYER KONEKTOR KORIDOR: Corridor_East_Connector (plan §4).
 * Origin = pusat lantai koridor; sumbu panjang searah X (2.80 m), lebar Z 2.00 m.
 * Ujung barat terbuka (menyambung celah pintu office_room_shell.glb), ujung timur
 * berpintu geser kaca yang terbuka menuju ruang rapat.
 */
export function buildCorridorEast(load: ModelLoader) {
  const group = new THREE.Group();
  group.name = CORRIDOR_EAST.name;
  // Turun 4 mm: lantai koridor yang menumpuk 0.3 m dengan slab ruang kerja (X 6.70..7.00)
  // tidak berkedip (z-fighting); permukaan jalan tetap di atas slab ruang kerja.
  group.position.set(CORRIDOR_EAST.origin.x, -0.004, CORRIDOR_EAST.origin.z);

  const connector = new THREE.Group();
  connector.name = 'SubLayer_Connector';
  group.add(connector);

  mountAsset(connector, '/models/Office_Glass_Corridor.glb', corridorPlaceholder(), load);
  return { group };
}

function corridorPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Office_Glass_Corridor_Placeholder';
  const L = CORRIDOR_EAST.halfLength * 2;
  const slate = std(0x18252b, 0.9, 0.05);
  const terrazzo = std(0x263339, 0.65, 0.05);
  const frame = std(0x172a30, 0.35, 0.75);
  const led = std(0x0b1a1d, 0.4, 0.1, { emissive: 0x5ed9e7, emissiveIntensity: 1.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xb9e3e8, roughness: 0.1, metalness: 0.1,
    transparent: true, opacity: 0.22, depthWrite: false,
  });
  const handle = std(0x0b1a1d, 0.3, 0.2, { emissive: 0x5ed9e7, emissiveIntensity: 1.5 });

  // Lantai: sub-slab + runner terrazzo + strip LED pemandu
  g.add(box(L, 0.28, 2.0, slate, [0, -0.16, 0], 'Corridor_SubSlab'));
  g.add(box(L, 0.02, 1.5, terrazzo, [0, -0.01, 0], 'Corridor_Terrazzo'));
  for (const z of [-0.76, 0.76]) {
    const strip = box(L, 0.004, 0.03, led, [0, 0.002, z], 'Corridor_LED_Guide');
    strip.castShadow = false;
    g.add(strip);
  }

  // Dinding kaca utara penuh (belakang, dilihat kamera) + rangka
  const north = box(L, 3.1, 0.02, glass, [0, 1.55, -0.92], 'Corridor_North_Glass');
  north.castShadow = false;
  g.add(north);
  for (const x of [-L / 2 + 0.03, 0, L / 2 - 0.03]) g.add(box(0.06, 3.1, 0.06, frame, [x, 1.55, -0.92]));
  g.add(box(L, 0.08, 0.08, frame, [0, 3.06, -0.92], 'Corridor_Header'));
  g.add(box(L, 0.1, 0.08, frame, [0, 0.05, -0.92], 'Corridor_Bottom_Rail'));

  // Sisi selatan (menghadap kamera): balustrade kaca rendah 1.05 m
  const southGlass = box(L, 0.92, 0.02, glass, [0, 0.59, 0.92], 'Corridor_South_Balustrade');
  southGlass.castShadow = false;
  g.add(southGlass);
  g.add(box(L, 0.04, 0.05, frame, [0, 1.05, 0.92], 'Corridor_Handrail'));
  g.add(box(L, 0.13, 0.1, frame, [0, 0.065, 0.92], 'Corridor_Curb'));

  // Ujung timur: kusen portal + 1 daun pintu geser kaca posisi TERBUKA (bergeser ke utara)
  const ex = L / 2 - 0.04;
  for (const z of [-0.74, 0.74]) g.add(box(0.08, 2.55, 0.08, frame, [ex, 1.275, z]));
  g.add(box(0.08, 0.08, 1.56, frame, [ex, 2.59, 0]));
  const leaf = box(0.02, 2.45, 1.4, glass, [ex - 0.07, 1.25, -1.36], 'Corridor_Sliding_Door');
  leaf.castShadow = false;
  g.add(leaf);
  g.add(box(0.03, 0.4, 0.03, handle, [ex - 0.09, 1.25, -0.72], 'Corridor_Door_Handle'));

  // Rusuk atap terbuka
  for (const x of [-1.2, 0, 1.2]) g.add(box(0.06, 0.06, 2.0, frame, [x, 3.05, 0]));
  return g;
}
