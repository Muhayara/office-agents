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
