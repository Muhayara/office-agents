# Solusi Audit v2: Ruang Rapat 10 Agent (Formasi 5+5)

*Lampiran untuk: `workspace/office-next/docs/modular_office_layers_plan.md`*
*Lokasi usulan: `workspace/office-next/docs/boardroom_audit_v2_solutions.md`*
*Tanggal audit: 16 November 2026*
*Status: Keputusan CEO — formasi 5+5 dipilih, prompt meja & kursi dipisah*

---

## 1. Ringkasan Keputusan

1. **TV pindah ke dinding pendek timur** (searah sumbu panjang meja), seperti ruang rapat sungguhan. Ujung meja di sisi TV dibiarkan kosong sebagai zona presenter.
2. **Formasi 5+5**: 5 kursi di sisi utara, 5 kursi di sisi selatan. Tidak ada kursi di ujung meja. Semua kursi berada di bagian lurus meja, sehingga **tidak ada lagi kursi miring 20°**.
3. **Meja diperpanjang menjadi 4.00 × 1.20 m** agar 5 kursi per sisi muat dengan jarak antar-kursi standar kantor (0.70 m).
4. **Meja dan kursi dibuat dengan dua prompt terpisah**, masing-masing menghasilkan satu file HTML generator dan satu GLB.
5. Perbaikan navigasi: jeda keberangkatan 0.9 detik, urutan berdasarkan jarak ke pintu, dan segmen waypoint X:4.0 → X:7.0 ditambahkan.

---

## 2. Daftar Temuan & Solusi

| # | Temuan audit | Solusi | Bagian master plan yang diubah |
|---|---|---|---|
| 1 | TV di dinding utara: kursi 1–4 membelakangi layar, kursi ujung harus menoleh ±63° | TV di dinding timur, ujung timur kosong, formasi 5+5 | 3 (hirarki), 4B, 5C |
| 2 | Koordinat kursi tidak ada di prompt | Tabel seat anchor lengkap (bagian 6 dokumen ini) | 5C, 6 |
| 3 | Kursi pojok 20° tidak sesuai normal busur (±11°) | Dihapus: semua kursi di bagian lurus, rotasi 0 atau π | 5C |
| 4 | Armrest berisiko menembus daun meja saat kursi didorong | Batas tinggi armrest ≤ 0.66 m; bagian bawah meja 0.71 m | 5A, 5B |
| 5 | Kaki trestle dekat lutut kursi pojok | Kaki di x = ±1.05 (di antara kursi), lebar loop 0.50 m | 5A |
| 6 | Jeda 0.4 detik terlalu rapat (jarak ±0.5 m) | Jeda 0.9 detik + urutan berdasarkan jarak ke pintu + kunci pintu (door mutex) | 7B |
| 7 | Pintu 1.4 m tidak konsisten dengan "1 agen per waktu" | Pintu geser kaca ruang rapat menjadi 1.0 m | 3, 4A |
| 8 | Celah waypoint X:4.0 → X:7.0 | Segmen baru "East Aisle" | 7A |
| 9 | Dua pintu geser di koridor 2.5 m (seperti airlock) | Ujung barat koridor (X:7.0) dibuat terbuka; pintu hanya di X:9.5 | 3, 4A |
| 10 | AC di dinding timur bentrok dengan TV | AC pindah ke dinding utara | 3, 4B |

---

## 3. Tata Letak Baru Ruang Rapat

### A. Dimensi & Posisi

* Ruangan: `8.0 m (X) × 7.0 m (Z)`, pusat world `X: 13.5, Z: -0.5` (tidak berubah).
* Batas world: X `9.5 → 17.5`, Z `-4.0 → +3.0`.
* **Pusat meja**: local `(-0.4, 0)` → world **`X: 13.1, Z: -0.5`**. Meja digeser 0.4 m ke barat agar zona presenter di depan TV lebih lapang.
* Ujung barat meja: world X `11.1` (jarak ke dinding barat/pintu **1.6 m**).
* Ujung timur meja: world X `15.1` (jarak ke dinding TV **2.4 m** = zona presenter).

### B. Denah (tampak atas)

