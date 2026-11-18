# Rencana Teknis Tahap 5 — Workshop / Training, Information Wall, & Collaboration Pods

Dokumen ini menjabarkan spesifikasi arsitektur, koordinat presisi (lokal & dunia), aturan kepemilikan dinding & *Wall Auto-Fade*, rute navigasi portal, perilaku agen, serta kontrak slot model 3D untuk **Tahap 5** berdasarkan masterplan [blueprint-lantai-1-v6.2.html](./blueprint-lantai-1-v6.2.html) dan kode aktual `workspace/office-next`.

---

## 1. Tujuan Tahap 5

Setelah Tahap 1–4 menuntaskan area inti serta awal sayap timur (*Collaboration Commons* & *Digital Garden*), **Tahap 5** menuntaskan seluruh klaster **Timur Laut (Northeast Wing)** Lantai 1 yang terdiri dari 3 ruangan saling terhubung:

1. **Workshop / Training (`Room_Workshop` — $6.0 \times 6.0\text{ m} = 36\text{ m}^2$):**
   - Ruang presentasi teknis, demo produk visual, *sprint review*, dan sesi berbagi ilmu (*tech sharing*), terletak di ujung timur sisi utara Jalan Utama ($X: +25.0 .. +31.0\text{ m}$, $Z: -1.0 .. +5.0\text{ m}$).
   - Menjadi gerbang penghubung langsung dari Jalan Utama menuju **Collaboration Pods** di sisi utaranya.
2. **Information Wall (`Room_InfoWall` — $5.0 \times 4.0\text{ m} = 20\text{ m}^2$):**
   - Ruang *command-center* telemetri tim di baris utara kedua ($X: +21.0 .. +26.0\text{ m}$, $Z: -5.0 .. -1.0\text{ m}$), diakses langsung dari pintu utara timur **Collaboration Commons** ($X = +23.0\text{ m}$).
   - Menampilkan dinding LED panoramik dengan metrik *live/simulasi* CI/CD, status *security scanner*, progres *roadmap build*, dan papan peringkat aktivitas agen.
3. **Collaboration Pods (`Room_CollabPods` — $5.0 \times 4.0\text{ m} = 20\text{ m}^2$):**
   - Zona 2 bilik diskusi cepat (*2-person diner huddle pods*) kedap suara di sudut timur laut gedung ($X: +26.0 .. +31.0\text{ m}$, $Z: -5.0 .. -1.0\text{ m}$), diakses langsung lewat pintu utara **Workshop / Training** ($X = +28.5\text{ m}$) untuk *pair-programming* atau *design critique* tanpa harus memesan Ruang Rapat 10 kursi.

---

## 2. Pemetaan Koordinat 3D & Kepemilikan Dinding (`1 unit = 1 m`)

Rumus transformasi tetap mengacu pada standar V6.2:  
`worldX = tapakX - 7.0`, `worldZ = tapakZ - 5.0`.

### A. Tabel Tapak & Pusat Ruangan

| Layer Ruangan | Ukuran ($W \times D$) | Rentang Dunia `X` | Rentang Dunia `Z` | Pusat Dunia (`origin`) | `halfX × halfZ` | Lantai Bersih Lokal (`inner`) |
|---|---|---|---|---|---|---|
| **`Room_Workshop`** | $6.0 \times 6.0\text{ m}$ | `+25.0 .. +31.0` | `-1.0 .. +5.0` | `(+28.0, 0, +2.0)` | `3.0 × 3.0` | `X: -3.00..+2.76`, `Z: -2.76..+2.76` |
| **`Room_InfoWall`** | $5.0 \times 4.0\text{ m}$ | `+21.0 .. +26.0` | `-5.0 .. -1.0` | `(+23.5, 0, -3.0)` | `2.5 × 2.0` | `X: -2.26..+2.26`, `Z: -1.76..+2.00` |
| **`Room_CollabPods`** | $5.0 \times 4.0\text{ m}$ | `+26.0 .. +31.0` | `-5.0 .. -1.0` | `(+28.5, 0, -3.0)` | `2.5 × 2.0` | `X: -2.50..+2.26`, `Z: -1.76..+2.00` |

