# Prompt Detail Pembuatan Model 3D — Tahap 3 (Lobi & Resepsionis, Lounge, & Server IT)
> **Proyek:** Office Agents 2.5D (`workspace/office-next`)  
> **Engine:** Three.js r128 (WebGL PBR) + `GLTFExporter`  
> **Target Generator:** Claude Sonnet 3.5 / 5.5, Gemini 1.5/2.0 Pro, atau standalone Three.js HTML Generator  
> **Folder Output Model:** `workspace/office-next/public/models/`  
> **Standar Skala:** Metrik 1 Unit = 1 Meter (1.0 = 100 cm). Orientasi: Depan = `+Z`, Kanan = `+X`, Atas = `+Y`.

---

## 1. Daftar Aset 3D Baru Tahap 3

| No | Nama Aset | File Output GLB | Dimensi ($P \times L \times T$) | Penempatan & Ruangan | Deskripsi Singkat |
|---|---|---|---|---|---|
| 1 | **Meja Resepsionis Melengkung** | `Office_Lobby_Reception_Desk.glb` | $2.40 \times 1.10 \times 1.05\text{ m}$ | Lobi ($X: 1.5, Z: 11.2$) | Meja counter marmer Carrara putih melengkung, bilah kayu oak vertikal, komputer terminal & interkom. |
| 2 | **Kiosk Direktori Digital** | `Office_Lobby_Directory_Kiosk.glb` | $0.55 \times 0.45 \times 1.75\text{ m}$ | Lobi dekat pintu ($X: 3.2, Z: 8.5$) | Standing kiosk vertikal layar sentuh 43", bezel hitam matte, peta direktori gedung bercahaya emissive. |
| 3 | **Kursi Tunggu Aksen Velvet** | `Office_Lobby_Accent_Armchair.glb` | $0.72 \times 0.70 \times 0.80\text{ m}$ | Lobi sayap timur ($X: 3.0, Z: 11.5$) | Kursi lounge tunggal berbalut kain velvet warna teal/emerald, bantalan empuk, kaki kuningan tipis. |
| 4 | **Sofa Sudut Mewah (Sectional L)** | `Office_Lounge_Sectional_Sofa.glb` | $2.60 \times 1.80 \times 0.78\text{ m}$ | Lounge sudut barat daya ($X: 10.5, Z: 11.5$) | Sofa sudut empuk kain woven fabric abu-abu hangat, bantal aksen mustard & teal, kaki kayu rendah. |
| 5 | **Meja Kopi Rendah Kayu** | `Office_Lounge_Coffee_Table.glb` | $1.10 \times 0.65 \times 0.42\text{ m}$ | Lounge depan sofa ($X: 11.6, Z: 10.8$) | Meja kopi rendah kayu walnut solid chamfered, rangka silang baja hitam matte, majalah arsitektur di atasnya. |
| 6 | **Lampu Lantai Melengkung (Arc)** | `Office_Lounge_Arc_Floor_Lamp.glb` | $1.20 \times 0.45 \times 2.15\text{ m}$ | Lounge sudut ruangan ($X: 9.6, Z: 12.6$) | Lampu tiang lengkung kubah kuningan, dasar marmer hitam pemberat, cahaya temaram warm white. |
| 7 | **Unit Pendingin Server (CRAC)** | `Office_Server_CRAC_Unit.glb` | $1.20 \times 0.75 \times 2.05\text{ m}$ | Server Room dinding timur ($X: 21.3, Z: 10.4$) | AC presisi industri data center, kisi-kisi intake logam, display digital suhu 18°C berlampu biru. |
| 8 | **Konsol Meja IT Admin** | `Office_Server_Admin_Console.glb` | $1.40 \times 0.70 \times 1.25\text{ m}$ | Server Room dinding barat ($X: 18.7, Z: 10.4$) | Workstation teknis sempit rangka baja, dual monitor lengkung dengan grafik terminal data, keyboard & mouse. |

> [!NOTE]
> **Aset Eksisting yang Digunakan Kembali:**
> Model `Server_Rack_42U.glb` yang sudah ada di `public/models/` akan langsung dipindahkan ke dalam Ruang Server IT secara resmi di Tahap 3.

---

## 2. Cara Menggunakan Prompt

1. Salin salah satu blok PROMPT di bawah ini secara utuh ke AI generator (Claude Sonnet / Gemini Pro).
2. AI akan menghasilkan file HTML mandiri Three.js r128 yang memiliki tombol **"Export GLB"**.
3. Buka file HTML tersebut di browser, klik tombol **"Export GLB"**.
4. Pindahkan file `.glb` hasil unduhan ke folder:  
   `p:\gemini-lab\office\workspace\office-next\public\models/`

