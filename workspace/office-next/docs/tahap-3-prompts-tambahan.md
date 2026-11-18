# Prompt Generator 3D Tambahan — Tahap 3 (Lobi & Lounge)

Dokumen ini memuat **3 prompt generator 3D prosedural** Three.js khusus untuk melengkapi perabot Tahap 3 yang belum memiliki model GLB dedicated (saat ini masih menggunakan placeholder prosedural kode):

1. **`Office_Lobby_Side_Table.glb`** — Meja samping bundar marmer & kuningan untuk Lobi.
2. **`Office_Plant_Areca_Palm.glb`** — Tanaman hias palem areca dalam pot terakota untuk Lounge.
3. **`Office_Lounge_Magazine_Rack.glb`** — Rak majalah vertikal 3 tingkat baja nirkarat untuk Lounge.

Prompt di bawah siap langsung disalin ke Claude Code / LLM untuk menghasilkan file HTML generator di folder `workspace/office-next/tools/3d-generator/`, diekspor menjadi `.glb`, dan dipindahkan ke `workspace/office-next/public/models/`.

---

## Ringkasan Spesifikasi Model

| Nama File GLB | Target Dimensi ($L \times T \times D$) | Slot di Kode (`mountAsset`) | Posisi Ruangan |
|---|---|---|---|
| `Office_Lobby_Side_Table.glb` | $\varnothing 0.60 \times 0.54\text{ m}$ | `lobbyReception.ts:160` | Di antara 2 kursi tub Lobi |
| `Office_Plant_Areca_Palm.glb` | $\varnothing 1.10 \times 1.70\text{ m}$ (Pot $\varnothing 0.44 \times 0.42\text{ m}$) | `loungeRelax.ts:133` | Sudut barat daya Lounge |
| `Office_Lounge_Magazine_Rack.glb` | $0.34 \times 0.90 \times 0.30\text{ m}$ | `loungeRelax.ts:135` | Sisi barat Lounge dekat pintu |

---

## PROMPT 1: Meja Samping Lobi Marmer & Kuningan (`Office_Lobby_Side_Table.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lobby_Side_Table" (Modern Round Marble & Brass Accent Side Table for Corporate Lobby).

1. METRIC SCALING & DIMENSIONS:
   - Tabletop Diameter: 0.60 m (radius 0.30 m).
   - Tabletop Thickness: 25 mm.
   - Total Height (Y): 0.54 m.
   - Weighted Base Plate Diameter: 0.38 m (thickness 15 mm).
   - Origin (0,0,0): Floor center beneath the table base.