### B. Audit Dinding, *Frontage*, & *Ray-Traced Wall Auto-Fade* (Bebas Dinding Ganda & Bebas Tutupan Kamera)

Berdasarkan vektor kamera ortografis Tenggara di `cameraRig.ts` (`ISO_OFFSET = (18, 12.95, 20)`), dinding setinggi `3.2 m` pada `Z = -1.0` memproyeksikan bayangan tutupan ke arah Barat Laut sejauh $\Delta X = -4.45\text{ m}, \Delta Z = -4.94\text{ m}$ (menutupi lantai sampai `Z = -5.94`, yakni **100% kedalaman baris utara `Z = -5.0 .. -1.0`**). Oleh karena itu, aturan dinding dan `WallFader` ditetapkan sebagai berikut:

1. **Frontage Jalan Utama (`BUS_FRONTAGE_NORTH` di `layout.ts`):**
   - Ubah segmen `{ id: 'workshop', xMin: 25, xMax: 31, tahap: 5, built: true }` sehingga kaca sementara dan strip `Bus_SubSlab_North` di ruas `X = 25..31` otomatis hilang (tidak bertumpuk dengan dinding selatan Workshop).
2. **Pemecahan Dinding Utara `Room_CollabCommons` di `X = +21.0` (lokal `x = +1.0`):**
   - `Room_InfoWall` (`X = 21..26`) menumpang `4.0 m` di atas `Room_CollabCommons` (`X = 21..25`) dan `1.0 m` di atas `Room_Workshop` (`X = 25..26`), sedangkan `Studio / Content` (`X = 15..21`) baru dibangun di Tahap 6.
   - Agar `Room_InfoWall` terlihat utuh tanpa membuka area kosong Studio:
     - **Ruas Barat Dinding Utara Commons (`X = 15.0..21.0`, lokal `-5.0..+1.0`):** tetap terdaftar sebagai dinding perimeter (`commons_north_west`, `interior: false` → tetap solid di Tahap 5; pintu `northDoors[0]` di `X = 17.5..18.5` tetap tertutup dengan papan `"STUDIO / CONTENT · Segera · Tahap 6"`). Geser `COMMONS.sign` (`"COLLABORATION COMMONS"`, lebar diperkecil ke `2.2 m`) dan `COMMONS.whiteboard` dari lokal `x = +0.55` ke `x = -0.25` (dunia `X = 19.75`, tepat di tengah bidang solid `18.5..21.0`) agar tulisan tidak terpotong batas `X = 21.0` dan tidak menghalangi kusen pintu Info Wall.
     - **Ruas Timur Dinding Utara Commons (`X = 21.0..25.0`, lokal `+1.0..+5.0`):** terdaftar sebagai `commons_north_east` dengan **`{ interior: true }`** (selalu memudar ke opacity `0.15`). Lepas daun pintu tertutup `Future_Door_Leaf_1`, kaca intip, gagang, dan papan `"INFORMATION WALL · Segera · Tahap 5"` pada `ROOM_COMMONS.northDoors[1]` (`X = 22.5..23.5`), lalu pasang pelat `threshold` lantai penyambung di celah `Z = -1.00..-0.76`.
