# Rencana Teknis Tahap 1 — Fondasi Tapak V6.2, Jalan Utama (Bus), & Klaster Inti

Dokumen ini menjabarkan detail implementasi **Tahap 1** dari [blueprint-lantai-1-v6.2.html](./blueprint-lantai-1-v6.2.html) ke scene 3D Three.js di `workspace/office-next`.

---

## 1. Tujuan Tahap 1

Mengganti konektor koridor kaca pendek (`Corridor_East_Connector` sepanjang `2,8 m`) menjadi **arsitektur topologi bus penuh (`38 × 2,4 m`)** yang menghubungkan klaster inti (**Ruang Kerja ↔ Jalan Utama ↔ Meeting Foyer ↔ Ruang Rapat**) secara berdampingan, sehingga:
- Seluruh jalan kaki agen ke Ruang Rapat lebih dekat (`7,5 m` di Jalan Utama, bukan `23,5 m`).
- Struktur koridor utama dan koordinat tapak `38 × 18,4 m` sudah siap menampung penambahan ruangan baru satu per satu pada Tahap 2–6 tanpa menggeser ulang klaster inti.
- Dinding penuh tetap dipakai untuk mode Free Cam 3D dan otomatis memudar (`WallFader`) saat kamera isometrik menatap dari Tenggara.

---

## 2. Pemetaan Koordinat Dunia 3D (`1 unit = 1 meter`)

Untuk mempertahankan seluruh koordinat meja dan kursi di `Ruang Kerja`, pusat `Room_MainWorkspace` dipertahankan di **`(0, 0)`** dengan pergeseran dari koordinat denah V6.2:
`worldX = svgX_m - 7.0`, `worldZ = svgZ_m - 5.0`.

| Zona / Layer | Ukuran | Rentang Dunia `X` | Rentang Dunia `Z` | Titik Pusat (`origin`) | Status di Tahap 1 |
|---|---|---|---|---|---|
| **Tapak Lantai 1** | `38 × 18,4 m` | `-7.0 .. +31.0` | `-5.0 .. +13.4` | — | Batas tapak virtual |
| **Room_MainWorkspace** | `14 × 10 m` | `-7.0 .. +7.0` | `-5.0 .. +5.0` | `(0, 0)` | Tetap + **dinding selatan baru (2 pintu)** |
| **Room_Boardroom_10p** | `8 × 8 m` | `+7.0 .. +15.0` | `-5.0 .. +3.0` | `(11.0, -1.0)` | Digeser bersebelahan Ruang Kerja + **bukaan selatan** |
| **Room_MeetingFoyer** | `8 × 2 m` | `+7.0 .. +15.0` | `+3.0 .. +5.0` | `(11.0, +4.0)` | Baru (terbuka tanpa sekat tengah) |
| **Corridor_MainBus** | `38 × 2,4 m` | `-7.0 .. +31.0` | `+5.0 .. +7.4` | `(+12.0, +6.2)` | Baru (mengganti `Corridor_East_Connector`) |

---

## 3. Rincian Perubahan per Modul & Ruangan

### A. `Room_MainWorkspace` (`src/stage/rooms/mainWorkspace.ts`)
- **Dinding Selatan Baru (`Z = +4.88`):**
  - Menambahkan dinding penuh setinggi `3,2 m` di sisi selatan dengan **2 bukaan pintu berkusen**:
    - Pintu Barat-Selatan di **`X = -3.5`** (sejajar `3,5 m` tapak / area pod barat & antrean kopi).
    - Pintu Timur-Selatan di **`X = +3.5`** (sejajar `10,5 m` tapak / area engineering, berjarak `7,5 m` di koridor dari Meeting Foyer).
  - Mendaftarkan grup dinding selatan sebagai `main_south` ke `WallFader` (`normal = (0, 0, -1)`) agar otomatis memudar ke `opacity 0.15` di kamera isometrik.
  - Menyembunyikan/mengganti `Front_Cutaway_Threshold` pada `office_room_shell.glb` agar selaras dengan ambang pintu selatan baru.
- **Partisi Timur (`X = +6.70`):**
  - Pintu kaca timur lama tidak lagi dipakai sebagai jalur navigasi (karena sisi timur kini berbatasan dengan dinding barat Ruang Rapat).
- **Aset Interior Sementara:**
  - `Coffee Bar`, `Water Dispenser`, `Trash Bin`, dan `2× Server Rack 42U` **tetap berada di Ruang Kerja selama Tahap 1**, lalu dipindahkan ke `Pantry / Café` (Tahap 2) dan `Server / IT` (Tahap 3).

