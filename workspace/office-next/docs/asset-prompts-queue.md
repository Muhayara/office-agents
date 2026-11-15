# Antrean Prompt Aset 3D Modular Kantor Virtual (`asset-prompts-queue.md`)
*Disusun oleh: Wulan (Pixel/3D Artist) & Tari (Desainer UI/UX)*

Dokumen ini berisi kumpulan prompt presisi bahasa Inggris yang sudah diformat khusus untuk model **`Qwen3.5-4B-GLB-3D-Coder`**. Setiap prompt dirancang agar menghasilkan satu file `.glb` modular yang siap pakai di panggung Three.js kantor kita.

---

## 📋 Daftar Aset & Status Pengerjaan

| No | Nama Aset | File Output | Status |
|---|---|---|---|
| **0** | **Ruangan Kantor Dasar (Diorama Shell)** | `office_room_shell.glb` | ✅ **Selesai (Sudah Terpasang)** |
| **1** | **Meja Kerja Modular (10 Posisi)** | `desk.glb` | ⏳ **Sedang Dibuat di Laptopmu** |
| **2** | **Kursi Kantor Ergonomis Mesh** | `chair.glb` | 🎯 Siap Diproses Berikutnya |
| **3** | **Setup Komputer Dual Monitor + Keyboard** | `monitor_setup.glb` | 🎯 Antrean ke-3 |
| **4** | **Rak Server 42U (Satria & Bima)** | `server_rack.glb` | 🎯 Antrean ke-4 |
| **5** | **Tanaman Hias Sudut (Monstera Indoor Pot)** | `plant.glb` | 🎯 Antrean ke-5 |
| **6** | **Pantry Coffee Bar & Water Dispenser** | `coffee_bar.glb` | 🎯 Antrean ke-6 |
| **7** | **Papan Tulis Kanban Strategi (Dinding Raka)** | `kanban_board.glb` | 🎯 Antrean ke-7 |

---

## 🎯 Koleksi Prompt Siap Salin ke Qwen 3D-Coder

### 1. Meja Kerja Modular (`desk.glb`) — *Sedang Berjalan*
```text
Generate a clean, modern, low-poly modular office workstation desk 3D model in GLB format using Three.js procedural modeling and GLTFExporter.

Specifications:
1. Exact Dimensions:
   - Length (X-axis): 1.4 units (meters)
   - Depth (Z-axis): 0.7 units (meters)
   - Height (Y-axis): 0.75 units (meters)
   - Pivot / Origin: Centered at floor level [0, 0, 0] at the bottom of the legs.

2. Tabletop:
   - Thickness: 0.035 units
   - Position: Top sits exactly at Y = 0.75
   - Material: Premium dark charcoal wood / walnut matte finish (#1c282e), roughness 0.65, metalness 0.05.
   - Chamfered / beveled edges on the tabletop for a manufactured finish.
   - Include a small circular black cable grommet cap (radius 0.03m) recessed near the back edge [0, 0.751, -0.25].

3. Frame & Legs (Industrial Minimalist):
   - Leg Style: Two sturdy square loop legs (O-frame / U-frame) made of extruded black matte steel (#11181c), roughness 0.35, metalness 0.8.
   - Legs positioned at X = -0.63 and X = +0.63, spanning from Z = -0.32 to +0.32.
   - Include a horizontal support beam connecting the legs underneath the tabletop for structural realism.
   - Include a subtle metal wire-management tray mesh tucked underneath the rear of the desk.

4. Output Contract:
   - Standalone HTML page with Three.js WebGL preview (OrbitControls, soft studio lighting) and a one-click "Export GLB" button.
   - Export root group named "Office_Modular_Desk" with clean normals and optimized geometry for instanced rendering.
   - Do NOT include chairs or monitors (desk only).
```

---

### 2. Kursi Kantor Ergonomis Mesh (`chair.glb`)
```text
Generate a clean, modern, low-poly ergonomic office swivel chair 3D model in GLB format using Three.js procedural modeling and GLTFExporter.

Specifications:
1. Exact Dimensions & Scaling:
   - Width: 0.62m, Depth: 0.60m, Total Height: 1.05m
   - Seat Height: 0.45m from the floor
   - Pivot / Origin: Centered at floor level [0, 0, 0] directly under the center pedestal column.

2. Base & Pedestal:
   - 5-star spider base with 5 small castor wheels at the tips (radius 0.3m).
   - Central vertical hydraulic cylinder column (metallic dark chrome #25333a, metalness 0.85, roughness 0.25).

3. Seat & Backrest (Ergonomic Breathable Mesh Style):
   - Contoured padded seat cushion: 0.48m wide x 0.45m deep x 0.06m thick, dark graphite fabric (#182329).
   - Ergonomic curved mesh backrest: 0.44m wide x 0.55m tall with subtle lumbar curve and black plastic outer frame (#0d1418).
   - Two adjustable T-armrests on the sides with soft black pads at Y = 0.68m.

4. Output Contract:
   - Facing forward (+Z axis).
   - Standalone HTML page with Three.js preview and a one-click "Export GLB" button.
   - Export root group named "Office_Ergonomic_Chair" optimized for instancing.
```

