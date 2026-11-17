# Rencana Teknis Tahap 2 — Ruang Manajer & Pantry / Café

Dokumen ini menjabarkan spesifikasi dan rincian implementasi **Tahap 2** dari denah [blueprint-lantai-1-v6.2.html](./blueprint-lantai-1-v6.2.html) ke scene 3D Three.js di `workspace/office-next`.

---

## 1. Tujuan Tahap 2

Setelah **Tahap 1** berhasil mendirikan jalan koridor utama (*bus*) sepanjang 38 meter dan klaster inti di sisi utara, **Tahap 2** mulai membangun ruangan di **sisi selatan Jalan Utama (seberang Ruang Kerja & Ruang Rapat)**:

1. **Ruang Manajer ($6 \times 6\text{ m} = 36\text{ m}^2$):**
   - Ruang kerja privat untuk Manajer (Raka) dan area diskusi review 1-on-1 dengan CEO.
   - Terletak di sayap barat daya, berseberangan langsung dengan pintu barat Ruang Kerja.
2. **Pantry / Café ($5 \times 6\text{ m} = 30\text{ m}^2$):**
   - Ruang sosial, santai, dan konsumsi makanan/minuman agen.
   - **Menuntaskan relokasi permanen:** Mengeluarkan Coffee Bar, Water Dispenser, dan Trash Bin yang sebelumnya menumpang di sudut barat daya Ruang Kerja ke ruangan Pantry ini.
   - Terletak di posisi strategis ($X: +4.0 .. +9.0\text{ m}$), tepat di seberang antara pintu timur Ruang Kerja ($X = +3.5\text{ m}$) dan Meeting Foyer ($X = +11.0\text{ m}$), sehingga alur agen ngopi dan istirahat sangat dekat.
3. **Pembersihan Ruang Kerja:**
   - Sudut barat daya Ruang Kerja yang sebelumnya padat oleh antrean kopi kini menjadi bersih dan lega untuk perluasan meja kerja di masa depan.

---

## 2. Pemetaan Koordinat 3D (`1 unit = 1 meter`)

Sistem koordinat mengacu pada rumus transformasi V6.2:  
`worldX = svgX_m - 7.0`, `worldZ = svgZ_m - 5.0`.

| Ruangan / Layer | Ukuran | Rentang Dunia `X` | Rentang Dunia `Z` | Titik Pusat (`origin`) | Pintu Masuk ke Bus (`Z = +7.4`) |
|---|---|---|---|---|---|
| **Room_ManagerOffice** | $6.0 \times 6.0\text{ m}$ | `-7.0 .. -1.0` | `+7.4 .. +13.4` | `(-4.0, 0, +10.4)` | Tengah Utara: $X = -4.0\text{ m}$ (lebar 1.4 m) |
| **Room_PantryCafe** | $5.0 \times 6.0\text{ m}$ | `+4.0 .. +9.0` | `+7.4 .. +13.4` | `(+6.5, 0, +10.4)` | Tengah Utara: $X = +6.5\text{ m}$ (lebar 1.4 m) |
| **Jalan Utama (Bus)** | $38.0 \times 2.4\text{ m}$ | `-7.0 .. +31.0` | `+5.0 .. +7.4` | `(+12.0, 0, +6.2)` | Koridor penghubung antar-ruangan |

> [!NOTE]
> Area di antara Ruang Manajer dan Pantry ($X: -1.0 .. +4.0\text{ m}$, ukuran $5 \times 6\text{ m}$) disiapkan untuk **Lobi & Resepsionis** yang akan dibangun pada **Tahap 3**. Di Tahap 2, ruas ini tetap berupa dinding kaca pembatas koridor (*glass frontage*).

---

## 3. Rincian Desain & Interior Tiap Ruangan