2. DETAILED PROCEDURAL GEOMETRIES & MATERIALS:
   - Round Marble Top:
     - Honed white Carrara marble disc with fine top edge bevel.
     - Material: MeshStandardMaterial (color: #f1f5f9, roughness: 0.20, metalness: 0.05).
   - Slender Central Pedestal Stem:
     - Solid turned brass pillar (diameter 50 mm, height 0.50 m).
     - Material: MeshStandardMaterial (color: #c9a24a, roughness: 0.28, metalness: 0.88).
   - Weighted Base Plate:
     - Chamfered circular brass disc (diameter 0.38 m, thickness 15 mm) with black rubber glide ring at bottom.
     - Material: MeshStandardMaterial matching stem.
   - Tabletop Decorative Prop:
     - Minimalist fluted amber/teal glass bud vase (diameter 7 cm, height 18 cm) resting on tabletop at [0.06, 0.54, -0.04].
     - Stylized botanical element: single elegant white calla lily stem with deep green leaf.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lobby_Side_Table".
   - Enable castShadow = true and receiveShadow = true on all meshes.
   - Keep polygon count under 8,000 triangles.
   - Include OrbitControls, studio lighting (3-point warm/cool + directional shadow caster), and a clean single-click "Export GLB" button downloading "Office_Lobby_Side_Table.glb".
```

---

## PROMPT 2: Tanaman Hias Areca Palm (`Office_Plant_Areca_Palm.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Plant_Areca_Palm" (Potted Indoor Tropical Areca Butterfly Palm in Terracotta Planter).

1. METRIC SCALING & DIMENSIONS:
   - Planter Pot Diameter: Top 0.44 m, Bottom 0.34 m, Pot Height: 0.42 m.
   - Total Plant Height (Y): ~1.70 m.
   - Canopy Spread: ~1.10 m diameter.
   - Origin (0,0,0): Floor center at bottom of the planter.

2. DETAILED PROCEDURAL GEOMETRIES & MATERIALS:
   - Terracotta Architectural Planter:
     - Slightly tapered circular pot with soft rounded top lip.
     - Material: MeshStandardMaterial (color: #b5613b, roughness: 0.72, metalness: 0.0).
   - Organic Potting Soil:
     - Recessed dark damp potting soil bed (color: #1c1917, roughness: 0.90) with subtle gravel top dressing.
   - Clustered Canes & Stems:
     - 7 to 9 clustered bamboo-like ringed canes of varying heights (diameter 12-22 mm, color: #6b7a3a, roughness: 0.65) fanning outwards from soil center with organic outward lean (tilt 15°-35°).
   - Feathered Palm Fronds:
     - Gracefully arching pinnate palm fronds with slender linear-lanceolate leaflets.
     - Material: Double-sided MeshStandardMaterial (color: #3b6b2c with subtle gradient towards #5a8738 at tips, roughness: 0.55).
     - Natural asymmetric 360-degree crown distribution.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Plant_Areca_Palm".
   - Enable castShadow = true and receiveShadow = true.
   - Triangle budget under 25,000 triangles with smooth vertex normals.
   - Include studio lighting, OrbitControls, and a clean single-click "Export GLB" button downloading "Office_Plant_Areca_Palm.glb".
```

---

## PROMPT 3: Rak Majalah Lounge (`Office_Lounge_Magazine_Rack.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Lounge_Magazine_Rack" (Modern Stainless Steel Tiered Floor Magazine Rack for Executive Lounge).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.34 m.
   - Depth (Z): 0.30 m.
   - Height (Y): 0.90 m.
   - Origin (0,0,0): Bottom center on floor. Faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES & MATERIALS:
   - Structural Upright Frames:
     - Dual vertical rectangular side frames built from 15×15 mm satin brushed stainless steel bars rising 0.90 m.
     - Material: MeshStandardMaterial (color: #cbd5e1, metalness: 0.90, roughness: 0.22).
   - 3-Tier Angled Display Trays:
     - 3 horizontal perforated or slatted steel display shelves (width 0.34 m, shelf depth 0.22 m) tilted backward at 20° with a 25 mm front retention lip.
     - Spaced vertically at Y ≈ 0.25 m, 0.55 m, and 0.85 m.
   - Realistic Magazine Props:
     - Tier 1 (Top): Architecture & design monograph ("ARCHITECTURE TODAY", terracotta cover #b5523b, white title text).
     - Tier 2 (Middle): Tech & AI periodical ("AI SYSTEMS", deep teal cover #1f4d55).
     - Tier 3 (Bottom): Executive business weekly ("GLOBAL STRATEGY", mustard gold cover #c9973a).
   - Base Feet:
     - Low-profile horizontal stabilizing runners with non-scratch rubber end caps.

3. SCENE HIERARCHY & EXPORT REQUIREMENTS:
   - Root THREE.Group named: "Office_Lounge_Magazine_Rack".
   - Enable castShadow = true and receiveShadow = true.
   - Triangle count under 10,000 triangles.
   - Include studio lighting, OrbitControls, and a clean single-click "Export GLB" button downloading "Office_Lounge_Magazine_Rack.glb".
```

---

## Panduan Ekspor & Integrasi

1. Salin prompt di atas ke Claude Code atau generator Three.js untuk menghasilkan file HTML di `workspace/office-next/tools/3d-generator/`:
   - `Office_Lobby_Side_Table.html`
   - `Office_Plant_Areca_Palm.html`
   - `Office_Lounge_Magazine_Rack.html`
2. Buka masing-masing HTML di browser, klik tombol **"Export GLB"**.
3. Pindahkan ketiga file hasil ekspor ke folder model publik:
   ```
   workspace/office-next/public/models/
     ├── Office_Lobby_Side_Table.glb
     ├── Office_Plant_Areca_Palm.glb
     └── Office_Lounge_Magazine_Rack.glb
   ```
4. Saat aplikasi `office-next` dijalankan, `lobbyReception.ts` dan `loungeRelax.ts` akan secara otomatis mendeteksi file `.glb` tersebut dan menggantikan mesh placeholder bawaan tanpa perlu perubahan kode apa pun.

---

## Koreksi & Status (dicek terhadap kode, 18 November 2026)

**Status:** ketiga generator sudah dibuat di `tools/3d-generator/<Nama>.html` (gitignored, lokal saja). Buka file, klik **Export GLB**, lalu salin ke `public/models/`. GLB otomatis menggantikan placeholder prosedural.

### A. Koreksi terhadap dokumen ini

| # | Bagian | Masalah | Keputusan |
|---|---|---|---|
| 1 | Tabel ringkasan: palm di "Sudut barat daya Lounge" | Slot `LOUNGE.palm` ada di sudut **barat laut** (dekat kaca utara), bukan barat daya (sofa L ada di sana). | Tetap di barat laut. |
| 2 | Prompt 2: kanopi Ø1,10 | Di slot lama `(-2.15, -2.35)` lokal, kanopi r 0,55 menembus dinding barat 0,20 m dan kaca utara 0,14 m. | Slot digeser ke `(-1.93, -2.19)` lokal = dunia `(9.57, 8.21)`. Generator menjamin seluruh kanopi di dalam silinder Ø1,10 (hasil 1,09). |
| 3 | Prompt 3: baki "width 0.34 m" | Lebar luar rak juga 0,34 m, jadi baki selebar itu tidak muat di antara rangka 15 mm. | Baki 0,31 m di antara rangka. |
| 4 | Prompt 3: "horizontal ... tilted backward at 20° with a front retention lip" | Arah miring ambigu. | Gaya lectern: depan rendah + bibir 25 mm, belakang tinggi. Majalah bersandar di bibir, sampul menghadap atas-depan (terlihat dari kamera Tenggara). Tinggi total dengan majalah 0,91 m. |
| 5 | Prompt 1: ring karet "at bottom" + tebal pelat 15 mm | Kalau ring ditambahkan di bawah pelat, tinggi total melebihi 0,54. | Ring dibenamkan, tebal pelat + ring tetap 15 mm. Total tepat 0,54. Warna vas "amber/teal" diambil amber. |
| 6 | Panduan langkah 4: "tanpa perubahan kode" | Palm butuh slot baru (koreksi 2); placeholder ketiganya disamakan dengan kontrak. | `layout.ts`, `loungeRelax.ts`, `lobbyReception.ts` diperbarui. |

### B. Kontrak per GLB

| GLB | Ukuran (m) | Origin & arah | Penempatan di scene (dunia) | Segitiga |
|---|---|---|---|---|
| `Office_Lobby_Side_Table` | Ø0,60 × 0,54 (vas + calla lily sampai 1,06) | Lantai di tengah pelat dasar | Lobi `(3.2, 12.05)`, rotasi 0 → `X 2.9..3.5, Z 11.75..12.35` | 7,3k |
| `Office_Plant_Areca_Palm` | Pot Ø0,44 (bawah Ø0,34) × 0,42; tinggi 1,70; kanopi ≤ Ø1,10 | Lantai di tengah pot | Lounge `(9.57, 8.21)` → `X 9.15..10.06, Z 7.78..8.64` (bebas 0,15 dari dinding barat, 0,14 dari kaca utara) | 22,6k |
| `Office_Lounge_Magazine_Rack` | 0,34 × 0,90 × 0,30 (majalah sampai 0,91) | Lantai di tengah tapak; depan (bibir baki) +Z | Lounge `(9.3, 9.2)`, rotY 90° (menghadap Timur) → `X 9.15..9.45, Z 9.03..9.37` | 0,7k |

### C. Verifikasi
- Panel cek dimensi di tiap generator lolos semua (±3 mm, origin, ketinggian kunci, batas segitiga).
- Ketiga GLB dibangun dari generator lalu disajikan ke halaman kantor lewat `page.route`. Semuanya termuat menggantikan placeholder, dengan bounding box dunia sesuai tabel B.
