# Rencana Teknis Tahap 6 (Penutup Lantai 1) — Studio / Content, Focus Pods, & Digital Access Hub

Dokumen ini menjabarkan spesifikasi arsitektur final, koordinat presisi (lokal & dunia), aturan kepemilikan dinding & *ray-traced Wall Auto-Fade*, rute navigasi portal, perilaku agen, pembaruan UI/Kios, serta kontrak slot GLB untuk **Tahap 6**—tahap penutup yang menggenapkan **100% seluruh 16 zona + Jalan Utama** pada masterplan [blueprint-lantai-1-v6.2.html](./blueprint-lantai-1-v6.2.html) di `workspace/office-next`.

---

## 1. Tujuan Tahap 6 (Penyelesaian Penuh Tapak $38 \times 18.4\text{ m}$)

Tahap 6 mengisi tiga celah ruangan terakhir di Lantai 1 sehingga **tidak ada lagi dinding kaca sementara (`BUS_FRONTAGE_*`) maupun pintu bertanda `"Segera"`**:

1. **Studio / Content (`Room_StudioContent` — $6.0 \times 4.0\text{ m} = 24\text{ m}^2$):**
   - Zona produksi konten kreatif, perekaman video/demo *green screen*, fotografi aset, dan meja *color-grading / rendering*, terletak di baris utara kedua ($X: +15.0 .. +21.0\text{ m}$, $Z: -5.0 .. -1.0\text{ m}$) tepat di antara **Ruang Rapat** (barat) dan **Information Wall** (timur), diakses langsung dari pintu utara barat **Collaboration Commons** ($X = +18.0\text{ m}$).
2. **Focus Pods (`Room_FocusPods` — $4.0 \times 6.0\text{ m} = 24\text{ m}^2$):**
   - Ruang tenang kedap suara di sisi selatan Jalan Utama ($X: +14.0 .. +18.0\text{ m}$, $Z: +7.4 .. +13.4\text{ m}$), tepat di antara **Lounge** (barat) dan **Server / IT** (timur), berisi 2 bilik kerja fokus tunggal (*solo deep-work pods*) berindikator status sibuk untuk sesi *coding / debugging / riset* mendalam.
3. **Digital Access Hub (`Room_AccessHub` — $4.0 \times 6.0\text{ m} = 24\text{ m}^2$):**
   - Gerbang arsitektural tenggara gedung ($X: +27.0 .. +31.0\text{ m}$, $Z: +7.4 .. +13.4\text{ m}$) di sebelah timur **Digital Garden**, memuat portal lift *stainless/bronze*, tangga melayang menuju *mezzanine* **Lantai 2** (ekspansi masa depan), serta totem peta masterplan interaktif seluruh gedung.

---

## 2. Pemetaan Koordinat 3D & Kepemilikan Dinding (`1 unit = 1 m`)

Mengacu pada rumus baku `worldX = tapakX - 7.0`, `worldZ = tapakZ - 5.0`:

### A. Tabel Tapak & Pusat Ruangan

| Layer Ruangan | Ukuran ($W \times D$) | Rentang Dunia `X` | Rentang Dunia `Z` | Pusat Dunia (`origin`) | `halfX × halfZ` | Lantai Bersih Lokal (`inner`) |
|---|---|---|---|---|---|---|
| **`Room_StudioContent`** | $6.0 \times 4.0\text{ m}$ | `+15.0 .. +21.0` | `-5.0 .. -1.0` | `(+18.0, 0, -3.0)` | `3.0 × 2.0` | `X: -2.76..+3.00`, `Z: -1.76..+2.00` |
| **`Room_FocusPods`** | $4.0 \times 6.0\text{ m}$ | `+14.0 .. +18.0` | `+7.4 .. +13.4` | `(+16.0, 0, +10.4)` | `2.0 × 3.0` | `X: -2.00..+2.00`, `Z: -2.76..+2.76` |
| **`Room_AccessHub`** | $4.0 \times 6.0\text{ m}$ | `+27.0 .. +31.0` | `+7.4 .. +13.4` | `(+29.0, 0, +10.4)` | `2.0 × 3.0` | `X: -2.00..+1.76`, `Z: -2.76..+2.76` |

### B. Audit Kepemilikan Dinding, *Frontage*, & *Ray-Traced Wall Auto-Fade*

Seluruh interaksi dinding tetangga dan proyeksi sudut pandang kamera ortografis Tenggara (`ISO_OFFSET = (18, 12.95, 20)`) telah diperiksa terhadap kode aktual:

1. **Penutupan 100% *Frontage* Sementara Jalan Utama (`layout.ts`):**
   - Pada `BUS_FRONTAGE_SOUTH`, ubah segmen `focus` (`xMin: 14, xMax: 18`) dan `access` (`xMin: 27, xMax: 31`) menjadi **`built: true`**.
   - Dengan perubahan ini, seluruh segmen di `BUS_FRONTAGE_SOUTH` dan `BUS_FRONTAGE_NORTH` bernilai `built: true`, sehingga `openRuns()` di `mainCorridor.ts` menghasilkan array kosong (`[]`)—seluruh dinding kaca sementara Jalan Utama resmi tergantikan oleh dinding ruangan permanen.