### A. Ruang Manajer (`Room_ManagerOffice` — $6 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Utara (`world Z = +7.4`):** Dinding partisi kaca gelap / acoustic wood panel dengan pintu geser kaca di tengah ($X = -4.0\text{ m}$). Terdaftar ke `WallFader` (`manager_north`).
  - **Dinding Selatan (`world Z = +13.4`):** Dinding luar gedung penuh setinggi 3.2 m dengan aksen acoustic slat walnut dan jendela pemandangan luar. Terdaftar ke `WallFader` (`manager_south`).
  - **Dinding Barat (`world X = -7.0`):** Dinding tepi barat gedung.
  - **Dinding Timur (`world X = -1.0`):** Dinding pemisah dengan calon Lobi (Tahap 3).
  - **Lantai:** Karpet akustik premium warna charcoal slate gelap dengan aksen border kayu tipis.
- **Furnitur & Aset 3D:**
  1. **Meja Eksekutif Raka:** Meja sudut berbentuk L kayu walnut gelap dengan kaki baja matte, laptop eksekutif, lampu meja arsitek, dan dokumen kerja.
  2. **Kursi Ergonomis Utama:** Kursi kulit high-back eksekutif untuk Raka.
  3. **2× Kursi Tamu:** Kursi lounge fabric di depan meja untuk sesi review 1-on-1 dengan CEO.
  4. **Display KPI & Monitor:** TV/Monitor dinding 55 inci di dinding timur untuk menampilkan metrik sprint dan status performa agen.
  5. **Rak Buku & Kredenza:** Kredenza rendah di belakang meja untuk plakat, buku teknis, dan file proyek.
  6. **Tanaman Hias:** Indoor Fiddle Leaf Fig di sudut barat daya.

---

### B. Pantry / Café (`Room_PantryCafe` — $5 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Utara (`world Z = +7.4`):** Bukaan pintu tengah terbuka lebar / kaca frameless di $X = +6.5\text{ m}$ menghadap Jalan Utama. Terdaftar ke `WallFader` (`pantry_north`).
  - **Dinding Selatan (`world Z = +13.4`):** Dinding perimeter selatan gedung dengan aksen subway tile keramik putih & rak gantung. Terdaftar ke `WallFader` (`pantry_south`).
  - **Dinding Barat (`world X = +4.0`):** Dinding partisi pemisah dengan calon Lobi.
  - **Dinding Timur (`world X = +9.0`):** Dinding partisi pemisah dengan calon Lounge (Tahap 3).
  - **Lantai:** Keramik mozaik abu-abu doff tahan air (*spill-proof matte tiles*) yang berbatasan mulus dengan karpet Jalan Utama melalui threshold kuningan.
- **Furnitur & Relokasi Aset 3D:**
  1. **Coffee Bar (Pindahan Resmi):** Mesin espresso komersial, grinder kopi, cup stack, sirup, dan meja barista dipindahkan dari Ruang Kerja ke dinding selatan Pantry.
  2. **Water Dispenser & Trash Bin (Pindahan):** Galon air minum dan tempat sampah recycle ditata rapi di sebelah meja counter dapur.
  3. **Kitchen Counter & Sink:** Meja counter cuci piring marmer dengan kabinet bawah kayu oak terang.
  4. **Kulkas Mini & Microwave:** Kabinet utilitas untuk camilan dan minuman dingin agen.
  5. **Meja Bar Island & 4× Kursi Bar Tinggi:** Meja komunal tinggi di tengah ruangan untuk tempat agen duduk santai menikmati kopi atau makan siang bersama.
  6. **Antrean Ngopi (Coffee Queue):** 4 titik antrean jalan yang lebih lega di depan meja espresso tanpa mengganggu lalu lintas meja kerja siapa pun.

---

## 4. Perubahan pada Ruang Kerja Utama (`Room_MainWorkspace`)

Dengan dipindahkannya Pantry ke ruangannya sendiri:
1. Menghapus objek `Coffee Bar`, `Water Dispenser`, `Trash Bin`, dan antrean lama dari sudut barat daya Ruang Kerja.
2. Memulihkan lantai karpet akustik di area barat daya menjadi area terbuka bersih.
3. Posisi `Server Rack 42U` di dinding selatan Ruang Kerja tetap dipertahankan sampai Ruang Server/IT selesai pada **Tahap 3**.

