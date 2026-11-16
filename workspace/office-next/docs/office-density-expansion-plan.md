# Office 3D Interior Density & Asset Expansion Plan
> Authored by: **Gita — Game Dev 2.5D** & **Tari — UI/UX Designer**  
> Engine: **Three.js r128 (WebGL PBR) + GLTFExporter**  
> Targeted Generator: **Claude Sonnet 3.5 / 5.5 (High Effort)**

---

## 1. Architectural Layout & Density Overview (14×10m Diorama)

To transform our virtual office into a bustling, authentic high-tech agency headquarters, additional architectural props and utilities are staged across logical spatial zones:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AC Wall Unit 1]          [Mobile Glass Whiteboard]       [AC Wall Unit 2]  │
│ [Bookshelf Cabinet]       (Raka - Manager)   (Fajar - QA) [Archive Cabinet] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐    CENTRAL CORRIDOR ┌─────────────────────┐       │
│   │ Sari (Researcher)   │       (X: 0.0)      │ Bima (Programmer)   │       │
│   │ Dimas (Writer)      │                     │ Gita (Game Dev 2.5D)│       │
│   ├─────────────────────┤    WIDTH: > 2.5m    ├─────────────────────┤       │
│   │ Tari (UI/UX)        │                     │ Satria (Security)   │       │
│   │ Wulan (Artist)      │                     │ Laras (Reviewer)    │       │
│   └─────────────────────┘                     └─────────────────────┘       │
│     [West Pod: Product]                         [East Pod: Tech & Sec]      │
│                                                                             │
│ ═════════════════════ SOUTH PROMENADE (Z: 0.8 to 1.2) ═════════════════════ │
│                                                                             │
│  [Coffee Bar & Queue]                          [Round Meeting Table & 4Ch]  │
│  [Trash Bin & Dispenser]                       [42U Server Rack Data Center]│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Furniture Spec & Placement Coordinates

| No | Asset Name | Output File | Dimensions (W × D × H) | Target Coords (X, Y, Z) | Visual & PBR Specs |
|---|---|---|---|---|---|
| 1 | **Wall AC Inverter Unit** | `Office_Wall_AC_Unit.glb` | 0.85 × 0.22 × 0.30 m | `X: -1.5, Y: 2.8, Z: -4.85` & `X: 4.5, Y: 2.8, Z: -4.85` | High-gloss white ABS casing, horizontal intake grille, bottom louver flap angled at 15°, digital `24°C` LED readout. |
| 2 | **Industrial Bookshelf** | `Office_Bookshelf_Cabinet.glb` | 1.20 × 0.40 × 1.85 m | `X: -6.4, Y: 0, Z: -3.5` | Matte black steel tube frame with rear 'X' wire brace, lower 2-door oak cabinet, 4 open shelves stacked with binders, tech books, and a ceramic potted plant. |
| 3 | **Mobile Glass Whiteboard** | `Office_Whiteboard_Scrum.glb` | 1.60 × 0.45 × 1.80 m | `X: 0.0, Y: 0, Z: -4.75` | Heavy-duty mobile caster base, frosted tempered glass board, subtle sprint columns (*TODO*, *IN PROGRESS*, *TESTING*, *DONE*), pastel sticky notes, bottom marker tray. |
| 4 | **Bottom-Load Water Dispenser** | `Office_Water_Dispenser.glb` | 0.35 × 0.38 × 1.05 m | `X: -5.6, Y: 0, Z: 4.1` | Sleek matte black & brushed stainless steel, 3 dispenser taps (Hot/Cold/Ambient), metallic drip tray, status indicator LEDs. |
| 5 | **Round Meeting Table & 4 Chairs** | `Office_Meeting_Table_Round.glb` | 1.40 × 1.40 × 0.75 m | `X: 0.2, Y: 0, Z: 2.2` | 1.2m round walnut tabletop, fluted central steel pedestal on disc base, surrounded by 4 modern conference chairs upholstered in charcoal textured wool. |

---

## 3. High-Effort 3D Prompts for Claude Sonnet 3.5 / 5.5

> **Usage Instructions:**
> 1. Open a **New Chat** in Claude Sonnet 3.5 / 5.5 (set to **High Effort**).
> 2. Copy and paste one prompt below.
> 3. Claude will generate a single-file `.html` document containing Three.js r128 and `GLTFExporter`.
> 4. Open the generated HTML in your desktop browser and click the **Export GLB** button to download the 3D model.
> 5. Place the exported file into `workspace/office-next/public/models/`.