2. **`Room_StudioContent` & Penyesuaian Tetangga (`northWing.ts`, `collabCommons.ts`, `infoWall.ts`):**
   - **Utara (`Z = -5.00..-4.76`):** Dinding luar utara gedung (`interior: false` → **tetap solid 100%** dari kamera Tenggara). Menjadi bidang utama *cyclorama green screen* dan meja produksi.
   - **Barat (`X = 15.00..15.24, Z = -4.76..-1.00`):** Sisi timur laut Ruang Rapat (`Z = -5..-1`) hanya memiliki `Curb_East` setinggi `0.13 m`. Oleh karena itu, Studio membangun dinding baratnya sendiri melalui `buildNorthTierShell` (tambahkan opsi `sideMats?: { west?: SolidWallMaterials; east?: SolidWallMaterials }` pada `buildNorthTierShell` di `northWing.ts` agar memakai `boardroomWallMats()`), dan **wajib didaftarkan `interiorSides: ['west']` (`interior: true`)** agar selalu memudar dan tidak menutupi `plantNE`, `whiteboard`, maupun sisi timur kredenza Ruang Rapat.
   - **Timur (`X = 21.0`):** `sides: { east: false }` karena dinding di `X = 21.00..21.24` sudah dibangun oleh `Room_InfoWall` (`infoWall.ts`). Pada `infoWall.ts:53`, ubah `interiorSides: ['east']` menjadi **`interiorSides: ['west', 'east']`**—karena `Kanban_Board` sudah ditempel ke `walls.west` (`infoWall.ts:105`), dinding barat InfoWall beserta papan kanban otomatis ikut memudar di tampilan rumah boneka sehingga sisi timur Studio terlihat lega!
   - **Selatan (`Z = -1.0`, milik `Room_CollabCommons`):**
     - Di `collabCommons.ts`, ruas barat dinding utara (`north_west`, `X = 15..21`) kini berbatasan langsung dengan Studio, sehingga diubah menjadi **`interior: true, openDoors: true`** (kedua pintu utara `northDoors[0]` di `X = 17.5..18.5` dan `northDoors[1]` di `X = 22.5..23.5` kini terbuka penuh dengan pelat `threshold`; seluruh kode `Future_Door_Leaf_0`, kaca intip, gagang, dan papan `"STUDIO / CONTENT · Segera · Tahap 6"` dihapus!).
     - Tulisan dinding `Wall_Title_Collaboration_Commons` tetap menjadi anak dinding utara Commons sehingga ikut memudar halus (`0.15`) di mode isometrik dan tampil utuh di mode jalan kaki Free Cam.
     - **Relokasi `COMMONS.whiteboard` (`Office_Whiteboard_Scrum.glb`, tinggi `1.80 m`):** Di posisi Tahap 5 `(19.75, -0.42)`, proyeksi kamera Tenggara (`ΔX = -2.50, ΔZ = -2.78`) menjatuhkan bayangan visual whiteboard ke `X = 16.4..18.8, Z = -3.2` (tepat menutupi kamera & meja Studio). Pindahkan `COMMONS.whiteboard` ke sisi barat daya Commons di lokal **`x = -4.35, z = +1.65, rotY = +π/2`** (dunia `(15.65, +3.65)` menghadap Timur ke meja kolaborasi; geser `COMMONS.snakePlant` sedikit dari `(-4.40, +0.60)` ke `(-4.40, +0.20)`). Pada posisi baru ini, proyeksi ke barat laut jatuh di karpet kosong selatan Ruang Rapat (`Z = +0.87..+2.49`, di selatan seluruh kursi rapat) sehingga tidak menutupi apa pun!

3. **`Room_FocusPods` (`buildSouthRoomShell`):**
   - **Barat (`X = 14.0`) & Timur (`X = 18.0`):** Dinding timur Lounge (`X = 13.76..14.00`, `lounge_east`) dan dinding barat Server (`X = 18.00..18.24`, `server_west`) **sudah ada dan keduanya sudah `interior: true`**. Maka `FocusPods` memakai **`sides: { west: false, east: false }, interiorSides: []`** (persis seperti Lobi di antara Manajer & Pantry), menghasilkan lebar bersih penuh `4.00 m` (`X: -2.00..+2.00`).
   - **Utara (`Z = 7.40..7.64`):** Kaca berasap dengan *privacy band* akustik (`glassBand: { yMin: 0.95, yMax: 1.75 }`, memakai `smokedGlassWallMats()` seperti Ruang Manajer) + pintu kaca geser otomatis `1.4 m` (`northDoor: { xMin: -0.7, xMax: 0.7 }`, pusat dunia `X = 16.0 = 23.0 m` tapak).
   - **Selatan (`Z = 13.16..13.40`):** Dinding luar selatan gedung (`interior: false`, memudar otomatis dari kamera Tenggara).

4. **`Room_AccessHub` (`buildSouthRoomShell`):**
   - **Barat (`X = 27.0`):** Dinding timur Digital Garden (`X = 26.76..27.00`, `garden_east`, `interior: true`) **sudah ada**. Maka `AccessHub` memakai **`sides: { west: false }, interiorSides: []`**.
   - **Timur (`X = 30.76..31.00`) & Selatan (`Z = 13.16..13.40`):** Dinding perimeter luar tenggara gedung (`interior: false` → keduanya otomatis memudar dari kamera Tenggara dan menjadi solid bila di-orbit dari Barat/Utara).
   - **Utara (`Z = 7.40..7.64`):** Dinding kaca bening + pintu kaca geser ganda otomatis `1.6 m` (`northDoor: { xMin: -0.8, xMax: 0.8 }`, pusat dunia `X = 29.0 = 36.0 m` tapak).
   - **Perlindungan Pandangan Bangku Digital Garden (`Teak_Bench` di `X = 24.55..26.35, Z = 11.32`):** Benda tinggi di sisi barat `AccessHub` diletakkan hanya di **separuh utara** (Portal Lift di `Z = 8.45..10.15`), sedangkan separuh selatan sisi barat hanya diisi Totem Peta rendah (`tinggi 1.25 m`), dan Tangga Lantai 2 diletakkan di **kuadran tenggara** (`X = 29.40..30.65`) sehingga proyeksi sinar kamera Tenggara (`ΔX = -2.15 m` pada tinggi kepala duduk) tetap berada di timur `X = 27.0` dan sama sekali tidak menutupi agen yang sedang duduk di bangku taman!