---

## 5. Pembaruan Jalur Navigasi Agen (`src/stage/navigation.ts`)

Topologi bus akan diperluas dengan menambahkan 2 ruangan baru ke router gedung:

```ts
// Portal Baru Tahap 2:
FLOOR1_PORTALS.managerNorth = { x: -4.0, z: 7.4 };
FLOOR1_PORTALS.busManagerDoor = { x: -4.0, z: 7.4 };

FLOOR1_PORTALS.pantryNorth = { x: 6.5, z: 7.4 };
FLOOR1_PORTALS.busPantryDoor = { x: 6.5, z: 7.4 };
```

- **Rute Ngopi:** Agen di Ruang Kerja $\rightarrow$ keluar lewat Pintu Timur ($X = +3.5$) $\rightarrow$ menyeberang sedikit di Jalan Utama ke $X = +6.5$ ($3\text{ m}$) $\rightarrow$ masuk Pantry $\rightarrow$ antre di Coffee Bar. Jarak total jalan kaki hanya $\sim 6\text{ m}$.
- **Rute Review Manajer:** Agen $\rightarrow$ keluar Pintu Barat ($X = -3.5$) $\rightarrow$ melangkah ke Pintu Manajer ($X = -4.0$) $\rightarrow$ masuk Ruang Raka. Jarak hanya $\sim 3\text{ m}$.

---

## 6. Rencana Eksekusi Teknis

1. **`src/stage/layout.ts`:**
   - Menambahkan definisi konstan `ROOM_MANAGER` dan `ROOM_PANTRY` (dimensi, origin, portal, dan zona jalan).
2. **`src/stage/rooms/managerOffice.ts` (File Baru):**
   - Merakit geometri ruangan, lantai karpet eksekutif, dinding, furnitur meja Raka, kursi, dan monitor KPI.
3. **`src/stage/rooms/pantryCafe.ts` (File Baru):**
   - Merakit geometri ruangan, lantai keramik, meja kitchen counter, meja bar, kursi bar, dan memindahkan Coffee Bar/Dispenser ke file ini.
4. **`src/stage/rooms/mainWorkspace.ts`:**
   - Menghapus klaster coffee bar lama dari area barat daya.
5. **`src/stage/rooms/mainCorridor.ts`:**
   - Membuka frontage kaca di ruas $X: -4.7 .. -3.3\text{ m}$ (pintu Manajer) dan $X: +5.8 .. +7.2\text{ m}$ (pintu Pantry) dengan kusen aluminium elegan.
6. **`src/stage/navigation.ts`:**
   - Menghubungkan room `manager` dan `pantry` ke graf bus koridor.
7. **`src/stage/IsometricOfficeStage.tsx`:**
   - Memasang kedua grup ruangan baru ke dalam `Floor_1_Group` dan mendaftarkan `WallFader`.

---

## 7. Hasil Analisa, Koreksi Plan & Status Implementasi

**Status:** Tahap 2 selesai diimplementasikan (17 November 2026). Tapak §2 (Ruang Manajer `X -7..-1`, Pantry `X 4..9`, `Z 7.4..13.4`, pintu tengah 1,4 m) dipakai apa adanya. Bagian di bawah mencatat hal yang **berbeda dari plan** beserta alasannya.

### A. Koreksi plan (ditemukan saat analisa, sebelum coding)

