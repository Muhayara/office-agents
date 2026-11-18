# Prompt Detail Pembuatan Model 3D — Tahap 4 (Collaboration Commons & Digital Garden)
> **Proyek:** Office Agents 2.5D (`workspace/office-next`)  
> **Engine Generator:** Three.js r128 (via CDN) + `GLTFExporter`  
> **Folder Generator Lokal:** `workspace/office-next/tools/3d-generator/` *(gitignored)*  
> **Folder Output Model:** `workspace/office-next/public/models/`  
> **Standar Skala:** Metrik `1 Unit = 1 Meter` (`1.0 = 100 cm`). Orientasi lokal model: Depan = `+Z`, Kanan = `+X`, Atas = `+Y`.

---

## 1. Ringkasan Kontrak 6 Aset 3D Baru Tahap 4

Seluruh ukuran, titik origin, dan batas ruang bebas di bawah ini **sudah disinkronkan persis** dengan kode produksi di [layout.ts](../src/stage/layout.ts), [collabCommons.ts](../src/stage/rooms/collabCommons.ts), [digitalGarden.ts](../src/stage/rooms/digitalGarden.ts), serta kontrak [tahap-4-commons-garden.md §5.E](./tahap-4-commons-garden.md).

| No | File Output GLB | Dimensi Kontrak ($W \times H \times D$) | Origin `(0,0,0)` & Arah Depan | Slot Kode & Posisi Dunia | Catatan Kritis Integrasi Scene |
|---|---|---|---|---|---|
| 1 | `Office_Commons_Collab_Table.glb` | $3.20 \times 0.74 \times 1.20\text{ m}$ *(spine daya $\le 0.775\text{ m}$)* | Lantai tengah; sisi panjang = `X` | `collabCommons.ts:99` · `(20.55, 2.12)`, `rotY = 0` | **Tanpa laptop/buku** (scene memasang `Collab_Table_Props` di `Y = 0.74`). Kaki tengah masuk ke dalam agar kursi tengah leluasa. |
| 2 | `Office_Commons_Acoustic_Booth.glb` | Silinder luar $\le \varnothing 1.90\text{ m}$ ($R \le 0.95$), $H = 1.25\text{ m}$ *(cap $\le 1.27$)* | Lantai pusat lingkaran duduk; punggung di `-Z`, **terbuka ke `+Z`** | `collabCommons.ts:125` · `(16.25, 0.25)`, `rotY = 45°` | Jari-jari horizontal semua verteks **wajib $R \le 0.95\text{ m}$** agar menyisakan celah $6\text{ cm}$ dari dinding barat & utara Commons. |
| 3 | `Office_Garden_Living_Wall.glb` | $3.00 \times 2.40 \times 0.15\text{ m}$ *(ujung daun $\le 0.18\text{ m}$)* | **Tengah sisi BELAKANG di lantai** (`z = 0`); daun menghadap `+Z` | `digitalGarden.ts:106` · `(22.0, 9.4)`, `rotY = 90°` | Tidak boleh ada geometri di `z < 0` agar tidak menembus dinding timur Ruang Server (`X = 22.0`). |
| 4 | `Office_Garden_Zen_Fountain.glb` | $0.90 \times 0.85 \times 0.55\text{ m}$ *(bibir bak $0.42\text{ m}$)* | Lantai tengah; depan `+Z` | `digitalGarden.ts:119` · `(22.35, 12.0)`, `rotY = 90°` | **Tanpa mesh air!** Scene memasang `Fountain_Water_Overlay` beranimasi di `Y = 0.40` ($0.78 \times 0.43\text{ m}$) & aliran jatuh dari **ujung bambu `(0.03, 0.655, 0.05)`**. |
| 5 | `Office_Garden_Teak_Bench.glb` | $1.80 \times 0.45 \times 0.42\text{ m}$ | Lantai tengah; sisi panjang = `X` | `digitalGarden.ts:125` · `(25.45, 11.32)`, `rotY = 0` | **Tanpa sandaran** (`yMax = 0.45 m` rata). Agen duduk di 3 titik menghadap Selatan (`+Z`). |
| 6 | `Office_Plant_Fiddle_Leaf_Fig.glb` | Kanopi $\le \varnothing 0.80\text{ m}$ ($R \le 0.40$), $H = 2.00\text{ m}$; pot $\varnothing 0.42 \times 0.45\text{ m}$ | Lantai di tengah dasar pot | `digitalGarden.ts:131` · `(26.30, 8.20)`, `rotY = 0` | Jari-jari kanopi **wajib $R \le 0.40\text{ m}$** agar menyisakan celah $6\text{ cm}$ dari dinding timur Garden (`X = 26.76`) & $16\text{ cm}$ dari kaca utara. |