---

## 3. Rincian Desain Interior & Koordinat Lokal Tiap Ruangan

### A. Studio / Content (`src/stage/rooms/studioContent.ts` — pusat dunia `(18.0, -3.0)`)

Lantai bersih lokal: `X: -2.76..+3.00` (`5.76 m`), `Z: -1.76..+2.00` (`3.76 m`). Pintu selatan dari Commons berpusat di lokal `x = 0.0` (dunia `X = 18.0`).

- **Lantai:** Vinyl studio matte abu-abu gelap anti-pantul (*matte charcoal studio floor*) dengan garis penanda zona pengambilan gambar kuning tipis.
- **Zona Barat Laut — Panggung *Cyclorama Green Screen* (`Office_Studio_Cyclorama_Stage.glb`, $2.60 \times 2.35 \times 1.75\text{ m}$):**
  - Dipasang rata muka dinding utara solid di lokal `x = -1.25, z = -1.76, rotY = 0` (origin belakang-bawah-tengah: rentang `X: -2.55..+0.05`, `Z: -1.76..-0.01`, bebas `0.21 m` dari dinding barat).
  - Berupa lengkungan *chroma-key green* (`#1fa855`) mulus dari dinding ke lantai (*coved floor*), palang *truss* atas dengan 2 lampu sorot *Fresnel* ber-*barn-door*, dan tanda silang putih `"✕"` di lantai panggung.
  - **Titik Berdiri Talent / Model di Atas *Green Screen* (`sitY = 0`, `approach === spot`):** `(-1.25, -0.72, rotY: 0)` (menghadap Selatan `+Z` ke arah kamera syuting & kamera Tenggara; panggung melengkung di bawah kaki setebal `≤ 12 mm` sehingga sepatu tidak tenggelam).
- **Zona Barat Daya — Rig Kamera Sinema & *Softbox* (`Office_Studio_Camera_Softbox_Rig.glb`, $1.30 \times 1.68 \times 0.80\text{ m}$):**
  - Dipasang di depan panggung pada lokal `x = -1.25, z = +0.52, rotY = π` (menghadap Utara ke arah *green screen*; rentang `X: -1.90..-0.60`, `Z: +0.12..+0.92`).
  - Memuat kamera sinema digital di atas tripod *fluid-head* dengan layar monitor sutradara kecil bercahaya di sisi belakangnya, diapit *octagonal softbox keylight* di sisi samping.
  - **Titik Berdiri Sutradara / Kameramen (`sitY = 0`, `approach === spot`):** `(-1.25, +1.35, rotY: π)` (berdiri di belakang kamera menghadap Utara).
- **Zona Timur Laut — Meja Produksi & *Color-Grading* (`Office_Studio_Production_Desk.glb`, $1.65 \times 1.18 \times 0.72\text{ m}$):**
  - Dipasang rata dinding utara solid di lokal `x = +1.85, z = -1.76, rotY = 0` (origin belakang-bawah-tengah: rentang `X: +1.025..+2.675`, `Z: -1.76..-1.04`, meja kerja setinggi `0.75 m` menghadap `+Z` ke kursi editor).
  - Memuat 2 monitor referensi *color-grading* + layar *preview render* 3D (menghadap `+Z` Selatan sehingga layar langsung terbaca dari kamera Tenggara!), sepasang speaker monitor studio, dan papan kontrol *colorist/audio*.
  - Kursi editor (pakai ulang `Office_Ergonomic_Chair.glb`): di `spot = (+1.85, -0.58, rotY: π)` (`sitY = 0.45`), `approach = (+1.85, +0.10)`.
- **Dekorasi & Pencahayaan:**
  - `Office_Indoor_Plant_SnakePlant.glb` di sudut tenggara `(+2.58, +1.55)`.
  - 1 `PointLight` *daylight* bersih (`0xf4f8ff`) di atas zona syuting `(-1.25, 2.55, -0.20)` dan 1 `PointLight` hangat lembut di zona editing `(+1.85, 2.50, -0.60)`.
- **Jalur Navigasi Lokal (`studioPath`):**
  - Koridor selatan `z = +1.45` tersambung ke lorong vertikal tengah `x = +0.42` (`0.37 m` di timur *green screen* `+0.05` dan `0.605 m` di barat meja produksi `+1.025`), dengan cabang siku ke panggung talent `(+0.42, -0.72) ↔ (-1.25, -0.72)` sehingga talent memutari rig kamera lewat lorong tengah tanpa pernah menyentuh tripod/softbox!

---

### B. Focus Pods (`src/stage/rooms/focusPods.ts` — pusat dunia `(16.0, 10.4)`)

