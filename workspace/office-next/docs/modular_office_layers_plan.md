# Master Plan: Arsitektur Gedung Modular Berbasis Layer & Sayap Ruang Rapat 10 Agent (Formasi 5+5)

*Disusun oleh: Tim 10 Agen AI (Raka, Tari, Gita, Bima, Satria, Wulan, Laras, Dimas, Sari, Fajar)*  
*Disetujui oleh: CEO (Muhayara)*  
*Lokasi Dokumen: `workspace/office-next/docs/modular_office_layers_plan.md`*  
*Status Dokumen: **Cetak Biru Resmi v4 (Audit v2 + Kamera Free Cam 3D & Auto-Fade Wall + Sinkronisasi `office_room_shell.glb`)** — Siap Fase Pembuatan Aset Ruangan*

---

## 1. Visi Besar: Gedung Kantor Modular Bertingkat (Expandable Office Tower)

Kantor virtual AI kita dirancang bukan sebagai satu kotak statis, melainkan **gedung perkantoran modular yang dapat bertambah secara bertingkat dan multi-ruangan**, dengan prinsip:
1. **Identitas Tematik Unik**: Setiap ruangan memiliki fungsi, tekstur material, dan atmosfer pencahayaan yang berbeda (tidak ada ruangan kembar).
2. **Kemandirian Modul (*Decoupled Room Nodes*)**: Setiap ruangan dibungkus dalam sistem **Layer / Scene Graph Group** dengan origin lokal `(0, 0, 0)`.
3. **Fleksibilitas Penataan Bebas**: Ruangan dapat dipindahkan ke koordinat horizontal mana saja atau dipindahkan ke **Lantai 2 / Lantai 3** di masa depan cukup dengan memindahkan node ruangan ke *Floor Group* yang dituju (*Node Reparenting*), tanpa membongkar susunan furnitur di dalamnya.
4. **Sistem Konektor Koridor & Pintu**: Ruangan dihubungkan oleh lorong penghubung kaca (*Glass Skybridges / Hallways*) yang realistis dan berpintu transisi anti-macet.

---

## 2. Standarisasi Konvensi Sistem Koordinat 3D & Arah Mata Angin

Untuk mencegah bug orientasi arah hadap avatar dan kamera antar-agen, panggung Three.js menetapkan konvensi resmi berikut:

* **Sumbu X**: Barat (`-X`) ↔ Timur (`+X`)
* **Sumbu Y**: Bawah (`0.0 = Lantai Jalan`) ↔ Atas (`+Y = Ketinggian`)
* **Sumbu Z**: Utara (`-Z`) ↔ Selatan (`+Z`)

| Arah Mata Angin | Vektor Sumbu | Nilai Rotasi Y (`rotation.y`) | Deskripsi Visual |
|---|:---:|:---:|---|
| **Selatan** | `+Z` | `0` (`0 rad`) | Menghadap ke arah depan panggung / kamera default |
| **Utara** | `-Z` | `Math.PI` (`3.14159 rad`) | Menghadap ke dinding belakang / menjauhi kamera |
| **Timur** | `+X` | `Math.PI / 2` (`1.5708 rad`) | Menghadap ke sisi kanan panggung (arah koridor & ruang rapat) |
| **Barat** | `-X` | `-Math.PI / 2` (`-1.5708 rad`) | Menghadap ke sisi kiri panggung (arah pantry & rak server) |

---

## 3. Sistem Dual Kamera & Auto-Fade Wall (ala *The Sims*)

Agar panggung nyaman dipantau sekaligus bebas dijelajahi saat ruangan makin banyak dan bertingkat, `IsometricOfficeStage.tsx` mengadopsi sistem **Dual Camera** tanpa menghapus kamera bawaan:

### A. Mode 1 — Kamera Isometrik (Default, Tetap Dipertahankan)
* Menggunakan `OrthographicCamera` + `OrbitControls` (posisi awal `(18, 14, 20)` menghadap Tenggara → Barat Laut).
* Cocok untuk memantau pergerakan seluruh 10 agen dan tata letak kantor sekaligus.
* Disediakan tombol shortcut di topbar: `[ Fokus: Ruang Kerja ]` dan `[ Fokus: Ruang Rapat ]` (tidak memaksa auto-pan bila CEO sedang menggeser kamera secara manual).

### B. Mode 2 — Free Cam 3D (Tombol Toggle Baru)
* Menggunakan **`PerspectiveCamera` (FOV 50°)** dengan efek kedalaman ruang 3D nyata.
* Kontrol terbang bebas: **Mouse Look/Orbit + Keyboard `W A S D` (maju/mundur/geser) + `Q / E` (naik/turun)**.
* Memungkinkan CEO "terbang masuk" menyusuri lorong koridor kaca, mengecek detail kredenza, hingga berdiri pada level mata (*eye-level*) di depan Smart TV 85".

