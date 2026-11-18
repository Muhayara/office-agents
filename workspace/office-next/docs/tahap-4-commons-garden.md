# Rencana Teknis Tahap 4 — Collaboration Commons & Digital Garden

Dokumen ini menjabarkan spesifikasi dan rincian implementasi **Tahap 4** dari denah [blueprint-lantai-1-v6.2.html](./blueprint-lantai-1-v6.2.html) ke scene 3D Three.js di `workspace/office-next`.

---

## 1. Tujuan Tahap 4

Setelah **Tahap 3** menyelesaikan seluruh klaster selatan (Lobi, Lounge, dan Server Room), **Tahap 4** memperluas bangunan ke **sayap timur**:

1. **Collaboration Commons ($10 \times 6\text{ m} = 60\text{ m}^2$):**
   - Ruang kelompok terbuka terbesar kedua setelah Ruang Kerja Utama.
   - Terletak di sisi utara Jalan Utama ($X: +15.0 .. +25.0\text{ m}$, $Z: -1.0 .. +5.0\text{ m}$), menempel langsung di sebelah timur Ruang Rapat & Foyer.
   - Berfungsi sebagai hub kolaborasi tim lintas fungsi (desain, programming, QA) dan jalur penghubung langsung menuju Studio & Information Wall di masa depan.
2. **Digital Garden ($5 \times 6\text{ m} = 30\text{ m}^2$):**
   - Terletak di sisi selatan Jalan Utama ($X: +22.0 .. +27.0\text{ m}$, $Z: +7.4 .. +13.4\text{ m}$), di sebelah timur Server Room.
   - Oase hijau asri (*biophilic design*) dengan taman vertikal, bebatuan zen, bangku kayu alami, dan tanaman rimbun untuk tempat rehat agen.
3. **Penyempurnaan Koridor Timur Ruang Rapat:**
   - Curb cutaway di sisi timur Ruang Rapat & Meeting Foyer kini tertutup rapi oleh dinding pemisah kaca/akustik yang berbatasan dengan Collaboration Commons.

---

## 2. Pemetaan Koordinat 3D (`1 unit = 1 meter`)

Sistem koordinat mengacu pada rumus transformasi V6.2:  
`worldX = svgX_m - 7.0`, `worldZ = svgZ_m - 5.0`.

| Ruangan / Layer | Ukuran ($P \times L$) | Rentang Dunia `X` | Rentang Dunia `Z` | Titik Pusat (`origin`) | Pintu Akses |
|---|---|---|---|---|---|
| **Room_CollabCommons** | $10.0 \times 6.0\text{ m}$ | `+15.0 .. +25.0` | `-1.0 .. +5.0` | `(+20.0, 0, +2.0)` | • Selatan (ke Bus): $X = +20.0, Z = +5.0$<br>• Utara 1 (ke Studio): $X = +18.0, Z = -1.0$<br>• Utara 2 (ke Info Wall): $X = +23.0, Z = -1.0$ |
| **Room_DigitalGarden** | $5.0 \times 6.0\text{ m}$ | `+22.0 .. +27.0` | `+7.4 .. +13.4` | `(+24.5, 0, +10.4)` | • Utara (ke Bus): $X = +24.5, Z = +7.4$ (lebar 1.6 m) |
| **Focus Pods** *(Tahap 6)* | $4.0 \times 6.0\text{ m}$ | `+14.0 .. +18.0` | `+7.4 .. +13.4` | `(+16.0, 0, +10.4)` | *Tetap frontage kaca sementara* |
| **Server / IT** *(Tahap 3)* | $4.0 \times 6.0\text{ m}$ | `+18.0 .. +22.0` | `+7.4 .. +13.4` | `(+20.0, 0, +10.4)` | Pintu RFID di $X = +20.0$ |

---

## 3. Rincian Desain & Interior Tiap Ruangan

### A. Collaboration Commons (`Room_CollabCommons` — $10 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Selatan (`world Z = +5.0`):** Dinding partisi kaca transparan setinggi 3.2 m dengan pintu tengah terbuka lebar 1.6 m menghadap ke Jalan Utama di $X = +20.0\text{ m}$. Terdaftar ke `WallFader` (`commons_south`).
  - **Dinding Barat (`world X = +15.0`):** Dinding pemisah akustik yang menyatu dengan Ruang Rapat & Foyer.
  - **Dinding Timur (`world X = +25.0`):** Dinding kaca pemisah dengan calon Workshop/Training (Tahap 5).
  - **Dinding Utara (`world Z = -1.0`):** Dinding pembatas dengan 2 bukaan pintu kusen menuju calon Studio ($X = +18.0$) dan Information Wall ($X = +23.0$).
  - **Lantai:** Kombinasi karpet akustik abu-abu geometris dengan aksen garis border kayu oak hangat.