Lantai bersih lokal: `X: -2.00..+2.00` (`4.00 m`), `Z: -2.76..+2.76` (`5.52 m`). Pintu geser kaca utara berpusat di `(0.0, -2.76)`.

- **Lantai:** Karpet akustik wol tebal warna biru-batu tenang (*deep slate-navy acoustic carpet*) dengan strip kayu walnut penanda zona hening.
- **Sisi Barat (menghadap Timur `+X` ke arah kamera Tenggara) — 2× Bilik Fokus Tunggal (`Office_Focus_Solo_Pod.glb`, $1.36 \times 1.48 \times 1.16\text{ m}$):**
  - Desain *open-top architectural focus alcove* setinggi `1.48 m` (tanpa atap penutup agar avatar yang sedang mengetik di dalamnya, monitor lengkung 34", dan lampu meja hangatnya terlihat jelas dari kamera Tenggara!). Punggung akustik + meja kerja melengkung berada di `-Z` lokal, jendela kaca akustik vertikal di dinding samping, pintu masuk terbuka penuh di `+Z` lokal, dan bilah indikator status **`Focus_Status_LED`** (`MeshStandardMaterial`, hijau emerald `#34d399` = kosong, merah koral/amber `#f43f5e` = *Deep Focus*) di ambang atas.
  - Dipasang dengan **`rotY = +π/2`** sehingga pintu masuk `+Z` menghadap Timur (`+X` ruangan):
    1. **Focus Pod Utara (`Focus_Pod_0`):** pusat di `x = -1.36, z = -0.85, rotY = +π/2` (rentang `X: -1.94..-0.78`, `Z: -1.53..-0.17`, bebas `6 cm` dari dinding barat).
       - Titik duduk: `spot = (-1.18, -0.85, rotY: -π/2)` (menghadap meja Barat, `sitY = 0.35` untuk dudukan kursi/bangku terintegrasi `0.45 m`), `approach = (+0.15, -0.85)`.
    2. **Focus Pod Selatan (`Focus_Pod_1`):** pusat di `x = -1.36, z = +1.35, rotY = +π/2` (rentang `X: -1.94..-0.78`, `Z: +0.67..+2.03`).
       - Titik duduk: `spot = (-1.18, +1.35, rotY: -π/2)` (`sitY = 0.35`), `approach = (+0.15, +1.35)`.
- **Celah Antar-Pod & Dekorasi:**
  - Tanaman Snake Plant (`Office_Indoor_Plant_SnakePlant.glb`) di celah antara Pod 0 dan Pod 1 `(-1.55, +0.25)` serta di sudut tenggara `(+1.55, +2.30)`.
  - Tulisan akustik tenang `"QUIET ZONE · DEEP FOCUS"` di muka barat di atas celah antar-pod (`x = -1.98, y = 2.15, z = +0.25`, menghadap Timur).
- **Jalur Navigasi Lokal (`focusPodsPath`):**
  - `polylineLane([{ x: 0, z: -2.35 }, { x: 0.85, z: -2.35 }, { x: 0.85, z: 1.65 }])`: koridor timur selebar `1.90 m` yang sangat lega untuk keluar-masuk kedua pod.

---

### C. Digital Access Hub (`src/stage/rooms/accessHub.ts` — pusat dunia `(29.0, 10.4)`)

Lantai bersih lokal: `X: -2.00..+1.76` (`3.76 m`), `Z: -2.76..+2.76` (`5.52 m`). Pintu geser ganda utara berpusat di `(0.0, -2.76)`.

- **Lantai:** Ubin batu kuarsa teraso terang (*architectural terrazzo stone tile*) dengan garis pandu logam kuningan/cyan menuju lift dan tangga.
- **1. Sisi Barat Utara — Portal Lift Lantai 2 (`Office_Access_Elevator_Portal.glb`, $1.70 \times 2.45 \times 0.28\text{ m}$):**
  - Dipasang rata muka dinding barat di lokal `x = -2.00, z = -1.10, rotY = +π/2` (origin belakang-bawah-tengah: rentang `X: -2.00..-1.72`, `Z: -1.95..-0.25`, menghadap **Timur `+X`** langsung ke kamera Tenggara!).
  - Memuat kusen baja *brushed champagne-bronze*, pintu belah ganda *satin stainless*, layar indikator lantai digital bercahaya di ambang atas (`"L1 · LANTAI UTAMA  ▲ L2"`), dan panel tombol panggil berlampu di sisi kanan.
  - Titik berdiri inspeksi/tunggu lift (`sitY = 0`, `approach === spot`): `(-1.05, -1.10, rotY: -π/2)`.
- **2. Sisi Barat Selatan — Totem Meja Peta Gedung Interaktif (`Office_Access_Floor_Map_Totem.glb`, $0.95 \times 1.25 \times 0.55\text{ m}$):**
  - Dipasang di lokal `x = -1.42, z = +1.25, rotY = +π/2` (rentang `X: -1.695..-1.145`, `Z: +0.775..+1.725`, tinggi rendah `1.25 m` sehingga bangku jati Digital Garden di baratnya tetap 100% terlihat!).
  - Layar miring 30° (`rotation.x = -π/6`) menghadap Timur (`+X`) dengan mesh layar datar bernama **`Access_Map_Screen`** (`0.82 × 0.48 m`, pusat lokal `(0, 1.04, 0.02)`). *(Catatan implementasi: karena layar miring terhadap sumbu X, salin `position` & `quaternion` lokal mesh `Access_Map_Screen` lalu `translateZ(0.004)` pada overlay `AccessMapScreen`—jangan memakai `fitOverlay` khusus bidang vertikal)*, menampilkan peta 16 zona Lantai 1 berstatus `"16 / 16 ZONA AKTIF"` + pratinjau `"LANTAI 2 · EKSPANSI AGEN BARU"`.
  - Titik berdiri pembaca peta (`sitY = 0`, `approach === spot`): `(-0.62, +1.25, rotY: -π/2)`.
- **3. Kuadran Tenggara — Tangga Melayang *Mezzanine* Lantai 2 (`Office_Access_Floor2_Staircase.glb`, $1.25 \times 2.35 \times 2.20\text{ m}$):**
  - Dipasang di lokal `x = +1.02, z = +1.45, rotY = 0` (rentang `X: +0.395..+1.645`, `Z: +0.35..+2.55`, bebas `11.5 cm` dari dinding timur & `21 cm` dari dinding selatan).
  - Anak tangga kayu oak melayang di atas *stringer* baja hitam naik dari utara (`z = +0.35`) ke bordes *mezzanine* (`Y = 1.55 m`) di selatan dengan pagar kaca *tempered*, gerbang pembatas *stainless* tertutup bertuliskan `"LANTAI 2 · SEGERA"`, dan pencahayaan *step-LED* hangat.
- **Dekorasi & Pencahayaan:**
  - Tanaman Monstera (`Office_Indoor_Plant.glb`) di sudut timur laut `(+1.30, -2.20)`.
  - Lampu plafon cincin arsitektural hangat (serasi dengan Lobi) di `(0.0, 2.85, -0.40)`.
- **Jalur Navigasi Lokal (`accessHubPath`):**
  - `polylineLane([{ x: 0, z: -2.35 }, { x: 0, z: -1.10 }, { x: -0.25, z: 1.25 }])`: koridor tengah bersih di antara zona barat (`x <= -1.145`) dan tangga timur (`x >= +0.395`).

---

## 4. Konektor Portal Gedung (`src/stage/navigation.ts`)

Seluruh portal ditulis dalam **koordinat LOKAL masing-masing ruangan** (berada di dalam ruangan, bukan di garis dinding):

```ts
// Tambahan pada FLOOR1_PORTALS di navigation.ts:
/** Commons ↔ Studio lewat ROOM_COMMONS.northDoors[0]: dunia (18.0, -0.35) ↔ (18.0, -1.45). */
commonsNorthStudio: { x: mid(ROOM_COMMONS.northDoors[0]!), z: -NORTH_ROOM_DOOR_INSIDE_Z }, // (-2.0, -2.35)
studioSouth:        { x: (ROOM_COMMONS.origin.x + mid(ROOM_COMMONS.northDoors[0]!)) - ROOM_STUDIO.origin.x, z: NORTH_TIER_SOUTH_DOOR_INSIDE_Z }, // (0, 1.55)

/** Jalan Utama ↔ Focus Pods: dunia (16.0, 6.2) ↔ (16.0, 8.05). */
busFocusDoor: { x: busX(ROOM_FOCUS.origin.x + mid(ROOM_FOCUS.northDoor)), z: 0 }, // (4.0, 0)
focusNorth:   { x: mid(ROOM_FOCUS.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },      // (0, -2.35)

/** Jalan Utama ↔ Digital Access Hub: dunia (29.0, 6.2) ↔ (29.0, 8.05). */
busAccessDoor: { x: busX(ROOM_ACCESS.origin.x + mid(ROOM_ACCESS.northDoor)), z: 0 }, // (17.0, 0)
accessNorth:   { x: mid(ROOM_ACCESS.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },       // (0, -2.35)
```

Konektor baru pada `createBuildingNav(...)` di `IsometricOfficeStage.tsx`:
- `{ id: 'commons-studio', a: { room: 'commons', portal: FLOOR1_PORTALS.commonsNorthStudio }, b: { room: 'studio', portal: FLOOR1_PORTALS.studioSouth } }`
- `{ id: 'bus-focus', a: { room: 'bus', portal: FLOOR1_PORTALS.busFocusDoor }, b: { room: 'focus', portal: FLOOR1_PORTALS.focusNorth } }`
- `{ id: 'bus-access', a: { room: 'bus', portal: FLOOR1_PORTALS.busAccessDoor }, b: { room: 'access', portal: FLOOR1_PORTALS.accessNorth } }`

---

## 5. Perilaku Agen, Kamera, & Kios Direktori (100% Lantai 1 Lengkap)

1. **Tiga Rutinitas Baru (`IsometricOfficeStage.tsx` & `officeDialogues.ts`, dapat disela pekerjaan nyata via `COFFEE_STATES`):**
   - **Produksi Konten di *Studio* (`kind: 'studio'`):** Setiap `110–165 dtk`, `1–2` agen kreatif/visual (diutamakan Wulan, Tari, Dimas, Gita, atau Fajar) masuk ke Studio lewat Commons: satu agen duduk di meja *color-grading/render* (`pose: 'type'`) atau mengoperasikan kamera (`pose: 'inspect'`), dan bila berdua, rekan satunya berdiri di tanda `"✕"` *green screen* (`pose: 'lounge'` / bergestur presentasi) selama `20–28 dtk`.
   - **Sesi *Deep Focus* di *Focus Pods* (`kind: 'focus'`):** Setiap `85–130 dtk`, 1 agen teknis/riset yang sedang santai (Bima, Gita, Satria, Sari, Fajar, atau Laras) masuk ke salah satu bilik `Focus_Pod` yang kosong, menyalakan lampu status pod menjadi merah/amber (`#f43f5e`), dan fokus mengetik (`pose: 'type'`, `sitY = 0.35`) selama `22–32 dtk`.
   - **Kunjungan *Digital Access Hub* (`kind: 'access'`):** Setiap `130–190 dtk`, 1 agen (sering Raka, Sari, atau Fajar) berjalan ke `AccessHub` untuk mengecek peta ekspansi gedung 16 zona (`pose: 'inspect'`) lalu menengok indikator portal Lantai 2 sebelum kembali ke meja. *(Jangan lupa panggil `focusPods.update(dt, agentPts)` dan `accessHub.update(dt, agentPts)` di loop animasi agar pintu geser otomatis keduanya membuka mulus saat agen mendekat!)*
   - **Debug Hooks (`window.__officeStageDebug`):** Tambahkan `studio(ids?)`, `focusPod(id?, podIdx?)`, `access(id?)`, dan perluas `errandState()` dengan `{ studio, focus, access }`.
2. **Kamera, HUD, & Layar Komando (`App.tsx`, `lobbyReception.ts`, `infoWall.ts`):**
   - Bingkai kamera awal (`setHomeBox`) tetap menjaga area inti barat–tengah (`X = -7..15`) pada *zoom* `0.63`.
   - Dropdown `"Fokus: ruangan"` di `App.tsx` kini lengkap memuat **17 entri** (Jalan Utama + **16 ruangan**), dan teks status header diperbarui menjadi `"Lantai 1 · Jalan Utama + 16 ruangan"`.
   - Kios Direktori Lobi (`lobbyReception.ts`): denah mini atas kini menggambar lengkap seluruh **16 ruangan** tanpa celah kosong, dan tabel kehadiran 2 kolom menampilkan **15 ruangan** (seluruh ruangan di luar Meeting Foyer) yang muat rapi di dalam kapasitas 16 slot grid 2 kolom.
   - Kolom `"ZONA LANTAI 1"` pada `InfoWallScreen` (`infoWall.ts`): tingkatkan kapasitas baris dari 12 ke **15 ruangan** (mis. tinggi baris `22 px` atau kompak) agar Studio, Focus Pods, dan Access Hub ikut tercatat!

---

## 6. Kontrak Slot Model 3D Baru Tahap 6 (7 Slot GLB)

Tahap 6 menggunakan placeholder prosedural berdimensi kontrak terlebih dahulu melalui `mountAsset()`, siap digantikan oleh 7 file GLB berikut:

| No | Slot GLB Baru | Ukuran Kontrak ($W \times H \times D$) | Origin `(0,0,0)` & Orientasi Lokal | Ruangan & Rotasi |
|---|---|---|---|---|
| 1 | `Office_Studio_Cyclorama_Stage.glb` | $2.60 \times 2.35 \times 1.75\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); lengkung *green screen* menghadap `+Z` *(ketebalan lantai panggung di `(0, 1.04)` $\le 12\text{ mm}$)* | Studio, `rotY = 0°` |
| 2 | `Office_Studio_Camera_Softbox_Rig.glb` | $1.30 \times 1.68 \times 0.80\text{ m}$ | Lantai tengah; lensa kamera & muka *softbox* menghadap `+Z`, layar *viewfinder* operator di `-Z` | Studio, `rotY = 180°` |
| 3 | `Office_Studio_Production_Desk.glb` | $1.65 \times 1.18 \times 0.72\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); permukaan meja `0.75 m`, dual monitor menghadap `+Z` (tanpa kursi) | Studio, `rotY = 0°` |
| 4 | `Office_Focus_Solo_Pod.glb` | $1.36 \times 1.48 \times 1.16\text{ m}$ *(2×)* | Lantai tengah; meja + monitor 34" di `-Z`, dudukan terintegrasi `0.45 m`, **terbuka di `+Z` & tanpa atap**, mesh `Focus_Status_LED` di atas | Focus Pods, `rotY = +90°` |
| 5 | `Office_Access_Elevator_Portal.glb` | $1.70 \times 2.45 \times 0.28\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); pintu lift & indikator `"L1 ▲ L2"` menghadap `+Z` | Access Hub, `rotY = +90°` |
| 6 | `Office_Access_Floor_Map_Totem.glb` | $0.95 \times 1.25 \times 0.55\text{ m}$ | Lantai tengah; layar miring menghadap `+Z` dengan mesh datar `Access_Map_Screen` (`0.82 × 0.48 m`) | Access Hub, `rotY = +90°` |
| 7 | `Office_Access_Floor2_Staircase.glb` | $1.25 \times 2.35 \times 2.20\text{ m}$ | Lantai tengah; anak tangga mulai naik dari `-Z` menuju bordes *mezzanine* (`Y = 1.55 m`) di `+Z` | Access Hub, `rotY = 0°` |