### C. Auto-Fade Wall (ala Game *The Sims*)
* Setiap grup dinding penuh (`Back_Wall`, `Left_Wall` di Main Office; `North_Wall`, `West_Wall_Acoustic` di Boardroom) diberi vektor normal hadap ke dalam ruangan.
* Setiap frame, dihitung *dot product* antara normal dinding dan arah posisi kamera:
  * **Jika kamera berada di belakang dinding (`dot < 0`)** dan menghalangi pandangan ke isi ruangan → material dinding memudar halus menjadi transparan (`opacity ≈ 0.15`, `depthWrite: false`).
  * **Jika kamera kembali ke depan dinding atau masuk ke dalam ruangan (Mode Free Cam 3D)** → dinding kembali solid penuh (`opacity: 1.0`).

---

## 4. Hirarki Scene Graph (Sistem Layer Photoshop / Figma)

```text
🏢 Gedung Kantor (BuildingRoot - THREE.Group)
└── 🏢 Lantai 1 (Floor_1_Group - THREE.Group)
    │
    ├── 🚪 LAYER INDUK RUANGAN 1: [Room_MainWorkspace] (Pusat: X: 0.0, Z: 0.0)
    │   ├── 📁 SubLayer_Architecture (office_room_shell.glb — 14×10×3.2 m, bukaan pintu timur di Z: +1.65..+3.05)
    │   ├── 📁 SubLayer_Workstations (10 meja kerja modular + monitor kode glow satu sisi)
    │   ├── 📁 SubLayer_Chairs (10 kursi kerja ergonomis mesh putar)
    │   ├── 📁 SubLayer_Pantry (Coffee Bar, Water Dispenser galon bawah, Tempat Sampah)
    │   ├── 📁 SubLayer_Appliances (2 unit Wall AC Unit 24°C)
    │   ├── 📁 SubLayer_Decor (2 Server Rack 42U, Bookshelf Cabinet oak, Tanaman Monstera & Snake)
    │   └── 📁 SubLayer_SeatAnchors (10 titik duduk kerja agen)
    │
    ├── 🚪 LAYER KONEKTOR KORIDOR: [Corridor_East_Connector] (Pusat: X: 8.10, Z: +2.35)
    │   └── 📁 SubLayer_Connector (Office_Glass_Corridor.glb — bentang X: 6.70 s/d 9.50, Z: +1.35..+3.35)
    │       ├── Ujung Barat (X = 6.70): Menyambung langsung ke celah pintu geser asli office_room_shell.glb (tanpa pintu ganda)
    │       └── Ujung Timur (X = 9.50): 1 pintu geser kaca tempered terbuka menuju Boardroom
    │
    └── 🚪 LAYER INDUK RUANGAN 2: [Room_Boardroom_10p] (Pusat: X: 13.50, Z: 0.0)
        ├── 📁 SubLayer_Architecture (Office_Boardroom_Shell.glb — 8×8×3.2 m, karpet charcoal, cutaway Selatan & Timur)
        ├── 📁 SubLayer_AV_Presentation:
        │   ├── Office_Presentation_Display_85.glb di Dinding Barat (Z = -0.60, hadap Timur +X, terlihat penuh oleh kamera SE)
        │   └── Office_Whiteboard_Scrum.glb (clone aset eksisting) di sudut Timur-Utara (local X: +2.8, Z: -3.35)
        ├── 📁 SubLayer_Furniture_Props:
        │   ├── Office_Boardroom_Credenza.glb (kredenza walnut & marmer + carafe/kopi) di Dinding Utara (local X: +0.5, Z: -3.65)
        │   ├── Office_Wall_AC_Unit.glb (clone eksisting) di Dinding Utara (Y: 2.45 m)
        │   └── Office_Indoor_Plant.glb (clone eksisting) di sudut Barat-Utara & Timur-Utara
        ├── 📁 SubLayer_Lighting (Office_Linear_Pendant_Light.glb menggantung di Y: 2.25 m di atas meja, pure emissive mesh)
        ├── 📁 SubLayer_ConferenceTable (Office_Conference_Table.glb — 4.00×1.20 m di local X: +0.60, Z: -0.60)
        ├── 📁 SubLayer_ConferenceChairs (10× instanced Office_Conference_Chair.glb, formasi 5+5)
        └── 📁 SubLayer_MeetingSpots (10 seat anchor + animasi swivel menoleh ke TV Barat)
```

---

## 5. Tata Letak Spasial & Denah Ruang Rapat (Formasi 5+5, TV Dinding Barat)

