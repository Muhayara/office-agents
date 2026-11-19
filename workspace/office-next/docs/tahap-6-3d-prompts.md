# Prompt Detail Pembuatan Model 3D — Tahap 6 (Studio / Content, Focus Pods, & Digital Access Hub)
> **Proyek:** Office Agents 3D (`workspace/office-next`) — **Tahap Penutup Lantai 1 (16/16 Zona)**  
> **Engine Generator:** Three.js r128 (via CDN) + `GLTFExporter`  
> **Folder Generator Lokal:** `workspace/office-next/tools/3d-generator/` *(gitignored)*  
> **Folder Output Model:** `workspace/office-next/public/models/`  
> **Standar Skala:** Metrik `1 Unit = 1 Meter` (`1.0 = 100 cm`). Orientasi lokal model: Depan = `+Z`, Kanan = `+X`, Atas = `+Y`. Nilai `emissiveIntensity` seluruh material dijaga **`<= 1.0`** agar tidak dipotong `GLTFExporter` r128.

---

## 1. Ringkasan Kontrak 7 Aset 3D Baru Tahap 6

Seluruh ukuran, titik origin, penamaan mesh dinamis, dan batas visibilitas kamera di bawah ini disinkronkan langsung dengan [tahap-6-studio-focus-access.md §6](./tahap-6-studio-focus-access.md).

| No | File Output GLB | Dimensi Kontrak ($W \times H \times D$) | Origin `(0,0,0)` & Orientasi Lokal | Ruangan & Penempatan | Catatan Kritis Integrasi Scene |
|---|---|---|---|---|---|
| 1 | `Office_Studio_Cyclorama_Stage.glb` | $2.60 \times 2.35 \times 1.75\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); lengkung *green screen* menghadap `+Z` | `Room_StudioContent` · `(-1.25, -1.76)` rata dinding utara, `rotY = 0°` | `zMin >= 0`. Ketebalan karpet/alas lantai panggung di zona berdiri talent `(0, +1.04)` **wajib $\le 10\text{ mm}$** agar sepatu avatar tidak tenggelam. |
| 2 | `Office_Studio_Camera_Softbox_Rig.glb` | $1.30 \times 1.68 \times 0.80\text{ m}$ | Lantai tengah (`Y = 0`); lensa kamera & muka *softbox* menghadap `+Z`, monitor operator di `-Z` | `Room_StudioContent` · `(-1.25, +0.52)`, `rotY = 180°` | Saat diputar `180°`, lensa & *softbox* menyorot ke utara (*green screen*), sedangkan layar monitor sutradara menghadap operator di selatan. |
| 3 | `Office_Studio_Production_Desk.glb` | $1.65 \times 1.18 \times 0.72\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); permukaan meja `0.75 m`, dual monitor menghadap `+Z` | `Room_StudioContent` · `(+1.85, -1.76)` rata dinding utara, `rotY = 0°` | `zMin >= 0`, **tanpa kursi** (scene memasang `Office_Ergonomic_Chair.glb`). Ruang lutut di `+Z` terbuka penuh. |
| 4 | `Office_Focus_Solo_Pod.glb` | $1.36 \times 1.48 \times 1.16\text{ m}$ *(dipakai 2×)* | Lantai tengah (`Y = 0`); meja + monitor 34" di `-Z`, dudukan `0.45 m`, **terbuka di `+Z` & tanpa atap** | `Room_FocusPods` · `(-1.36, -0.85)` & `(-1.36, +1.35)`, `rotY = +90°` | **Tanpa atap** agar agen yang mengetik terlihat dari kamera Tenggara. Wajib ada 1 `THREE.Mesh` ber-`MeshStandardMaterial` tunggal bernama **`Focus_Status_LED`** (`yMax = 1.480 m`). |
| 5 | `Office_Access_Elevator_Portal.glb` | $1.70 \times 2.45 \times 0.28\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); pintu lift & indikator `"L1 ▲ L2"` menghadap `+Z` | `Room_AccessHub` · `(-2.00, -1.10)` rata dinding barat utara, `rotY = +90°` | `zMin >= 0` agar tidak menembus ke Digital Garden di baratnya. |
| 6 | `Office_Access_Floor_Map_Totem.glb` | $0.95 \times 1.25 \times 0.55\text{ m}$ | Lantai tengah (`Y = 0`); layar miring menghadap `+Z` (`yMax <= 1.25 m`) | `Room_AccessHub` · `(-1.42, +1.25)`, `rotY = +90°` | Tinggi dikunci `<= 1.25 m` agar bangku jati Garden tidak tertutup. Wajib ada 1 mesh datar **`Access_Map_Screen`** (`0.82 × 0.48 m`, pusat `(0, 1.04, 0.02)`, `rotation.x = -π/6`). |
| 7 | `Office_Access_Floor2_Staircase.glb` | $1.25 \times 2.35 \times 2.20\text{ m}$ | Lantai tengah (`Y = 0`); anak tangga mulai naik dari `-Z` menuju bordes *mezzanine* (`Y = 1.52 m`) di `+Z` | `Room_AccessHub` · `(+1.02, +1.45)`, `rotY = 0°` | Bordes atas berpagar kaca *tempered* + gerbang pembatas `"LANTAI 2 · SEGERA"` sebagai penanda ekspansi gedung. |