3. **Dinding `Room_Workshop` (`buildNorthRoomShell` diperluas dengan opsi `interiorNorth?: boolean`):**
   - **Barat (`X = 25.0`):** `sides: { west: false }` — memakai ulang dinding kaca timur `Room_CollabCommons` (`X = 24.76..25.00`, sudah `interior: true`).
   - **Selatan (`Z = 4.76..5.00`):** kaca berpintu terbuka `1.6 m` (`southDoor: { xMin: -0.8, xMax: 0.8 }`, dunia `X = 27.2..28.8`) + pelat `threshold`, `interior: true`.
   - **Utara (`Z = -1.00..-0.76`):** dinding dengan bukaan pintu terbuka `1.2 m` (`northDoors: [{ xMin: -0.1, xMax: 1.1 }]`, dunia `X = 27.9..29.1`, pusat `28.5 = 35.5 m` tapak) + pelat `threshold`, terdaftar dengan **`interiorNorth: true`** (`{ interior: true }`) karena seluruh bentang `X = 25..31` kini membatasi `InfoWall` (`25..26`) dan `CollabPods` (`26..31`).
   - **Timur (`X = 30.76..31.00`):** dinding perimeter luar timur gedung (`interior: false`). Karena normal dalamnya `(-1, 0, 0)`, `WallFader` otomatis memudarkannya dari kamera Tenggara (`dot < -0.02`) dan menampilkannya solid saat kamera diputar ke Barat.
4. **Cangkang Baris Utara Kedua (`buildNorthTierShell` baru di `rooms/northWing.ts`, siap dipakai ulang Studio di Tahap 6):**
   - Membangun sub-slab penuh di bawah ruangan baris `Z = -5.0..-1.0` (`sides.south` bawaan `false` karena dinding di `Z = -1.00..-0.76` sudah dimiliki ruangan baris di selatannya).
   - **`Room_InfoWall`:**
     - **Utara (`Z = -5.00..-4.76`):** dinding luar gedung (`interior: false` → **tetap solid** dari kamera Tenggara, bidang utama layar *Information Wall*).
     - **Barat (`X = 21.00..21.24`):** dinding pembatas ke tapak Studio yang belum dibangun (`interior: false` di Tahap 5 agar sudut barat laut InfoWall tampil solid; di Tahap 6 tinggal diubah ke `interiorSides: ['west', 'east']`). Semua papan di dinding ini dimasukkan ke grup `walls.west` agar ikut memudar di Tahap 6.
     - **Timur (`X = 25.76..26.00`):** dinding partisi antar-ruangan menuju `Collaboration Pods` (`interiorSides: ['east']` → selalu memudar).
     - **Selatan (`Z = -1.0`):** `sides: { south: false }`.
   - **`Room_CollabPods`:**
     - **Utara (`Z = -5.00..-4.76`):** dinding luar gedung (`interior: false` → **tetap solid**).
     - **Timur (`X = 30.76..31.00`):** dinding luar timur gedung (`interior: false` → otomatis memudar dari kamera Tenggara lewat normal `(-1, 0, 0)`).
     - **Barat (`X = 26.0`) & Selatan (`Z = -1.0`):** `sides: { south: false, west: false }` (memakai dinding timur `InfoWall` dan dinding utara `Workshop`).

---

## 3. Rincian Desain Interior & Koordinat Lokal Tiap Ruangan

### A. Workshop / Training (`src/stage/rooms/workshopTraining.ts` — pusat dunia `(28.0, 2.0)`)

Karena dinding Utara, Selatan, dan Timur memudar dari kamera Tenggara, panggung presentasi diletakkan di **sisi Barat** menghadap **Timur (`+X`)**, persis mengikuti prinsip Ruang Rapat, Ruang Manajer, dan Ruang Server:

- **Lantai:** Karpet akustik biru-abu hangat bermotif tenun halus dengan jalur aksen tepi kayu oak.
- **Panggung Presentasi Barat (menghadap Timur, `rotY = +π/2`):**
  - Panel latar akustik kisi kayu (*freestanding walnut slat stage backdrop*, lebar `3.0 m` sepanjang `Z = -1.30..+1.70`, tinggi `2.30 m`, tebal `0.06 m` di lokal `x = -2.92`, tidak menutup bagian atas kaca Commons).
  - Layar Presentasi 85" (pakai ulang `Office_Presentation_Display_85.glb` skala `0.88` di `x = -2.86, y = 1.46, z = 0.20, rotY = +π/2`) dengan overlay kanvas materi *live/demo* (`"WORKSHOP & TECH DEMO · Arsitektur Multi-Agen"`).
  - **Podium Pembicara (`Office_Workshop_Lectern_Podium.glb`, $0.62 \times 1.12 \times 0.48\text{ m}$):** di `x = -2.12, z = 1.38, rotY = +π/2` (rentang `X: -2.36..-1.88`, `Z: +1.07..+1.69`). Titik berdiri pembicara di belakang podium (`sitY = 0`, sehingga sesuai kontrak `errand_stay` memakai `approach === spot`): `(-2.55, 1.38, rotY: +π/2)`.