- **Furnitur & Aset 3D Utama:**
  1. **Meja Kolaborasi Modular Besar:** Meja kerja kelompok komunal berbentuk modular berkaki baja hitam matte dengan power strip & data ports.
  2. **Kursi Kerja Fleksibel (Task Chairs):** Kursi ergonomis ringan beroda untuk pergerakan lincah diskusi tim.
  3. **Papan Tulis Kaca Ideation Beroda:** Mobile glass whiteboard untuk brainstorming ide dan arsitektur sistem.
  4. **Booth Diskusi Akustik / Pod Santai:** Sofa semi-melingkar empuk dengan meja laptop kecil untuk diskusi 2–3 orang.
  5. **Lampu Gantung Linear LED:** Rangkaian lampu linear arsitektural di atas meja kolaborasi.

---

### B. Digital Garden (`Room_DigitalGarden` — $5 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Utara (`world Z = +7.4`):** Pintu geser kaca frameless lebar 1.6 m menghadap Jalan Utama di $X = +24.5\text{ m}$. Terdaftar ke `WallFader` (`garden_north`).
  - **Dinding Selatan (`world Z = +13.4`):** Dinding perimeter dengan jendela kaca panorama luas setinggi langit-langit. Terdaftar ke `WallFader` (`garden_south`).
  - **Dinding Barat (`world X = +22.0`):** Dinding partisi pemisah dengan Server Room, dilapisi taman vertikal hijau.
  - **Dinding Timur (`world X = +27.0`):** Dinding pemisah dengan calon Digital Access Hub (Tahap 6).
  - **Lantai:** Hamparan rumput sintetis lembut pendek dikelilingi kerikil kali putih dan lempengan batu alam (*slate stepping stones*).
- **Furnitur & Aset 3D Utama:**
  1. **Vertical Living Green Wall:** Dinding taman vertikal penuh tanaman pakis, lumut hijau (*preserved moss*), dan daun philodendron rimbun dengan pencahayaan LED grow-light tersembunyi.
  2. **Bangku Taman Kayu Teak Minimalis:** Bangku panjang kayu jati tanpa sandaran dengan rangka besi hitam di atas kerikil hias.
  3. **Batu Taman Zen & Stepping Stones:** Jalan setapak lempengan batu alam abu-abu (*slate stepping stones*) yang tertanam rapi di atas rumput.
  4. **Pohon & Tanaman Hias Raksasa:** Pohon Fiddle Leaf Fig tinggi, tanaman Monstera Deliciosa besar, dan Snake Plant di pot semen beton.
  5. **Fountain Air Zen Minimalis:** Air mancur batu alam kecil dengan aliran air gemercik tenang untuk efek relaksasi.

---

## 4. Alur Navigasi Baru Agen (`src/stage/navigation.ts`)

Topologi bus akan menambahkan 2 portal utama:
```ts
FLOOR1_PORTALS.commonsSouth = { x: 20.0, z: 5.0 };
FLOOR1_PORTALS.busCommonsDoor = { x: 20.0, z: 5.0 };

FLOOR1_PORTALS.gardenNorth = { x: 24.5, z: 7.4 };
FLOOR1_PORTALS.busGardenDoor = { x: 24.5, z: 7.4 };
```

- **Alur Kerja Kolaboratif:** Agen-agen dari berbagai pod (Sari, Dimas, Tari, Gita, Bima) dapat berpindah ke Collaboration Commons untuk diskusi kelompok.
- **Alur Refreshing:** Agen yang selesai bekerja intensif dapat berjalan menuju Digital Garden untuk duduk santai di bangku taman kayu di bawah rimbunnya pepohonan.

---

## 5. Koreksi & Keputusan (dicek terhadap kode, 18 November 2026)

### A. Konflik rencana vs kode