```text
                                Dinding Utara (Z = -4.0)
                          [ AC Wall 22°C, tinggi 2.4 m ]
   ┌──────────────────────────────────────────────────────────────────┐
   │                                                                  │
   │            Lorong belakang kursi utara (Z ≈ -2.4)                │
   │                                                                  │
   │        N1      N2      N3      N4      N5                        │ ┃
 P │       [v]     [v]     [v]     [v]     [v]                        │ ┃ T
 I │     ╭───────────────────────────────────────╮     ZONA           │ ┃ V
 N │     │  (kaki)                       (kaki)  │   PRESENTER        │ ┃
 T │     │   [G1]                         [G2]   │   (2.4 m)          │ ┃ 85"
 U │     ╰───────────────────────────────────────╯                    │ ┃
   │       [^]     [^]     [^]     [^]     [^]                        │ ┃
 1.0m      S1      S2      S3      S4      S5                        │ ┃
   │                                                                  │
   │            Lorong belakang kursi selatan (Z ≈ +1.5)              │
   │                                                                  │
   └──────────────────────────────────────────────────────────────────┘
                   [ Whiteboard Scrum — Dinding Selatan (Z = +3.0) ]
   X = 9.5                                                     X = 17.5
   (Barat)                                                     (Timur)
```

`[v]` = menghadap Selatan (+Z), `[^]` = menghadap Utara (−Z), `[G]` = cable grommet di atas kaki meja.

### C. Penataan Dinding

| Dinding | Isi |
|---|---|
| Timur (X = 17.5) | **Smart TV 85" 4K** di tengah (Z = -0.5), menghadap Barat (`rotY = -π/2`), titik tengah layar setinggi 1.25 m, dibingkai panel kayu akustik dengan strip LED vertikal |
| Utara (Z = -4.0) | Wall AC unit 22°C, di tengah dinding, tinggi 2.4 m |
| Selatan (Z = +3.0) | Whiteboard Scrum |
| Barat (X = 9.5) | Pintu geser kaca **1.0 m**, tepat di sumbu meja (Z = -0.5) |

### D. Cek Kenyamanan Pandang

* TV 85": lebar ±1.88 m, tinggi ±1.06 m.
* Kursi terjauh (N1/S1) ke layar: ±5.9 m, masih di bawah batas baca ±6× tinggi layar (6.3 m).
* Kursi terdekat (N5/S5) ke layar: ±3.2 m, sudut samping ±18°.
* Saat mode presentasi, kursi putar (swivel) diputar menghadap TV. Sudut putar dihitung per kursi dengan `Math.atan2` ke posisi TV, bukan nilai tetap.

---

## 4. Spesifikasi Meja (Office_Conference_Table.glb)

| Parameter | Nilai |
|---|---|
| Bentuk | Kapsul / racetrack |
| Panjang × lebar × tinggi | **4.00 × 1.20 × 0.75 m** |
| Tebal daun meja | 0.040 m (bagian bawah daun di 0.710 m) |
| Panjang bagian lurus | 4.00 − 1.20 = **2.80 m** |
| Radius ujung busur | 0.60 m |
| Kaki | 2 loop trestle baja hitam di **x = ±1.05**, lebar loop (Z) 0.50 m, profil 0.06 m |
| Balok penguat | 1 balok tengah sepanjang sumbu X di z = 0, tepat di bawah daun meja |
| Cable grommet | 2 unit di **x = ±1.05, z = 0** (di atas kaki, kabel turun lewat kaki), 0.30 × 0.12 m |
| Area bebas di bawah tepi meja | Tidak ada apron/rangka dalam 0.30 m dari tepi panjang, supaya armrest dan lutut bisa masuk |
| Origin | Lantai, tepat di bawah pusat meja; sumbu panjang searah X |
| Target poligon | ≤ 8.000 segitiga |

---

## 5. Spesifikasi Kursi (Office_Conference_Chair.glb)