> [!NOTE]
> **Aset Eksisting yang Dipakai Ulang di Tahap 6:**
> - `Office_Ergonomic_Chair.glb` (kursi editor di meja produksi Studio)
> - `Office_Indoor_Plant.glb` & `Office_Indoor_Plant_SnakePlant.glb` (tanaman sudut di Studio, Focus Pods, & Access Hub)

---

## 2. Panduan Penggunaan Prompt

1. Setelah implementasi kode Tahap 6 selesai (atau sesuai urutan pengerjaan), salin tiap blok prompt di bawah untuk membuat 7 file HTML generator di `workspace/office-next/tools/3d-generator/<Nama_Model>.html`.
2. Buka masing-masing file HTML di browser, pastikan panel **Contract check** berstatus **PASS**, klik **"Export GLB"**, dan selalu tutup browser/Playwright setelah pengecekan.
3. Salin ketujuh file `.glb` ke `workspace/office-next/public/models/`:
   ```text
   workspace/office-next/public/models/
     ├── Office_Studio_Cyclorama_Stage.glb
     ├── Office_Studio_Camera_Softbox_Rig.glb
     ├── Office_Studio_Production_Desk.glb
     ├── Office_Focus_Solo_Pod.glb
     ├── Office_Access_Elevator_Portal.glb
     ├── Office_Access_Floor_Map_Totem.glb
     └── Office_Access_Floor2_Staircase.glb
   ```

---

## 3. Koleksi Prompt Detail per Model

---

### PROMPT 1: Panggung Lengkung Green Screen & Lampu Sorot (`Office_Studio_Cyclorama_Stage.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Studio_Cyclorama_Stage" (Seamless Chroma-Key Green Screen Infinity Cyclorama Cove with Overhead Lighting Truss & Fresnel Spotlights).