| # | Bagian rencana | Masalah (bukti) | Keputusan |
|---|---|---|---|
| 1 | §3.A dinding barat Commons "menyatu dengan Ruang Rapat & Foyer" | Ruang rapat (`Office_Boardroom_Shell.glb`, `Curb_East`) dan foyer (`Curb_East` prosedural) **tidak punya dinding timur**, hanya curb 0,13 m. Dinding solid 3,2 m di X 15 dari kamera Tenggara menutupi ±4,4 m sisi timur ruang rapat (kursi N4/N5/S4/S5, lorong timur) dan sayap timur foyer. | Commons membangun dinding baratnya sendiri (partisi akustik, dunia X 15.0..15.24, Z -0.76..4.76), terdaftar `interior` (selalu memudar). Curb ruang rapat & foyer tetap. Sisi timur ruang rapat Z -5..-1 tetap terbuka sampai Studio dibangun. |
| 2 | §4 portal `commonsSouth = busCommonsDoor = (20, 5.0)`, `gardenNorth = busGardenDoor = (24.5, 7.4)` | Kedua sisi di titik yang sama, di garis dinding, dalam koordinat dunia. `FLOOR1_PORTALS` memakai koordinat **lokal** tiap ruangan; sisi bus di sumbu tengah koridor, sisi ruangan di dalam ruangan. Kesalahan yang sama dengan Tahap 2 & 3. | `busCommonsDoor (8, 0)` ↔ `commonsSouth (0, 2.35)` (dunia `(20, 6.2)` ↔ `(20, 4.35)`); `busGardenDoor (12.5, 0)` ↔ `gardenNorth (0, -2.35)` (dunia `(24.5, 6.2)` ↔ `(24.5, 8.05)`). |
| 3 | Rencana tidak menyebut mekanisme frontage & cangkang sisi utara | Tanpa `built: true`, kaca sementara bus menumpuk dengan dinding baru. Belum ada pembangun cangkang untuk ruangan di sisi utara bus. | Frontage `commons` (utara) & `garden` (selatan) `built: true`. Pembangun baru `rooms/northWing.ts` (cermin `southWing.ts`): kaca berpintu di dunia Z 4.76..5.00, dinding utara solid, sub-slab penuh. |
| 4 | §3.A dua bukaan pintu utara ke Studio & Information Wall | Ruangan di baliknya belum ada (tapak kosong). Dinding utara tetap solid dari kamera, jadi bukaannya akan memperlihatkan ruang kosong. | Kusen + daun pintu oak **tertutup** + papan "Segera · Tahap 6 / Tahap 5" (dunia X 17.5..18.5 dan 22.5..23.5). Bukan jalur navigasi sampai ruangannya dibangun. |
| 5 | §3.B jendela panorama di dinding selatan Garden | Dinding selatan berada di antara kamera Tenggara dan ruangan, jadi hampir selalu pudar di tampilan isometrik. | Jendela panorama tetap dibuat (terlihat di Free Cam), tetapi bukan fitur utama. |
| 6 | §3.B taman vertikal "melapisi" dinding barat Garden | Dinding barat Garden = dinding timur Server (`X 21.76..22.0`, selalu memudar). Green wall setinggi 2,4 m sepanjang 6 m menutupi bagian bawah muka rak server dan lorong timur Server dari kamera. | Keputusan CEO: green wall hanya di **separuh utara** (dunia Z 7.9..10.9). Separuh selatan diisi fountain dan tanaman ≤ 1 m. |

Catatan kecil: Commons (60 m²) adalah ruang terbuka terbesar kedua; ruang rapat (64 m²) lebih besar tetapi bukan ruang terbuka.

### B. Keputusan CEO (sebelum coding)

| Pertanyaan | Keputusan |
|---|---|
| Green wall | Separuh utara dinding barat, tinggi 2,4 m; fountain + tanaman rendah di separuh selatan. |
| Bingkai home kamera | Tetap X -7..15 (memasukkan Commons & Garden menurunkan zoom ±24%). Commons & Garden masuk dropdown "Fokus: ruangan" (11 ruangan). |
| Perilaku agen | Commons: tiap 90–150 dtk, 3–4 agen santai dari minimal 2 kelompok (pod barat / pod timur / meja eksekutif / manajer) berdiskusi 25–35 dtk. Garden: demo tiap 60–100 dtk; live saat status berubah `working/thinking/messaging → idle`; duduk 15–25 dtk. Keduanya bisa disela pekerjaan nyata (seperti kopi). |
| Aset 3D | Pakai ulang GLB yang ada (kursi ergonomis, lampu linear, whiteboard scrum, monstera, snake plant). Aset baru = placeholder prosedural + slot GLB bernama; kontraknya di §5.E. |

### C. Koordinat final (dunia, `1 unit = 1 m`)