### A. Mengapa TV Diletakkan di Dinding Barat (`-X`) dan Pintu di `Z = +2.35`?
1. **Sinkronisasi Nyata dengan `office_room_shell.glb`**: Sekat kaca timur Ruang Utama (`X = 6.70`) *sudah memiliki* celah pintu geser asli pada **`Z = +1.65` s/d `+3.05`** (titik tengah **`Z = +2.35`**). Menyelaraskan koridor di `Z = +2.35` membuat agen berjalan mulus tanpa memotong/menembus kaca!
2. **Bebas Oklusi Kamera Isometrik**: Kamera default memandang dari Tenggara (`+X, +Z`). Dinding Barat (`-X`) dan Dinding Utara (`-Z`) menghadap langsung ke arah kamera, sedangkan sisi Selatan (`+Z`) dan Timur (`+X`) adalah *cutaway*. Memasang **Smart TV 85" di Dinding Barat** menghadap ke Timur (`+X`) menjamin layar presentasi, presenter, dan ke-10 agen terlihat 100% jelas tanpa pernah terhalang tembok!
3. **Margin Luas untuk Pintu & Zona Presenter**: Dengan Ruang Rapat berukuran **`8.00 m × 8.00 m`** (pusat `X: +13.5, Z: 0.0`, bentang `X: 9.5..17.5`, `Z: -4.0..+4.0`) dan Meja Kapsul digeser ke **`local X = +0.60, Z = -0.60`**:
   * **Zona Presenter di depan TV Barat**: `2.60 meter` bersih (`X: 9.5 .. 12.1`).
   * **Jarak Lorong Timur**: `1.40 meter` (`X: 16.1 .. 17.5`).
   * **Jarak Lorong Utara (di belakang kursi N1–N5)**: `2.10 meter` (cukup untuk Kredenza `0.45 m` + jalur jalan `1.65 m`).
   * **Jarak Promenade Selatan (pintu masuk `Z = +2.35`)**: `3.30 meter` lapang lurus dari pintu masuk!

### B. Denah Tampak Atas (Top-Down):

```text
                                  Dinding Utara (Z = -4.0)
               [ Plant ]   [ Credenza 1.8m + AC Wall 22°C ]   [ Whiteboard ]
        ┌────────────────────────────────────────────────────────────────────────┐
        │                                                                        │
        │                  Lorong sirkulasi utara (lebar 1.65 m)                 │
   D    │                                                                        │
   I  T │                        N1      N2      N3      N4      N5              │
   N  V │                       [v]     [v]     [v]     [v]     [v]              │
   D    │       ZONA          ╭───────────────────────────────────────╮          │
   I  8 │     PRESENTER       │  (kaki)                       (kaki)  │          │
   N  5 │      (2.6 m)        │   [G1]                         [G2]   │          │  (Timur
   G  " │                     ╰───────────────────────────────────────╯          │  Cutaway)
        │                       [^]     [^]     [^]     [^]     [^]              │
   B    │                        S1      S2      S3      S4      S5              │
   A    │                                                                        │
   R  ╔═╝  ◄═══ (Pintu Geser Kaca Z = +2.35, lebar 1.40 m) ═══════════════╗      │
   A  ║        Koridor Kaca Timur (X: 6.70 ──► 9.50)                      ║      │
   T  ╚═══════════════════════════════════════════════════════════════════╝      │
        └────────────────────────────────────────────────────────────────────────┘
   X = 9.5                         (Selatan Cutaway Z = +4.0)               X = 17.5
```
*Keterangan:* `[v]` = menghadap Selatan (`+Z`, `rotY = 0`), `[^]` = menghadap Utara (`-Z`, `rotY = Math.PI`), `[G]` = cable grommet di atas kaki trestle meja.

---

## 6. Tabel 10 Seat Anchor (Formasi 5+5 Simetris)

* Pusat meja lokal: **`(X: +0.60, Z: -0.60)`** → World **`(X: 14.10, Z: -0.60)`**.
* Jarak antar-kursi: **0.70 m** pada bagian lurus sepanjang `2.80 m` (`local X: -0.80, -0.10, +0.60, +1.30, +2.00`).
* Tepi meja: Utara `local Z = -1.20`, Selatan `local Z = 0.00`.
* *World Coordinate* = Local + `(13.50, 0.00)`. Di kode, pembacaan posisi selalu memakai `getWorldPosition()`.

| Seat ID | Baris | Local X | Local Z (Tucked) | Local Z (Pulled) | World X | World Z (Tucked) | `rotation.y` Default | Agen (Penugasan Kursi) |
|---|:---:|---:|---:|---:|---:|---:|:---:|---|
| **N1** | Utara | -0.80 | -1.60 | -1.90 | 12.70 | -1.60 | `0` | **Laras (Reviewer — dekat Presenter/TV)** |
| **N2** | Utara | -0.10 | -1.60 | -1.90 | 13.40 | -1.60 | `0` | Gita (Game Dev 2.5D) |
| **N3** | Utara | +0.60 | -1.60 | -1.90 | 14.10 | -1.60 | `0` | **Raka (Manajer / Pimpinan Tengah)** |
| **N4** | Utara | +1.30 | -1.60 | -1.90 | 14.80 | -1.60 | `0` | Bima (Programmer) |
| **N5** | Utara | +2.00 | -1.60 | -1.90 | 15.50 | -1.60 | `0` | Fajar (Visual QA) |
| **S1** | Selatan | -0.80 | +0.40 | +0.70 | 12.70 | +0.40 | `Math.PI` | Wulan (Artis Visual) |
| **S2** | Selatan | -0.10 | +0.40 | +0.70 | 13.40 | +0.40 | `Math.PI` | Tari (Desainer UI/UX) |
| **S3** | Selatan | +0.60 | +0.40 | +0.70 | 14.10 | +0.40 | `Math.PI` | Sari (Peneliti) |
| **S4** | Selatan | +1.30 | +0.40 | +0.70 | 14.80 | +0.40 | `Math.PI` | Dimas (Penulis / Notulen) |
| **S5** | Selatan | +2.00 | +0.40 | +0.70 | 15.50 | +0.40 | `Math.PI` | Satria (Security Auditor) |