### B. `Room_Boardroom_10p` (`src/stage/rooms/boardroom.ts` & `src/stage/layout.ts`)
- **Geser Posisi:** `ROOM_BOARDROOM.origin` diubah dari `(13.5, 0)` menjadi **`(11.0, -1.0)`**. Seluruh furnitur interior (meja konferensi 10 kursi, TV 85", kredenza, whiteboard, lampu gantung) tidak diubah ukurannya.
- **Akses Pintu Selatan (`local X ∈ [-0.85, +0.85]`, `local Z = +3.88`):**
  - Memotong/membuka `Curb_South` (`Office_Boardroom_Shell.glb` / placeholder) di celah pintu tengah (`world X = +11.0`, lebar `1,7 m`) menggunakan pendekatan `splitMeshAlongX` / segmen terpisah agar bebas tersandung/terhalang.
  - Menambahkan segmen dinding selatan berkusen di kiri & kanan pintu tengah dan mendaftarkannya ke `WallFader` (`board_south`, `normal = (0, 0, -1)`).
  - Sisi timur Ruang Rapat tetap cutaway terbuka untuk pandangan kamera isometrik Tenggara sampai `Collaboration Commons` dibangun di Tahap 4.
- **Portal Masuk Baru:** `BOARDROOM.doorInside` diubah dari `(-3.30, 2.35)` menjadi **`(0, 2.35)`** (tepat di promenade selatan di dalam pintu tengah).

### C. `Room_MeetingFoyer` (`src/stage/rooms/meetingFoyer.ts` — file baru)
- **Dimensi & Lantai:** `8 × 2 m` di `origin = (11.0, +4.0)`, memakai `createCarpetFloor(8.0, 2.0)` bermaterial karpet Ruang Rapat agar menyatu 1:1.
- **Tata Ruang Terbuka:**
  - **Tanpa tembok atau kaca penyekat di dalam foyer** antara jalur tengah (`2,4 m`, `world X: 9.8..12.2`) dengan sayap kiri (`X: 7.0..9.8`) dan sayap kanan (`X: 12.2..15.0`).
  - Sayap kiri & kanan diisi elemen awal ringan (mis. tanaman indoor / papan jadwal / meja konsol kecil yang nantinya bisa dipakai untuk hidangan rapat panjang).
- **Dinding Selatan Foyer (`world Z = +4.88`):**
  - Memiliki **1 pintu tengah** tepat di **`world X = +11.0`** menghadap Jalan Utama, dan didaftarkan ke `WallFader` (`foyer_south`, `normal = (0, 0, -1)`).

### D. `Corridor_MainBus` (`src/stage/rooms/mainCorridor.ts` — menggantikan `corridorEast.ts`)
- **Dimensi & Lantai:** `38 × 2,4 m` di `origin = (12.0, -0.004, 6.2)` (`Y` turun `4 mm` di sambungan ambang untuk mencegah *z-fighting*), memakai `createCarpetFloor(38.0, 2.4)` + sub-slab slate `38 × 2,4 m` + garis pemandu tepi koridor.
- **Terminator & Pembatas Sementara:**
  - Penutup ujung Barat (`world X = -7.0`) dan ujung Timur (`world X = +31.0`).
  - Dinding pembatas sementara (menunggu Tahap 2–6) di sisi Utara ruas timur (`world X: +15.0..+31.0`, `Z = +5.0`) dan seluruh sisi Selatan (`world X: -7.0..+31.0`, `Z = +7.4`, didaftarkan ke `WallFader` `bus_south`).

### E. Navigasi Bus (`src/stage/navigation.ts`)
- **Portal Lantai 1 (`FLOOR1_PORTALS`):**
  - `mainSouthWest: { x: -3.5, z: 4.3 }` ↔ `busWestDoor: { x: -15.5, z: 0 }` *(world `X = -3.5`)*
  - `mainSouthEast: { x: 3.5, z: 4.3 }` ↔ `busEastDoor: { x: -8.5, z: 0 }` *(world `X = +3.5`)*
  - `busFoyerDoor: { x: -1.0, z: 0 }` *(world `X = +11.0`)* ↔ `foyerSouth: { x: 0, z: 0.6 }`
  - `foyerNorth: { x: 0, z: -0.6 }` ↔ `boardroomDoorInside: { x: 0, z: 2.35 }` *(tetap memakai `gate: BOARDROOM_DOOR_GATE`)*
- **`mainRoomPath` & Router:**
  - Mendukung kedua pintu selatan `Ruang Kerja` dan memilih pintu yang paling dekat dengan tujuan akhir agen secara otomatis.
  - `busPath` melintasi garis sumbu tengah Jalan Utama (`local z = 0`, `world Z = +6.2`).
  - `foyerPath` melintasi jalur tengah terbuka foyer (`local x = 0`, `world X = +11.0`).

### F. Kamera & Stage Wiring (`cameraRig.ts`, `IsometricOfficeStage.tsx`, `App.tsx`)
- **`cameraRig.ts`:** Perluas `FREE_BOUNDS` menjadi `minX: -12, maxX: 36, minY: 0.3, maxY: 16, minZ: -10, maxZ: 20` agar Free Cam 3D bisa menyusuri seluruh panjang Jalan Utama `38 m`.
- **`IsometricOfficeStage.tsx`:**
  - Hubungkan callback `onCarpetMaterial` dari `boardroom` ke `main`, `foyer`, dan `bus`.
  - Perbarui `board.focusPoint()` (otomatis mengikuti `origin` baru `(11.0, -1.0)`), tambah target fokus `Jalan Utama` / `Meeting Foyer` bila diperlukan, dan sesuaikan `ISO_DEFAULT_TARGET` agar klaster inti (`Ruang Kerja + Ruang Rapat + Foyer + Jalan Utama`) tampil proporsional saat awal dibuka.

---

## 4. Keputusan Desain Terbuka sebelum Coding

Untuk dinding tepi **Jalan Utama** di ruas yang ruangannya belum dibangun pada Tahap 1 (sisi Selatan `X: -7..+31 m` dan Utara bagian timur `X: +15..+31 m`), pilih salah satu:
1. **Dinding kaca berbingkai gelap + `WallFader`** *(disarankan: serasi dengan gaya koridor kaca sebelumnya dan siap dibuka per pintu di Tahap 2–6)*.
2. **Dinding solid / pembatas rendah sementara**.

> **Diputuskan CEO:** opsi 1 (kaca berbingkai gelap). Detail dan keputusan lain ada di §6.

---

## 5. Kriteria Verifikasi Tahap 1

- `npm run typecheck` dan build Vite lulus tanpa error.
- `npm test` (`@office/server`) seluruh test lulus.
- Pemeriksaan visual di browser (Playwright / preview):
  - Tidak ada celah lantai / *z-fighting* antara Ruang Kerja, Jalan Utama, Meeting Foyer, dan Ruang Rapat.
  - Mode Isometrik: dinding selatan Ruang Kerja, Meeting Foyer, Ruang Rapat, dan Jalan Utama otomatis memudar saat menghalangi kamera.
  - Mode Free Cam 3D: seluruh dinding berdiri utuh setinggi `3,2 m`, bisa berjalan menembus pintu selatan Ruang Kerja → Jalan Utama → Meeting Foyer → Ruang Rapat.
  - Simulasi rapat: agen dari pod barat & timur keluar lewat pintu selatan terdekat, berjalan di Jalan Utama, masuk lurus lewat tengah Meeting Foyer, dan mengantre rapi di pintu Ruang Rapat.

---

## 6. Hasil Analisa, Koreksi Plan & Status Implementasi

**Status:** Tahap 1 selesai diimplementasikan (17 November 2026). Seluruh koordinat §2 dipakai apa adanya. Bagian di bawah mencatat hal yang **berbeda dari plan** beserta alasannya.

### A. Koreksi plan (ditemukan saat analisa, sebelum coding)

| # | Masalah di plan | Bukti (diukur dari kode / isi GLB) | Solusi yang diterapkan |
|---|---|---|---|
| 1 | Dinding barat Ruang Rapat jadi dinding bersama dan **menutupi pod timur** (Gita, Laras, Fajar) dari kamera isometrik. Plan hanya memudarkan dinding selatan. | Dinding slat 3,2 m di `X = 7.0..7.24` berada tepat di antara kamera Tenggara dan pod `X 2..4`. | Dinding didaftarkan sebagai **dinding dalam** (`interior`): selalu memudar di tampilan rumah boneka. TV 85 inci sengaja tidak ikut memudar (benda dinding tetap terlihat). |
| 2 | Pintu selatan-barat `X = -3.5` jatuh **tepat di Coffee Bar** dan garis antrean kopi. | Bar GLB lebar 1,8 m di `X -4.7..-2.9`, antrean di `X = -3.8`. | Pintu tetap sesuai blueprint; klaster pantry digeser ke sudut barat daya (lihat §6.C). |
| 3 | "Free Cam: seluruh dinding utuh" **bertentangan** dengan `WallFader` lama yang memudarkan dinding tiap kali kamera ada di belakangnya. | Dari Jalan Utama semua dinding ruangan di kiri-kanan akan tampak transparan. | `WallFader` punya mode **jalan kaki**: Free Cam di dalam tapak gedung dan di bawah 3,2 m → semua dinding utuh. Di atas dinding / di luar gedung → tampilan rumah boneka. |
| 4 | Lubang pintu lama tidak dibahas. | `Office_Boardroom_Shell.glb` punya portal pintu barat `Z 1.63..3.07` yang kini menghadap sekat kaca ruang kerja (meleset 1 m dari celah sekat `Z 1.65..3.05`). | Portal GLB disembunyikan dan ditutup dinding pengisi + baseboard. Celah sekat kaca ruang kerja ditutup panel **kaca mati** bermaterial sama. |
| 5 | Router BFS lama **tidak bisa memilih** antara 2 pintu selatan. | `createBuildingNav` selalu mengambil konektor pertama yang ditemukan BFS. | Router menghitung semua rute tanpa mengulang ruangan dan memilih **jalan total terpendek** (dicache per pasangan ruangan). |

**Perbaikan kecil yang ikut dikerjakan:**
- 4 baut `Partition_Bolt_*` GLB di garis `Z = 5.0` (jatuh di bukaan pintu) dan gagang `Sliding_Door_Handle` disembunyikan.
- `Curb_South` ruang rapat **disembunyikan penuh** (bukan dipotong `splitMeshAlongX`) karena posisinya sudah ditempati dinding selatan berpintu; tanpa itu terjadi *z-fighting*.
- Dinding kaca sementara Jalan Utama berdiri di **sisi ruangan** (`Z 7.40..7.64` dan `Z 4.76..5.00`), bukan di garis `Z = 7.4`, supaya lebar bersih koridor tetap 2,4 m saat ruangannya dibangun.
- Frustum bayangan matahari dan bingkai awal kamera isometrik dihitung otomatis dari tapak ruangan (sebelumnya angka tetap yang tidak mencakup klaster baru).
- Ruang Rapat kini punya lorong timur (`X = 3.05` lokal) di samping lorong barat; peserta mengitari meja lewat sisi yang lebih pendek karena pintunya di tengah.

**Catatan jarak:** potongan Jalan Utama memang 7,5 m, tetapi jarak total dari kursi ke pintu Ruang Rapat kini **±19–31 m** (Laras 19,4 m; Raka 30,2 m), lebih jauh dari koridor kaca lama. Seluruh 10 agen tetap duduk dalam **±26 detik** (batas `MEETING_GATHER_TIMEOUT_S` 45 detik).

### B. Keputusan CEO (sebelum coding)

| Pertanyaan | Keputusan |
|---|---|
| Pintu selatan-barat vs Coffee Bar | Geser pantry ke sudut barat daya, pintu tetap di 3,5 m tapak |
| Dinding barat Ruang Rapat (TV) | Memudar di isometrik, TV tetap solid |
| Perilaku dinding di Free Cam | Utuh saat kamera di dalam gedung & di bawah dinding |
| Dinding sementara Jalan Utama | Kaca berbingkai gelap per ruas ruangan |

### C. Koordinat final (dunia, `1 unit = 1 m`)

| Elemen | Nilai |
|---|---|
| Pintu selatan Ruang Kerja | `X -4.2..-2.8` dan `X 2.8..4.2`, dinding pusat `Z = 4.88`, tinggi bukaan 2,57 m |
| Pintu foyer → Jalan Utama | `X 10.15..11.85` di `Z = 4.88` |
| Pintu Ruang Rapat → foyer | `X 10.15..11.85` di `Z = 2.88` |
| Coffee Bar / Dispenser / Tempat sampah | `(-5.8, 4.33)` / `(-4.59, 4.45)` / `(-2.4, 4.46)` |
| Antrean kopi (slot 0–3) | `X = -5.8`, `Z 3.6 / 2.7 / 1.8 / 0.9`, menghadap Selatan (bar) |
| Titik berdiri tempat sampah | `(-2.4, 4.03)` |
| Server rack | `(1.8, 4.17)` dan `(5.5, 4.17)`, mengapit pintu selatan-timur |
| Door mutex ruang rapat | antre di luar `(11.0, 3.4)`, di dalam `(11.0, 1.35)` |

Ruas dinding kaca sementara diatur oleh `BUS_FRONTAGE_SOUTH` / `BUS_FRONTAGE_NORTH` di `layout.ts`. Saat sebuah ruangan dibangun (Tahap 2–6), ubah `built: true` pada ruasnya: kaca ruas itu hilang dan ruangan baru membawa dinding berpintunya sendiri.

### D. Peta file

| File | Isi |
|---|---|
| `src/stage/layout.ts` | `ROOM_FOYER`, `CORRIDOR_BUS`, `BUS_FRONTAGE_*`, pintu selatan, pantry baru, `WALL_HEIGHT/THICKNESS`, `DOOR_HEIGHT` |
| `src/stage/rooms/walls.ts` *(baru)* | `buildSolidWallX` (dinding penuh berpintu berkusen), `buildGlassWallX` (kaca berbingkai), palet material yang disalin dari warna linear GLB |
| `src/stage/rooms/mainCorridor.ts` *(baru, ganti `corridorEast.ts`)* | Jalan Utama 38 × 2,4 m, LED pemandu, dinding kaca per ruas, terminator ujung |
| `src/stage/rooms/meetingFoyer.ts` *(baru)* | Foyer 8 × 2 m, dinding selatan + pintu tengah, meja konsol minuman, bangku tunggu, tanaman, papan status ruang rapat |
| `src/stage/rooms/mainWorkspace.ts` | Dinding selatan 2 pintu, kaca mati di celah timur, pantry sudut barat daya |
| `src/stage/rooms/boardroom.ts` | Origin baru, pintu selatan, penutup portal barat, dinding barat jadi dinding dalam |
| `src/stage/navigation.ts` | `busPath`, `foyerPath`, lorong timur ruang rapat, router rute terpendek, `FLOOR1_PORTALS` baru |
| `src/stage/camera/wallFade.ts` | Opsi `interior`, mode jalan kaki (`setWalkZones`) |
| `src/stage/camera/cameraRig.ts` | `FREE_BOUNDS` baru, Free Cam mulai melayang di atas dinding, bingkai home otomatis (`setHomeBox`) |
| `src/stage/IsometricOfficeStage.tsx` | Rakit 4 ruangan, konektor pintu, frustum bayangan, papan status foyer, debug `freeAt()` / `roomAt()` |

### E. Hasil verifikasi (§5)

- [x] `npm run typecheck` lulus (shared, server, web, office-next).
- [x] `npm test` lulus: 10 file, 64 test.
- [x] `vite build` live dan `--mode demo` lulus. **Catatan lingkungan:** di PC ini esbuild gagal menghapus file sementara di `%TEMP%` (`remove …\Temp\esbuild-…: Access is denied`) untuk chunk > 1 MB, kemungkinan karena dikunci pemindai antivirus. Solusi: arahkan `TEMP`/`TMP` ke folder di drive P: sebelum build, atau kecualikan `%TEMP%` dari pemindaian.
- [x] Tidak ada celah lantai / *z-fighting* di sambungan Ruang Kerja ↔ Jalan Utama ↔ foyer ↔ Ruang Rapat (pelat ambang menutup celah slab di bawah pintu).
- [x] Isometrik: dinding selatan Ruang Kerja, foyer, Ruang Rapat, dan Jalan Utama memudar; dinding barat Ruang Rapat ikut memudar, TV tetap terlihat. Juga dicek dari sudut berlawanan (orbit 180°).
- [x] Free Cam: dinding utuh 3,2 m saat berjalan di Ruang Kerja, Jalan Utama, foyer, dan Ruang Rapat; bisa melewati semua pintu.
- [x] Simulasi 420 detik (3 rapat + rutinitas kopi & tempat sampah): tidak ada agen menembus dinding, macet, atau keluar tapak. Agen lewat pintu selatan terdekat, berjalan di sumbu Jalan Utama, masuk lurus lewat tengah foyer, dan antre di pintu Ruang Rapat (door mutex).

### F. Catatan untuk Tahap 2
- Pantry di sudut barat daya bersifat **sementara**. Saat Coffee Bar pindah ke Pantry / Café, tempatkan bar di dinding utara atau barat ruangan: dari kamera Tenggara agen yang menyeduh kini tertutup badan bar.
- `Office_Glass_Corridor.glb` (741 KB) tidak lagi dipakai scene.
- Tombol HUD fokus baru belum ditambahkan; API `focusRoom('foyer' | 'bus')` sudah tersedia.