> [!NOTE]
> **Aset Eksisting yang Dipakai Ulang di Tahap 4 (Tidak Perlu Dibuat Ulang):**
> - `Office_Ergonomic_Chair.glb` (6× kursi meja kolaborasi Commons)
> - `Office_Linear_Pendant_Light.glb` (lampu gantung di atas meja kolaborasi Commons)
> - `Office_Whiteboard_Scrum.glb` (whiteboard beroda di dinding utara Commons)
> - `Office_Indoor_Plant.glb` (2× monstera di sudut timur laut Commons & tenggara Garden)
> - `Office_Indoor_Plant_SnakePlant.glb` (2× lidah mertua di sisi barat Commons & timur Garden)

---

## 2. Panduan Penggunaan Prompt

1. Salin masing-masing blok prompt di bawah ke Claude Code untuk membuat 6 file generator mandiri di `workspace/office-next/tools/3d-generator/<Nama_Model>.html`.
2. Buka masing-masing file HTML di browser, pastikan panel pemeriksaan ukuran (*dimension/contract check*) berstatus **PASS**, lalu klik tombol **"Export GLB"**.
3. Salin keenam file `.glb` ke `workspace/office-next/public/models/`:
   ```text
   workspace/office-next/public/models/
     ├── Office_Commons_Collab_Table.glb
     ├── Office_Commons_Acoustic_Booth.glb
     ├── Office_Garden_Living_Wall.glb
     ├── Office_Garden_Zen_Fountain.glb
     ├── Office_Garden_Teak_Bench.glb
     └── Office_Plant_Fiddle_Leaf_Fig.glb
   ```
4. Saat halaman `office-next` dimuat ulang, fungsi `mountAsset()` di `collabCommons.ts` dan `digitalGarden.ts` otomatis mengganti placeholder prosedural dengan model GLB tersebut tanpa perlu mengubah kode panggung.

---

## 3. Koleksi Prompt Detail per Model

---

### PROMPT 1: Meja Kolaborasi Modular (`Office_Commons_Collab_Table.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Commons_Collab_Table" (Modular 6-Person Team Collaboration Workbench Table with Central Power & Data Spine).

