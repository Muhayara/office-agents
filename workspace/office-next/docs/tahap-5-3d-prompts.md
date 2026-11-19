# Prompt Detail Pembuatan Model 3D — Tahap 5 (Workshop, Information Wall, & Collaboration Pods)
> **Proyek:** Office Agents 3D (`workspace/office-next`)  
> **Engine Generator:** Three.js r128 (via CDN) + `GLTFExporter`  
> **Folder Generator Lokal:** `workspace/office-next/tools/3d-generator/` *(gitignored)*  
> **Folder Output Model:** `workspace/office-next/public/models/`  
> **Standar Skala:** Metrik `1 Unit = 1 Meter` (`1.0 = 100 cm`). Orientasi lokal model: Depan = `+Z`, Kanan = `+X`, Atas = `+Y`.

---

## 1. Ringkasan Kontrak 5 Aset 3D Baru Tahap 5

Seluruh dimensi, titik origin, penamaan mesh dinamis, dan batas ruang bebas di bawah ini mengikuti spesifikasi pada [tahap-5-workshop-infowall-pods.md §6](./tahap-5-workshop-infowall-pods.md).

| No | File Output GLB | Dimensi Kontrak ($W \times H \times D$) | Origin `(0,0,0)` & Orientasi Lokal | Ruangan & Penempatan | Catatan Kritis Integrasi Scene |
|---|---|---|---|---|---|
| 1 | `Office_Workshop_Lectern_Podium.glb` | $0.62 \times 1.12 \times 0.48\text{ m}$ | Lantai tengah (`Y = 0`); muka depan audiens = `+Z`, dek baca miring pembicara = `-Z` | `Room_Workshop` · `(-2.12, 1.38)`, `rotY = +90°` | Saat diputar `+90°`, muka `+Z` menghadap Timur ke peserta & kamera Tenggara; pembicara berdiri di sisi `-Z` (`x = -2.55`). |
| 2 | `Office_Workshop_Training_Table.glb` | $1.80 \times 0.74 \times 0.55\text{ m}$ *(dipakai 2×)* | Lantai tengah (`Y = 0`); sisi panjang = `X`, *modesty panel* di `-Z`, ruang lutut kursi di `+Z` | `Room_Workshop` · 2 baris (`x = -1.30` & `+0.50`, `z = 0.20`) | Permukaan meja rata tepat di `Y = 0.74 m`. *(Catatan rotasi scene: gunakan `rotY = +90°` agar sisi kursi `+Z` menghadap Timur ke kursi peserta dan panel `-Z` menghadap panggung Barat).* |
| 3 | `Office_InfoWall_Command_Display.glb` | $3.80 \times 2.10 \times 0.30\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`y = 0, z = 0`); layar menghadap `+Z` | `Room_InfoWall` · `(0.10, -1.76)` menempel dinding utara, `rotY = 0°` | `zMin >= 0` (rata dinding). Wajib memiliki **1 mesh layar datar** bernama `InfoWall_Main_Screen` (`3.60 × 1.37 m`, `Y = 0.65..2.02`, muka datar di `Z = +0.156 m`) tempat overlay kanvas *live* scene menempel bebas *clipping*. |
| 4 | `Office_InfoWall_Kanban_Board.glb` | $1.80 \times 1.15 \times 0.06\text{ m}$ | **Tengah sisi BELAKANG papan** (`x = 0, y = 0, z = 0`); muka papan menghadap `+Z` | `Room_InfoWall` (`walls.west`) · `(-2.25, 1.55, -0.05)`, `rotY = +90°` | `zMin >= 0`, `zMax <= 0.060 m` (termasuk rak spidol). Dipasang sebagai anak `walls.west` agar ikut memudar saat Studio dibangun di Tahap 6. |
| 5 | `Office_Collab_Diner_Pod.glb` | $1.90 \times 1.32 \times 1.30\text{ m}$ *(dipakai 2×)* | Lantai tengah (`Y = 0`); punggung + layar 27" di `-Z`, **sisi depan `+Z` terbuka penuh** | `Room_CollabPods` · `Pod_A (-1.38, -0.98)` & `Pod_B (+1.14, -0.98)`, `rotY = 0°` | **Tanpa atap tertutup** agar kedua agen yang duduk di `x = ±0.62, Y = 0.45` terlihat utuh dari kamera Tenggara. Sediakan mesh lampu bernama `Pod_Occupancy_LED` di ambang atas belakang untuk status hijau/amber. |