| # | Masalah di plan | Bukti (diukur dari kode / isi GLB) | Solusi yang diterapkan |
|---|---|---|---|
| 1 | Coffee Bar di **dinding selatan** Pantry: agen yang menyeduh tertutup badan bar dari kamera isometrik (masalah yang sama dengan Tahap 1). | Kamera `ISO_OFFSET (18, 12.95, 20)` = dari Tenggara, elevasi ±26°. Badan bar 0,92 m + mesin 1,27 m, avatar berdiri ±0,7 m. Dinding utara juga tidak muat: sisa dinding di samping pintu 1,56 m, sedangkan bar 1,8 m. | Bar di **dinding barat**, menghadap Timur. Antrean berbaris ke utara sepanjang muka bar (lihat §7.C). |
| 2 | TV KPI 55" di **dinding timur** Ruang Manajer. | Layar menghadap Barat, jadi dari kamera Tenggara yang terlihat hanya punggung TV. Dinding timur juga memudar di isometrik. | TV di **dinding barat** di atas kredenza (di belakang Raka), menghadap tamu & kamera. Satu-satunya dinding Ruang Manajer yang tetap solid dari kamera Tenggara adalah dinding barat (tepi gedung). |
| 3 | Portal §5: `managerNorth` = `busManagerDoor` = `(-4.0, 7.4)` (begitu juga Pantry). | Titik ada tepat di garis dinding dan ditulis dalam koordinat dunia, padahal `FLOOR1_PORTALS` memakai koordinat **lokal** per ruangan. Titik yang sama di kedua sisi juga membuat `roomAt` ambigu. | Portal Jalan Utama di sumbu koridor (`z = 0` lokal, dunia `Z 6.2`); portal ruangan di dalam ruangan (`z = -2.35` lokal, dunia `Z 8.05`). |
| 4 | §6.5 "membuka frontage kaca di `mainCorridor.ts`". | Bertentangan dengan mekanisme Tahap 1 (`BUS_FRONTAGE_SOUTH.built = true` → ruangan membawa dinding berpintunya sendiri). Curb kaca 11 cm juga akan melintang di bukaan pintu. | Ruas `manager` & `pantry` diubah ke `built: true`. Tiap ruangan membangun dinding kaca utaranya sendiri lewat `buildGlassWallX`, yang kini mendukung `doors` (curb terputus, kusen, palang + kaca transom), `threshold`, dan `band`. |
| 5 | Dinding utara hanya disebut "terdaftar ke `WallFader`". | Bila didaftarkan sebagai dinding tepi, rangka kaca utara menutupi Jalan Utama dari kamera Tenggara. | `manager_north` / `pantry_north` didaftarkan `interior: true` (selalu pudar di tampilan rumah boneka). |
| 6 | Kulkas + microwave dan rak buku tanpa posisi pasti. | Benda setinggi 1,85–2,06 m di sisi utara ruangan menutupi Jalan Utama di depan pintu (contoh: kabinet di `Z 7.64..8.24` menutupi `X ±6.5..7.5`). | Benda tinggi **hanya di dinding barat**: kabinet utilitas di sudut barat daya Pantry, rak buku di dinding barat Ruang Manajer. |
| 7 | "Jarak total jalan kaki hanya ±6 m / ±3 m". | Angka itu hanya ruas Jalan Utama. | Jarak sebenarnya: meja Bima → antrean 24,1 m; Sari → titik review Raka 23,6 m. Akibatnya alur kopi lama (minum di meja, buang cup di Pantry) membuat agen bolak-balik 2× (keputusan §7.B). |
| 8 | Meja eksekutif Raka di Ruang Manajer tidak membahas meja Raka yang sudah ada di Ruang Kerja (terikat status live). | `AGENT_3D_POSITIONS.raka` di `(-3.8, -3.8)` Ruang Kerja; workstation dibangun di `main.workstations`. | Meja punya `room` (`main` / `manager`) dan koordinat lokal ruangannya; workstation dipasang ke sub-layer ruangan itu (keputusan §7.B). |
| 9 | Dinding barat Pantry (calon Lobi) setinggi 3,2 m. | Dari kamera Tenggara dinding itu menutupi ruas Jalan Utama `X ≈ 0,5..3,2`, jalur yang dilalui agen yang hendak ke Pantry. | Didaftarkan sebagai dinding dalam (keputusan §7.B). |