**Aset Eksisting yang Dipakai Ulang:**
- `Office_Ergonomic_Chair.glb` (kursi meja produksi Studio)
- `Office_Indoor_Plant.glb` & `Office_Indoor_Plant_SnakePlant.glb` (tanaman sudut Studio, Focus Pods, & Access Hub)

---

## 7. Daftar Periksa Verifikasi Tahap 6 (Penyelesaian Lantai 1)

- [ ] `npm run typecheck` lulus di keempat workspace (`shared`, `server`, `web`, `office-next`).
- [ ] `npm test` lulus 100% (64 tes).
- [ ] `npm run build:next` dan `npm run build:next:demo` berhasil tanpa error.
- [ ] Seluruh segmen `BUS_FRONTAGE_SOUTH` & `BUS_FRONTAGE_NORTH` bernilai `built: true` (0 dinding kaca sementara tersisa, 0 papan `"Segera · Tahap ..."` tersisa di Lantai 1).
- [ ] Simulasi 600 detik menguji seluruh ruangan Tahap 1–6 (termasuk Studio, Focus Pods, Access Hub, pintu geser otomatis baru, dan relokasi whiteboard Commons) dengan **0 tabrakan dinding/perabot** dan tidak ada agen macet.
- [ ] Kamera Tenggara memperlihatkan isi Studio (`commons_north_west`, `studio_west`, dan `infowall_west` + kanban memudar), kedua Focus Pods, serta Portal Lift & Tangga Lantai 2 di Access Hub tanpa menutupi agen di bangku Digital Garden.
- [ ] Kios Direktori Lobi (15 ruangan, 2 kolom), `InfoWallScreen` (15 ruangan), dan dropdown fokus HUD (17 pilihan) tampil utuh tanpa teks terpotong.