---

## 3. Koleksi Prompt Detail per Model

---

### PROMPT 1: Meja Resepsionis Melengkung (`Office_Lobby_Reception_Desk.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lobby_Reception_Desk" (Curved Architectural Reception Desk for Corporate Office Lobby).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 2.40 m.
   - Depth (Z): 1.10 m (including inward curve).
   - Counter Height (Y): 1.05 m (transaction counter), Inner Desk Height: 0.75 m.
   - Origin (0,0,0): Centered at the front-bottom floor contact point. Front curved face faces towards -Z (towards visitors arriving from the entrance). Receptionist sits on the inside facing +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Front Curved Facade: Smooth convex arc facing visitors. Upper transactions shelf made of honed white Carrara marble with subtle grey veining (color #f8fafc, roughness 0.22, metalness 0.05).
   - Lower Slat Cladding: Vertical decorative architectural slats in natural white oak (slat dimensions: width 20 mm, depth 15 mm, gap 15 mm, color #c8a27a, roughness 0.4, metalness 0.02) curving along the front apron.
   - Recessed LED Plinth: Dark charcoal recessed toe-kick base (height 60 mm) with a soft downward warm-white ambient LED glow strip (emissive #fef08a, intensity 0.8).
   - Inner Work Surface: 1.80 m wide flat walnut/matte desktop (height 0.75 m) with cable grommets.
   - Reception Desk Equipment: Ultra-thin all-in-one aluminum desktop computer (silver stand, dark glass bezel screen displaying an abstract welcome graphic), compact IP intercom desk phone, and a polished brass business card stand.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lobby_Reception_Desk".
   - Set castShadow = true and receiveShadow = true on all opaque meshes.
   - Standalone preview with orbit controls and single-click "Export GLB" button downloading "Office_Lobby_Reception_Desk.glb".
```

---

### PROMPT 2: Standing Kiosk Direktori Digital (`Office_Lobby_Directory_Kiosk.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lobby_Directory_Kiosk" (Commercial Interactive Digital Directory Totem Kiosk).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.55 m.
   - Depth (Z): 0.45 m (base plate). Totem body depth: 0.12 m.
   - Total Height (Y): 1.75 m.
   - Origin (0,0,0): Bottom center of the floor base plate. Touchscreen face faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Heavy Floor Base: Low-profile beveled rectangular steel plate (0.55 m × 0.45 m × 0.02 m, powder-coated matte black #111827, roughness 0.5, metalness 0.8).
   - Vertical Monolith Enclosure: Sleek rounded-corner pillar casing in brushed anodized aluminum (color #334155, roughness 0.35, metalness 0.75).
   - 43-Inch Portrait Display Screen: Edge-to-edge toughened glass front. Screen surface has an emissive CanvasTexture rendering a stylized office floorplan map, directory floor listing, and "TAP TO SEARCH" button (emissive #38bdf8, emissiveIntensity 1.4).
   - Peripherals: Recessed QR-code scanner window beneath the screen with a subtle green pulse line (emissive #22c55e), and small NFC tap icon badge.
   - Rear Ventilation & Lock: Minimalist horizontal cooling intake louvers on the rear side.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lobby_Directory_Kiosk".
   - Optimized geometry (under 10k triangles). "Export GLB" download button.
```

---

### PROMPT 3: Kursi Tunggu Aksen Velvet (`Office_Lobby_Accent_Armchair.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lobby_Accent_Armchair" (Modern Mid-Century Velvet Accent Chair for Office Lobby Waiting Area).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.72 m across armrests.
   - Depth (Z): 0.70 m.
   - Height (Y): 0.80 m. Seat height: 0.43 m.
   - Origin (0,0,0): Floor center beneath the seat. Faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Contoured Barrel Backrest: Gently curved wrap-around shell upholstered in rich jewel-toned deep teal/emerald green plush velvet fabric (MeshStandardMaterial: color #0f4c5c, roughness 0.75, metalness 0.05).
   - Deep Foam Seat Cushion: 80 mm thick tailored box cushion with piped welt seams.
   - Fluted Vertical Channel Tufting: Subtle vertical stitching channels along the inner back curve.
   - Splayed Stiletto Legs: 4 slender tapered round steel legs splaying outward at a 10-degree angle, finished in satin brushed brass/gold (color #d4af37, roughness 0.28, metalness 0.88).
   - Articulated Brass Floor Glides: Self-leveling spherical foot glides with black rubber protective pads.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lobby_Accent_Armchair".
   - Single-file HTML generator with "Export GLB" button.
```

---

### PROMPT 4: Sofa Sudut Mewah Sectional L (`Office_Lounge_Sectional_Sofa.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lounge_Sectional_Sofa" (Contemporary Modular L-Shaped Sectional Sofa for Office Lounge).

1. METRIC SCALING & DIMENSIONS:
   - Overall Width (X): 2.60 m.
   - Main Section Depth (Z): 0.90 m. Extended Chaise Section Depth (Z at -X wing): 1.80 m.
   - Total Height (Y): 0.78 m. Seat Height: 0.44 m.
   - Origin (0,0,0): Centered at the rear-left corner floor level. Seat faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Solid Wood Internal Plinth: Low-profile slim oak base trim (height 50 mm, color #b48a60, roughness 0.4) running along the underside.
   - High-Density Multi-Layer Cushions: 3 primary seat cushions and 1 long chaise cushion with tailored piping seams. Upholstered in durable warm light-grey textured woven linen fabric (color #d1d5db, roughness 0.88, metalness 0.0).
   - Plump Backrest Pillows: Angled relaxed backrest cushions with subtle natural fabric creasing.
   - Accent Throw Pillows: 3 decorative square throw pillows tossed naturally on the sofa (two in muted mustard yellow #ca8a04, one in deep teal #0d9488).
   - Low Architectural Feet: Cylindrical matte black steel legs (height 70 mm, diameter 45 mm) recessed slightly beneath the plinth.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lounge_Sectional_Sofa".
   - Clean topology with realistic chamfered edges. Single-click "Export GLB" button.
```

---

### PROMPT 5: Meja Kopi Rendah Kayu (`Office_Lounge_Coffee_Table.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lounge_Coffee_Table" (Modern Minimalist Solid Walnut Low Coffee Table).

1. METRIC SCALING & DIMENSIONS:
   - Length (X): 1.10 m.
   - Width (Z): 0.65 m.
   - Height (Y): 0.42 m.
   - Origin (0,0,0): Floor center (0,0,0).

2. DETAILED PROCEDURAL GEOMETRIES:
   - Solid Wood Tabletop: 35 mm thick solid American walnut tabletop with a gentle underside reverse-bevel edge (color #2c1d11, roughness 0.32, metalness 0.03).
   - Architectural Cross-Leg Base: Minimalist geometric sled base formed by 20×20 mm square tube steel in satin black powder coat (color #18191c, roughness 0.45, metalness 0.8).
   - Tabletop Props & Details:
     - 2 stacked hardcover architectural monograph books with colored spines.
     - Minimalist fluted ceramic coaster with a clear glass tumbler.
     - Small matte white ceramic bowl holding decorative green moss balls.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lounge_Coffee_Table".
   - Triangle count under 15k triangles. "Export GLB" download button.
```

---

### PROMPT 6: Lampu Lantai Melengkung Arc (`Office_Lounge_Arc_Floor_Lamp.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lounge_Arc_Floor_Lamp" (Iconic Mid-Century Modern Curved Overarching Floor Lamp).

1. METRIC SCALING & DIMENSIONS:
   - Base Diameter: 0.42 m.
   - Arch Reach (Forward in +Z): 1.20 m horizontal extension.
   - Total Height (Y): 2.15 m. Lamp dome hangs at Y = 1.65 m.
   - Origin (0,0,0): Floor center of the heavy marble base plate. Lamp shade arches forward towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Heavy Weighted Base: Solid cylindrical slab of polished black Nero Marquina marble with white veining (diameter 0.42 m, height 0.06 m, color #0f172a, roughness 0.18, metalness 0.1).
   - Telescoping Arch Stem: Elegant curved cantilevered tubular stem sweeping upwards and forwards in a smooth parabola. Brushed satin brass finish (color #d4af37, roughness 0.25, metalness 0.88).
   - Hemispherical Lamp Shade: Outer spun brass dome (diameter 0.32 m, height 0.20 m) with brushed finish. Inside dome is painted reflective warm-white (#fffbeb).
   - Frosted Diffuser & Bulb: Recessed frosted glass diffuser emitting a warm ambient glow (emissive #fef3c7, emissiveIntensity 1.6).
   - Floor Foot Switch: Minimalist black inline step switch cylinder along the power cord on the floor.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lounge_Arc_Floor_Lamp".
   - Single-file HTML generator with "Export GLB" button.
```

---

### PROMPT 7: Unit Pendingin Server CRAC (`Office_Server_CRAC_Unit.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Server_CRAC_Unit" (Computer Room Air Conditioning Unit / Precision Data Center Cooling Unit).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 1.20 m.
   - Depth (Z): 0.75 m.
   - Height (Y): 2.05 m.
   - Origin (0,0,0): Bottom center rear. Front intake and access doors face towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Heavy Industrial Cabinet: High-grade sheet steel chassis in textured dark enterprise grey (color #1e293b, roughness 0.5, metalness 0.6).
   - Front Intake Grille (Lower 60%): High-density perforated metal louvers providing intake airflow into internal filtration coils.
   - Upper Maintenance Doors: Dual insulated access doors with flush chrome quarter-turn compression latches.
   - Microprocessor Digital Control Panel: Touch-capacitive control module at eye level (height 1.55 m). Blue backlit LCD screen displaying "TARGET: 18.0°C | HUMIDITY: 45% | STATUS: OPTIMAL" using an emissive texture (emissive #38bdf8, intensity 1.5).
   - Status Indicator Light Tower: Top-right corner features an industrial 3-tier optical signal beacon (Green LED steadily illuminated).
   - Warning & Specification Decals: High-voltage danger triangle badge and unit serial plate on the front service panel.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Server_CRAC_Unit".
   - Clean industrial bevels. "Export GLB" button.
```

---

### PROMPT 8: Konsol Meja IT Admin (`Office_Server_Admin_Console.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Server_Admin_Console" (Data Center NOC IT Admin Terminal Workstation).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 1.40 m.
   - Depth (Z): 0.70 m.
   - Desktop Height (Y): 0.75 m. Total Height with Dual Curved Displays: 1.25 m.
   - Origin (0,0,0): Bottom center rear. Front faces towards +Z (where the network engineer sits facing -Z towards the screens).

2. DETAILED PROCEDURAL GEOMETRIES:
   - Heavy-Duty Steel Frame: 40×40 mm square tube frame in matte textured black powder coat with reinforced corner gussets (#111827, roughness 0.5, metalness 0.75).
   - Anti-Static Work Surface: Industrial high-pressure laminate gray top with black PVC bumper edge (color #374151, roughness 0.45).
   - Dual Ultra-Wide Curved Monitors: Mounted on a dual-arm heavy-duty desktop gas spring pole mount.
     - Screen 1: Terminal Matrix screen with scrolling green log output (emissive #22c55e, intensity 1.5).
     - Screen 2: Real-time network throughput and packet graph in cyan/blue (emissive #06b6d4, intensity 1.4).
   - Mechanical Keyboard & Mouse: Tenkeyless mechanical keyboard with RGB backlit keycaps on an extended desk mat, and ergonomic optical mouse.
   - Cable Management & Rack Shelf: Perforated steel under-desk cable basket holding power bricks with coiled patch cables.
   - Yellow Fiber Optic Patch Cable spool and a digital label maker resting on the corner of the desk.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Server_Admin_Console".
   - Under 20k triangles. "Export GLB" button.
```

---

## 4. Hasil Pengecekan Silang & Validasi (Double Check)

1. **Sinkronisasi dengan `tahap-3-lobby-lounge-server.md`:**
   - Semua 8 model mencakup seluruh furnitur dan utilitas yang dijanjikan pada cetak biru Tahap 3.
   - Tidak ada duplikasi terhadap model yang sudah ada (`Server_Rack_42U.glb` dan `Office_Indoor_Plant.glb` langsung dipakai ulang).
2. **Kesesuaian Ergonomi & Ruang Sirkulasi:**
   - **Lobi ($5 \times 6\text{ m}$):** Meja resepsionis ($2.4\text{ m}$) di tengah selatan memberikan celah jalan $\sim 1.3\text{ m}$ di sisi kiri dan kanan menuju Jalan Utama.
   - **Lounge ($5 \times 6\text{ m}$):** Sofa sudut ($2.6 \times 1.8\text{ m}$) dan coffee table ($1.1\text{ m}$) meninggalkan koridor bebas $1.8\text{ m}$ di depan pintu masuk.
   - **Server Room ($4 \times 6\text{ m}$):** Kedua Server Rack 42U di tengah, CRAC Unit ($1.2\text{ m}$) di dinding timur, dan Admin Console ($1.4\text{ m}$) di dinding barat menyisakan *cold aisle* dan *hot aisle* standar data center selebar $\sim 1.1\text{ m}$.
3. **Format & Kesiapan Ekspor:**
   - Seluruh prompt dirancang untuk menghasilkan file `.glb` tunggal dengan material standar PBR MeshStandardMaterial (tanpa ketergantungan texture eksternal yang hilang).