- **Zona Peserta (2 Baris × 3 Kursi = 6 Kursi menghadap Barat `rotY = -π/2`):**
  - **Baris 1 (Depan):** Meja lipat pelatihan (`Office_Workshop_Training_Table.glb`, $1.80 \times 0.74 \times 0.55\text{ m}$) di `x = -1.30, z = 0.20, rotY = -π/2` (rentang `X: -1.575..-1.025`, `Z: -0.70..+1.10`). 3 kursi kerja (`Office_Ergonomic_Chair.glb`) di `x = -0.78, z = -0.38 / +0.20 / +0.78, rotY = -π/2` (`approach` berdiri di lorong tengah `x = -0.22`).
  - **Baris 2 (Belakang):** Meja lipat pelatihan kedua di `x = +0.50, z = 0.20, rotY = -π/2` (rentang `X: +0.225..+0.775`, `Z: -0.70..+1.10`). 3 kursi kerja di `x = +1.02, z = -0.38 / +0.20 / +0.78, rotY = -π/2` (`approach` berdiri di koridor timur `x = +1.85`).
- **Dekorasi & Pencahayaan:**
  - Lampu gantung linear (`Office_Linear_Pendant_Light.glb`) membujur di atas area meja (`x = -0.40, z = 0.20, rotY = π/2`) + 2 `PointLight` putih hangat.
  - Tanaman Monstera (`Office_Indoor_Plant.glb`) di sudut barat laut `(-2.50, -2.25)` dan Snake Plant di sudut tenggara `(+2.30, +2.25)`.
- **Jalur Navigasi Lokal (`workshopPath`):**
  - `ringLane({ minX: -0.22, maxX: 1.85, minZ: -1.95, maxZ: 2.05 })`, ditambah cabang siku `(-0.22, 2.05) ↔ (-2.55, 2.05) ↔ (-2.55, 1.38)` khusus titik di barat podium (`x < -1.8`) agar pembicara memutari sisi selatan podium (`z = 2.05 > 1.69`, bebas `0.36 m`) tanpa menembus badan podium:
    - Koridor utama timur (`x = +1.85`, lebar bebas `1.48 m`) mengalirkan lalu lintas tembus `Jalan Utama (0, +2.35) ↔ Collaboration Pods (+0.5, -2.35)` dengan mulus tanpa menyentuh kursi peserta.
    - Lorong antara Baris 1 dan Baris 2 (`x = -0.22`, celah bersih `0.745 m`) melayani 3 kursi depan.

---

### B. Information Wall (`src/stage/rooms/infoWall.ts` — pusat dunia `(23.5, -3.0)`)

- **Lantai:** Karpet teknis antrasit gelap dengan garis pemandu tipis cyan (`#38bdf8`) di depan zona baca layar.
- **Dinding Utara Solid (`local Z = -1.76`, menghadap Selatan `+Z` ke arah kamera Tenggara):**
  - **Layar Komando Panoramik (`Office_InfoWall_Command_Display.glb`, $3.80 \times 2.10 \times 0.30\text{ m}$):** Dipasang menempel muka dinding utara di `x = 0.10, z = -1.76, rotY = 0` (origin belakang-bawah-tengah). Terdiri dari konsol dasar rendah setinggi `0.48 m` dan susunan layar *bezelless* melengkung lembut di atasnya (`Y = 0.65..2.05 m`).
  - **Overlay Kanvas Real-Time (`InfoWallScreen`, tanpa API key, di-refresh tiap 1 detik):** Menampilkan 3 kolom metrik hidup:
    1. *Build & Security Health* (`Typecheck: PASS · 64 Tests · Scanner: CLEAN`) + grafik mini trafik aktivitas.
    2. *Floor 1 Zone Status* (jumlah agen aktif & rapat berlangsung).
    3. *Agent Activity Feed / Leaderboard* (status 10 agen: *working / idle / meeting* dan ruangan tempatnya berada).