---

## 8. Koreksi Analisa, Koordinat Final, & Status Implementasi (18 November 2026)

Tahap 6 selesai: **Lantai 1 lengkap 16 / 16 zona + Jalan Utama**. Seluruh `BUS_FRONTAGE_SOUTH/NORTH` bernilai `built: true`. Tidak ada lagi dinding kaca sementara maupun papan "Segera · Tahap ..." di Lantai 1. Satu-satunya papan "Segera" yang tersisa adalah gerbang Lantai 2 di tangga, dan itu memang disengaja.

### A. Koreksi terhadap rencana (§2–§5)

1. **Focus Pods: bilik diputar 45°, bukan +90°.** Dengan rotY +90° (mulut ke Timur), sirip depan dan *brow* bilik menutupi agen yang duduk dari kamera Tenggara (elevasi ±26°, azimut ±42°). Yang terlihat hanya penanda di atas kepala. Mulut ke Selatan (rotY 0) juga sama tertutupnya. Hanya mulut serong 45° (searah kamera) yang memperlihatkan agen yang mengetik beserta monitor 34"-nya. Bilik dipindah ke `(-1.05, -1.0)` dan `(-1.05, +1.3)` agar muat. Titik duduk dan titik berdiri dihitung dari rotY bilik.
2. **Focus Pods: titik berdiri (approach).** Rencana menulis `(+0.15, z)`, sehingga agen akan meluncur 1,33 m dalam 0,4 dtk saat duduk. Kini agen berdiri 0,36 m di depan mulut bilik (lokal bilik z +0,94), lalu meluncur 0,76 m ke dudukan (lokal z +0,18).
3. **Access Hub: tangga dipindah ke kuadran timur laut dan diputar 180°.** Di kuadran tenggara, bordes 2,35 m berada tepat di garis pandang agen yang membaca totem peta. Agen itu tertutup bordes dan rangka hitam. Kini tangga berada di `(1.02, -1.2)` dengan rotY π:
   - Anak tangga pertama di selatan (z −0,16).
   - Bordes dan gerbang "Lantai 2" di utara, plakat `-Z` GLB menghadap kamera dan pendaki.
   - Tangga tidak menutupi lift, totem, maupun bangku Garden.
   - Monstera pindah ke sudut tenggara `(1.3, 2.25)`.