**Bug yang ditemukan saat verifikasi:** saat antrean maju, agen yang masih di perjalanan diberi garis lurus ke slot barunya. Di Tahap 1 aman karena semua ada di satu ruangan; sekarang agen bisa menembus dinding Jalan Utama. Diperbaiki dengan `moveToQueueSlot`: agen yang sudah di garis antrean melangkah lurus, sisanya dirute ulang lewat pintu.

### B. Keputusan CEO (sebelum coding)

| Pertanyaan | Keputusan |
|---|---|
| Meja Raka | Pindah ke Ruang Manajer; bekas mejanya di Ruang Kerja diisi Whiteboard Scrum (GLB yang sudah ada) |
| Posisi Coffee Bar | Dinding barat Pantry, antrean sejajar bar |
| Alur kopi | Seduh → duduk di kursi bar island → buang cup di Pantry → kembali ke meja. Bila 4 kursi penuh, kopi dibawa ke meja (alur lama) |
| Dinding barat Pantry & timur Ruang Manajer / Pantry | Dinding dalam: selalu pudar di tampilan rumah boneka; perabot yang menempel (bar, menu, kabinet) tetap solid |

### C. Koordinat final (dunia, `1 unit = 1 m`)

| Elemen | Nilai |
|---|---|
| Dinding kaca utara (kedua ruangan) | `Z 7.40..7.64` (garis yang sama dengan kaca sementara, lebar Jalan Utama tetap 2,4 m); ambang di bukaan `Z 7.40..7.64` |
| Pintu Ruang Manajer / Pantry | `X -4.7..-3.3` / `X 5.8..7.2`, tinggi bukaan 2,57 m |
| Portal (bus ↔ ruangan) | `(-4.0, 6.2) ↔ (-4.0, 8.05)` dan `(6.5, 6.2) ↔ (6.5, 8.05)` |
| Dinding selatan / barat / timur | `Z 13.16..13.40`; tepi tapak ± 0,24 m (`X -7.00..-6.76`, `-1.24..-1.00`, `4.00..4.24`, `8.76..9.00`) |
| Meja L Raka | pusat sayap utama `(-5.0, 10.4)`, `rotY -π/2` (return ke Selatan sampai `x -6.2`); kursi `(-5.55, 10.4)` menghadap Timur; titik tamu `(-4.2, 10.4)` |
| Kredenza / TV KPI / rak buku | `(-6.535, 10.4)` / `(-6.755, y 1.78, 10.4)` skala 0,65 / `(-6.56, 8.45)`, semua menghadap Timur |
| Kursi tamu | `(-3.55, 9.8)` dan `(-3.55, 11.0)`, menghadap meja |
| Lorong Ruang Manajer | `Z = 8.6` (semua titik disambung Utara–Selatan ke lorong ini) |
| Coffee Bar / mesin espresso | pusat `(4.565, 10.9)` menghadap Timur / `Z 11.37` |
| Antrean kopi | `X = 5.35`: slot 0 `Z 11.37` menghadap Barat (mesin), slot 1–3 `Z 10.47 / 9.57 / 8.67` menghadap Selatan |
| Dispenser / kabinet utilitas | `(4.43, 12.04)` / belakang menempel dinding barat `x 4.24`, `z 12.35..13.15`, menghadap Timur |
| Kitchen counter + sink | `X 4.95..8.15`, `Z 12.51..13.16` (belakang menempel dinding selatan), atas 0,90 m, backsplash sampai 1,25 m |
| Bar island / kursi bar | `X 7.3..8.2`, `Z 9.2..11.6`, tinggi 1,05 m / `X 7.0`, `Z 9.775 / 10.325 / 10.875 / 11.425`, dudukan 0,75 m, avatar duduk `y 0.65` menghadap Timur |
| Tempat sampah / titik berdiri | `(7.55, 7.86)` / `(7.55, 8.35)` menghadap Utara (dibuang sambil keluar) |
| Lorong tengah Pantry | `X = 6.5` (segaris pintu, di antara garis antrean dan kursi bar) |
| Whiteboard Scrum Ruang Kerja | `(-3.8, -4.47)` (bekas meja Raka) |