---

### 3. Setup Komputer Workstation Dual Monitor (`monitor_setup.glb`)
```text
Generate a clean, modern low-poly dual-monitor computer workstation setup (monitors, stand, keyboard, mousepad) in GLB format using Three.js procedural modeling and GLTFExporter.

Specifications:
1. Sizing & Origin:
   - Sits on top of the desk: Pivot / Origin at [0, 0, 0] positioned flat on the desk surface (Y = 0 is tabletop level).
   - Total Width: 1.15m, Depth: 0.45m, Height: 0.42m.

2. Dual Monitors:
   - Monitor 1 (Main): 27-inch widescreen display (0.60m x 0.35m x 0.015m) angled slightly, ultra-thin bezel.
   - Monitor 2 (Secondary): 24-inch display angled inward by 18 degrees to create a realistic curved workstation view.
   - Sturdy V-shape or dual-arm aluminum desk mount clamp (#1c2a31, metalness 0.8).
   - Screen glass: Sleek dark emissive cyan glow (#3ca7b8, emissiveIntensity 0.35).

3. Peripherals:
   - Sleek dark extended desk mousepad: 0.8m x 0.35m x 0.003m flat on tabletop (#11191e).
   - Compact 75% mechanical keyboard with dark grey and teal keycaps (#1a262e).
   - Wireless ergonomic mouse beside the keyboard.

4. Output Contract:
   - Facing forward (+Z axis).
   - Standalone HTML with preview and a one-click "Export GLB" button.
   - Export root group named "Workstation_Monitor_Setup".
```

---

### 4. Rak Server 42U Data Center (`server_rack.glb`)
```text
Generate an enterprise server rack enclosure (42U) 3D model in GLB format using Three.js procedural modeling and GLTFExporter.

Specifications:
1. Exact Dimensions:
   - Width: 0.75m, Depth: 0.95m, Height: 2.05m
   - Pivot / Origin: Centered at floor level [0, 0, 0].

2. Enclosure:
   - Heavy-duty matte black steel cabinet (#0d1317, metalness 0.75, roughness 0.4) with beveled corners.
   - Perforated mesh front door with a subtle metallic frame and vertical handle.

3. Interior Servers & Patch Panels:
   - Several 1U, 2U, and 4U rackmount servers visible inside.
   - Cable management clips on the sides with colored patch cables (teal, yellow, blue).
   - Emissive LED indicator dots (green #5dbb8a, blue #4da8da, and amber #e9a23b) on server faceplates with subtle glow.

4. Output Contract:
   - Standalone HTML page with preview and a one-click "Export GLB" button.
   - Export root group named "Server_Rack_42U".
```

---

### 5. Tanaman Hias Sudut Kantor (`plant.glb`)
```text
Generate a clean, stylized low-poly indoor office plant (Monstera / Ficus in geometric pot) in GLB format using Three.js procedural modeling and GLTFExporter.

Specifications:
1. Dimensions:
   - Total Height: 1.35m, Diameter: 0.65m
   - Pivot / Origin: Centered at floor level [0, 0, 0].

2. Pot & Planter:
   - Modern geometric faceted or cylindrical ceramic pot (0.35m diameter, 0.45m height) in matte off-white / light slate (#cdd6d8).
   - Dark potting soil mesh inside the pot.

3. Stems & Foliage:
   - 6 to 9 stylized broad green leaves (Monstera style with distinctive perforations/splits).
   - Rich natural green tones (#2a784c and #389e63, roughness 0.65).
   - Elegant outward fan spread to add organic warmth to the corporate office corners.

4. Output Contract:
   - Standalone HTML page with preview and a one-click "Export GLB" button.
   - Export root group named "Office_Indoor_Plant".
```

---

### 6. Pantry Coffee Bar & Water Dispenser (`coffee_bar.glb`)
```text
Generate a compact, modern office coffee bar counter with an espresso machine and water dispenser in GLB format using Three.js procedural modeling and GLTFExporter.

Specifications:
1. Dimensions:
   - Length: 1.8m, Depth: 0.65m, Height: 0.92m (counter level) + 0.35m (machine height).
   - Pivot / Origin: Centered at floor level [0, 0, 0].

2. Cabinet & Counter:
   - Dark wooden lower cabinet with 2 minimalist handle-less push doors (#182328).
   - White marble or light concrete countertop (#c5d1d4, thickness 0.04m).

3. Equipment on Counter:
   - Commercial twin-group espresso machine in polished chrome (#9ebec7) with dark portafilters and a small drip tray.
   - Tall bottom-loading water dispenser with hot/cold tap levers.
   - Small stack of ceramic coffee mugs.

4. Output Contract:
   - Standalone HTML with preview and a one-click "Export GLB" button.
   - Export root group named "Office_Coffee_Bar".
```