1. STRICT METRIC SCALING, ORIGIN & SCENE CONTRACT:
   - Total Length (X): 3.20 m (x spans -1.60 m to +1.60 m, ±3 mm).
   - Total Depth (Z): 1.20 m (z spans -0.60 m to +0.60 m, ±3 mm).
   - Worktop Surface Height (Y): STRICTLY 0.74 m (the host scene mounts laptop and notebook props directly at Y = 0.74 m).
   - Central Power/Data Spine Height: Low-profile recessed/raised aluminum channel along Z = 0, rising at most 35 mm above the tabletop (max total Y <= 0.775 m, width along Z <= 0.14 m so z = ±0.18..±0.45 m remains completely flat for scene laptops).
   - Origin (0,0,0): Floor center directly beneath the table center (Y = 0 on floor).
   - IMPORTANT EXCLUSION: Do NOT place any laptops, monitors, mugs, or notebooks on the tabletop—the host scene dynamically spawns "Collab_Table_Props" at x = -1.05, 0.0, +1.05 and z = ±0.30 at Y = 0.74 m.

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Dual Modular Tabletops:
     - Two precision-joined 1.60 m × 1.20 m × 30 mm architectural tabletop slabs (x = -0.80 m and +0.80 m) with subtle 3 mm chamfered edges and a 4 mm center seam reveal.
     - Surface finish: Warm bleached white-oak laminate (procedural subtle linear woodgrain CanvasTexture, MeshStandardMaterial roughness 0.42, metalness 0.02) with contrasting natural oak edge banding (#b88a5a).
   - Ergonomic Trestle Steel Subframe (Knee-Clearance Aware):
     - Outer end A-frame / angled trestle legs at x = ±1.44 m crafted from 55×55 mm matte black powder-coated steel tubes (#17191c, roughness 0.48, metalness 0.78) with brass/chrome leveling glides.
     - Center support at x = 0.0 m MUST be a recessed inset dual-post column (kept within z = -0.24 m to +0.24 m) so agents seated at the middle chairs (x = 0.0, z = ±0.92 m) have full unobstructed legroom.
     - Dual longitudinal under-desk steel structural beams and a perforated matte-black under-desk cable management tray (y = 0.58..0.68 m, z = -0.14..+0.14 m).
   - Central Power & Data Spine (Along X at Z = 0):
     - Brushed dark anodized aluminum power trough (length 2.80 m, width 0.12 m, top at Y = 0.772 m) with hinged cable-brush flaps, 6 AC power outlets, USB-C PD ports, and subtle RJ45 data jacks with tiny status LEDs.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Commons_Collab_Table".
   - Enable castShadow = true and receiveShadow = true on all meshes. Keep triangle count under 14,000.
   - Include an on-screen automated contract check panel verifying bounding box (3.20 × <=0.775 × 1.20 m), yMin = 0, flat worktop at Y = 0.74 m, and triangle budget, plus OrbitControls, 3-point PBR studio lighting, and a single-click "Export GLB" button saving "Office_Commons_Collab_Table.glb".
```

---

### PROMPT 2: Booth Diskusi Akustik Setengah Lingkaran (`Office_Commons_Acoustic_Booth.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Commons_Acoustic_Booth" (Semi-Circular Upholstered Acoustic Huddle Alcove Booth with Pedestal Laptop Table).

1. STRICT METRIC SCALING, CYLINDER CLEARANCE & ORIGIN CONTRACT:
   - Origin (0,0,0): Floor center (Y = 0) of the circular seating footprint.
   - Orientation: High curved acoustic back wall occupies the -Z half (angles PI to 2*PI, z <= 0). The open entrance faces STRICTLY towards +Z.
   - CRITICAL WALL-CLEARANCE CONSTRAINT: Every single vertex in the model MUST lie inside horizontal cylinder radius R <= 0.95 m (Math.hypot(x, z) <= 0.950 m, outer diameter <= 1.90 m). In the host room, this booth sits at (-3.75, -1.75) rotated 45° near walls at -4.76, leaving 6 cm clearance—no plinth, trim, or rib may exceed R = 0.950 m!
   - Acoustic Back Shell Height: 1.25 m (optional top oak cap trim up to max Y = 1.27 m), radial thickness 0.15 m (R = 0.80 m to 0.95 m).
   - Curved Bench Seat Height: Top cushion surface at Y = 0.45 m, spanning radial band R = 0.43 m to 0.80 m across the -Z semicircle.
   - Central Pedestal Table: Round tabletop diameter 0.50 m (R = 0.25 m) centered at (0, 0, 0), top surface at Y = 0.62 m, weighted circular base plate Ø 0.40 m.

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Outer Acoustic Felt Shell:
     - Ribbed vertical fluted PET acoustic felt exterior in muted sage-slate (#4d6b63, procedural fine heather felt CanvasTexture, roughness 0.92, metalness 0.0), capped with a smooth curved natural white-oak top rail (#b88a5a, roughness 0.48) and recessed matte-black plinth kickplate (height 60 mm).
   - Plush Curved Interior Seating:
     - Contoured multi-segment upholstered bench cushion (top at Y = 0.45 m) and ergonomic channel-tufted lumbar backrest cushion (Y = 0.45 m to 0.88 m) in soft seafoam-grey woven bouclé fabric (#7c9a8e, roughness 0.88) with tailored piping seams.
   - Central Swivel Laptop Pedestal Table:
     - Beveled circular bleached-oak / warm laminate tabletop (Ø 0.50 m, thickness 24 mm, top Y = 0.62 m) with a recessed brass cup coaster ring, slender matte-black steel column (Ø 56 mm), and beveled steel floor disc (Ø 0.40 m, height 14 mm).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Commons_Acoustic_Booth".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 18,000.
   - Include an automated verification panel checking max radial distance <= 0.950 m across all vertices, yMin = 0, yMax in 1.25..1.27 m, seat height = 0.45 m, table height = 0.62 m, and open +Z entrance, plus OrbitControls and a single-click "Export GLB" button saving "Office_Commons_Acoustic_Booth.glb".
```

---

### PROMPT 3: Taman Dinding Vertikal (`Office_Garden_Living_Wall.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Garden_Living_Wall" (Architectural Biophilic Vertical Living Green Wall Panel with Integrated Grow-Light Hood).

1. STRICT METRIC SCALING & FLUSH-MOUNT ORIGIN CONTRACT:
   - Total Width (X): 3.00 m (x spans -1.50 m to +1.50 m, ±5 mm).
   - Total Height (Y): 2.40 m (y spans 0.00 m to 2.40 m, ±5 mm).
   - Frame Depth (Z): 0.15 m (foliage tips may reach at most z = 0.18 m).
   - CRITICAL REAR-FLUSH ORIGIN (0,0,0): Bottom-center of the REAR mounting face (x = 0, y = 0, z = 0). NO vertex may have z < 0.000 m, because in the host scene this asset mounts flush against the Server Room partition wall (X = 22.0) rotated 90° facing East—any negative Z geometry would poke into the Server Room! Front foliage faces +Z.

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Architectural Frame & Drip Trough:
     - Matte charcoal powder-coated aluminum perimeter frame (#1b1e21, roughness 0.48, metalness 0.65, width 3.00 m, height 2.40 m, depth 0.15 m).
     - Waterproof dark slate modular felt hydroponic backing grid at z = 0.02..0.05 m.
     - Bottom brushed-dark-steel irrigation catch trough (height 0.20 m, depth 0.15 m) filled with dark river pebbles.
     - Top cantilevered grow-light valence hood (y = 2.33..2.40 m, depth 0.15 m) housing a recessed warm-daylight LED diffuser bar (emissive #fff6dc, emissiveIntensity 1.1).
   - Rich Multi-Species Botanical Tapestry (Merged Vertex-Color Geometry for Performance):
     - Organic undulating cushions of preserved reindeer moss & pillow moss in chartreuse and emerald tones (#6ea343, #4a7c34).
     - Clustered cascading Boston fern fronds, heart-leaf philodendron trails, variegated pothos leaves, and compact bird's-nest fern rosettes arranged in natural diagonal drifts across the 3.00 × 2.05 m planting zone.
     - Merge leaf clusters by material using vertex colors for rich botanical shading while keeping draw calls low (<= 8 meshes total).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Garden_Living_Wall".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 24,000.
   - Include an automated verification panel checking x in [-1.505, +1.505], y in [0, 2.405], zMin >= 0.000, zMax <= 0.185, draw calls, and triangle count, plus OrbitControls and "Export GLB" button saving "Office_Garden_Living_Wall.glb".
```

---

### PROMPT 4: Air Mancur Batu Zen & Pancuran Bambu (`Office_Garden_Zen_Fountain.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Garden_Zen_Fountain" (Japanese-Inspired Chiseled Basalt Basin & Bamboo Kakehi Spout Zen Fountain).

1. STRICT METRIC SCALING & ANIMATED-WATER OVERLAY CONTRACT:
   - Basin Outer Width (X): 0.90 m (x spans -0.45 m to +0.45 m).
   - Basin Outer Depth (Z): 0.55 m (z spans -0.275 m to +0.275 m).
   - Total Height (Y): 0.85 m (top of bamboo upright / stone cairn).
   - Origin (0,0,0): Floor center (Y = 0), front facing +Z.
   - CRITICAL SCENE WATER CONTRACT (READ CAREFULLY):
     1. DO NOT export any water surface plane, falling water stream cylinder, or splash rings inside the GLB! (In the HTML preview you may toggle a non-exported preview water helper, or exclude it before GLTFExporter runs.)
     2. The host scene overlays an animated water surface (`0.78 m × 0.43 m`) at `Y = 0.40 m`, an animated falling water stream from `(0.03, 0.655, 0.05)` straight down to `(0.03, 0.40, 0.05)`, and a splash ring of radius `0.07 m` centered at `(0.03, 0.402, 0.05)`.
     3. Therefore:
        - Basin walls MUST be 60 mm thick around the perimeter so the inner water cavity is `0.78 m (X) × 0.43 m (Z)`, with basin rim top at `Y = 0.42 m` (2 cm above water level) and inner basin floor at `Y = 0.16..0.24 m`.
        - Submerged dark river pebbles on the basin floor MUST stay strictly below `Y = 0.36 m` so none poke through `Y = 0.40 m` around the splash zone `(0.03, 0.05)`.
        - The open pouring tip (mouth) of the angled bamboo spout MUST terminate precisely at local coordinates `X = +0.030 m, Y = +0.655 m, Z = +0.050 m` (±4 mm)!

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Chiseled Dark Basalt Trough Basin:
     - Rectangular carved dark volcanic basalt basin (#36393c, procedural pitted stone CanvasTexture + bump/roughness variation, roughness 0.84, metalness 0.05) with chamfered 60 mm rim at Y = 0.42 m and slightly recessed shadow plinth at floor level.
     - Bed of smooth wet charcoal/grey river pebbles resting on the inner basin floor (Y = 0.22..0.34 m).
   - Stacked Zen River Stones & Dwarf Fern Accent:
     - Asymmetrical cairn of 4 smooth water-worn slate boulders stacked on a submerged stone ledge in the rear-left quadrant (around x = -0.24 m, z = -0.12 m, rising from Y = 0.38 m to ~0.78 m), plus a small tuft of lush green moss/fern nestled beside the stones.
   - Traditional Bamboo Kakehi Spout Assembly:
     - Vertical segmented golden-aged bamboo upright post (Ø 46 mm with realistic nodal rings, #9c8a4a, roughness 0.52) rising in the rear-left/center (around x = -0.12 m, z = -0.17 m, top capped at Y = 0.85 m), bound with dark hemp twine lashing (#2a241e) to an angled bamboo pouring spout (Ø 34 mm, beveled hollow cut tip ending precisely at `(0.03, 0.655, 0.05)`).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Garden_Zen_Fountain" (containing ONLY permanent fountain meshes, no water mesh).
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 14,000.
   - Include an automated verification panel checking outer bounds (0.90 × 0.85 × 0.55 m), basin rim Y = 0.42 m, bamboo spout tip world/local point at `(0.03, 0.655, 0.05)`, and absence of water meshes in export group, plus "Export GLB" button saving "Office_Garden_Zen_Fountain.glb".
```

---

### PROMPT 5: Bangku Taman Kayu Teak Minimalis (`Office_Garden_Teak_Bench.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Garden_Teak_Bench" (Minimalist Backless Architectural Teak Slat & Matte Black Steel Garden Bench).

1. STRICT METRIC SCALING, ORIGIN & SEATING CONTRACT:
   - Total Length (X): 1.80 m (x spans -0.90 m to +0.90 m, ±3 mm).
   - Total Depth (Z): 0.42 m (z spans -0.21 m to +0.21 m, ±3 mm).
   - Seat Top Height (Y): STRICTLY 0.45 m (y spans 0.00 m to 0.45 m, ±2 mm).
   - STRICTLY BACKLESS: Nothing may rise above Y = 0.45 m (agents sit at 3 spots along X facing +Z South and approach from +Z).
   - Origin (0,0,0): Floor center directly beneath the bench.

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - 5 Solid Oiled Teak Wood Slats:
     - Five full-length 1.80 m horizontal timber slats (thickness 36 mm, width ~72 mm each with 15 mm drainage gaps, rounded bullnose edges, end-grain detailing).
     - Warm golden-brown Burmese teak woodgrain procedural CanvasTexture (#a0703f with rich darker heartwood streaks, roughness 0.50, metalness 0.02), subtly waterfall-mitred or brass-pinned at ends.
   - Architectural Matte-Black Steel Sled Legs:
     - Two heavy-duty rectangular sled/loop leg frames inset 0.22 m from each end (at x = ±0.68 m), fabricated from 45×18 mm flat bar powder-coated matte black steel (#17191c, roughness 0.46, metalness 0.76), connected by a recessed central anti-racking stretcher bar underneath at Y = 0.26 m, with thin non-marring dark floor pads embedded within Y >= 0.00 m.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Garden_Teak_Bench".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 6,000.
   - Include an automated verification panel checking exact bounds (1.80 × 0.45 × 0.42 m) and yMin = 0 / yMax = 0.45 m, OrbitControls, studio lighting, and "Export GLB" button saving "Office_Garden_Teak_Bench.glb".
```

---

### PROMPT 6: Pohon Hias Fiddle Leaf Fig (`Office_Plant_Fiddle_Leaf_Fig.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Plant_Fiddle_Leaf_Fig" (Indoor Architectural Ficus Lyrata Tree in Fluted Concrete Planter).

1. STRICT METRIC SCALING & CORNER CLEARANCE CONTRACT:
   - Planter Pot Dimensions: Top outer diameter Ø 0.42 m, slightly tapered bottom Ø 0.35 m, height 0.45 m.
   - Total Tree Height (Y): 2.00 m (y spans 0.00 m to 2.00 m, ±2 cm).
   - Origin (0,0,0): Floor center at bottom of the planter pot (Y = 0).
   - CRITICAL WALL-CLEARANCE CONSTRAINT: Every single leaf, branch, and pot vertex MUST fit strictly inside a vertical cylinder of diameter Ø 0.80 m (`Math.hypot(x, z) <= 0.400 m`)! In the host Digital Garden, this tree sits in the NE corner at `(1.80, -2.20)` next to the East wall (`x = +2.26`) and North glass wall (`z = -2.76`), leaving 6 cm clearance—no leaf tip may exceed radius `0.400 m`!

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Architectural Cast-Concrete Planter:
     - Tapered cylindrical modern concrete pot (#9c9b97, procedural subtle porous cast-concrete CanvasTexture, roughness 0.88, metalness 0.02) with recessed rim lip, recessed dark organic soil bed at Y = 0.41 m, and white/grey decorative river pebble top-dressing.
   - Sculptural Branching Woody Trunk:
     - Naturalistic slightly sinuous central woody trunk (Ø 36 mm at base tapering upward, warm grey-brown bark #6b5240, roughness 0.86) splitting around Y = 0.95..1.25 m into 3 graceful upward-reaching secondary branches.
   - Signature Violin-Shaped Ficus Lyrata Foliage:
     - 32 to 42 large, sculptural violin/fiddle-shaped leaves (`length 20–28 cm, width 13–18 cm`) with wavy scalloped margins, subtle central midrib & pale green pinnate venation (procedural high-res leaf CanvasTexture, deep waxy botanical green #2d5c29 to fresh upper-crown #417d37, roughness 0.42, double-sided).
     - Arranged spirally from Y = 0.85 m up to the 2.00 m crown, pitched naturally outward while strictly respecting `Math.hypot(x, z) <= 0.400 m`.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Plant_Fiddle_Leaf_Fig".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 20,000.
   - Include an automated verification panel checking max radial extent <= 0.400 m (diameter <= 0.80 m), pot Ø 0.42 × 0.45 m, yMin = 0, yMax ≈ 2.00 m, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Plant_Fiddle_Leaf_Fig.glb".
```

---

## 4. Status Generator & Kontrak Terverifikasi (18 November 2026)

**Status:** keenam generator sudah dibuat di `tools/3d-generator/<Nama>.html` (gitignored, lokal saja). Setiap halaman punya panel **Contract check** yang menampilkan **PASS** bila semua batas terpenuhi. Klik **Export GLB**, lalu salin ke `public/models/`; GLB otomatis menggantikan placeholder prosedural.

Semua generator memakai satu template bersama (UI, lighting studio, panel cek, ekspor `GLTFExporter` biner) dan helper prosedural yang sama, jadi tampilannya konsisten.

### A. Catatan terhadap prompt

| # | Prompt | Catatan | Keputusan |
|---|---|---|---|
| 1 | Living wall `emissiveIntensity 1.1` | `GLTFExporter` r128 memotong emisi di atas 1,0. | Strip LED memakai emisi 1,0 (warna `#fff6dc`); cahaya taman tetap dari PointLight scene. |
| 2 | Living wall "≤ 8 meshes" | — | Tepat 8 mesh: rangka, LED, felt, bak, kerikil, lumut, pakis (matte), philodendron/pothos (glossy). Daun digabung per material dengan warna per verteks. |
| 3 | Batu (cairn, kerikil, lumut) dengan jitter | Polihedron three.js tidak berindeks; jitter acak per verteks membuat sisi "retak". | Jitter dikunci ke posisi verteks + normal halus. Perbaikan yang sama diterapkan ke batu zen placeholder di `digitalGarden.ts`. |
| 4 | Meja kolaborasi: spine dengan 6 modul port | 42 bagian kecil = banyak draw call. | Modul port digabung per material (35 mesh total). |

### B. Hasil cek per GLB

| GLB | Ukuran terukur | Cek kunci | Segitiga | Ukuran file |
|---|---|---|---|---|
| `Office_Commons_Collab_Table` | 3,200 × 0,774 × 1,200 | Worktop 0,740; spine 0,774 × 0,121; zona props bersih; tiang tengah z ±0,240 | 1,2k | ±250 KB |
| `Office_Commons_Acoustic_Booth` | R maks 0,950; tinggi 1,270 | Dudukan 0,450; meja 0,620; terbuka ke +Z | 10,8k | ±780 KB |
| `Office_Garden_Living_Wall` | X ±1,500; Y 0..2,400; Z 0..0,163 | Tidak ada z < 0; 8 mesh | 19k | ±2,3 MB |
| `Office_Garden_Zen_Fountain` | 0,900 × 0,850 × 0,550 | Bibir 0,420; mulut pancuran tepat (0.03, 0.655, 0.05), Δ 0 mm; kerikil maks 0,24; 0 mesh air | 6,2k | ±680 KB |
| `Office_Garden_Teak_Bench` | 1,800 × 0,450 × 0,420 | Tanpa sandaran (yMax 0,450) | 0,9k | ±130 KB |
| `Office_Plant_Fiddle_Leaf_Fig` | R maks 0,375; tinggi 2,000 | Pot Ø0,42 (bawah Ø0,35) × 0,45 | 8,2k | ±780 KB |

### C. Verifikasi di scene
- Keenam GLB dibangun dari generator lalu disajikan ke halaman kantor lewat `page.route`. Semuanya termuat menggantikan placeholder, dengan bounding box dunia: meja `X 18.95..22.15, Z 1.52..2.72`; booth `X 15.30..16.92, Z -0.70..0.92` (6 cm dari dinding barat & utara); green wall `X 22.00..22.18, Z 7.90..10.90`; fountain `X 22.08..22.63, Z 11.55..12.45` (overlay air scene tetap terpasang); bangku `X 24.55..26.35, Z 11.11..11.53`; fig `X 26.01..26.65, Z 7.83..8.53` (11 cm dari dinding timur, 19 cm dari kaca utara).
- Diskusi Commons dan rehat Garden tetap berjalan dengan GLB terpasang (agen duduk di kursi meja dan bangku).