> [!NOTE]
> **Aset Eksisting yang Dipakai Ulang di Tahap 5 (Tidak Perlu Dibuat Ulang):**
> - `Office_Presentation_Display_85.glb` (layar utama panggung Workshop di sisi barat, skala `0.88`)
> - `Office_Ergonomic_Chair.glb` (6× kursi peserta Workshop)
> - `Office_Linear_Pendant_Light.glb` (lampu gantung linear Workshop)
> - `Office_Indoor_Plant.glb` & `Office_Indoor_Plant_SnakePlant.glb` (tanaman sudut di ketiga ruangan Tahap 5)

---

## 2. Panduan Penggunaan Prompt

1. Setelah implementasi kode Tahap 5 selesai, salin masing-masing blok prompt di bawah untuk menghasilkan 5 file HTML generator di `workspace/office-next/tools/3d-generator/<Nama_Model>.html` *(pastikan ukuran kontrak dicek ulang dengan §8/catatan akhir dokumen Tahap 5 bila ada penyesuaian saat coding)*.
2. Buka tiap file HTML di browser, pastikan seluruh baris pada panel verifikasi berstatus **PASS**, lalu klik **"Export GLB"** (ingat: selalu tutup browser/Playwright sesudah pengecekan).
3. Salin kelima file `.glb` ke `workspace/office-next/public/models/`:
   ```text
   workspace/office-next/public/models/
     ├── Office_Workshop_Lectern_Podium.glb
     ├── Office_Workshop_Training_Table.glb
     ├── Office_InfoWall_Command_Display.glb
     ├── Office_InfoWall_Kanban_Board.glb
     └── Office_Collab_Diner_Pod.glb
   ```
4. Fungsi `mountAsset()` pada modul ruangan Tahap 5 akan otomatis memuat model `.glb` tersebut menggantikan placeholder prosedural.

---

## 3. Koleksi Prompt Detail per Model

---

### PROMPT 1: Podium Pembicara Workshop (`Office_Workshop_Lectern_Podium.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Workshop_Lectern_Podium" (Modern Architectural Speaker Lectern & Tech Demo Podium with Dual Gooseneck Microphones).