- **Dinding Barat (`local X = -2.26`, menghadap Timur `+X`):**
  - **Papan Kanban & Arsitektur (`Office_InfoWall_Kanban_Board.glb`, $1.80 \times 1.15 \times 0.06\text{ m}$):** Dipasang sebagai anak `walls.west` di `x = -2.25, y = 1.55, z = -0.05, rotY = +π/2` (menampilkan kolom *Backlog · In Progress · Review · Done* dengan kartu warna-warni; otomatis ikut memudar di Tahap 6 saat dinding barat menjadi dinding dalam Studio).
- **Titik Berdiri Inspeksi & Dekorasi:**
  - 3 titik berdiri pengamat menghadap layar utara (`rotY = π`, `sitY = 0`): `(-1.05, 0.15)`, `(0.10, 0.15)`, `(1.25, 0.15)` (jarak pandang ideal `1.6 m` dari layar).
  - Snake Plant (`Office_Indoor_Plant_SnakePlant.glb`) di sudut timur laut `(1.90, -1.38)`.
- **Jalur Navigasi Lokal (`infoWallPath`):**
  - `laneZ(0.65)` (dunia `Z = -2.35`): menyambung tegak lurus portal pintu selatan `(-0.5, +1.55)` ke ketiga titik pengamat di `z = +0.15`.

---

### C. Collaboration Pods (`src/stage/rooms/collabPods.ts` — pusat dunia `(28.5, -3.0)`)

- **Lantai:** Karpet akustik hijau-abu lembut dengan zonasi karpet aksen di bawah tiap pod.
- **2× Diner Huddle Pod 2 Orang (`Office_Collab_Diner_Pod.glb`, $1.90 \times 1.32 \times 1.30\text{ m}$, punggung di `-Z`, sisi depan `+Z` terbuka penuh ke arah kamera Tenggara):**
  - Setiap pod memiliki 2 bangku sofa berhadapan kiri–kanan (`dudukan Y = 0.45 m`), meja tengah ramping (`0.52 × 1.10 m`, tinggi `0.72 m`), dinding akustik belakang melengkung dengan layar kolaborasi mini 27", serta lampu indikator okupansi di atas atap parsial/bingkai belakang (hijau = kosong, amber = terpakai, di-update dari scene).
  - **Pod Barat (`Pod_A`):** di `x = -1.38, z = -0.98, rotY = 0` (rentang `X: -2.33..-0.43`, `Z: -1.63..-0.33`, bebas `17 cm` dari dinding barat & `13 cm` dari dinding utara).
    - Kursi kiri: `spot = (-2.00, -0.98, rotY: +π/2)`, `approach = (-2.00, +0.12)`.
    - Kursi kanan: `spot = (-0.76, -0.98, rotY: -π/2)`, `approach = (-0.76, +0.12)`.
  - **Pod Timur (`Pod_B`):** di `x = +1.14, z = -0.98, rotY = 0` (rentang `X: +0.19..+2.09`, `Z: -1.63..-0.33`, bebas `17 cm` dari dinding timur & `13 cm` dari dinding utara).
    - Kursi kiri: `spot = (+0.52, -0.98, rotY: +π/2)`, `approach = (+0.52, +0.12)`.
    - Kursi kanan: `spot = (+1.76, -0.98, rotY: -π/2)`, `approach = (+1.76, +0.12)`.
  - Karena seluruh titik `approach` (`z = +0.12`) berada **`0.45 m` di selatan bibir depan pod (`z = -0.33`)**, agen yang berjalan tidak pernah menyentuh *bounding box* pod, dan saat transisi duduk (`0.4 dtk`) agen meluncur rapi di celah kaki selebar `0.22 m` di antara bangku dan meja tengah (`sitY = 0.42`).
