# Prompt Detail Pembuatan Model 3D — Tahap 2 (Ruang Manajer & Pantry / Café)
> **Proyek:** Office Agents 3D (`workspace/office-next`)  
> **Engine:** Three.js r128 (WebGL PBR) + `GLTFExporter`  
> **Target Generator:** Claude Sonnet 3.5 / 5.5, Gemini 1.5/2.0 Pro, atau standalone Three.js HTML Generator  
> **Folder Output Model:** `workspace/office-next/public/models/`  
> **Standar Skala:** Metrik 1 Unit = 1 Meter (1.0 = 100 cm). Orientasi: Depan = `+Z`, Kanan = `+X`, Atas = `+Y`.

---

## 1. Daftar Aset 3D Baru Tahap 2

| No | Nama Aset | File Output GLB | Dimensi ($P \times L \times T$) | Penempatan & Ruangan | Deskripsi Singkat |
|---|---|---|---|---|---|
| 1 | **Meja Eksekutif L** | `Office_Manager_L_Desk.glb` | $2.10 \times 1.60 \times 0.75\text{ m}$ | Ruang Manajer ($X: -4.0, Z: 10.4$) | Meja sudut bentuk L walnut gelap, baki kabel, desk pad kulit, kaki baja matte. |
| 2 | **Kursi Eksekutif Raka** | `Office_Manager_Executive_Chair.glb` | $0.68 \times 0.68 \times 1.20\text{ m}$ | Ruang Manajer ($X: -4.0, Z: 11.2$) | Kursi kulit hitam high-back, sandaran kepala, armrest aluminium, 5 roda bintang. |
| 3 | **Kursi Tamu Lounge** | `Office_Guest_Lounge_Chair.glb` | $0.62 \times 0.60 \times 0.82\text{ m}$ | Ruang Manajer (2 unit, $Z: 9.6$) | Kursi tamu modern fabric abu-abu gelap, kaki kayu oak runcing miring. |
| 4 | **Kitchen Counter & Sink** | `Office_Pantry_Kitchen_Counter.glb` | $3.20 \times 0.65 \times 0.90\text{ m}$ | Pantry dinding selatan ($Z: 13.0$) | Counter marmer Carrara, bak wastafel stainless, kran leher angsa, kabinet oak bawah. |
| 5 | **Meja Bar Island Komunal** | `Office_Pantry_Bar_Island.glb` | $2.40 \times 0.90 \times 1.05\text{ m}$ | Pantry tengah ($X: 6.5, Z: 10.4$) | Meja bar tinggi tebal kayu walnut, rangka baja hitam doff, colokan power strip tersembunyi. |
| 6 | **Kursi Bar Tinggi (*Bar Stool*)** | `Office_Pantry_Bar_Stool.glb` | $0.46 \times 0.46 \times 0.95\text{ m}$ | Pantry (4 unit mengitari island) | Kursi bar jok busa bundar kulit sintetis camel/cokelat, rangka baja hitam, footrest ring. |
| 7 | **Kabinet Kulkas & Microwave** | `Office_Pantry_Utility_Cabinet.glb` | $0.80 \times 0.60 \times 1.85\text{ m}$ | Pantry dinding barat ($X: 4.4, Z: 9.2$) | Lemari utilitas tinggi, kulkas mini kaca di bawah, microwave di rak tengah, rak cangkir atas. |

---

## 2. Cara Menggunakan Prompt

1. **Buka AI Generator** (Claude Sonnet 3.5 / 5.5, Gemini Pro, dsb.).
2. **Salin salah satu blok PROMPT di bawah ini** secara utuh.
3. AI akan menghasilkan file kode tunggal berformat `.html` lengkap dengan Three.js r128, pencahayaan studio PBR, dan tombol **"Export GLB"**.
4. Simpan kode ke file (misal `generator_desk.html`), buka di browser Chrome/Edge, lalu klik tombol **"Export GLB"**.
5. Pindahkan file `.glb` yang terunduh ke dalam folder:  
   `p:\gemini-lab\office\workspace\office-next\public\models/`