1. STRICT METRIC SCALING & ORIENTATION CONTRACT:
   - Total Width (X): 0.62 m (x spans -0.31 m to +0.31 m, ±3 mm).
   - Total Depth (Z): 0.48 m (z spans -0.24 m to +0.24 m, ±3 mm).
   - Total Height (Y): STRICTLY 1.12 m (y spans 0.00 m to 1.12 m, ±4 mm; body brow at ~1.07 m and microphone tips peaking at 1.120 m).
   - Origin (0,0,0): Floor center directly beneath the podium base (Y = 0).
   - CRITICAL ORIENTATION:
     - Front Audience Facade faces +Z (when rotated +90° around Y in the host Workshop room, +Z faces East toward the audience and isometric camera).
     - Presenter Reading Side faces -Z (slanted reading surface tilts down towards -Z so a presenter standing behind at z < -0.24 m reads comfortably).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Weighted Architectural Plinth Base:
     - Beveled rectangular matte-black powder-coated steel base plate (0.62 m × 0.48 m × 22 mm, #17191c, roughness 0.45, metalness 0.80) with subtle recessed LED floor wash strip along the +Z toe-kick.
   - Sculpted Column & Acoustic Slat Front Apron (+Z Face):
     - Tapered charcoal-slate structural body (#20262e, roughness 0.55, metalness 0.25) clad on the +Z audience face with 11 vertical warm natural walnut/oak slats (#9c6f44, procedural woodgrain CanvasTexture, roughness 0.46) framed by brushed dark bronze side trims.
     - Brushed aluminum & glowing cyan acrylic emblem plaque on the upper +Z chest (y = 0.86 m) reading "OFFICE AGENTS" (procedural crisp CanvasTexture, subtle emissive #38bdf8).
   - Slanted Presenter Reading Deck & Tech Console (-Z Side):
     - Angled matte-walnut reading top (y = 0.98 m at -Z lip rising to 1.09 m at +Z brow) with a raised 18 mm document retention lip along the -Z edge, plus a recessed middle shelf (y = 0.66 m) inside the presenter cavity holding a water tumbler.
     - Flush-mounted 7-inch presenter countdown timer & slide-clicker touchscreen embedded on the left side of the deck, and a sleek brushed-silver wireless presentation remote on the right.
   - Dual Gooseneck Condenser Microphones & Reading Light:
     - Two slender matte-black flexible gooseneck microphones rising symmetrically from shock-mounts near the +Z top corners, curving smoothly toward the presenter (-Z) with foam windscreens and tiny glowing red/cyan ring LEDs (total height strictly <= 1.12 m, or body brow at 1.08 m and mics peaking at 1.12 m so overall Y box is 1.12 m).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Workshop_Lectern_Podium".
   - Enable castShadow = true and receiveShadow = true on all meshes. Keep triangle count under 12,000.
   - Include an automated on-screen contract check panel verifying exact bounding box (0.62 × 1.12 × 0.48 m, ±4 mm), yMin = 0, front +Z slat orientation, and triangle count, plus OrbitControls, studio lighting, and a single-click "Export GLB" button saving "Office_Workshop_Lectern_Podium.glb".
```

---

### PROMPT 2: Meja Pelatihan Lipat Sempit (`Office_Workshop_Training_Table.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Workshop_Training_Table" (Modular 3-Person Narrow Flip-Top Seminar & Workshop Training Table on Locking Casters).

1. STRICT METRIC SCALING, KNEE CLEARANCE & ORIGIN CONTRACT:
   - Total Length (X): 1.80 m (x spans -0.90 m to +0.90 m, ±3 mm; seats 3 trainees spaced at x = -0.58, 0.00, +0.58 m).
   - Total Depth (Z): 0.55 m (z spans -0.275 m to +0.275 m, ±3 mm).
   - Tabletop Surface Height (Y): STRICTLY 0.74 m (y spans 0.00 m to 0.74 m, ±2 mm; flush grommet covers <= 0.740 m, keeping z = +0.02..+0.25 m completely flat where the host scene mounts "Training_Table_Props" notebooks at Y = 0.74 m).
   - Origin (0,0,0): Floor center directly beneath the table (Y = 0).
   - Orientation:
     - Front Modesty Panel faces -Z (positioned near z = -0.21 m).
     - Open Trainee Knee Space faces +Z (full unobstructed legroom from z = +0.275 m inward to z = -0.19 m for 3 seated avatars).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Narrow Ergonomic Seminar Tabletop:
     - Single 1.80 m × 0.55 m × 26 mm slab at top Y = 0.74 m with softly radiused 3 mm safety corners, warm bleached white-oak laminate surface (procedural woodgrain CanvasTexture, roughness 0.42, metalness 0.02) and darker oak edge-banding (#b88a5a).
     - Three flush brushed-aluminum rectangular flip cable grommets aligned near the -Z front edge (at x = -0.58, 0.00, +0.58 m, z = -0.16 m).
   - Perforated Acoustic Modesty Apron (-Z Side):
     - Sleek powder-coated dark slate steel modesty panel (length 1.56 m, height 0.24 m from Y = 0.45 m to 0.69 m, at z = -0.21 m) featuring a laser-cut micro-perforated geometric pattern texture and integrated under-desk cable trough.
   - Offset T-Leg Flip-Top Frame & Twin-Wheel Locking Casters:
     - Dual heavy-duty anodized silver/charcoal steel vertical columns at x = ±0.78 m (z = -0.05 m) with under-top flip-release lever mechanisms and arched aluminum die-cast feet (z = -0.26 m to +0.26 m, keeping x = -0.70..+0.70 m completely clear for 3 chairs!).
     - Four realistic 55 mm twin-wheel hooded locking casters with grey polyurethane treads resting precisely at Y = 0.00 m.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Workshop_Training_Table".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 12,000.
   - Include an automated contract verification panel checking exact bounds (1.80 × 0.74 × 0.55 m), yMin = 0, yMax = 0.74 m, unobstructed +Z knee clearance, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Workshop_Training_Table.glb".
```

---

### PROMPT 3: Dinding Layar Komando Panoramik (`Office_InfoWall_Command_Display.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_InfoWall_Command_Display" (3.8-Meter Panoramic Mission-Control Telemetry LED Wall & Low Equipment Console).

1. STRICT METRIC SCALING, REAR-FLUSH ORIGIN & LIVE CANVAS OVERLAY CONTRACT:
   - Total Width (X): 3.80 m (x spans -1.90 m to +1.90 m, ±5 mm).
   - Total Height (Y): 2.10 m (y spans 0.00 m to 2.10 m, ±5 mm).
   - Total Depth (Z): 0.30 m (low console base spans z = 0.00 m to +0.30 m; upper display housing spans z = 0.00 m to +0.16 m).
   - CRITICAL REAR-FLUSH ORIGIN (0,0,0): Floor center of the REAR wall-mounting plane (`x = 0, y = 0, z = 0`). NO vertex may have `z < 0.000 m` because this unit mounts flush against the solid North perimeter wall of the Information Wall room! Front faces +Z.
   - CRITICAL NAMED FLAT SCREEN MESH CONTRACT:
     - The active upper LED display surface MUST be a single FLAT planar rectangular mesh (parallel to XY, NOT curved in Z!) named EXACTLY `"InfoWall_Main_Screen"` (make it the ONLY mesh whose name contains `"Screen"`).
     - Exact dimensions of `"InfoWall_Main_Screen"`: Width `3.60 m` (`x: -1.80..+1.80`), Height `1.37 m` (`y: 0.65..2.02`), front surface strictly planar at **`z = +0.156 m`**.
     - Why flat? Because the host scene dynamically fits a live 2D CanvasTexture overlay (`4 mm` in front at `z = +0.160 m`) displaying real-time CI/CD, test suite, and 10-agent telemetry; a flat planar face guarantees zero Z-fighting and zero corner clipping!
     - Give `"InfoWall_Main_Screen"` a rich default fallback emissive CanvasTexture (dark cyber-slate telemetry dashboard with CI/CD pipeline status, 64/64 tests green badge, throughput sparklines, and agent leaderboard) so it also looks stunning standalone in the HTML preview!

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Architectural Wall Backing & Ambient Halo Frame:
     - Dark charcoal acoustic slat & brushed gunmetal backing wall frame (`3.80 × 2.10 m`, `z = 0.00..0.09 m`, #151b22, roughness 0.50, metalness 0.55) with a concealed perimeter cyan/warm-white bias-lighting LED glow rim along the left, right, and top edges.
   - Ultra-Slim Bezelless 3-Bay Display Array (`Y = 0.62..2.06 m`):
     - Precision matte-black anodized aluminum outer bezel (`3.68 × 1.44 m`, `z = 0.09..0.158 m`, frame lip recessed behind or framing `"InfoWall_Main_Screen"` without protruding past `z = 0.158 m` over the active screen area) with subtle top status beacon bar (3 glowing emerald/cyan status pills at `Y = 2.07 m`).
   - Low Telemetry Media Credenza (`Y = 0.00..0.48 m`, `Z = 0.00..0.30 m`):
     - Sleek 3.80 m wide low-profile equipment console beneath the screen in matte anthracite steel (#1b222b) topped with a honed dark basalt/walnut ledge at `Y = 0.48 m` (`z = 0.00..0.30 m`), 4 louvered smoked-glass rack doors housing subtle blinking rack telemetry LEDs inside, and a recessed aluminum toe-kick.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_InfoWall_Command_Display".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 14,000.
   - Include an automated verification panel checking outer bounds (3.80 × 2.10 × 0.30 m), `zMin >= 0.000`, `yMin = 0`, single `"InfoWall_Main_Screen"` mesh (`3.60 × 1.37 m` flat at `z ≈ 0.156 m`), and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_InfoWall_Command_Display.glb".
```

---

### PROMPT 4: Papan Kanban & Arsitektur Dinding (`Office_InfoWall_Kanban_Board.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_InfoWall_Kanban_Board" (Wall-Mounted Architectural Magnetic Glass Kanban & Sprint Roadmap Board).

1. STRICT METRIC SCALING & WALL-MOUNT ORIGIN CONTRACT:
   - Total Width (X): 1.80 m (x spans -0.90 m to +0.90 m, ±3 mm).
   - Total Height (Y): 1.15 m (y spans -0.575 m to +0.575 m, ±3 mm).
   - Total Depth (Z): STRICTLY <= 0.060 m (z spans 0.000 m to +0.060 m, including the bottom marker tray!).
   - CRITICAL WALL-MOUNT ORIGIN (0,0,0): Center of the REAR wall-mounting face (`x = 0, y = 0, z = 0`). NO vertex may have `z < 0.000 m`! Front board surface faces +Z. (Mounted as a child of `walls.west` at `y = 1.55 m` in the host scene so it fades cleanly with the wall in future stages).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Slim Anodized Frame & Tempered Magnetic Glass Surface:
     - Perimeter 18 mm chamfered matte-black anodized aluminum frame (`1.80 × 1.15 × 0.024 m`, #181c22, roughness 0.38, metalness 0.82) with brushed corner brackets.
     - High-clarity low-iron dark-tinted magnetic glass board surface at `z = 0.022 m` (procedural high-res CanvasTexture, roughness 0.14, metalness 0.08) printed with crisp subtle gridlines, header title `"SPRINT ROADMAP · LANTAI 1"`, and 4 column lanes: `"BACKLOG"`, `"IN PROGRESS"`, `"REVIEW"`, and `"DONE"`.
   - 3D Tactile Kanban Cards, Magnets & Architecture Diagram:
     - 14 physical 3D bevel-edged task cards (`110 × 75 × 3 mm`, protruding to `z = 0.026 m`, color-coded warm amber, teal, coral, emerald, and slate headers with simulated task lines) arranged realistically across the 4 columns, each held by tiny cylindrical brushed-brass or colored neodymium disc magnets (`z = 0.029 m`).
     - Right-side mini architecture flow diagram drawn on the glass with clean vector node boxes and arrows.
   - Compact Integrated Marker Tray (`z <= 0.060 m`):
     - Bottom aluminum accessory ledge (`width 0.90 m`, `y = -0.565 m`, `z = 0.022..0.058 m`) holding 3 dry-erase markers (cyan, amber, white caps) and a felt-bottom magnetic eraser block, all strictly staying within `z <= 0.060 m`.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_InfoWall_Kanban_Board".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 8,000.
   - Include an automated verification panel checking exact bounds (`x` in `[-0.903, +0.903]`, `y` in `[-0.578, +0.578]`, `z` in `[0.000, 0.060]`) and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_InfoWall_Kanban_Board.glb".
```

---

### PROMPT 5: Bilik Diskusi Berpasangan 2 Orang (`Office_Collab_Diner_Pod.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Collab_Diner_Pod" (Open-Top 2-Person Acoustic Diner Huddle Booth with Facing Sofas, Cantilever Table, Rear 27" Screen & Occupancy LED).

1. STRICT METRIC SCALING, OPEN-TOP CAMERA VISIBILITY & AVATAR SEATING CONTRACT:
   - Outer Width (X): 1.90 m (x spans -0.95 m to +0.95 m, ±4 mm).
   - Outer Depth (Z): 1.30 m (z spans -0.65 m to +0.65 m, ±4 mm).
   - Outer Height (Y): 1.32 m (y spans 0.00 m to 1.32 m, ±4 mm).
   - Origin (0,0,0): Floor center directly beneath the central table (`Y = 0`).
   - CRITICAL ISOMETRIC VISIBILITY & ENTRANCE RULES:
     1. OPEN +Z ENTRANCE & NO FLOOR THRESHOLD AT +Z: The front `+Z` face (`z = +0.65 m`) MUST be 100% open (no front wall, no front glass, and NO raised floor threshold across the central leg aisle `x = -0.50..+0.50` so seated/entering avatars stand cleanly on the room carpet at `Y = 0`!).
     2. OPEN TOP (NO SOLID CEILING): Do NOT enclose the top with a solid roof! From the host scene's Southeast isometric camera looking down at ~32°, both seated avatars, their gesturing arms, the central table, and the rear screen must remain 100% unobstructed. You may frame the rear `-Z` wall (`height 1.32 m`) and tapered side acoustic wings (`height 1.32 m` at `-Z` stepping/curving smoothly down to `1.08 m` at `+Z`).
   - EXACT AVATAR SEATING & KNEE-CLEARANCE GEOMETRY (MATCHING HOST SCENE):
     - Left Avatar sits centered at `(x = -0.62 m, z = 0.00 m)` facing `+X`; Right Avatar sits centered at `(x = +0.62 m, z = 0.00 m)` facing `-X`.
     - Left Acoustic Side Wall & Angled Backrest: `x = -0.95 m to -0.76 m`; Left Bench Cushion: `x = -0.86 m to -0.46 m`, `z = -0.53 m to +0.62 m`, flat seat top surface at **`Y = 0.45 m`**.
     - Right Bench Cushion & Side Wall (symmetrical): Cushion `x = +0.46 m to +0.86 m` at **`Y = 0.45 m`**, Backrest & Side Wall `x = +0.76 m to +0.95 m`.
     - Central Narrow Huddle Table: Width `0.52 m` (`x = -0.26 m to +0.26 m`, leaving a clean `0.20 m` knee aisle on both sides!), Length `1.06 m` (`z = -0.52 m to +0.54 m`), top surface at **`Y = 0.72 m`**, supported by a rear wall-cantilever bracket + single inset rear pedestal column at `z = -0.38 m` (NO front leg near `+Z`!).

2. DETAILED PROCEDURAL GEOMETRIES, NAMED OCCUPANCY LED & PBR MATERIALS:
   - Fluted Acoustic Shell (Rear `-Z` Wall & Curved Side Wings):
     - Exterior clad in vertical ribbed dark-teal / slate PET acoustic felt (#2c444c, procedural heather felt CanvasTexture, roughness 0.90) with warm natural white-oak perimeter trim capping (#b88a5a, roughness 0.46).
     - Interior rear & upper side walls lined with soft light-oatmeal acoustic fabric panels (#dcd7cc, roughness 0.92).
   - Upholstered Diner Sofa Benches:
     - Tailored boxed seat cushions (`Y = 0.45 m`) and channel-tufted ergonomic lumbar backrests (`Y = 0.45..0.88 m`) in warm terracotta-amber or sage woven bouclé upholstery (#4c7369 cushions with subtle #c88a4b accent welt/piping, roughness 0.86) over recessed matte-black plinth bases (`x = ±0.48..±0.93 m`).
   - Cantilevered Huddle Table & Rear 27" Collaboration Display:
     - Rounded-corner bleached-oak tabletop (`0.52 × 1.06 m`, `Y = 0.72 m`) with central flush USB-C/HDMI puck (`z = -0.25 m`).
     - Sleek 27-inch collaboration monitor (`0.62 × 0.36 m`) mounted on the interior rear `-Z` wall centered at `(x = 0, y = 0.98 m, z = -0.51 m)` facing `+Z`, showing a crisp glowing CanvasTexture of a pair-programming code diff & UI component preview.
   - Named Occupancy Indicator Light Bar:
     - Single THREE.Mesh (NOT a Group, and using a single MeshStandardMaterial, NOT a material array) named EXACTLY **`"Pod_Occupancy_LED"`** (`0.42 × 0.03 × 0.03 m`, centered at `x = 0, y = 1.305 m, z = -0.56 m` so `yMax = 1.320 m`), with `MeshStandardMaterial({ color: 0x0b2a14, emissive: 0x34d399, emissiveIntensity: 1.0, roughness: 0.4 })` (keep `emissiveIntensity <= 1.0` for GLTFExporter r128). The host scene (`collabPods.ts`) looks up `model.getObjectByName('Pod_Occupancy_LED')` and dynamically toggles its `color` and `emissive` between emerald green (`#34d399`, free) and amber (`#f59e0b`, occupied).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Collab_Diner_Pod".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 18,000.
   - Include an automated verification panel checking exact outer bounds (`1.90 × 1.32 × 1.30 m`), `yMin = 0`, bench cushion height `0.45 m` at `x = ±0.62 m`, table height `0.72 m` (`x` within `[-0.26, +0.26]`), open `+Z` entrance & open top, presence of `"Pod_Occupancy_LED"`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Collab_Diner_Pod.glb".
```

---

## 4. Status Generator & Kontrak Terverifikasi (18 November 2026)

**Status:** kelima generator sudah dibuat di `tools/3d-generator/<Nama>.html` (gitignored, lokal saja), memakai template yang sama dengan Tahap 4 (panel **Contract check**, lighting studio, ekspor `GLTFExporter` biner). Semua halaman berstatus **PASS**. Klik **Export GLB**, lalu salin ke `public/models/`.

### A. Analisa prompt vs scene
Kelima prompt cocok dengan kode scene; tidak ada koreksi kontrak. Yang dicek:
- Podium: pembicara scene berdiri di lokal z −0,43 (sisi −Z), audiens & kamera di +Z setelah rotY +90°.
- Meja pelatihan: rotY +90° (koreksi §8.A rencana Tahap 5); buku catatan scene jatuh di lokal x −0,58 / 0 / +0,58, z +0,13 (zona datar +0,02..+0,25); kursi di lokal z +0,52.
- Layar komando: scene mencari `InfoWall_Main_Screen` lebih dulu (`Command_Screen_Active` juga diterima).
- Kanban: dipasang sebagai anak `walls.west`. Slot scene diganti nama menjadi `InfoWall_Kanban_Board`, karena `Kanban_Board` sudah dipakai node di GLB whiteboard scrum ruang kerja.
- Diner pod: kursi scene di x ±0,62, z 0, berdiri dulu 0,45 m di depan bibir pod; LED `Pod_Occupancy_LED` diwarnai scene, kapsul lampu scene disembunyikan bila LED ada.

### B. Hasil cek per GLB

| GLB | Ukuran terukur | Cek kunci | Segitiga | File |
|---|---|---|---|---|
| `Office_Workshop_Lectern_Podium` | 0,620 × 1,120 × 0,480 | 11 bilah walnut di +Z (z 0,176..0,221); dek 0,98 → 1,09; ujung mic tepat 1,12; badan naik mengikuti kemiringan dek (tanpa celah di bawah brow) | 2,3k | ±190 KB |
| `Office_Workshop_Training_Table` | 1,800 × 0,740 × 0,550 | Lubang grommet asli (tanpa z-fighting); ruang lutut +Z kosong; zona buku catatan datar; caster di y 0 | 2,0k | ±220 KB |
| `Office_InfoWall_Command_Display` | 3,800 × 2,100 × 0,300 | zMin 0; tepat 1 mesh "Screen" = `InfoWall_Main_Screen` 3,600 × 1,370, Y 0,65..2,02, datar di z 0,156 | 2,5k | ±400 KB |
| `Office_InfoWall_Kanban_Board` | X ±0,900, Y ±0,575, Z 0..0,058 | 14 kartu (atlas tekstur), magnet, baki spidol di dalam z ≤ 0,060 | 1,5k | ±260 KB |
| `Office_Collab_Diner_Pod` | 1,900 × 1,320 × 1,300 | Dudukan 0,45 di x ±0,62; meja 0,72 di x ±0,26; atap & pintu +Z terbuka; `Pod_Occupancy_LED` 1 mesh, 1 material | 1,0k | ±180 KB |

### C. Verifikasi di scene
- Kelima GLB dibangun dari generator dan disajikan ke halaman kantor lewat `page.route`. Semuanya termuat menggantikan placeholder, dengan bounding box dunia: podium `X 25.64..26.12, Z 3.07..3.69`; meja `X 26.43..26.98` & `28.23..28.78`, `Z 1.3..3.1`; layar komando `X 21.7..25.5, Z -4.76..-4.46`; kanban `X 21.25..21.31, Y 0.975..2.125, Z -3.95..-2.15` (anak `West_Wall`); pod A `X 26.17..28.07`, pod B `X 28.69..30.59`, `Z -4.63..-3.33`.
- Overlay kanvas live jatuh tepat 4 mm di depan `InfoWall_Main_Screen` (z dunia −4,604 → −4,600) dengan ukuran sama persis.
- LED `Pod_Occupancy_LED` GLB berubah amber saat pod terisi; kapsul lampu scene tersembunyi.