### D. Peta file

| File | Isi |
|---|---|
| `src/stage/layout.ts` | `DeskSpot.room/style`, `ROOM_MANAGER`, `ROOM_PANTRY`, `MANAGER`, `PANTRY`, `SOUTH_ROOM_DOOR_INSIDE_Z`, frontage `built: true`. Konstanta pantry lama di Ruang Kerja dihapus |
| `src/stage/rooms/southWing.ts` *(baru)* | `buildSouthRoomShell`: cangkang ruangan sisi selatan bus (sub-slab, kaca utara berpintu + ambang, dinding S/B/T, registrasi `WallFader`). Dipakai ulang untuk Lobi, Lounge, dan Server / IT di Tahap 3 |
| `src/stage/rooms/managerOffice.ts` *(baru)* | Karpet + list walnut, kaca gelap + privacy band, daun pintu geser terparkir, jendela kota + slat walnut, kredenza, TV KPI (kanvas), rak buku, kursi tamu, meja L Raka |
| `src/stage/rooms/pantryCafe.ts` *(baru)* | Keramik mozaik, Coffee Bar + dispenser + papan menu, kabinet utilitas, counter + sink, backsplash subway tile + rak gantung, bar island + 4 kursi bar + lampu gantung, tempat sampah daur ulang |
| `src/stage/rooms/walls.ts` | `buildGlassWallX` mendukung `doors`, `threshold`, `band`; `smokedGlassWallMats`, `brassMat` |
| `src/stage/rooms/mainWorkspace.ts` | Pantry sementara dihapus; Whiteboard Scrum di bekas meja Raka |
| `src/stage/navigation.ts` | `managerPath` / `pantryPath` (lorong tunggal, `busPath` & `foyerPath` memakai pembangun yang sama), `visitSpotFor` per ruangan, portal baru |
| `src/stage/IsometricOfficeStage.tsx` | Rakit 2 ruangan, konektor, walk zone, bingkai home; meja per ruangan; state `walk_to_stool` & `sipping_at_bar`; `moveToQueueSlot`; TV KPI; debug `pantryState()`, `coffee(id)`, `visit(from, to)` |
| `src/stage/officeDialogues.ts` | Dialog `going_to_pantry`, `walking_to_bar`, `sipping_at_bar` |
| `src/App.tsx` | Tombol HUD `Fokus: Manajer` & `Fokus: Pantry` |

### E. Slot GLB baru (placeholder prosedural sampai file-nya ada di `public/models/`)

Nama, ukuran, dan pivot mengikuti `tahap-2-3d-prompts.md` (lihat §5 di sana). Generator HTML-nya ada di `tools/3d-generator/<nama>.html`. Satuan meter, depan = `+Z`.

| File | Ukuran & pivot |
|---|---|
| `Office_Manager_L_Desk.glb` | 2,10 × 0,75 × 1,60 m. Origin = pusat sayap utama 1,80 × 0,80 (atas 0,75). Sayap return (atas 0,72) di sisi `+X` (kanan Raka) menjorok ke `+Z` sampai `Z 1.2`. Agen duduk di `+Z`. Monitor/keyboard dipasang panggung |
| `Office_Manager_Executive_Chair.glb` | Lebar armrest 0,68, tinggi 1,21, dudukan 0,48, armrest 0,675 (di bawah kolong meja 0,705). Origin di bawah gas lift. Kursi ergonomis jadi placeholder |
| `Office_Guest_Lounge_Chair.glb` | 0,62 × 0,82 × 0,60 m, dudukan 0,44. Origin pusat tapak |
| `Office_Pantry_Kitchen_Counter.glb` | 3,20 × 0,65 m, atas 0,90, backsplash sampai 1,25, bak cuci di `X +0.6`. Origin = tengah sisi BELAKANG (menempel dinding) |
| `Office_Pantry_Utility_Cabinet.glb` | 0,80 × 1,85 × 0,60 m: kulkas kaca 0–0,85, ceruk microwave 0,85–1,35, lemari atas (pintu terbuka 32°). Origin = tengah sisi BELAKANG |
| `Office_Pantry_Bar_Island.glb` | 0,90 (X) × 1,05 × 2,40 (Z) m, memanjang Z. Origin pusat lantai |
| `Office_Pantry_Bar_Stool.glb` | 0,46 × 0,96 × 0,46 m, dudukan 0,75, sandaran rendah di `-Z`. Origin di bawah dudukan |