---

### PROMPT 1: Wall-Mounted AC Inverter Unit (`Office_Wall_AC_Unit.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Wall_AC_Unit" (Modern Commercial Wall-Mounted Inverter Air Conditioner).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.85 m
   - Depth (Z): 0.22 m
   - Height (Y): 0.30 m
   - Origin (0,0,0): Centered at the bottom edge of the rear wall-mounting plate. The front faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Main Housing: Aerodynamic rectangular casing with gentle chamfered/filleted front corners. High-gloss clean white finish (MeshStandardMaterial: color #f8fafc, roughness 0.22, metalness 0.05).
   - Top Air Intake: Horizontal slotted intake vents along the top surface, recessed with dark interior cavity.
   - Directional Air Louver (Bottom Flap): Sleek horizontal louver flap tilted downwards at approximately 15 degrees, revealing a dark matte charcoal air discharge duct inside (#1e293b, roughness 0.8).
   - Digital LED Display: Front-right quadrant features a minimalist temperature indicator display reading "24°C" using an emissive texture (emissive color #38bdf8, emissiveIntensity 1.8).
   - Brand Plate: Subtle brushed chrome metallic badge on the lower right corner (metalness 0.9, roughness 0.15).

3. SCENE HIERARCHY & CLEANLINESS:
   - All meshes must be grouped under a single root THREE.Group named: "Office_Wall_AC_Unit".
   - Do NOT include scene lights, camera, grid, or ground helper in the exported GLB.

4. UI & EXPORT WORKFLOW:
   - Dark studio preview with OrbitControls, directional key/fill lights, soft shadows, and an environment map.
   - Prominent "Export GLB" button in the top-right corner that triggers gltfExporter.parse() with binary: true, saving "Office_Wall_AC_Unit.glb".
   - Readout badges showing measured bounding dimensions (W × D × H) and total polygon count.
```

---

### PROMPT 2: Industrial Bookshelf & File Cabinet (`Office_Bookshelf_Cabinet.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Bookshelf_Cabinet" (Modern Industrial Open Bookshelf with Lower Storage Cabinet).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 1.20 m
   - Depth (Z): 0.40 m
   - Height (Y): 1.85 m
   - Origin (0,0,0): Centered on the floor at the base of the unit. The front faces towards +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Structural Metal Frame: 25mm square hollow steel tubing in matte powder-coated black (#18181b, roughness 0.65, metalness 0.75). Includes rear diagonal 'X' cross-brace wire tensioners for authentic industrial stability.
   - Lower Two-Door Filing Cabinet (Height 0.50m): Solid warm oak wood casing (#78350f / #92400e, roughness 0.5, metalness 0.05) with 2 cabinet doors, subtle seam gap, and minimalist vertical black bar handles.
   - 4 Open Tiered Shelves: Sturdy 25mm thick oak wood planks positioned at heights 0.52m, 0.95m, 1.38m, and 1.80m.
   - Populated Props (Integrated Content):
     * Shelf 1: A neat row of upright office archive ring binders in navy blue (#1e3a8a), charcoal (#374151), and deep wine red (#831843).
     * Shelf 2: Assorted stacks and leaning rows of software engineering and design books with colored spine details.
     * Shelf 3: A minimalist white ceramic cylindrical pot containing a green succulent plant (#15803d) and a small acrylic award trophy.
     * Shelf 4: Dual textured grey fabric storage baskets with leather pull tags.

3. SCENE HIERARCHY & EXPORT:
   - Root THREE.Group named: "Office_Bookshelf_Cabinet".
   - Only export the furniture and its props (no cameras, stage lights, or ground meshes).
   - Instant "Export GLB" button downloading "Office_Bookshelf_Cabinet.glb" with live dimension readouts.
```

---

### PROMPT 3: Mobile Agile Glass Whiteboard (`Office_Whiteboard_Scrum.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Whiteboard_Scrum" (Mobile Glass Kanban & Scrum Whiteboard on Lockable Casters).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 1.60 m
   - Depth of Base Legs (Z): 0.48 m
   - Total Height (Y): 1.80 m
   - Origin (0,0,0): Centered at floor level between the wheel casters. Front faces +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Stand & Base Frame: Powder-coated white anodized steel tubular frame (#f1f5f9, roughness 0.35, metalness 0.3). Features inverted T-legs equipped with 4 black swivel wheel casters and foot brake levers.
   - Frosted Glass Writing Surface: Large 1.50m x 1.05m tempered frosted safety glass panel (#e2e8f0, roughness 0.12, transmission 0.85, opacity 0.95).
   - Sprint Columns & Sticky Notes:
     * Subtle etched column divider lines demarcating "TODO", "DOING", "REVIEW", "DONE".
     * Scattered 3D pastel sticky notes (#fef08a yellow, #a7f3d0 teal, #fbcfe8 pink) placed across columns.
   - Bottom Marker Tray: Extruded horizontal brushed aluminum channel holding 2 dry-erase markers (black & blue caps) and a magnetic felt eraser block.

3. SCENE HIERARCHY & EXPORT:
   - Root THREE.Group named: "Office_Whiteboard_Scrum".
   - Self-contained single-file HTML with interactive 3D OrbitControls viewport.
   - "Export GLB" button downloading "Office_Whiteboard_Scrum.glb".
```

---

### PROMPT 4: Commercial Bottom-Load Water Dispenser (`Office_Water_Dispenser.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Water_Dispenser" (Commercial Bottom-Load Hot/Cold Water Cooler Dispenser).

1. METRIC SCALING & DIMENSIONS:
   - Width (X): 0.34 m
   - Depth (Z): 0.38 m
   - Height (Y): 1.05 m
   - Origin (0,0,0): Centered at floor level at the base. Front faces +Z.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Exterior Housing: Premium matte black textured ABS body (#0f172a, roughness 0.55, metalness 0.1) with vertical brushed stainless steel front accent panel (#e2e8f0, roughness 0.25, metalness 0.85).
   - Recessed Dispensing Alcove:
     * High-clearance alcove to fit mugs and bottles.
     * 3 push buttons or levers: Hot (crimson red accent #ef4444), Room Temp (white accent #f8fafc), and Cold (electric cyan accent #06b6d4).
     * Removable perforated metallic drip tray grid at the bottom.
   - Status Indicator Panel: Three small LED indicator dots (Heating, Cooling, Bottle Empty) on the top fascia.
   - Lower Access Door: Clean vertical seam and handle indent for the concealed 5-gallon water bottle compartment.

3. SCENE HIERARCHY & EXPORT:
   - Root THREE.Group named: "Office_Water_Dispenser".
   - Interactive OrbitControls inspector with bounding box dimensions and polycount HUD.
   - "Export GLB" button downloading "Office_Water_Dispenser.glb".
```

---

### PROMPT 5: Collaborative Round Meeting Table & 4 Chairs (`Office_Meeting_Table_Round.glb`)

```markdown
Create a complete, single-file HTML application using Three.js r128 (via CDN) and GLTFExporter to procedurally generate, preview, and export a high-fidelity 3D PBR model: "Office_Meeting_Table_Round" (1.2m Collaborative Round Discussion Table with 4 Modern Conference Chairs).

1. METRIC SCALING & DIMENSIONS:
   - Tabletop Diameter: 1.20 m
   - Tabletop Height: 0.75 m
   - Overall Footprint with 4 Chairs: Diameter approx. 1.85 m
   - Origin (0,0,0): Centered at floor level at the table column base.

2. DETAILED PROCEDURAL GEOMETRIES:
   - Round Table:
     * Top Surface: 30mm thick circular beveled dark walnut wood top (#451a03 / #582a0d, roughness 0.45, metalness 0.05).
     * Base: Central cylindrical heavy steel pedestal pillar (#18181b, metalness 0.8, roughness 0.4) mounted onto a wide chamfered circular steel ground plate.
     * Center Cable Hub: Circular brushed aluminum recessed cable port grommet in the center of the table.
   - 4 Modern Conference Chairs:
     * Arranged symmetrically at 0°, 90°, 180°, and 270°, rotated to face inward toward the table center.
     * Curved ergonomic shell seat and backrest upholstered in woven charcoal grey wool fabric (#27272a, roughness 0.85).
     * Slender 4-legged matte black steel spider base with protective floor glides.

3. SCENE HIERARCHY & EXPORT:
   - Root THREE.Group named: "Office_Meeting_Table_Round".
   - Clean hierarchy ready for instant production diorama usage.
   - "Export GLB" button downloading "Office_Meeting_Table_Round.glb".
```