- **Celah Tengah Antar-Pod (`X = -0.43..+0.19`, lebar `0.62 m`):**
  - Diisi tanaman hias `Office_Indoor_Plant_SnakePlant.glb` di `(-0.12, -1.30)`.
- **Jalur Navigasi Lokal (`collabPodsPath`):**
  - `laneZ(0.60)` (dunia `Z = -2.40`): menyambung lurus portal selatan `(0.0, +1.55)` dari Workshop menuju keempat titik `approach` kedua pod tanpa halangan apa pun.

---

## 4. Konektor Portal Gedung (`src/stage/navigation.ts`)

Seluruh portal ditulis dalam **koordinat LOKAL masing-masing ruangan**, dengan sisi ruangan berada **di dalam ruangan** (bukan di garis dinding):

```ts
// Konstanta baru di layout.ts:
/** Z lokal titik berdiri di dalam ruangan baris utara kedua (Z -5..-1) tepat di depan pintu selatan (dunia Z -1.45). */
export const NORTH_TIER_SOUTH_DOOR_INSIDE_Z = 1.55;

// Tambahan pada FLOOR1_PORTALS di navigation.ts:
/** Jalan Utama ↔ Workshop: dunia (28.0, 6.2) ↔ (28.0, 4.35). */
busWorkshopDoor: { x: busX(ROOM_WORKSHOP.origin.x + mid(ROOM_WORKSHOP.southDoor)), z: 0 }, // (16.0, 0)
workshopSouth:   { x: mid(ROOM_WORKSHOP.southDoor), z: NORTH_ROOM_DOOR_INSIDE_Z },         // (0, 2.35)

/** Commons ↔ Information Wall lewat ROOM_COMMONS.northDoors[1]: dunia (23.0, -0.35) ↔ (23.0, -1.45). */
commonsNorthInfo: { x: mid(ROOM_COMMONS.northDoors[1]!), z: -NORTH_ROOM_DOOR_INSIDE_Z },   // (3.0, -2.35)
infoWallSouth:    { x: (ROOM_COMMONS.origin.x + mid(ROOM_COMMONS.northDoors[1]!)) - ROOM_INFOWALL.origin.x, z: NORTH_TIER_SOUTH_DOOR_INSIDE_Z }, // (-0.5, 1.55)

/** Workshop ↔ Collaboration Pods lewat ROOM_WORKSHOP.northDoors[0]: dunia (28.5, -0.35) ↔ (28.5, -1.45). */
workshopNorthPods: { x: mid(ROOM_WORKSHOP.northDoors[0]!), z: -NORTH_ROOM_DOOR_INSIDE_Z }, // (0.5, -2.35)
collabPodsSouth:   { x: (ROOM_WORKSHOP.origin.x + mid(ROOM_WORKSHOP.northDoors[0]!)) - ROOM_COLLABPODS.origin.x, z: NORTH_TIER_SOUTH_DOOR_INSIDE_Z }, // (0, 1.55)
```

Konektor baru pada `createBuildingNav(...)` di `IsometricOfficeStage.tsx`:
- `{ id: 'bus-workshop', a: { room: 'bus', portal: FLOOR1_PORTALS.busWorkshopDoor }, b: { room: 'workshop', portal: FLOOR1_PORTALS.workshopSouth } }`
- `{ id: 'commons-infowall', a: { room: 'commons', portal: FLOOR1_PORTALS.commonsNorthInfo }, b: { room: 'infowall', portal: FLOOR1_PORTALS.infoWallSouth } }`
- `{ id: 'workshop-collabpods', a: { room: 'workshop', portal: FLOOR1_PORTALS.workshopNorthPods }, b: { room: 'collabpods', portal: FLOOR1_PORTALS.collabPodsSouth } }`