| Elemen | Nilai |
|---|---|
| `Room_CollabCommons` | Pusat `(20, 2)`, tapak X 15..25, Z -1..5. Lantai bersih X 15.24..24.76, Z -0.76..4.76 |
| Dinding Commons | Selatan kaca `Z 4.76..5.0` + bukaan 1,6 m `X 19.2..20.8`; utara solid `Z -1.0..-0.76`; barat partisi akustik `X 15.0..15.24`; timur kaca `X 24.76..25.0` (barat & timur selalu memudar) |
| Meja kolaborasi / lampu | `(20.55, 2.12)`, 3,2 × 1,2 m (`X 18.95..22.15, Z 1.52..2.72`), atas 0,74; lampu linear 2,6 m di atasnya + 2 PointLight hangat |
| 6 kursi Commons | Utara `X 19.5 / 20.55 / 21.6, Z 1.2` menghadap Selatan (berdiri dulu di Z 0.45); selatan `Z 3.04` menghadap Utara (berdiri dulu di Z 3.8). Avatar duduk di `y 0.45` |
| Lorong cincin Commons | Persegi `X 17.55..23.35, Z 0.45..3.8`; rute memilih arah yang lebih pendek |
| Whiteboard / booth / tanaman | `(20.55, -0.42)` menghadap Selatan / booth pusat `(16.25, 0.25)` R 0,95 terbuka ke Tenggara / monstera `(24.35, -0.35)`, snake plant `(15.6, 2.6)` |
| `Room_DigitalGarden` | Pusat `(24.5, 10.4)`, tapak X 22..27, Z 7.4..13.4. Lantai bersih X 22.0..26.76, Z 7.64..13.16 |
| Dinding Garden | Utara kaca + pintu geser otomatis 1,6 m `X 23.7..25.3` (sensor 1,6 m); barat = dinding timur Server; timur `X 26.76..27.0` (dalam, ke Access Hub); selatan dinding luar + jendela panorama |
| Green wall / fountain | `X 22.0..22.15, Z 7.9..10.9`, tinggi 2,4, menghadap Timur / `X 22.08..22.63, Z 11.55..12.45`, permukaan air y 0,40 |
| Bangku teak & kursi | `X 24.55..26.35, Z 11.11..11.53`, dudukan 0,45; duduk di `X 24.85 / 25.45 / 26.05, Z 11.32` menghadap Selatan (y 0,35), berdiri dulu di Z 11.9 |
| Lorong batu pijakan | `(24.5, 8.05) → (24.5, 8.85) → (23.95, 8.85) → (23.95, 11.9) → (26.25, 11.9)` |
| Tanaman Garden | Fiddle leaf fig `(26.3, 8.2)`, monstera `(26.35, 12.7)`, snake plant `(26.45, 9.9)`; 3 batu zen |

### D. Peta file

| File | Isi |
|---|---|
| `src/stage/layout.ts` | `NorthRoomSpec`, `NORTH_ROOM_DOOR_INSIDE_Z`, `ROOM_COMMONS`, `COMMONS`, `ROOM_GARDEN`, `GARDEN`; frontage `commons` & `garden` `built: true` |
| `src/stage/rooms/northWing.ts` *(baru)* | `buildNorthRoomShell`: kaca berpintu sisi bus, dinding utara + kusen, sisi barat/timur solid atau kaca |
| `src/stage/rooms/collabCommons.ts` *(baru)* | Karpet geometris + list oak, pintu masa depan + papan, tulisan dinding, meja kolaborasi + spine daya, 6 kursi, laptop, whiteboard, booth akustik, lampu linear, tanaman |
| `src/stage/rooms/digitalGarden.ts` *(baru)* | Kerikil + rumput sintetis + batu pijakan slate, green wall + grow-light, fountain dengan air beranimasi, bangku teak, fiddle leaf fig, batu zen, jendela panorama, pintu geser otomatis |
| `src/stage/navigation.ts` | `ringLane`, `commonsPath`, `gardenPath`, 4 portal baru |
| `src/stage/IsometricOfficeStage.tsx` | Merakit 2 ruangan + zona + konektor. Errand baru `commons` (pose `discuss`) & `garden`; jadwal Commons & Garden; pemicu live `working → idle`; debug `commons(ids?)`, `garden(id)`, `errandState()` diperluas |
| `src/stage/officeDialogues.ts` | `COMMONS_GOING`, `COMMONS_CHAT`, `GARDEN_GOING`, `GARDEN_CHAT` |
| `src/stage/rooms/lobbyReception.ts` | Kios direktori: denah + hitungan Commons & Garden |
| `src/App.tsx` | Dropdown fokus 11 ruangan; label "Jalan Utama + 10 ruangan" |