---

## 7. Daftar Aset 3D & Urutan Pembuatan (1 Objek = 1 Prompt)

### Fase 2A — Ruangan, Koridor & Detail Interior (Dikerjakan Pertama)
1. **`Office_Boardroom_Shell.glb`** — Cangkang Ruang Rapat `8 × 8 × 3.2 m` (karpet akustik charcoal, cutaway Selatan & Timur, Dinding Barat slat kayu walnut + lubang portal pintu `Z: +1.65..+3.05`).
2. **`Office_Glass_Corridor.glb`** — Koridor Kaca Modular `2.80 × 2.00 × 3.10 m` (jembatan kaca dengan lantai terrazzo + LED strip pemandu, atap terbuka, cutaway kaca selatan, pintu geser kaca terbuka di sisi timur).
3. **`Office_Presentation_Display_85.glb`** — Smart TV 85" 4K + Soundbar Video Conference + Backlight hangat.
4. **`Office_Boardroom_Credenza.glb`** — Konsol Kredenza Walnut & Marmer `1.80 × 0.45 × 0.82 m` lengkap dengan nampan carafe air, 4 gelas, mesin kopi kapsul, cangkir, dan tablet dock.
5. **`Office_Linear_Pendant_Light.glb`** — Lampu Gantung Linier Aluminium `2.60 m` di ketinggian `Y = 2.25 m` (pure emissive mesh, tanpa PointLight shadow berat).
*(Ditambah aset eksisting yang di-clone: `Office_Wall_AC_Unit.glb`, `Office_Whiteboard_Scrum.glb`, `Office_Indoor_Plant.glb`, `Office_Indoor_Plant_SnakePlant.glb`).*

### Fase 2B — Furnitur Utama 10 Agent (Dikerjakan Setelah Ruangan Selesai)
6. **`Office_Conference_Table.glb`** — Meja Kapsul/Racetrack `4.00 × 1.20 × 0.75 m` (bagian lurus `2.80 m`, bawah daun meja `0.710 m`, 2 kaki trestle di `x = ±1.05` langsung di bawah 2 cable grommet, target ≤ 8.000 segitiga).
7. **`Office_Conference_Chair.glb`** — Kursi Konferensi Eksekutif Swivel (`Chair_Root -> Chair_Base & Chair_Swivel`), tinggi armrest **≤ 0.66 m** (clearance aman 5 cm di bawah meja `0.710 m`), menghadap `+Z`, target ≤ 6.000 segitiga.