Aset yang dipakai ulang: `Office_Coffee_Bar`, `Office_Water_Dispenser`, `Office_Boardroom_Credenza` (kredenza Raka), `Office_Presentation_Display_85` (diskala 0,65 → 55"), `Office_Bookshelf_Cabinet`, `Office_Whiteboard_Scrum`, `Office_Indoor_Plant` (pengganti Fiddle Leaf Fig), `Office_Indoor_Plant_SnakePlant`. "Laptop eksekutif" diganti monitor status standar karena monitor itu yang menampilkan status live agen.

### F. Hasil verifikasi

- [x] `npm run typecheck` lulus (shared, server, web, office-next).
- [x] `npm test` lulus: 10 file, 64 test.
- [x] `vite build` live dan `--mode demo` lulus (dengan `TEMP`/`TMP` diarahkan ke `.esbuild-tmp`, lihat catatan Tahap 1).
- [x] Simulasi 600 detik (2 rapat, kunjungan ke & dari Raka, rutinitas kopi alami): **0 pelanggaran**. Tidak ada agen yang menembus dinding atau perabot (island, counter, bar, kabinet, meja Raka, kredenza, kursi tamu, rak buku), dan tidak ada yang macet. Maksimum 3 agen sekaligus di Pantry dan 2 kursi bar terisi; fallback "kopi dibawa ke meja" tidak pernah terpicu.
- [x] Rapat: seluruh 10 agen duduk dalam **22,5 detik** (sebelumnya ±26 detik). Rute Raka → pintu Ruang Rapat 25,8 m (sebelumnya 30,2 m).
- [x] Isometrik: bingkai home mencakup 6 ruangan (zoom 0,65 di 1440 × 900). Dinding utara, timur, selatan, dan dinding barat Pantry memudar; dinding barat Ruang Manajer (kredenza + TV KPI) tetap solid. Agen yang menyeduh terlihat dari depan. Juga dicek dari sudut berlawanan (orbit 180°): jendela kota + slat dan backsplash tampil solid.
- [x] Free Cam jalan kaki: dinding utuh 3,2 m di Pantry & Ruang Manajer; dari Jalan Utama pintu, kaca gelap + privacy band, dan ambang terlihat rapi.

### G. Catatan untuk Tahap 3
- **Lobi (`X -1..4`)** diapit dinding timur Ruang Manajer (`X -1.24..-1.00`) dan dinding barat Pantry (`X 4.00..4.24`). Keduanya sudah berupa dinding dalam, jadi Lobi cukup memakai dinding itu (tanpa dinding barat/timur sendiri, lebar bersih `X -1.0..4.0` = 5,0 m). Bangun dengan `buildSouthRoomShell` tanpa sisi samping, atau tambahkan opsi `sides`.
- **Lounge (`X 9..14`)**: dinding timur Pantry (`X 8.76..9.00`) sudah berupa dinding dalam.
- Setiap ruangan baru: `built: true` di `BUS_FRONTAGE_SOUTH`, `NavRoom` + konektor ke `bus`, walk zone, dan masuk ke kotak bingkai home.
- Server Rack pindah ke Server / IT (`X 18..22`); posisinya di dinding selatan Ruang Kerja masih dipertahankan.