4. **Studio: kursi editor `z -0.58` → `-0.72`.** Kursi di −0,58 berjarak 0,46 m dari tepi meja (z −1,04), sehingga tangan avatar tidak sampai ke keyboard. Kini jaraknya 0,32 m, sama dengan kursi Commons. Approach dipindah ke `(1.85, 0.05)`.
5. **Studio: lorong digabung jadi satu polyline.** `polylineLane` tidak mendukung simpang T (koridor + cabang). Lorongnya kini `(-1.25, 1.45) → (0.42, 1.45) → (0.42, -0.72) → (-1.25, -0.72)`. Editor tersambung lurus dari lorong tengah.
6. **Tangga: bordes 1,52 m** (mengikuti `tahap-6-3d-prompts.md`), bukan 1,55.
7. **Material Auto-Fade.** `WallFader` mengkloning material dinding saat didaftarkan. Karena itu lampu "ON AIR" di dinding utara Studio diwarnai lewat material mesh yang aktif, bukan referensi material awal.
8. **Tulisan dinding yang ikut memudar.** Dinding utara Commons kini selalu memudar. Akibatnya tulisan "COLLABORATION COMMONS" (15%) tampak samar menimpa green screen Studio. `WallFader` kini mendukung `userData.fadeHide`: papan atau tulisan dinding hilang penuh saat dindingnya memudar penuh, dan tampil utuh di mode jalan kaki. Ini dipakai untuk judul Commons dan papan "QUIET ZONE" Focus Pods.
9. **Papan "QUIET ZONE".** Dinding barat Focus Pods adalah dinding timur Lounge, yang selalu memudar. Papan di-*attach* ke dinding itu (`focusPods.attachSign(...)` sebelum `lounge.bindWalls()`), bukan dibiarkan melayang.
10. **Pose talent.** Pose `lounge` hanya bergestur bila agen duduk (k ≥ 1). Karena itu ditambahkan pose baru **`present`**: berdiri, satu tangan bergestur saat bicara. Pose ini dipakai talent di green screen.
11. **Peran Studio.** Bila 2 agen datang, satu menjadi kameramen (`inspect`, di belakang rig) dan satu menjadi talent (`present`, di tanda ✕). Bila 1 agen, ia menjadi editor (`type`, duduk). Lampu "ON AIR" menyala selama talent berdiri di tanda ✕.
12. **Access Hub.** Kunjungan terdiri dari 2 titik: totem peta (9–13 dtk), lalu portal lift (5–8 dtk). Tombol panggil lift (scene) menyala saat agen menunggu.
13. **Totem.** Kanvas peta menampilkan 16 zona beserta jumlah agen live per ruangan dan "Anda di sini". Overlay disalin dari transform `Access_Map_Screen` relatif ke slot, lalu digeser 4 mm searah normal.