*(Rincian kode prompt bahasa Inggris untuk Fase 2A dan Fase 2B tersimpan rapi pada dokumen masing-masing dan bagian lampiran Audit v2 di [`boardroom_audit_v2_solutions.md`](file:///P:/gemini-lab/office/workspace/office-next/docs/boardroom_audit_v2_solutions.md)).*

---

## 8. Logika Navigasi `/rapat` & Anti-Macet Pintu

1. **Graf Waypoint Berurutan:**
   * `Exit Workstation` → `Aisle / Central Avenue` → `Promenade Selatan (Z = +0.8..+2.35)` → `East Corridor Ingress (X = 6.70 → 9.50, Z = +2.35)` → `Boardroom South Entry Promenade` → `North/South Seat Aisle` → `Pulled Chair -> Sit & Tuck`.
2. **Door Mutex & Staggered Departure:**
   * Jeda keberangkatan `0.9 detik` antar-agen (urutan agen terdekat pintu jalan duluan).
   * Pintu masuk koridor di `X = 9.50, Z = +2.35` memakai penguncian *Door Mutex* (slot 0.8 detik per agen); agen berikutnya menunggu sebentar di titik antre koridor `World (X: 8.80, Z: +2.35)`.
3. **Animasi Swivel Presentasi:**
   * Saat rapat berlangsung, `Chair_Swivel` diputar halus ke arah Smart TV Barat (`-X`) memakai `Math.atan2` sehingga tidak ada leher avatar yang menoleh kaku 90°.

---

## 9. Roadmap Eksekusi Resmi

* [x] **Fase 1 (Selesai)**: Blueprint Arsitektur Layer, Audit v2 (5+5), dan Sinkronisasi Kamera/Pintu Asli (`modular_office_layers_plan.md` v4).
* [ ] **Fase 2A** (4/5 GLB sudah ada): `Office_Boardroom_Shell`, `Office_Glass_Corridor`, `Office_Presentation_Display_85`, `Office_Linear_Pendant_Light` ✅ — tinggal `Office_Boardroom_Credenza`.
* [ ] **Fase 2B**: `Office_Conference_Table` dan `Office_Conference_Chair` (wajib punya node `Chair_Swivel`).
* [x] **Fase 3 (Selesai)**: Hirarki `BuildingRoot → Floor_1_Group → Room_MainWorkspace / Corridor_East_Connector / Room_Boardroom_10p`, Dual Camera (Isometrik ↔ Free Cam 3D), Auto-Fade Wall.
* [x] **Fase 4 (Selesai)**: Graf navigasi per ruangan + portal pintu `Z = +2.35`, door mutex, keberangkatan bertahap 0.9 s, animasi tarik-duduk-dorong kursi, dan `Chair_Swivel` menghadap TV.
* [ ] **Fase 5 (Jangka Panjang)**: Ekspansi bertingkat (`Floor_2_Group`, `Floor_3_Group`) dengan memindahkan node ruangan secara modular (*Node Reparenting*).

---

## 10. Catatan Implementasi Fase 3–4

* **Struktur kode** (`workspace/office-next/src/stage/`): `layout.ts` (semua koordinat & tabel kursi), `navigation.ts` (navigasi lokal per ruangan + router gedung lewat portal), `rooms/` (`mainWorkspace.ts`, `corridorEast.ts`, `boardroom.ts`, `assets.ts`), `camera/` (`cameraRig.ts`, `wallFade.ts`).
* **Placeholder otomatis**: setiap aset ruang rapat tampil sebagai placeholder prosedural berdimensi kontrak prompt, lalu otomatis diganti GLB begitu file ada di `public/models/`. Kursi GLB wajib punya node `Chair_Swivel`; TV GLB sebaiknya punya mesh bernama `Screen_*` (overlay agenda dipaskan ke mesh itu).
* **Ritme rapat**: timer sesi (24 s) baru mulai setelah **semua peserta duduk** (batas tunggu 45 s). 13 s pertama kursi diputar ke TV (presentasi), lalu kembali ke meja untuk tanggapan. TV menampilkan topik `/rapat` dari server (tanpa API key).
* **Navigasi**: waypoint ditulis lokal per ruangan, jadi memindah grup ruangan ikut memindah grafnya. Door mutex dipasang sebagai *gate* di titik antre `(8.80, 2.35)` arah masuk dan `(10.20, 2.35)` arah keluar. Rute di ruang kerja tidak berubah. Kecepatan jalan tetap 2.2 m/s.
* **Penyesuaian kecil dari denah**: kredenza di `Z = -3.53` (di `-3.65` bagian belakangnya menembus dinding 11 cm), whiteboard di `X = +2.6`, dan tanaman timur-utara memakai snake plant di `(3.62, -3.05)` karena ruang di samping whiteboard sempit.
* **Ruang kerja**: rel bawah sekat kaca & ambang lantai yang melintang di celah pintu timur dipotong otomatis saat `office_room_shell.glb` dimuat. AC (2 unit), rak buku, dan dispenser air kini ikut dimuat.
* **Kamera**: Free Cam memakai Q = naik, E = turun (sesuai §3B). Auto-pan ke ruang rapat saat `/rapat` dan kembali ke ruang kerja saat bubar, kecuali CEO menggeser kamera dalam 8 detik terakhir atau sedang di Free Cam.

---

## 11. Koleksi Prompt Fase 2A — Ruangan, Koridor & Detail Interior (Siap Salin ke Claude)

> **Aturan Generator:** 1 Objek = 1 Prompt Bahasa Inggris. Semua file HTML memakai **Three.js r128** via CDN `<script>` tag agar bisa dibuka langsung lewat `file://`, tanpa `RoundedBoxGeometry` (gunakan `ExtrudeGeometry` atau `BoxGeometry` standar r128).

### Prompt 1 — Cangkang Ruang Rapat (`Office_Boardroom_Shell.html` → `Office_Boardroom_Shell.glb`)

```markdown
Create a complete, single-file standalone HTML application (must work cleanly when opened directly via file://) using Three.js r128, OrbitControls, and GLTFExporter via CDN `<script>` tags to procedurally generate, preview, and export ONE 3D PBR architectural shell asset: "Office_Boardroom_Shell".

Do NOT use module imports and do NOT reference THREE.RoundedBoxGeometry (not built into core r128); build chamfered or beveled edges cleanly using THREE.ExtrudeGeometry with bevels or composite BoxGeometry meshes.

1. COORDINATE & SCALE CONTRACT:
   - Units: meters (1 unit = 1 m). Y is up.
   - Room footprint: Width (X) = 8.00 m (-4.00 to +4.00), Depth (Z) = 8.00 m (-4.00 to +4.00), Wall Height (Y) = 3.20 m.
   - Origin (0,0,0): Room floor center, flush with the walkable top surface of the carpet (Y = 0.00).
   - Renderer: renderer.outputEncoding = THREE.sRGBEncoding, ACESFilmicToneMapping, PCFSoftShadowMap.

2. GEOMETRY & L-SHAPED CUTAWAY ARCHITECTURE (matching Southeast isometric view):
   - Floor Slab & Acoustic Carpet:
     * Sub-slab base: 8.00 m × 0.28 m × 8.00 m slate base extending downward from Y = -0.02 to Y = -0.30 (#18252b, roughness 0.90).
     * Acoustic Charcoal Carpet Tile Surface: 7.76 m × 0.02 m × 7.76 m sitting flush so its top surface is at EXACT Y = 0.00, textured with a procedural subtle woven herringbone/tile grid CanvasTexture (#1d242b / #242d35, roughness 0.92, metalness 0.02), framed by a flush dark perimeter granite border (#121a1e).
   - Back Wall (North, -Z side, centered at Z = -3.88, thickness 0.24 m, full height 3.20 m):
     * Matte slate wall (#18252b) with recessed decorative wall panels (#1e2b33), continuous dark timber baseboard (height 0.28 m), slim upper aluminum cap trim, a recessed frosted upper horizontal transom window (height 0.16 m at Y = 2.94), and a warm ambient cove light strip (3000K emissive #ffdfb8) along the top edge.
   - Left Wall (West, -X side, centered at X = -3.88, thickness 0.24 m, height 3.20 m) WITH PORTAL DOORWAY:
     * Doorway Cutout Portal: Open clear passage spanning from Z = +1.65 to Z = +3.05 (1.40 m wide, doorway clear height 2.55 m), framed by clean dark anodized aluminum jambs and a solid wall lintel above Y = 2.55 to 3.20 m.
     * Remaining South pier (Z = +3.05 to +4.00): matching slate wall.
     * Acoustic Walnut Slat Feature Wall (Z = -3.76 to +1.50, height 2.90 m on inner +X face at X = -3.74): dark acoustic felt backing (#14181c) layered with ~28 crisp vertical warm walnut wood slats (#4a2c19 / #3b2213, roughness 0.55) centered around Z = -0.60 to serve as the backdrop for a presentation display.
   - Front (+Z) & Right (+X) Cutaway Thresholds (NO full walls here so camera view is unobstructed):
     * Low architectural cutaway curb along Z = +3.88 and X = +3.88 (height 0.13 m, width 0.24 m, dark matte metal #0c171b), plus slim dark vertical corner end-caps.

3. UI & EXPORT CONTRACT:
   - Root THREE.Group named "Office_Boardroom_Shell" containing cleanly named sub-groups (Floor_Group, North_Wall, West_Wall_Acoustic, Cutaway_Curbs).
   - Side panel showing dimensions (8.00 × 8.00 × 3.20 m), triangle count, and toggles: Wireframe, Doorway Guide Overlay (preview only, not exported), Auto-rotate, Camera presets (Iso, Top, Front).
   - "Export GLB" button downloading "Office_Boardroom_Shell.glb" (binary: true), excluding lights, floor shadow plane, grid, and preview guides.
```

### Prompt 2 — Koridor Penghubung Kaca Modular (`Office_Glass_Corridor.html` → `Office_Glass_Corridor.glb`)

```markdown
Create a complete, single-file standalone HTML application (must work cleanly when opened directly via file://) using Three.js r128, OrbitControls, and GLTFExporter via CDN `<script>` tags to procedurally generate, preview, and export ONE 3D PBR modular connector asset: "Office_Glass_Corridor" — a modern glass skybridge / hallway linking two office rooms.

Do NOT use module imports and do NOT reference THREE.RoundedBoxGeometry; build beveled or rounded trim using standard r128 geometries.

1. COORDINATE & SCALE CONTRACT:
   - Units: meters (1 unit = 1 m). Y is up.
   - Long axis (walkway direction) runs along X: total length 2.80 m (X = -1.40 to +1.40).
   - Width along Z: total footprint 2.00 m (Z = -1.00 to +1.00), leaving a completely unobstructed 1.40 m clear walkway down the center (Z = -0.70 to +0.70).
   - Height along Y: 3.10 m (top walking floor flush at EXACT Y = 0.00; sub-slab extends down to Y = -0.30).
   - Origin (0,0,0): Exact center of the corridor floor surface.

2. DETAILED PROCEDURAL GEOMETRY:
   - Walkway Slab & Terrazzo Runner:
     * Slate sub-slab (2.80 × 0.28 × 2.00 m, top at Y = -0.02, #18252b) + recessed brushed terrazzo center walkway mat (2.80 × 0.02 × 1.50 m, top surface at EXACT Y = 0.00) using a subtle procedural terrazzo speckle CanvasTexture (#263339, roughness 0.65).
     * Two slim warm-cyan architectural LED floor guide strips recessed along both sides of the walkway (Z = ±0.76, Y = 0.002, subtle emissive #5ed9e7).
   - North Enclosure (back side, Z = -0.92, full height 3.10 m):
     * Full-height transparent tempered glass wall (MeshStandardMaterial color #b9e3e8, transparent true, opacity 0.22, roughness 0.10, depthWrite false) divided into 2 panes with slim matte charcoal-slate aluminum mullions, bottom rail, and top header beam (#172a30, metalness 0.75, roughness 0.35).
   - South Enclosure (camera-facing side, Z = +0.92, CUTAWAY LOW BALUSTRADE):
     * Low 1.05 m half-height tempered glass safety wall with sleek top aluminum handrail at Y = 1.05 m and low floor curb (0.13 m) so isometric cameras see walking agents clearly without obstruction.
   - West End (X = -1.40, joins existing room): COMPLETELY OPEN arch portal (no door panel, avoiding airlock double-doors).
   - East End (X = +1.40, entry into Boardroom):
     * Dark anodized aluminum portal frame + ONE frameless tempered glass sliding door leaf positioned in the OPEN position (slid toward the North pocket side, leaving a 1.30 m wide clear passage) with a vertical glowing teal-accent bar handle (#5ed9e7).
   - Overhead Open Skylight Beams: 3 slim transverse dark aluminum structural roof ribs spanning across Z at Y = 3.05 m (open-top between beams for natural lighting).

3. UI & EXPORT CONTRACT:
   - Root THREE.Group named "Office_Glass_Corridor".
   - Side panel with dimensions (2.80 × 2.00 × 3.10 m), triangle count, and toggles: Wireframe, Door Slide Open/Close animation test (reset to OPEN before export), Walking Path Clearance Guide, Auto-rotate.
   - "Export GLB" button downloading "Office_Glass_Corridor.glb" (binary: true), excluding lights, grids, and preview guides.
```

### Prompt 3 — Smart TV Presentasi 85" & Video Bar (`Office_Presentation_Display_85.html` → `Office_Presentation_Display_85.glb`)

```markdown
Create a complete, single-file standalone HTML application (must work cleanly when opened directly via file://) using Three.js r128, OrbitControls, and GLTFExporter via CDN `<script>` tags to procedurally generate, preview, and export ONE 3D PBR wall-mounted AV asset: "Office_Presentation_Display_85" (85-inch 4K Commercial Smart Presentation Display with Conference Video Soundbar).

Do NOT use module imports and do NOT reference THREE.RoundedBoxGeometry; use standard r128 geometries only.

1. COORDINATE & ORIENTATION CONTRACT:
   - Units: meters (1 unit = 1 m). Y is up.
   - Orientation: Screen faces +Z. Rear VESA wall-mount backing sits flush at Z = 0.00 (so when mounted on any wall, simply position at wall face and rotate Y).
   - Origin (0,0,0): Center-rear of the display mount bracket (this makes mounting at eye/presentation height Y = 1.45 m trivial).

2. DETAILED PROCEDURAL GEOMETRY:
   - Ultra-Slim 85" Display Panel:
     * Overall screen body: Width 1.90 m (X), Height 1.08 m (Y), Depth 0.045 m (Z = +0.03 to +0.075).
     * Thin anodized dark aluminum chassis bezel (#101418, metalness 0.85, roughness 0.30) framing a 1.86 m × 1.04 m recessed active LED display screen.
     * Screen CanvasTexture & Emissive Slide Content: Draw a crisp procedural high-res (1024×576) dark-mode corporate tech presentation slide ("Q4 OFFICE AGENTS STUDIO — SPRINT & ARCHITECTURE OVERVIEW") featuring 3 clean UI cards: a glowing bar chart, a 10-agent status matrix, and a mini node architecture diagram in teal (#38bdf8), emerald (#34d399), and warm amber (#fbbf24). Apply as both map and emissiveMap (emissiveIntensity ~0.85).
   - Wall Mount & Warm Bias Backlight:
     * Slim steel VESA wall bracket assembly spanning Z = 0.00 to +0.03 (#1c2128).
     * Subtle indirect warm LED backlight bar along the rear perimeter casting a soft amber glow ring (#ffcf99, low emissive) onto walls behind it.
   - Integrated Conference Video Soundbar (mounted cleanly under the screen centered at Y = -0.63 m):
     * Sleek capsule-shaped acoustic fabric body (0.72 m wide × 0.09 m tall × 0.08 m deep, charcoal fabric texture #1b1e23, roughness 0.88) with center recessed glossy glass camera pod, blue-tinted camera lens optic, and a tiny emerald green "ACTIVE" LED dot.

3. UI & EXPORT CONTRACT:
   - Root THREE.Group named "Office_Presentation_Display_85".
   - Side panel with exact dimensions (1.90 × 1.24 × 0.11 m), triangle count, toggles: Switch Presentation Slide (Architecture / Sprint Metrics / Standby), Wall Backdrop toggle (preview only), Wireframe, Auto-rotate.
   - "Export GLB" button downloading "Office_Presentation_Display_85.glb" (binary: true), excluding preview wall, lights, and grids.
```

### Prompt 4 — Kabinet Kredenza & Station Jamuan Rapat (`Office_Boardroom_Credenza.html` → `Office_Boardroom_Credenza.glb`)

```markdown
Create a complete, single-file standalone HTML application (must work cleanly when opened directly via file://) using Three.js r128, OrbitControls, and GLTFExporter via CDN `<script>` tags to procedurally generate, preview, and export ONE 3D PBR boardroom furniture + prop asset: "Office_Boardroom_Credenza" (Modern Fluted Walnut & Dark Marble Sideboard Console with Executive Meeting Refreshment Props).

Do NOT use module imports and do NOT reference THREE.RoundedBoxGeometry; use standard r128 geometries and seeded procedural CanvasTextures.

1. COORDINATE & ORIENTATION CONTRACT:
   - Units: meters (1 unit = 1 m). Y is up.
   - Front faces +Z; origin (0,0,0) at exact floor center underneath the base frame (feet touch Y = 0.00).
   - Overall Dimensions: Width (X) = 1.80 m, Height (Y) = 0.82 m (cabinet top surface at 0.82 m), Depth (Z) = 0.45 m.

2. DETAILED PROCEDURAL GEOMETRY:
   - Architectural Credenza Cabinet:
     * Floating Base Frame: 4 slender matte black powder-coated steel tubular legs (0.14 m high) connected by a recessed shadow-line plinth rail (#14181c, metalness 0.80, roughness 0.35).
     * Main Cabinet Carcass: Dark walnut veneer box (1.80 × 0.65 × 0.45 m, sitting from Y = 0.14 to 0.79, #3d2314 with procedural CanvasTexture wood grain, roughness 0.45).
     * Three Fluted Cabinet Doors on the +Z front face: 3 individual doors separated by crisp 4 mm shadow reveals, each featuring vertical fluted wood slats and minimalist brushed champagne-brass top-edge finger pulls (#c5a880, metalness 0.88, roughness 0.28).
     * Countertop Slab: 30 mm thick honed dark Nero Marquina marble slab (Y = 0.79 to 0.82, subtle procedural dark charcoal + fine white/gold mineral vein CanvasTexture, roughness 0.25, metalness 0.05).
   - Executive Refreshment Props Group ("Props_Refreshments", toggleable in UI, exported when visible):
     * Brushed Aluminum Serving Tray (0.42 × 0.015 × 0.28 m) centered toward the left side: holds 1 cylindrical clear glass water carafe (transparent tinted glass with water level cylinder inside and cork stopper) + 4 neatly aligned glass tumblers.
     * Compact Pod Espresso Machine on the right side: sleek matte graphite & brushed chrome housing, cup rest grille, 2 stacked white ceramic espresso mugs beside it.
     * Center Display: 2 neatly stacked dark leather meeting notebooks + a sleek angled presentation tablet resting in a small aluminum dock.

3. UI & EXPORT CONTRACT:
   - Root THREE.Group named "Office_Boardroom_Credenza" containing Cabinet_Body and Props_Refreshments.
   - Side panel with dimensions, triangle count, toggles: Show/Hide Props, Wireframe, Auto-rotate, View presets (Iso, Front, Top).
   - "Export GLB" button downloading "Office_Boardroom_Credenza.glb" (binary: true), excluding studio backdrop, floor grid, and lights.
```

### Prompt 5 — Lampu Gantung Linier Arsitektural (`Office_Linear_Pendant_Light.html` → `Office_Linear_Pendant_Light.glb`)

```markdown
Create a complete, single-file standalone HTML application (must work cleanly when opened directly via file://) using Three.js r128, OrbitControls, and GLTFExporter via CDN `<script>` tags to procedurally generate, preview, and export ONE 3D PBR architectural ceiling fixture: "Office_Linear_Pendant_Light" (Minimalist Suspended Linear LED Office Chandelier).

Do NOT use module imports and do NOT reference THREE.RoundedBoxGeometry; use standard r128 geometries only.

1. COORDINATE & SCALE CONTRACT:
   - Units: meters (1 unit = 1 m). Y is up.
   - Long axis runs along X (Width = 2.60 m, Depth Z = 0.11 m).
   - Origin (0,0,0) = Floor level center directly below the light fixture (so placing at room position (x, 0, z) automatically suspends the fixture at its true architectural height!).
   - Fixture body sits cleanly at Y = 2.25 m to 2.31 m (safe head clearance over a 0.75 m table), while the thin suspension cables rise to Y = 3.20 m (wall top height).

2. DETAILED PROCEDURAL GEOMETRY:
   - Suspended Aluminum Beam Body (at Y = 2.25 to 2.31 m):
     * Main extruded horizontal channel body: 2.60 m (X) × 0.06 m (Y) × 0.11 m (Z) in matte black anodized aluminum (#12161b, metalness 0.85, roughness 0.32) with crisp champagne-gold inner lip chamfer (#c8a97e, metalness 0.88, roughness 0.25) and solid end-caps.
     * Downward Frosted Acrylic Diffuser Lens: recessed 2.54 m × 0.01 m × 0.08 m glowing strip along the bottom face (warm architectural white 3500K emissive #fff1d6, emissiveIntensity 1.4, pure emissive mesh with ZERO runtime PointLights/SpotLights inside the exported GLB so scene framerate stays fast).
     * Subtle Top Uplight Strip: slim 2.50 m × 0.006 m × 0.04 m soft warm emissive strip on the top channel face.
   - Suspension Rigging (Y = 2.31 m up to Y = 3.20 m):
     * 2 ultra-slim braided stainless steel aircraft cables (radius 0.004 m) at X = -0.95 m and X = +0.95 m rising vertically from brass cable grippers on the beam up to Y = 3.20 m.
     * 2 minimalist circular matte-black ceiling canopy discs (radius 0.055 m, thickness 0.018 m) at Y = 3.19 m.
     * 1 slim draped power cord running smoothly alongside the left suspension cable (using TubeGeometry along a gentle CatmullRomCurve3).

3. UI & EXPORT CONTRACT:
   - Root THREE.Group named "Office_Linear_Pendant_Light".
   - Side panel showing suspension height (2.25 m) and ceiling height (3.20 m), triangle count, toggles: Emissive Light On/Off, Floor & Ghost Table Height Reference (0.75 m guide slab, preview only, never exported), Wireframe, Auto-rotate.
   - "Export GLB" button downloading "Office_Linear_Pendant_Light.glb" (binary: true), excluding preview reference guides, grid, and scene lights.
```