| Parameter | Nilai |
|---|---|
| Model | Mid-back executive conference chair, swivel |
| Lebar total (termasuk armrest) | 0.58 m |
| Kedalaman | 0.60 m |
| Tinggi dudukan | 0.46 m |
| Tinggi atas armrest | **≤ 0.66 m** (wajib, agar masuk di bawah meja 0.710 m) |
| Tinggi total | 0.88 m |
| Origin | Lantai, tepat di bawah pusat dudukan |
| Arah hadap default | **+Z (Selatan, `rotY = 0`)** sesuai konvensi master plan |
| Target poligon | ≤ 6.000 segitiga (akan di-instance 10×) |

---

## 6. Tabel 10 Seat Anchor

Jarak antar-kursi 0.70 m. Pusat kursi berjarak 0.40 m dari tepi meja saat didorong masuk (*tucked*) dan 0.70 m saat ditarik (*pulled*).

* **Local** = relatif terhadap pusat `Room_Boardroom_10p`.
* **World** = local + (13.5, -0.5), hanya sebagai referensi. Di kode, selalu baca posisi lewat `getWorldPosition`.
* Prompt meja (bagian 8) memakai koordinat relatif pusat meja: X meja = Local X + 0.4 (jadi -1.40 … +1.40).

| Seat | Local X | Local Z (tucked) | Local Z (pulled) | World X | World Z (tucked) | `rotY` | Agen (usulan) |
|---|---:|---:|---:|---:|---:|---:|---|
| N1 | -1.80 | -1.00 | -1.30 | 11.70 | -1.50 | `0` | — |
| N2 | -1.10 | -1.00 | -1.30 | 12.40 | -1.50 | `0` | — |
| N3 | -0.40 | -1.00 | -1.30 | 13.10 | -1.50 | `0` | Raka (pimpinan, tengah sisi utara) |
| N4 | 0.30 | -1.00 | -1.30 | 13.80 | -1.50 | `0` | — |
| N5 | 1.00 | -1.00 | -1.30 | 14.50 | -1.50 | `0` | Laras (terdekat ke zona presenter) |
| S1 | -1.80 | 1.00 | 1.30 | 11.70 | 0.50 | `Math.PI` | — |
| S2 | -1.10 | 1.00 | 1.30 | 12.40 | 0.50 | `Math.PI` | — |
| S3 | -0.40 | 1.00 | 1.30 | 13.10 | 0.50 | `Math.PI` | — |
| S4 | 0.30 | 1.00 | 1.30 | 13.80 | 0.50 | `Math.PI` | — |
| S5 | 1.00 | 1.00 | 1.30 | 14.50 | 0.50 | `Math.PI` | — |

Agen lain (Tari, Gita, Bima, Satria, Wulan, Dimas, Sari, Fajar) bisa ditetapkan bebas di kode. Ujung barat meja sengaja kosong. Jika nanti butuh kursi tamu ke-11, letakkan di local `(-2.85, 0)` dengan `rotY = Math.PI / 2`.

---

## 7. Perbaikan Navigasi `/rapat`

### A. Graf Waypoint (diperbarui)

1. **Exit Workstation**: bangkit, mundur ke Workstation Aisle.
2. **Avenue Transit**: Central Avenue (X 0.0 → 4.0, Z 0.0 → 0.8).
3. **East Aisle (baru)**: X 4.0 → 7.0. Titik koordinat ditentukan dari posisi aktual meja Bima & Gita, dengan lebar jalur bebas ≥ 1.0 m.
4. **Corridor Transit**: X 7.0 → 9.5 di Z -0.5. Ujung barat koridor terbuka tanpa pintu.
5. **Boardroom Entry**: lewat pintu kaca 1.0 m di X 9.5, berhenti di world (10.3, -0.5).
6. **Seat Aisle**: kursi utara lewat lorong Z ≈ -2.4; kursi selatan lewat lorong Z ≈ +1.5.
7. **Seat Approach**: berhenti 0.3 m di belakang posisi *pulled*, kursi ditarik, agen duduk, kursi didorong ke posisi *tucked*.

### B. Anti-Macet Pintu

* Jeda keberangkatan **0.9 detik** (kecepatan jalan ±1.2 m/s → jarak antar-agen ±1.1 m).
* Urutan keberangkatan berdasarkan **panjang jalur ke pintu, terpendek dulu**, bukan berdasarkan jabatan. Ini mencegah agen saling menyusul.
* **Door mutex**: agen meminta slot pintu sebelum melewati X 9.5; jarak waktu minimum 0.8 detik antar-agen. Agen yang belum dapat slot menunggu di titik antre world (8.8, -0.5).