**Estimasi Jarak & Waktu Tempuh Agen:**
- Ruang Kerja (pintu timur `X = 3.5`) → Information Wall (`X = 23.0, Z = -2.85`): $\approx 28.5\text{ m}$ ($\approx 15\text{ dtk}$).
- Ruang Kerja → Workshop (`X = 28.0`): $\approx 31\text{ m}$ ($\approx 16.5\text{ dtk}$).
- Collaboration Commons → Information Wall: **langsung lewat pintu penghubung** ($\approx 4.5\text{ m} \approx 2.5\text{ dtk}$).
- Workshop → Collaboration Pods: **langsung lewat pintu penghubung** ($\approx 4.0\text{ m} \approx 2.2\text{ dtk}$).

---

## 5. Perilaku Agen, UI Kamera, & Kios Direktori

1. **Tiga *Errand* Baru (`IsometricOfficeStage.tsx` & `officeDialogues.ts`, semuanya dapat disela pekerjaan nyata lewat `COFFEE_STATES`):**
   - **Sesi *Workshop / Tech Demo* (`kind: 'workshop'`):** Setiap `120–180 dtk` (bila tidak ada rapat), 1 pembicara (dipilih dari Raka / Bima / Gita / Tari / Sari) berjalan ke podium `Room_Workshop` (`pose: 'inspect'`, menjelaskan materi) diikuti `2–4` peserta santai yang duduk di meja pelatihan (`pose: 'discuss'`, `sitY = 0.45`) selama `25–35 dtk`.
   - **Cek Metrik *Information Wall* (`kind: 'infowall'`):** Setiap `85–135 dtk`, `1–2` agen santai (diutamakan Laras, Fajar, Satria, Bima, atau Raka) berjalan lewat Commons ke depan layar *Information Wall* (`pose: 'inspect'`, `sitY = 0`) selama `14–20 dtk` sambil berdialog soal status build/tes/keamanan.
   - ***Pair Huddle* di *Collaboration Pods* (`kind: 'collabpods'`):** Setiap `95–145 dtk` (atau di mode *live* saat pasangan agen sedang idle sesudah berbalas pesan), sepasang agen (`2 orang`) memesan salah satu pod kosong (`Pod_A` atau `Pod_B`), duduk berhadapan (`pose: 'discuss'`, `sitY = 0.42`) selama `20–30 dtk`, dan menyalakan lampu status pod menjadi *amber*.
   - **Debug Hooks (`window.__officeStageDebug`):** Tambahkan `workshop(presenterId?, attendeeIds?)`, `infowall(ids?)`, `pod(idA?, idB?, podIndex?)`, dan perluas `errandState()` dengan `{ workshop, infowall, pods }`.
2. **Kamera & HUD (`App.tsx`):**
   - Bingkai kamera awal (`setHomeBox`) **tetap `X = -7..15`** agar tingkat *zoom* utama tetap tajam (`0.63`).
   - Dropdown `"Fokus: ruangan"` diperluas menjadi **14 pilihan** (menambah `Workshop / Training`, `Information Wall`, dan `Collaboration Pods`), dan label header diperbarui menjadi `"Lantai 1 · Jalan Utama + 13 ruangan"`.
3. **Kios Direktori Lobi (`lobbyReception.ts` — Antisipasi *Overflow* Kanvas):**
   - Denah mini di bagian atas kanvas kios menambah 3 kotak ruangan baru (`Workshop`, `Info`, `Pods`).
   - Karena `ROOM_LABELS` bertambah dari 9 menjadi **12 ruangan** (yang jika digambar 1 kolom dengan tinggi baris `26 px` akan meluap melewati tinggi kanvas `640 px` ke `706 px`), tata letak daftar kehadiran `DirectoryScreen.draw()` diubah menjadi **grid 2 kolom ringkas** (6 baris × 2 kolom, `y = 400..592`), yang sekaligus siap menampung hingga 16 ruangan penuh sampai Tahap 6!