1. STRICT METRIC SCALING, REAR-FLUSH ORIGIN & AVATAR FLOOR CONTRACT:
   - Total Width (X): 2.60 m (x spans -1.30 m to +1.30 m, ±5 mm).
   - Total Height (Y): 2.35 m (y spans 0.00 m to 2.35 m, ±5 mm).
   - Total Depth (Z): 1.75 m (z spans 0.00 m to +1.75 m, ±5 mm).
   - CRITICAL REAR-FLUSH ORIGIN (0,0,0): Floor center of the REAR wall-mounting plane (`x = 0, y = 0, z = 0`). NO vertex may have `z < 0.000 m` (mounts flush against the Studio North wall). Front stage opens towards +Z.
   - CRITICAL AVATAR FOOT HEIGHT CONSTRAINT: An on-set presenter avatar stands at local `(x = 0.00, y = 0.00, z = +1.04 m)`. Therefore, the flat horizontal stage floor apron (`z = +0.55 m to +1.75 m`) MUST have top surface `Y <= 0.010 m` (8–10 mm low-profile studio floor sheet tapering to a 2 mm beveled safety ramp along the +Z front edge) so the avatar's shoes sit cleanly on top without sinking!

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Seamless Infinity Chroma-Key Cove (`#1fa855`):
     - Matte dark-charcoal rigid rear structural frame (`z = 0.00..0.05 m`, #1b1f24, roughness 0.6, metalness 0.5).
     - Ultra-smooth seamless studio chroma-key green surface (`color: #1fa855, roughness: 0.90, metalness: 0.0`—strictly matte to avoid hot-spot glare): vertical backdrop wall (`y = 0.50..2.22 m, z = 0.06 m`) curving continuously through a tangent quarter-cylinder floor cove (`radius 0.49 m`, `z = 0.06..0.55 m`) into the flat floor apron (`z = 0.55..1.75 m, top Y = 0.009 m`), plus subtle curved left/right corner wings (`12 cm` radius return) for an authentic infinity-wall look.
     - Crisp white gaffer-tape talent center cross-mark `"✕"` (`18 × 18 cm`, `Y = 0.010 m`) centered at `(x = 0.00, z = +1.04 m)`.
   - Overhead Box-Truss Rig & 2 Studio Fresnel Spotlights:
     - Two slim matte-black steel vertical truss stanchions tucked along the outer edges (`x = ±1.26 m, z = 0.14 m`) supporting a horizontal triangular/box aluminum lighting truss beam spanning `x = -1.28..+1.28 m` at `y = 2.20..2.35 m` (cantilevered forward to `z = 0.42 m`).
     - Two detailed matte-black die-cast LED Fresnel studio spotlights clamped to the truss at `x = ±0.68 m`, aimed downward toward `(0, 0.9, 1.04)`, complete with cooling fins, yoke brackets, safety cables, 4-leaf open matte-black barn doors, and glowing warm-daylight Fresnel lenses (`emissive: #fff6e5, emissiveIntensity: 1.0`—keep `<= 1.0` for GLTFExporter r128).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Studio_Cyclorama_Stage".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 14,000.
   - Include an automated contract check panel verifying bounds (2.60 × 2.35 × 1.75 m), `zMin >= 0.000`, floor height at `(0, 1.04)` <= `0.010 m`, `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Studio_Cyclorama_Stage.glb".
```

---

### PROMPT 2: Rig Kamera Sinema & Lampu Softbox (`Office_Studio_Camera_Softbox_Rig.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Studio_Camera_Softbox_Rig" (Digital Cinema Broadcast Camera on Fluid-Head Tripod with Director Monitor & Octagonal Softbox Keylight).

1. STRICT METRIC SCALING & ORIENTATION CONTRACT:
   - Total Width (X): 1.30 m (x spans -0.65 m to +0.65 m, ±5 mm).
   - Total Height (Y): 1.68 m (y spans 0.00 m to 1.68 m, ±5 mm).
   - Total Depth (Z): 0.80 m (z spans -0.40 m to +0.40 m, ±5 mm).
   - Origin (0,0,0): Floor center (`Y = 0`).
   - CRITICAL ORIENTATION:
     - Camera Lens, Matte-Box & Softbox Diffuser Face point towards **+Z** (the subject / stage).
     - Camera Operator Viewfinder, Pan-Bar & 7-Inch Director Field Monitor face towards **-Z** (in the host Studio, this rig is rotated 180° so +Z points North at the green screen while the operator stands on the South side).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Twin-Tube Cinema Tripod & Broadcast Camera Assembly (centered at `x = -0.18 m, z = 0.00 m`):
     - Heavy-duty matte carbon-fiber twin-leg video tripod (`footprint radius <= 0.36 m`, mid-level spreader with rubber feet at `Y = 0.00 m`, weighted black/amber saddlebag sandbag draped across spreader) topped with a machined anodized-black fluid head (`Y = 1.22 m`) and angled telescoping pan handle extending toward `-Z` (`z >= -0.39 m`).
     - Modular digital cinema camera body (`#1c2026`, red anodized record button, side cheese-plate rails, V-mount battery at rear `-Z` with 4 tiny green charge LEDs), cinema prime lens with geared follow-focus ring, flared carbon-fiber matte-box & top French flag pointing `+Z` (`z <= +0.38 m`), and a glowing red tally LED on top (`emissive: #ef4444, emissiveIntensity: 1.0`).
     - Articulated magic-arm holding an angled 7-inch high-bright Director's Field Monitor (`0.18 × 0.11 m` at `y = 1.52 m, z = -0.14 m` facing `-Z`) with a procedural CanvasTexture showing a green-screen framing grid, waveform scope, and `"REC 00:14:28 · 4K60"`.
   - Flanking Studio C-Stand & Octagonal Softbox Keylight (centered at `x = +0.34 m, z = +0.02 m`):
     - Folding 3-leg black steel studio light stand (`radius <= 0.30 m`) rising to `y = 1.40 m`, topped with an angled octagonal photography softbox (`outer diameter 0.56 m`, peaking strictly at `Y = 1.68 m`, pitched slightly toward `-X/+Z`).
     - Outer hood in matte black ripstop fabric (#16181b, roughness 0.85) with silver reflective inner rim and taut front translucent white diffuser fabric facing `+Z` (`color: #fffaf0, emissive: #fff3db, emissiveIntensity: 0.90`).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Studio_Camera_Softbox_Rig".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 16,000.
   - Include an automated verification panel checking exact outer bounds (1.30 × 1.68 × 0.80 m), `yMin = 0`, `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Studio_Camera_Softbox_Rig.glb".
```

---

### PROMPT 3: Meja Produksi Video & Color-Grading (`Office_Studio_Production_Desk.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Studio_Production_Desk" (Post-Production Video Editing, Color-Grading & 3D Rendering Studio Workstation Desk).

1. STRICT METRIC SCALING, REAR-FLUSH ORIGIN & CHAIR EXCLUSION CONTRACT:
   - Total Width (X): 1.65 m (x spans -0.825 m to +0.825 m, ±4 mm).
   - Total Height (Y): 1.18 m (y spans 0.00 m to 1.18 m, ±4 mm, top of monitor shading hood).
   - Total Depth (Z): 0.72 m (z spans 0.00 m to +0.72 m, ±4 mm).
   - Main Desktop Surface Height: `Y = 0.75 m`; Raised Acoustic Monitor Bridge Shelf: `Y = 0.86 m` (`z = 0.03..0.27 m`).
   - CRITICAL REAR-FLUSH ORIGIN (0,0,0): Floor center of the REAR wall-mounting face (`x = 0, y = 0, z = 0`). NO vertex may have `z < 0.000 m`! User sits on the `+Z` side facing `-Z`, meaning both monitor screens face **`+Z`** (directly visible from the host scene's Southeast isometric camera!).
   - DO NOT INCLUDE A CHAIR (the host scene mounts `Office_Ergonomic_Chair.glb` separately; keep central knee space `x = -0.48..+0.48 m, z = +0.28..+0.72 m, y = 0.00..0.71 m` completely unobstructed!).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Studio Desk & Rack Pedestal Architecture:
     - Ergonomic curved-front dark American walnut desktop (`1.65 × 0.72 × 0.028 m` at `Y = 0.75 m`, procedural rich walnut grain CanvasTexture, roughness 0.44) with padded black leatherette forearm bolster along the `+Z` front edge.
     - Left & right Matte-Black Steel A-frame / 4U angled studio rack side legs (`x = ±0.66 m`), housing a 19-inch rackmount audio interface & power conditioner with tiny glowing VU level LEDs on the right bay, plus rear perforated cable modesty tray (`z = 0.04..0.18 m`).
   - Dual 27" Reference Monitors + Studio Nearfield Speakers (on `Y = 0.86 m` Bridge):
     - Left 27" Color-Grading Reference Display (`x = -0.30 m`, angled 8° inward toward `(0, +0.9)`) fitted with a 3-sided matte-black anti-glare calibration hood (`peaking at Y = 1.18 m`), screen CanvasTexture rendering color-grading wheels, RGB parade waveform, and green-screen composite frame (`emissiveIntensity: 0.90`).
     - Right 27" NLE Timeline & 3D Viewport Display (`x = +0.30 m`, angled 8° inward), screen CanvasTexture rendering multi-track video/audio timeline & wireframe 3D model render.
     - Pair of compact acoustic nearfield studio monitor speakers at `x = ±0.71 m` on angled isolation pads, featuring matte-black enclosures and signature copper/yellow woven woofer cones facing `+Z`.
   - Tactile Editing & Colorist Peripherals (on `Y = 0.75 m` Desktop):
     - Three-ring colorist trackball control surface (`x = -0.32 m, z = +0.48 m`), dark tenkeyless shortcut keyboard with color-coded editing keycaps (`x = +0.04 m`), graphics pen tablet with stylus on stand (`x = +0.42 m`), and compact rotary audio monitor controller.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Studio_Production_Desk".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 16,000.
   - Include an automated verification panel checking exact bounds (1.65 × 1.18 × 0.72 m), `zMin >= 0.000`, `yMin = 0`, unobstructed central knee cavity, `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Studio_Production_Desk.glb".
```

---

### PROMPT 4: Bilik Fokus Tunggal Kedap Suara (`Office_Focus_Solo_Pod.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Focus_Solo_Pod" (Open-Top Architectural Solo Deep-Focus Acoustic Work Pod with Curved 34" Monitor, Built-In Seat & Busy Status LED).

1. STRICT METRIC SCALING, OPEN-TOP VISIBILITY & AVATAR SEATING CONTRACT:
   - Outer Width (X): 1.36 m (x spans -0.68 m to +0.68 m, ±4 mm).
   - Outer Depth (Z): 1.16 m (z spans -0.58 m to +0.58 m, ±4 mm).
   - Outer Height (Y): STRICTLY 1.48 m (y spans 0.00 m to 1.48 m, ±4 mm).
   - Origin (0,0,0): Floor center (`Y = 0`).
   - CRITICAL ISOMETRIC VISIBILITY & ENTRANCE RULES:
     1. OPEN TOP (NO SOLID ROOF): Do NOT cover the top with a ceiling! At 1.48 m high, this is a wrap-around architectural acoustic focus booth so the isometric camera looking down at ~32° clearly sees the seated agent typing inside, the 34" monitor, and the warm task lamp.
     2. OPEN +Z DOORWAY & ZERO +Z FLOOR THRESHOLD: Leave a clean `0.74 m` wide open entrance on the `+Z` side (`x = -0.37 m to +0.37 m, z = +0.58 m`) with NO door leaf and NO floor step/threshold in the leg/entry zone so avatars enter seamlessly at `Y = 0`!
   - EXACT AVATAR SEATING & DESK GEOMETRY:
     - Built-in curved walnut focus desk along the interior `-Z` wall (`z = -0.50 m to -0.06 m`, flat worktop at **`Y = 0.73 m`**).
     - Built-in upholstered focus banquette/task seat positioned for an avatar seated at **`(x = 0.00, z = +0.18 m)`** facing **`-Z`** (cushion top surface at **`Y = 0.45 m`**, spanning `x = -0.30..+0.30 m, z = +0.02..+0.36 m`, with a contoured low-profile backrest `z = +0.36..+0.44 m, y = 0.45..0.82 m` supported on a sleek central cantilever pedestal so entering from `+Z` is clean!).

2. DETAILED PROCEDURAL GEOMETRIES, NAMED STATUS LED & PBR MATERIALS:
   - Wrap-Around Acoustic Shell & Glazed Side Windows:
     - Softly radiused corners (`R = 0.14 m`), exterior clad in fluted deep slate-navy PET acoustic felt (`#22303d`, procedural heather texture, roughness 0.90) trimmed with warm natural oak top capping (`#b88a5a`) and matte-black base plinth along the walls.
     - Left and right side walls (`x = ±0.64 m`) each feature a vertical double-glazed acoustic vision window (`width 0.34 m` along Z, `y = 0.55..1.34 m`, tinted clear glass `opacity 0.32` in matte-black aluminum mullions) so the interior glows warmly from outside.
     - Interior walls lined with warm light-sand acoustic felt tiles (`#ded8cc`) and a subtle `+Z` entrance portal arch header bar (`y = 1.40..1.48 m` bridging across the top or mounted atop the `-Z` / `+Z` brow).
   - 34" Ultrawide Monitor & Warm Focus Task Lamp (on `-Z` Desk):
     - Curved 34-inch ultrawide coding display (`0.78 × 0.34 m`, centered at `x = 0, y = 1.02 m, z = -0.40 m` facing `+Z`) showing a crisp dark-mode IDE syntax & terminal CanvasTexture (`emissiveIntensity: 0.90`), wireless mechanical keyboard & mouse on desk, and a minimalist brass/matte-black architect desk lamp at `x = -0.42 m` casting a warm pool aesthetic.
   - Named Busy/Available Status Indicator Mesh:
     - Single `THREE.Mesh` (NOT a Group, and using a single `MeshStandardMaterial`, NOT an array) named EXACTLY **`"Focus_Status_LED"`** (`0.38 × 0.03 × 0.03 m`, centered at `x = 0, y = 1.465 m, z = +0.54 m` on the `+Z` upper brow—or if open-front without brow, at `z = -0.52 m, y = 1.465 m`—with `yMax = 1.480 m`), using `MeshStandardMaterial({ color: 0x0b2a14, emissive: 0x34d399, emissiveIntensity: 1.0, roughness: 0.35 })`. The host scene looks up `Focus_Status_LED` to switch between emerald green (`#34d399` available) and coral-red (`#f43f5e` deep focus).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Focus_Solo_Pod".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 16,000.
   - Include an automated verification panel checking exact bounds (1.36 × 1.48 × 1.16 m), `yMin = 0`, desk `Y = 0.73 m`, seat `Y = 0.45 m` at `(0, +0.18)`, open top, single `Focus_Status_LED` mesh with `MeshStandardMaterial` & `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Focus_Solo_Pod.glb".
```

---

### PROMPT 5: Portal Lift Ekspansi Lantai 2 (`Office_Access_Elevator_Portal.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Access_Elevator_Portal" (Architectural Corporate Passenger Elevator Doorway Portal with Floor Indicator & Call Station).

1. STRICT METRIC SCALING & REAR-FLUSH ORIGIN CONTRACT:
   - Total Width (X): 1.70 m (x spans -0.85 m to +0.85 m, ±4 mm).
   - Total Height (Y): 2.45 m (y spans 0.00 m to 2.45 m, ±4 mm).
   - Total Depth (Z): 0.28 m (z spans 0.00 m to +0.28 m, ±4 mm).
   - CRITICAL REAR-FLUSH ORIGIN (0,0,0): Floor center of the REAR wall-mounting plane (`x = 0, y = 0, z = 0`). NO vertex may have `z < 0.000 m` (mounts flush on the West wall of Digital Access Hub; negative Z would poke into Digital Garden!). Front faces +Z.

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Splayed Champagne-Bronze & Dark Gunmetal Portal Frame:
     - Monumental outer architectural surround (`1.70 × 2.45 × 0.26 m`, `z = 0.00..0.26 m`) in dark anodized gunmetal (`#1e2329`, roughness 0.42, metalness 0.78) with splayed brushed champagne-bronze inner jamb reveals (`#b39362`, roughness 0.30, metalness 0.86) tapering inward toward the elevator doors.
     - Concealed vertical warm-white LED cove light strips recessed inside the left and right jamb reveals (`y = 0.08..2.12 m`, `emissive: #ffebd2, emissiveIntensity: 0.95`).
     - Grooved extruded aluminum floor threshold sill plate (`width 1.24 m, y = 0.00..0.012 m, z = 0.06..0.26 m`) with safety track grooves.
   - Center-Parting Satin Stainless Steel Elevator Doors:
     - Twin recessed sliding door panels (`total clear width 1.16 m, height 2.12 m` at `z = 0.08..0.11 m`) in vertical brushed satin stainless steel (procedural fine brushed-metal CanvasTexture, `#cfd6dd`, roughness 0.26, metalness 0.90) separated by a crisp dark `5 mm` center parting shadow reveal and rubber safety astragal edge.
   - Digital Hall Lantern Transom & RFID Call Panel:
     - Overhead flush smoked-glass transom display (`0.68 × 0.14 m` centered at `x = 0, y = 2.27 m, z = 0.255 m`) with crisp emissive CanvasTexture reading `"L1  ▲  L2 · R&D LAB"` (`emissiveIntensity: 1.0`) flanked by twin directional arrival chevron lanterns.
     - Right-hand jamb call station plate (`x = +0.71 m, y = 1.05 m, z = 0.26..0.28 m`) featuring a glowing cyan halo `"▲"` call button, braille tactile Floor `"1"` badge, and sleek black glass NFC/RFID access reader.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Access_Elevator_Portal".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 10,000.
   - Include an automated verification panel checking exact bounds (1.70 × 2.45 × 0.28 m), `zMin >= 0.000`, `yMin = 0`, `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Access_Elevator_Portal.glb".
```

---

### PROMPT 6: Totem Meja Peta Masterplan Interaktif (`Office_Access_Floor_Map_Totem.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Access_Floor_Map_Totem" (Low-Profile Angled Interactive 3D Building Wayfinding & Expansion Masterplan Console Pedestal).

1. STRICT METRIC SCALING, LOW-PROFILE SIGHTLINE & TILTED SCREEN CONTRACT:
   - Total Width (X): 0.95 m (x spans -0.475 m to +0.475 m, ±4 mm).
   - Total Depth (Z): 0.55 m (z spans -0.275 m to +0.275 m, ±4 mm).
   - Total Height (Y): STRICTLY <= 1.25 m (y spans 0.00 m to 1.25 m, ±4 mm—kept low so it never occludes the Digital Garden bench behind it!).
   - Origin (0,0,0): Floor center (`Y = 0`). Viewer stands on the `+Z` side looking down at the angled screen facing `+Z` / `+Y`.
   - CRITICAL NAMED TILTED SCREEN MESH CONTRACT:
     - Create a single flat rectangular `THREE.Mesh` named EXACTLY **`"Access_Map_Screen"`** (make it the ONLY mesh whose `.name` contains `"Screen"`).
     - Exact geometry & transform of `"Access_Map_Screen"`: `PlaneGeometry(0.82, 0.48)` centered at **`(x = 0.000, y = 1.040, z = +0.020)`** with **`rotation.set(-Math.PI / 6, 0, 0)`** (`-30°` tilt around X, so its surface normal points `(0, +0.50, +0.866)` upward and forward toward `+Z`).
     - Keep surrounding outer bezel frame strictly flush with or behind the screen plane across the active `0.82 × 0.48 m` area so the host scene can attach a live `0.82 × 0.48 m` CanvasTexture overlay offset `+4 mm` along `"Access_Map_Screen"`'s local `+Z` normal with zero clipping!
     - Give `"Access_Map_Screen"` a detailed default fallback CanvasTexture showing the 16-zone Floor 1 architectural blueprint (`"LANTAI 1 · 16 / 16 ZONA AKTIF"`) and a glowing `"LANTAI 2 · EKSPANSI"` tab (`emissiveIntensity: 0.95`).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Angled Monolith Pedestal & Weighted Plinth:
     - Heavy chamfered matte-black steel floor base (`0.78 × 0.46 × 0.025 m`, `#15181c`, roughness 0.48, metalness 0.80) with subtle cyan perimeter floor-wash accent strip (`emissive: #38bdf8, emissiveIntensity: 0.85`).
     -Twin tapered architectural support columns / sculpted wedge pedestal in brushed dark titanium-slate (`#2a323d`, roughness 0.36, metalness 0.72) accented with vertical natural oak side inlays (`#b88a5a`).
   - Tilted Touchscreen Console Housing (`rotation.x = -Math.PI / 6`):
     - Sleek `0.95 × 0.58 × 0.055 m` chamfered anodized aluminum display housing centered behind `"Access_Map_Screen"` (peaking at `Y <= 1.25 m` at its upper `-Z` edge), featuring a brushed champagne-bronze lower wrist-rest ledge with laser-etched `"OFFICE AGENTS · BUILDING DIRECTORY"` lettering and NFC badge icon.

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Access_Floor_Map_Totem".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 8,000.
   - Include an automated verification panel checking exact outer bounds (`0.95 × <=1.25 × 0.55 m`), `yMin = 0`, `yMax <= 1.250 m`, exact `"Access_Map_Screen"` center `(0, 1.04, 0.02)` / size `0.82 × 0.48` / `rotation.x = -30°`, `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Access_Floor_Map_Totem.glb".
```

---

### PROMPT 7: Tangga Melayang Mezzanine Lantai 2 (`Office_Access_Floor2_Staircase.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, validate, and export a high-fidelity 3D PBR model: "Office_Access_Floor2_Staircase" (Architectural Floating White-Oak & Glass Mezzanine Staircase with Floor-2 Expansion Portal Gate).

1. STRICT METRIC SCALING & ORIENTATION CONTRACT:
   - Total Width (X): 1.25 m (x spans -0.625 m to +0.625 m, ±5 mm).
   - Total Depth (Z): 2.20 m (z spans -1.10 m to +1.10 m, ±5 mm).
   - Total Height (Y): 2.35 m (y spans 0.00 m to 2.35 m, ±5 mm, top of mezzanine balustrade / portal sign).
   - Origin (0,0,0): Floor center (`Y = 0`).
   - CRITICAL ORIENTATION:
     - Bottom First Step starts at the **-Z** end (`z = -1.04 m` near floor `Y = 0.19 m`).
     - Steps ascend towards **+Z** up to a cantilevered Mezzanine Landing Platform (`top surface Y = 1.52 m`, spanning `z = +0.36 m to +1.10 m`), capped at the `+Z` rear edge by a sleek closed Floor-2 Expansion Gate (`"LANTAI 2 · SEGERA"`).

2. DETAILED PROCEDURAL GEOMETRIES & PBR MATERIALS:
   - Central Steel Mono-Stringer & Mezzanine Landing Structure:
     - Heavy-duty architectural matte-black powder-coated steel rectangular spine beam (`140 × 180 mm`, `#171a1e`, roughness 0.46, metalness 0.78) anchored to a flush floor plate at `z = -0.92 m`, rising diagonally at ~38° to support the upper steel mezzanine landing frame (`1.25 × 0.74 m` at `Y = 1.52 m`) braced by two rear vertical steel columns at `(x = ±0.52 m, z = +1.02 m)`.
   - 7 Floating Solid White-Oak Treads + Oak Mezzanine Deck:
     - Seven thick cantilevered solid white-oak stair treads (`width 1.08 m, depth 0.26 m, thickness 46 mm`, warm natural woodgrain CanvasTexture `#b98c5c`, roughness 0.46) rising evenly from `Y = 0.19 m` (`z = -0.92 m`) to `Y = 1.33 m` (`z = +0.22 m`), leading onto the matching oak mezzanine deck (`Y = 1.52 m, z = +0.36..+1.08 m`).
     - Concealed warm-white LED step-nosing strips recessed beneath each tread and landing edge (`emissive: #ffe5be, emissiveIntensity: 0.90`).
   - Tempered Glass Balustrades & Satin Stainless Handrails:
     - Sloped and horizontal frameless low-iron tempered glass guard panels along both left and right sides (`x = ±0.58 m`, `color: #cfe8f3, transparent: true, opacity: 0.28, roughness: 0.08`), fastened to the treads/landing with machined satin-stainless circular standoff pucks and topped with continuous `Ø 42 mm` brushed stainless steel handrails peaking at `Y = 2.35 m` along the landing.
   - Floor-2 Expansion Access Gate (at `+Z` Mezzanine End, `z = +1.06 m`):
     - Modern waist-high brushed stainless & smoked-glass speed-gate barrier (`Y = 1.52..2.35 m`) across the back of the landing, topped with a sleek dark-slate & cyan illuminated architectural header plaque facing `-Z` (towards the lobby & camera) reading **`"LANTAI 2 · EKSPANSI"`** (`emissiveIntensity: 0.95`).

3. SCENE HIERARCHY, VERIFICATION PANEL & EXPORT:
   - Root THREE.Group named: "Office_Access_Floor2_Staircase".
   - Enable castShadow = true and receiveShadow = true. Keep triangle count under 16,000.
   - Include an automated verification panel checking exact outer bounds (1.25 × 2.35 × 2.20 m), `yMin = 0`, `yMax = 2.35 m`, ascent direction `-Z → +Z`, `emissiveIntensity <= 1.0`, and triangle budget, plus OrbitControls and "Export GLB" button saving "Office_Access_Floor2_Staircase.glb".
```

---

## 4. Status GLB & Penyesuaian Scene (18 November 2026)

Ketujuh GLB sudah ada di `public/models/` dan diverifikasi di scene. Ukuran sesuai kontrak; `Focus_Status_LED` dan `Access_Map_Screen` ditemukan. Generator HTML Tahap 6 ditunda (keputusan CEO). Rincian ada di [tahap-6-studio-focus-access.md §8](./tahap-6-studio-focus-access.md).

Ada dua penempatan scene yang berubah dari tabel §1. GLB tidak perlu diubah:
- **`Office_Focus_Solo_Pod`** dipasang dengan **rotY π/4**, bukan +90°. Mulut bilik kini menghadap kamera Tenggara, karena pada +90° agen yang duduk tertutup sirip depan dan *brow*.
- **`Office_Access_Floor2_Staircase`** dipasang di kuadran **timur laut** `(1.02, -1.2)` dengan **rotY π**. Di posisi rencana, bordesnya menutupi pembaca totem. Akibat rotasi ini, plakat gerbang yang menghadap −Z lokal kini menghadap +Z dunia, sehingga terbaca dari kamera Tenggara.