Yang dikonfirmasi sesuai rencana: kepemilikan dinding & Auto-Fade (§2.B), relokasi whiteboard Commons ke `(-4.35, 1.65, rotY π/2)` (bayangan pandangnya jatuh di karpet kosong selatan ruang rapat, tidak menutupi apa pun), portal & konektor (§4), jadwal rutinitas (§5), dan kios / InfoWall / dropdown.

### B. Koordinat final (lokal ruangan → dunia)

| Titik | Lokal | Dunia |
|---|---|---|
| Studio: talent (✕, berdiri, menghadap S) | `(-1.25, -0.72)` | `(16.75, -3.72)` |
| Studio: kameramen (berdiri, menghadap U) | `(-1.25, 1.35)` | `(16.75, -1.65)` |
| Studio: editor (duduk, `sitY 0.45`) | `(1.85, -0.72)` | `(19.85, -3.72)` |
| Focus Pod 0 / 1: pusat, rotY π/4 | `(-1.05, -1.0)` / `(-1.05, 1.3)` | `(14.95, 9.4)` / `(14.95, 11.7)` |
| Focus Pod 0 / 1: duduk (`sitY 0.35`) | pusat + 0,18 ke arah mulut | `(15.08, 9.53)` / `(15.08, 11.83)` |
| Access: pembaca totem | `(-0.62, 1.25)` | `(28.38, 11.65)` |
| Access: penunggu lift | `(-1.05, -1.1)` | `(27.95, 9.3)` |
| Commons: whiteboard (menghadap Timur) | `(-4.35, 1.65)` | `(15.65, 3.65)` |

Portal: Commons ↔ Studio dunia `(18.0, -0.35) ↔ (18.0, -1.45)`; bus ↔ Focus `(16.0, 6.2) ↔ (16.0, 8.05)`; bus ↔ Access `(29.0, 6.2) ↔ (29.0, 8.05)`.

### C. GLB Tahap 6 (sudah ada di `public/models/`, terverifikasi di scene)

Ketujuh GLB termuat menggantikan placeholder. Bounding box dunia:

| GLB | Bounding box dunia | Catatan |
|---|---|---|
| Cyclorama | `X 15.45..18.05, Z -4.76..-3.01, H 2.35` | |
| Rig kamera | `X 16.10..17.40, Z -2.88..-2.08, H 1.68` | |
| Meja produksi | `X 19.03..20.67, Z -4.76..-4.04, H 1.18` | |
| Solo pod | 1,36 × 1,48 × 1,16 | `Focus_Status_LED` ditemukan dan diwarnai (hijau ↔ merah koral); kapsul scene disembunyikan |
| Portal lift | `X 27.00..27.28, Z 8.45..10.15, H 2.45` | |
| Totem | `X 27.30..27.86, Z 11.18..12.12, H 1.25` | Overlay kanvas jatuh ≤ 3 mm dari `Access_Map_Screen` |
| Tangga (posisi baru) | `X 29.39..30.64, Z 8.10..10.30, H 2.35` | |

Generator HTML Tahap 6 ditunda sesuai keputusan CEO.

### D. Verifikasi

- `npm run typecheck` (4 workspace) lulus.
- `npm test` lulus 64/64.
- `npm run build:next` dan `npm run build:next:demo` berhasil.
- Simulasi 600 dtk (semua rutinitas Tahap 1–6, rapat, pemicu debug): 277 penghalang dicek (perabot sebagai OBB lokal slot + dinding), **0 tabrakan, 0 agen macet**. Lama tiap rutinitas: Studio 176 dtk, Focus 247 dtk, Access 204 dtk.
- Kamera Tenggara:
  - Studio terlihat penuh (talent di green screen, kameramen, meja produksi, ON AIR menyala); `commons_north_west`, `studio_west`, dan `infowall_west` + kanban memudar.
  - Agen di kedua bilik terlihat mengetik dengan LED merah.
  - Lift, totem (beserta pembacanya), dan tangga terlihat tanpa menutupi bangku Garden.
- Kios Lobi (15 ruangan, 2 kolom, denah 16 ruangan), layar InfoWall (15 baris), dan dropdown HUD (17 pilihan) tampil utuh.
- Mode jalan kaki: judul Commons dan papan QUIET ZONE tampil utuh.
- Debug hooks baru: `studio(ids?)`, `focusPod(id?, podIdx?)`, `access(id?)`. `errandState()` kini juga memuat `{ studio, focus, access }`.