---

## 6. Kontrak Slot Model 3D Baru Tahap 5 (Placeholder Dulu, Siap Prompt GLB)

Seperti Tahap 2–4, Tahap 5 dibangun terlebih dahulu dengan placeholder prosedural berdimensi kontrak presisi lewat `mountAsset()` sehingga langsung berjalan tanpa menunggu ekspor GLB:

| Slot GLB Baru | Ukuran Kontrak ($W \times H \times D$) | Origin `(0,0,0)` & Arah Depan | Ruangan & Rotasi |
|---|---|---|---|
| `Office_Workshop_Lectern_Podium.glb` | $0.62 \times 1.12 \times 0.48\text{ m}$ | Lantai tengah; muka miring pembaca menghadap `-Z`, muka depan audiens `+Z` | Workshop, `rotY = +90°` |
| `Office_Workshop_Training_Table.glb` | $1.80 \times 0.74 \times 0.55\text{ m}$ *(2×)* | Lantai tengah; sisi panjang = `X`, modesty panel di `-Z`, kursi peserta di `+Z` | Workshop, `rotY = -90°` |
| `Office_InfoWall_Command_Display.glb` | $3.80 \times 2.10 \times 0.30\text{ m}$ | **Tengah sisi BELAKANG di lantai** (`z = 0`); muka layar menghadap `+Z` *(overlay kanvas scene di `Y = 0.65..2.02, Z = +0.16`)* | InfoWall, `rotY = 0°` |
| `Office_InfoWall_Kanban_Board.glb` | $1.80 \times 1.15 \times 0.06\text{ m}$ | **Tengah sisi BELAKANG** (`y = 0` di tengah papan, `z = 0` menempel dinding); muka papan `+Z` | InfoWall (`walls.west`), `rotY = +90°` |
| `Office_Collab_Diner_Pod.glb` | $1.90 \times 1.32 \times 1.30\text{ m}$ *(2×)* | Lantai tengah; dinding punggung + layar mini di `-Z`, **sisi masuk terbuka penuh di `+Z`**; 2 bangku di `x = ±0.71` (`dudukan Y = 0.45`), meja tengah `0.52 × 1.10` (`Y = 0.72`) | CollabPods, `rotY = 0°` |

**Aset Eksisting yang Dipakai Ulang:**
- `Office_Presentation_Display_85.glb` (layar utama Workshop, skala `0.88`)
- `Office_Ergonomic_Chair.glb` (6× kursi peserta Workshop)
- `Office_Linear_Pendant_Light.glb` (lampu gantung Workshop)
- `Office_Indoor_Plant.glb` & `Office_Indoor_Plant_SnakePlant.glb` (tanaman sudut Workshop, InfoWall, & CollabPods)

---

## 7. Daftar Periksa Verifikasi Tahap 5

- [ ] `npm run typecheck` lulus di keempat workspace (`shared`, `server`, `web`, `office-next`).
- [ ] `npm test` lulus 100% (64 tes).
- [ ] `npm run build:next` dan `npm run build:next:demo` berhasil tanpa error.
- [ ] Simulasi 600 detik mencakup rapat, diskusi Commons, rehat Garden, sesi Workshop, inspeksi InfoWall, dan diskusi berpasangan di Collaboration Pods dengan **0 tabrakan dinding/perabot** dan tidak ada agen macet.
- [ ] Kamera Tenggara memperlihatkan isi `Room_InfoWall` (ruas timur dinding utara Commons memudar, ruas barat tetap solid), `Room_CollabPods` (dinding utara Workshop memudar), dan layar presentasi `Room_Workshop` tanpa terhalang dinding.
- [ ] Kios direktori Lobi menampilkan 12 ruangan dalam format 2 kolom tanpa teks terpotong di tepi bawah kanvas.