### C. Pulang Rapat

Urutan terbalik: kursi terdekat pintu (N1/S1) keluar lebih dulu, lalu N2/S2, dan seterusnya, dengan door mutex yang sama.

---

## 8. Prompt 1 — Meja Rapat (untuk Claude)

Output: `workspace/office-next/tools/3d-generator/Office_Conference_Table.html` → `Office_Conference_Table.glb`

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN), OrbitControls and GLTFExporter that procedurally generates, previews and exports ONE 3D PBR asset: "Office_Conference_Table" — a capsule / racetrack executive boardroom table for 10 people (5 per long side, no end seats).

1. COORDINATE CONTRACT
   - Units: meters. Y is up. The table's long axis runs along X; its width runs along Z.
   - Origin (0,0,0): floor level, directly under the exact center of the table.
   - Renderer: renderer.outputEncoding = THREE.sRGBEncoding; set all color textures/colors accordingly.

2. TABLETOP
   - Capsule shape built with THREE.Shape + ExtrudeGeometry: total length 4.00 m, width 1.20 m.
   - Straight section length 2.80 m; each end is a half-circle with radius 0.60 m.
   - Top surface at height 0.75 m; thickness 0.040 m (underside at 0.710 m); small 6 mm chamfer on the lower edge.
   - Material: dark walnut veneer, MeshStandardMaterial color #3d2314 (use #4a2c19 for a subtle procedural grain via a generated CanvasTexture), roughness 0.40, metalness 0.05.

3. CABLE GROMMETS
   - 2 recessed brushed-aluminum pop-up cable boxes, 0.30 m (X) × 0.12 m (Z), flush with the top, centered at x = -1.05 and x = +1.05, z = 0.
   - Material: #c8ccd0, metalness 0.85, roughness 0.30.

4. BASE (must leave knee and armrest clearance)
   - 2 matte black steel loop (trestle) legs at x = -1.05 and x = +1.05 (directly under the grommets).
   - Each loop: closed rectangular loop in the YZ plane, 0.50 m wide in Z (z from -0.25 to +0.25), from the floor to the underside of the top, square tube profile 0.06 m.
   - 1 horizontal center beam along X at z = 0, connecting both legs just under the top (0.06 × 0.06 m).
   - NO apron, rail or frame within 0.30 m of either long edge (|z| > 0.30 must be clear under the top).
   - Material: #1a1a1c, metalness 0.85, roughness 0.35.

5. REFERENCE OVERLAY (preview only, never exported)
   - Toggleable ghost markers for the 10 seat anchors: x = -1.40, -0.70, 0.00, +0.70, +1.40 at z = -1.00 (north side) and z = +1.00 (south side). Draw each as a 0.58 × 0.60 m translucent box, 0.46 m tall, plus an arrow showing its facing direction (north row faces +Z, south row faces -Z).
   - Toggleable 0.66 m height plane under the table edge to visually verify armrest clearance.

6. UI & EXPORT
   - Side panel: triangle count, vertex count, bounding box (should read ≈ 4.00 × 0.75 × 1.20 m).
   - Toggles: Wireframe, Seat Anchor Overlay, Clearance Plane, Auto-rotate. View presets: Perspective, Top, Front, Side. Reset View button.
   - "Export GLB" button → downloads "Office_Conference_Table.glb" (binary: true). Export ONLY the table group: tabletop, grommets, legs, beam. Exclude overlays, grid, lights and helpers.
   - Name meshes clearly: Table_Top, Table_Grommet_L, Table_Grommet_R, Table_Leg_L, Table_Leg_R, Table_Beam.
   - Keep the exported table under 8,000 triangles.