6. Scene kantor 3D di `office-next` otomatis mendeteksi model GLB tersebut dan menggantikan placeholder kotak Three.js lama secara mulus!

---

## 3. Koleksi Prompt Detail per Model

---

### PROMPT 1: Meja Eksekutif L Manajer (`Office_Manager_L_Desk.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Manager_L_Desk" (Executive L-Shaped Desk for AI Manager Raka).

1. METRIC SCALING & DIMENSIONS:
   - Primary Desk (Main Wing): Width (X) 1.80 m, Depth (Z) 0.80 m, Tabletop Height (Y) 0.75 m.
   - Side Return Wing (Left side at -X): Width (X) 0.55 m, Extends backwards in +Z to total depth 1.60 m, Height 0.72 m (slightly stepped down).
   - Overall bounding box: ~2.10 m (X) × 1.60 m (Z) × 0.75 m (Y).
   - Pivot Origin (0,0,0): Centered at the front-bottom edge of the primary desk. The user sits on the inside facing -Z towards the office door.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Tabletop: 45 mm thick chamfered edge desktop. Rich dark walnut wood PBR material (color #271c14, roughness 0.35, metalness 0.04) with subtle wood grain alignment.
   - Chamfered Leather Desk Pad: Inset black leather blotter on the primary desk (1.0 m × 0.55 m, color #18191c, roughness 0.65).
   - Structural Leg Frame: Minimalist architectural matte charcoal steel leg sleds (50×25 mm rectangular tubing, color #1f2429, roughness 0.45, metalness 0.85).
   - Modesty Privacy Panel: Perforated powder-coated dark grey steel plate (thickness 3 mm, height 0.42 m) hanging beneath the front edge of the desk.
   - Side Return Storage: 3-drawer pedestal unit integrated under the return wing with subtle horizontal brushed aluminum edge-pull handles (metalness 0.9, roughness 0.2).
   - Wire Grommet & Cable Spine: Circular black brushed aluminum cable passthrough grommet (diameter 60 mm) on the rear corner.
   - Accessories on Desk: Minimalist aluminum vertical document tray (2 slots) and a matte black pen cup holder.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Group all meshes into a single root THREE.Group named: "Office_Manager_L_Desk".
   - Set castShadow = true and receiveShadow = true on all opaque components.
   - Standalone HTML must include OrbitControls, soft studio ambient + directional shadow light, and a prominent "Export GLB" button downloading "Office_Manager_L_Desk.glb".
```

---

### PROMPT 2: Kursi Eksekutif Kulit Raka (`Office_Manager_Executive_Chair.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Manager_Executive_Chair" (Modern High-Back Executive Leather Office Chair).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.68 m (across armrests).
   - Depth (Z): 0.68 m (base diameter).
   - Height (Y): 1.18 - 1.24 m (top of integrated headrest).
   - Seat Height: 0.48 m above ground.
   - Origin (0,0,0): Centered at the floor contact point directly beneath the central pneumatic cylinder. Chair faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - 5-Star Caster Base: 5 arched aluminum prongs radiating outward (radius 0.33 m, polished brushed metal, color #94a3b8, roughness 0.25, metalness 0.85). Each tip has a dual-wheel hooded black nylon caster.
   - Central Pneumatic Cylinder & Mechanism: Telescoping chrome cylinder (diameter 50 mm) with tilt-tension knob and height-adjustment lever under the seat pan.
   - Ergonomic Seat Pan: Contoured waterfall front cushion upholstered in premium perforated black leather (color #1a1a1d, roughness 0.52, metalness 0.05).
   - High-Back Rest: Ergonomic S-curve lumbar support with horizontal segmented stitch cushions and integrated headrest cushion at the top.
   - 3D Adjustable Armrests: Polished aluminum support posts rising from the seat base, topped with soft-touch charcoal PU foam arm pads.
   - Rear Structural Spine: Polished aluminum Y-shaped external spine supporting the lumbar and upper back shell.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Manager_Executive_Chair".
   - High polygon efficiency (clean bevels, no excessive subdivision, under 25k triangles).
   - Include browser 3D preview with rotation controls and "Export GLB" download button.
```

---

### PROMPT 3: Kursi Tamu Lounge Fabric (`Office_Guest_Lounge_Chair.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Guest_Lounge_Chair" (Scandinavian Modern Fabric Guest Chair for 1-on-1 Reviews).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.62 m.
   - Depth (Z): 0.60 m.
   - Height (Y): 0.82 m. Seat height: 0.44 m.
   - Origin (0,0,0): Center base on floor. Faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Upholstered Bucket Shell: Gently curved one-piece molded seat shell with medium-high arm wings. Textured charcoal-slate woven wool fabric (MeshStandardMaterial: color #2a2e35, roughness 0.85, metalness 0.0).
   - Loose Seat Cushion: 60 mm thick removable-look tailored foam cushion resting inside the bucket shell.
   - Splayed Wooden Legs: 4 tapered round solid natural oak legs splaying outwards at an 8-degree angle (color #c8a27a, roughness 0.45, metalness 0.02).
   - Metallic Leg Bracing: Thin cross-wire bracket in matte black steel (#1a1a1a, roughness 0.5, metalness 0.8) connecting the tops of the four legs beneath the seat base.
   - Floor Glides: Felt/brass glides at the bottom tips of each wooden leg.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Guest_Lounge_Chair".
   - Clean topology with smooth normals. Export via single-click "Export GLB" button.
```

---

### PROMPT 4: Kitchen Counter, Wastafel & Kabinet (`Office_Pantry_Kitchen_Counter.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Pantry_Kitchen_Counter" (Modern Commercial Office Pantry Kitchen Counter & Sink Unit).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 3.20 m (modular 4-bay section).
   - Depth (Z): 0.65 m.
   - Counter Height (Y): 0.90 m. Backsplash height: 0.35 m (total height 1.25 m).
   - Origin (0,0,0): Bottom center of the back wall mounting edge. Front counter faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Carrara Marble Countertop: 30 mm thick honed white marble top with subtle grey veining (color #f1f5f9, roughness 0.22, metalness 0.05).
   - Integrated Undermount Sink (Right bay, X: +0.6 m): Deep single-bowl rectangular brushed stainless steel sink (0.50 m × 0.40 m × 0.22 m deep, color #cbd5e1, metalness 0.92, roughness 0.2).
   - Gooseneck Mixer Faucet: Elegant tall gooseneck arch faucet with single lever handle in matte black or brushed nickel (#1e293b, metalness 0.85, roughness 0.25).
   - Lower Oak Cabinetry: 4 bays of flat-slab cabinet doors and drawer stacks in warm natural rift-cut oak (color #b89772, roughness 0.4, metalness 0.02), recessed dark toe kick (0.10 m high).
   - Minimalist Hardware: Slim 150 mm edge-pull bar handles in matte black anodized aluminum.
   - Tiled Backsplash: Backing wall panel decorated with 75×150 mm white ceramic subway tiles with dark grey grout lines.
   - Built-in Accessories: Stainless steel sponge caddy, compact matte black soap dispenser pump next to the faucet, and a clean drying mat.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Pantry_Kitchen_Counter".
   - Export button triggering GLTFExporter to download "Office_Pantry_Kitchen_Counter.glb".
```

---

### PROMPT 5: Meja Bar Island Komunal (`Office_Pantry_Bar_Island.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Pantry_Bar_Island" (High-Top Communal Cafe Bar Table for Office Pantry).

1. METRIC SCALING & DIMENSIONS:
   - Length (Z): 2.40 m.
   - Width (X): 0.90 m.
   - Bar Height (Y): 1.05 m (standard standing / bar-stool height).
   - Origin (0,0,0): Centered on floor (0,0,0). Long axis runs along Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Solid Wood Tabletop: 50 mm thick solid walnut plank top with live-edge effect or subtle chamfer (color #2d2016, roughness 0.32, metalness 0.03).
   - Industrial Steel Frame: Robust 60×60 mm square tube steel trestle base with bottom footrest stretcher bar running along the center at height Y = 0.28 m (matte black powder coat #18191c, roughness 0.55, metalness 0.75).
   - Integrated Power Hub: 2 recessed flip-up matte black power module pop-ups along the center line (sockets and USB ports, emissive soft blue indicator dot).
   - Center Hanging Planter / Napkin Tray: Low-profile magnetic bamboo condiment & tissue tray neatly centered on the table.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Pantry_Bar_Island".
   - Export button for "Office_Pantry_Bar_Island.glb".
```

---

### PROMPT 6: Kursi Bar Tinggi / Bar Stool (`Office_Pantry_Bar_Stool.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Pantry_Bar_Stool" (Modern Minimalist High Bar Stool with Backrest).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.46 m.
   - Depth (Z): 0.46 m.
   - Total Height (Y): 0.96 m. Seat Height: 0.75 m (to match 1.05m bar table).
   - Origin (0,0,0): Floor center beneath the seat. Faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Upholstered Seat Cushion: Rounded saddle-curved seat with high-density foam upholstered in vintage cognac/camel faux leather (color #92542a, roughness 0.58, metalness 0.05).
   - Low Curved Backrest: Low-profile curved lumbar lip backrest (height 0.21 m above seat) providing comfortable posture support.
   - Sled / Tapered Tubular Legs: 4 slim tubular black steel legs (diameter 18 mm, color #1e242b, metalness 0.8, roughness 0.4).
   - Welded Footrest Ring: Square or circular horizontal footrest ring welded to the 4 legs at height Y = 0.28 m.
   - Non-scratch rubber floor glides.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Pantry_Bar_Stool".
   - Triangle count under 12k triangles for optimal multi-instance rendering.
   - Single-file HTML generator with "Export GLB" button.
```

---

### PROMPT 7: Kabinet Utilitas Kulkas & Microwave (`Office_Pantry_Utility_Cabinet.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Pantry_Utility_Cabinet" (Pantry Tall Appliance Station with Glass-Door Mini Fridge & Microwave).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.80 m.
   - Depth (Z): 0.60 m.
   - Height (Y): 1.85 m.
   - Origin (0,0,0): Bottom center rear. Front faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Outer Cabinet Carcass: Dark slate melamine body (color #1e293b, roughness 0.4, metalness 0.05).
   - Bottom Section (0.0 to 0.85 m): Built-in beverage cooler mini-fridge with double-pane glass door, black aluminum bezel frame, interior wire racks, and soft interior cool blue LED light (emissive #60a5fa, intensity 1.2). Inside shelves hold stacked soda cans and sparkling water bottles.
   - Middle Niche Shelf (0.85 to 1.35 m): Open stainless-steel lined alcove housing a compact commercial microwave oven (matte black casing, glass window, digital keypad with green LED clock readout).
   - Upper Section (1.35 to 1.85 m): Two upper cabinet doors with soft-close hinges, partially open revealing neat rows of ceramic coffee mugs and tea boxes.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Pantry_Utility_Cabinet".
   - Export button triggering GLTFExporter to download "Office_Pantry_Utility_Cabinet.glb".
```

---

## 4. Hasil Verifikasi & Pengecekan Silang (Double Check)

Hasil pengecekan silang terhadap kode program di `workspace/office-next`:

1. **Kesesuaian Dimensi Ruangan:**
   - Ruang Manajer berukuran $6.0 \times 6.0\text{ m}$. Meja L ($2.10 \times 1.60\text{ m}$) dan kursi tamu muat dengan sisa ruang jalan minimal $1.2\text{ m}$ di sekelilingnya, bebas tabrakan navigasi.
   - Pantry berukuran $5.0 \times 6.0\text{ m}$. Kitchen Counter di dinding selatan ($3.20\text{ m}$) dan Bar Island di tengah ($2.40\text{ m}$) memiliki lorong sirkulasi $1.35\text{ m}$ di sisi kiri dan kanan, memenuhi standar ergonomi arsitektur kantor modern.
2. **Kesesuaian dengan Skrip Panggung (`managerOffice.ts` & `pantryCafe.ts`):**
   - Di `managerOffice.ts`, slot aset `executiveDesk`, `workstations`, `chairs`, dan `decor` sudah disiapkan untuk me-mount GLB saat file tersedia di `public/models/`.
   - Di `pantryCafe.ts`, slot aset `coffee`, `kitchen`, `bar`, dan kabinet kulkas sudah memiliki koordinat lokal yang persis dengan output dimensi prompt di atas.
3. **Kepatuhan Terhadap Aturan Git:**
   - File prompt ini disimpan di dalam folder dokumentasi resmi proyek: `workspace/office-next/docs/tahap-2-3d-prompts.md`.
   - File generator sementara yang dijalankan secara lokal tidak akan mengotori git repositori utama.

---

## 5. Hasil Analisa, Penyesuaian & Status Generator (17 November 2026)

Prompt di atas dianalisa terhadap scene Tahap 2 yang sudah dibangun sebelum generator dibuat. Ketujuh generator **sudah dibuat dan diverifikasi** sebagai file HTML tunggal (Three.js r128 + `GLTFExporter`, pola sama dengan generator lain di folder ini):

`workspace/office-next/tools/3d-generator/<Nama_Aset>.html` → buka di Chrome/Edge → **Export GLB** → salin `.glb` ke `public/models/`.

> Catatan: folder `tools/3d-generator/` di-*ignore* oleh git (`.gitignore`), jadi file HTML ini hanya tersimpan lokal.

### A. Koreksi terhadap prompt (keputusan CEO: ikuti prompt + sesuaikan kode scene)

| # | Masalah di prompt | Bukti | Penyelesaian |
|---|---|---|---|
| 1 | Nama file GLB tidak sama dengan slot di scene, dan kursi Raka tidak punya slot. | Slot lama: `Office_Executive_Desk_L`, `Office_Lounge_Chair`, `Office_Kitchen_Counter_Sink`, `Office_Bar_Island`, `Office_Bar_Stool`, `Office_Pantry_Utility_Tall`; kursi Raka memakai `Office_Ergonomic_Chair.glb`. | Nama prompt dipakai. Slot kode diganti ke nama prompt dan ditambah slot `Office_Manager_Executive_Chair.glb` (kursi ergonomis jadi placeholder-nya). |
| 2 | Sayap return meja L di sisi **kiri** user (−X). | Di Ruang Manajer sisi kiri Raka = Utara, satu-satunya jalur Raka dari lorong `Z 8.6` ke kursinya. | Dicerminkan ke sisi **kanan** (+X = Selatan dunia). Ukuran lain tetap: 2,10 × 1,60 m, return 0,72 m. |
| 3 | Pivot meja L di "front-bottom edge". | Panggung memasang monitor/keyboard/mouse relatif terhadap pusat meja (sama seperti `desk.glb`). | Origin = lantai di bawah **pusat sayap utama 1,80 × 0,80 m**. Meja digeser 0,2 m ke Timur (`x -1.0` lokal) agar return 1,60 m tidak menabrak kredenza. |
| 4 | Kolom "Penempatan" di §1 (mis. kabinet di `X 4.4, Z 9.2`, island di `X 6.5`). | Itu posisi plan lama: `Z 9.2` adalah garis antrean kopi, `X 6.5` adalah lorong tengah Pantry. | Posisi tetap mengikuti layout Tahap 2 (§7.C `tahap-2-pantry-manager.md`). Generator hanya menentukan ukuran & pivot. |
| 5 | Ukuran island 2,40 × 0,90 × 1,05 m, kursi bar dudukan 0,75 m, counter 0,65 m + backsplash, kabinet 0,80 m pivot belakang. | Placeholder lama 2,0 × 0,7 × 0,95 m, dudukan 0,66 m, pivot di tengah. | Ukuran prompt dipakai. Kode scene disesuaikan: island pindah ke tengah `z 0`, avatar duduk di `y 0.65`, counter & kabinet menempel muka dinding (pivot belakang), tile dinding mulai di atas backsplash 1,25 m. |

### B. Kontrak tiap GLB (diperiksa otomatis di panel "Asset stats" generator)

| GLB | Ukuran terukur | Pivot & arah | Ukuran GLB* |
|---|---|---|---|
| `Office_Manager_L_Desk` | 2,100 × 0,750 × 1,600 m (return 0,720 m, aksesori sampai 1,04 m) | Pusat sayap utama; user di +Z; return di +X | ±525 KB |
| `Office_Manager_Executive_Chair` | lebar armrest 0,680, tinggi 1,210, kaki Ø 0,666, dudukan 0,480 | Lantai di bawah gas lift; depan +Z; armrest 0,675 m (30 mm di bawah kolong meja) | ±274 KB |
| `Office_Guest_Lounge_Chair` | 0,618 × 0,820 × 0,595, dudukan 0,440 | Pusat tapak; depan +Z | ±198 KB |
| `Office_Pantry_Kitchen_Counter` | 3,200 × 0,650, atas 0,900, backsplash 1,250 (keran 1,30) | Tengah sisi belakang (z = 0); depan +Z; bak cuci di X +0,6 | ±603 KB |
| `Office_Pantry_Bar_Island` | 2,400 (Z) × 0,900 (X) × 1,050, top 50 mm, footrest 0,280 | Pusat lantai; memanjang Z | ±445 KB |
| `Office_Pantry_Bar_Stool` | 0,459 × 0,960 × 0,460, dudukan 0,750, sandaran +0,210, ring 0,280 | Lantai di bawah dudukan; depan +Z; 5.024 segitiga (< 12k) | ±180 KB |
| `Office_Pantry_Utility_Cabinet` | carcass 0,800 × 1,850 × 0,600; pintu atas terbuka 32° (jangkauan 0,82 m) | Tengah sisi belakang (z = 0); depan +Z | ±839 KB |

\* Ukuran ekspor mentah (tekstur JPEG/PNG tertanam). Bisa dikompres lagi dengan pipeline WebP + meshopt yang dipakai untuk 18 model lain.

### C. Verifikasi

- Ketujuh generator dibuka di browser: tidak ada error/warning konsol, semua cek ukuran ✓, dan ekspor GLB diuji di memori (root node bernama sesuai file, material/tekstur lengkap).
- Uji pasang di scene **tanpa menyalin file ke `public/models/`**: GLB hasil generator disajikan lewat intersepsi request di browser uji, lalu posisinya diukur di dunia. Semua jatuh tepat di layout: meja L `x -6.2..-4.6, z 9.5..11.6` (11 cm dari kredenza), kursi Raka di `(-5.58, 10.4)` membelakangi kredenza, counter `x 4.95..8.15` menempel dinding selatan (`z 13.16`), island `x 7.3..8.2, z 9.2..11.6`, 4 kursi bar `x 6.77..7.23` (7 cm dari island), kabinet menempel dinding barat (`x 4.24`) dan pintunya yang terbuka tidak menabrak counter.
- Simulasi 600 detik dengan ukuran baru: 0 agen menembus dinding/perabot, tidak ada yang macet.