### E. Slot GLB baru (placeholder prosedural, kontrak untuk prompt berikutnya)

Satuan meter; depan = `+Z`. Setiap GLB otomatis menggantikan placeholder begitu ada di `public/models/`.

| Slot GLB | Ukuran W × H × D | Origin & arah | Penempatan |
|---|---|---|---|
| `Office_Commons_Collab_Table` | 3,20 × 0,74 × 1,20 | Lantai tengah; sisi panjang = X. Tanpa laptop (props dipasang scene) | Commons, rotasi 0 |
| `Office_Commons_Acoustic_Booth` | Ø1,90 (setengah lingkaran) × 1,25 | Pusat lingkaran duduk di lantai; sandaran di setengah −Z (R 0,80..0,95), sisi terbuka +Z; dudukan 0,45; meja laptop Ø0,50 × 0,62 di pusat | Commons, rotY 45° (terbuka ke Tenggara) |
| `Office_Garden_Living_Wall` | 3,00 × 2,40 × 0,15 | Tengah sisi BELAKANG di lantai; tanaman di +Z; strip LED grow-light di atas | Garden, rotY 90° (menghadap Timur) |
| `Office_Garden_Zen_Fountain` | 0,90 × 0,85 × 0,55 | Lantai tengah; bibir bak 0,42; **air diisi scene** (permukaan y 0,40, 0,78 × 0,43); ujung pancuran di `(0.03, 0.655, 0.05)` | Garden, rotY 90° |
| `Office_Garden_Teak_Bench` | 1,80 × 0,45 × 0,42 | Lantai tengah; sisi panjang = X; tanpa sandaran | Garden, rotasi 0 |
| `Office_Plant_Fiddle_Leaf_Fig` | Kanopi ≤ Ø0,80 × 2,00; pot beton Ø0,42 × 0,45 | Lantai di tengah pot | Garden, sudut timur laut |

Dipakai ulang: `Office_Ergonomic_Chair` (6×), `Office_Linear_Pendant_Light`, `Office_Whiteboard_Scrum`, `Office_Indoor_Plant` (2×), `Office_Indoor_Plant_SnakePlant` (2×).

### F. Hasil verifikasi

- [x] `npm run typecheck` lulus; `npm test` 10 file / 64 test lulus; build live & `--mode demo` lulus.
- [x] Simulasi 600 detik: 1 rapat, 3 diskusi Commons dan 7 permintaan rehat Garden yang dipicu lewat hook debug, ditambah jadwal otomatis (kopi, Lounge, inspeksi Server, Commons, Garden). Pemeriksa tabrakan memeriksa agen yang berjalan terhadap perabot Commons/Garden/Lounge/Server/Lobi dan semua badan dinding/kaca/curb/kusen: **0 tabrakan**, tidak ada agen macet, semua kursi Commons & Garden kosong lagi di akhir. Satu-satunya temuan adalah lintel di atas pintu (Y 2,57–3,2), positif palsu.
- [x] Isometrik: dinding barat Commons memudar (ruang rapat tetap terlihat); tulisan dinding, papan "Segera", whiteboard, booth, dan meja terlihat dari kamera Tenggara. Green wall separuh utara tidak menutupi rak & konsol Server. Agen di bangku Garden menghadap kamera.
- [ ] Pemicu Garden mode live (`working → idle`) belum diuji dengan server nyata; logikanya memakai peta transisi status yang sama dengan pemicu pulang/datang Tahap 3.

### G. Catatan untuk Tahap 5
- Workshop / Training (dunia X 25..31, Z -1..5, utara bus): pakai `buildNorthRoomShell` dan set frontage `workshop` `built: true`. Dinding timur Commons (`X 24.76..25.0`, kaca) sudah ada, jadi Workshop cukup `sides: { west: false }`.
- Information Wall (blueprint X 21..26, Z -5..-1) menumpang di atas Commons **dan** Workshop. Saat dibangun, buka kusen `ROOM_COMMONS.northDoors[1]` (dunia X 23), lepas daun pintunya, dan tambahkan konektor `commons ↔ infowall`. Collaboration Pods (X 26..31) masuk lewat Workshop.
- Studio (Tahap 6, X 15..21, Z -5..-1) menutup sisi timur ruang rapat yang masih curb (Z -5..-1) dan memakai kusen `northDoors[0]` (dunia X 18).
- Bingkai home sengaja tidak mencakup X > 15. Bila ruangan timur bertambah, tetap gunakan dropdown fokus, atau tambahkan preset "Sayap Timur".