```

---

## 9. Prompt 2 — Kursi Rapat (untuk Claude)

Output: `workspace/office-next/tools/3d-generator/Office_Conference_Chair.html` → `Office_Conference_Chair.glb`

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN), OrbitControls and GLTFExporter that procedurally generates, previews and exports ONE 3D PBR asset: "Office_Conference_Chair" — a mid-back executive swivel conference chair meant to be instanced 10 times around a boardroom table.

1. COORDINATE CONTRACT
   - Units: meters. Y is up.
   - Origin (0,0,0): floor level, directly below the center of the seat cushion.
   - The chair FACES +Z: a seated person looks toward +Z; the backrest sits on the -Z side. This is mandatory (rotation.y = 0 means facing +Z/South in our engine).
   - Renderer: renderer.outputEncoding = THREE.sRGBEncoding.

2. DIMENSIONS (hard limits)
   - Overall width including armrests: 0.58 m. Overall depth: 0.60 m. Overall height: 0.88 m.
   - Seat top height: 0.46 m.
   - Top of armrests: MAX 0.66 m (the table underside is at 0.71 m and the chair must slide under it).
   - Armrest front ends must not extend past the front edge of the seat.

3. GEOMETRY
   - Seat and mid-back backrest: rounded cushions with 5–6 horizontal ribbed channels (ribs modeled as subtle geometry, not a texture), charcoal leather, color #222225, roughness 0.85, metalness 0.0.
   - Backrest slightly reclined 8–10° and gently curved in plan.
   - Polished aluminum frame: loop armrests with thin dark pads, under-seat mechanism, gas-lift stem and 5-star spider base with 5 small floor glides (no casters). Base diameter 0.62 m max. Material #b0b5ba, metalness 0.90, roughness 0.20; armrest pads #2a2a2d, roughness 0.7.

4. HIERARCHY FOR ANIMATION
   - Group the model as: Chair_Root → Chair_Base (spider base + glides, static) and Chair_Swivel (stem top, mechanism, seat, backrest, armrests).
   - Chair_Swivel's pivot is the vertical axis through the origin, so the engine can rotate the upper chair independently for "turn to the TV" animations.

5. PREVIEW HELPERS (never exported)
   - Toggleable ghost table edge: a 1.20 m wide slab at height 0.710–0.750 m whose near edge is at z = +0.40 m from the chair origin (the "tucked" position). Use it to verify the armrests pass under the table.
   - Toggleable seated-human proxy (simple capsules) to check proportions.

6. UI & EXPORT
   - Side panel: triangle count, vertex count, bounding box (should read ≈ 0.58 × 0.88 × 0.60 m), measured armrest top height.
   - Toggles: Wireframe, Table Edge Guide, Human Proxy, Auto-rotate, Swivel test slider (-90° to +90° on Chair_Swivel). View presets: Perspective, Top, Front, Side. Reset View button.
   - "Export GLB" button → downloads "Office_Conference_Chair.glb" (binary: true) with ONE chair at the origin, facing +Z, Swivel slider reset to 0 before export. Exclude helpers, grid and lights.
   - Keep the exported chair under 6,000 triangles.
```

---

## 10. Checklist Pembaruan Master Plan

- [ ] Bagian 3: TV pindah ke Dinding Timur; AC pindah ke Dinding Utara; pintu ruang rapat 1.0 m; ujung barat koridor terbuka.
- [ ] Bagian 4A: lebar pintu 1.0 m; hanya satu pintu geser di X 9.5.
- [ ] Bagian 4B: ganti dengan tabel dinding pada bagian 3C dokumen ini.
- [ ] Bagian 5A: dimensi meja 4.00 × 1.20 m, kaki di x = ±1.05, grommet di atas kaki.
- [ ] Bagian 5B: batas armrest ≤ 0.66 m; kursi menghadap +Z.
- [ ] Bagian 5C: ganti diagram & formasi 4+4+1+1 dengan formasi 5+5 dan tabel seat anchor.
- [ ] Bagian 6: ganti prompt gabungan dengan Prompt 1 (meja) dan Prompt 2 (kursi) dari dokumen ini.
- [ ] Bagian 7: tambahkan East Aisle, jeda 0.9 detik, urutan berdasarkan jarak, door mutex.
- [ ] Bagian 9 (Roadmap) Fase 2: dua generator terpisah, `Office_Conference_Table.html` dan `Office_Conference_Chair.html`.
