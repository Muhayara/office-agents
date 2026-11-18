# Rencana Teknis Tahap 3 — Lobi & Resepsionis, Lounge, & Server / IT Room

Dokumen ini menjabarkan spesifikasi dan rincian implementasi **Tahap 3** dari denah [blueprint-lantai-1-v6.2.html](./blueprint-lantai-1-v6.2.html) ke scene 3D Three.js di `workspace/office-next`.

---

## 1. Tujuan Tahap 3

Setelah **Tahap 2** berhasil membangun Ruang Manajer dan Pantry / Café, **Tahap 3** akan melengkapi 3 ruangan krusial di **sayap selatan Jalan Utama**:

1. **Lobi & Resepsionis ($5 \times 6\text{ m} = 30\text{ m}^2$):**
   - Mengisi celah di antara Ruang Manajer dan Pantry ($X: -1.0 .. +4.0\text{ m}$).
   - Berfungsi sebagai gerbang masuk resmi gedung kantor virtual, meja resepsionis, dan titik *spawn* agen saat baru hadir / login.
2. **Lounge ($5 \times 6\text{ m} = 30\text{ m}^2$):**
   - Terletak di $X: +9.0 .. +14.0\text{ m}$, tepat di seberang Meeting Foyer dan Ruang Rapat.
   - Ruang santai elegan dengan sofa sudut empuk, meja kopi, dan pencahayaan hangat untuk rehat agen atau diskusi informal sebelum/sesudah rapat.
3. **Server / IT Room ($4 \times 6\text{ m} = 24\text{ m}^2$):**
   - Terletak di $X: +18.0 .. +22.0\text{ m}$.
   - **Menuntaskan relokasi akhir:** Memindahkan **2× Server Rack 42U** dari dinding selatan Ruang Kerja Utama ke ruangan berpendingin khusus ini.
   - Dilengkapi lantai *raised floor*, pendingin presisi, dan konsol terminal monitoring IT.
4. **Penyempurnaan Total Ruang Kerja Utama:**
   - Ruang Kerja Utama kini **100% bersih dari seluruh aset titipan** (Pantry sudah di Tahap 2, Server Racks di Tahap 3), menjadi ruang fokus kerja dan engineering yang murni dan lapang.

---

## 2. Pemetaan Koordinat 3D (`1 unit = 1 meter`)

Sistem koordinat mengacu pada rumus transformasi V6.2:  
`worldX = svgX_m - 7.0`, `worldZ = svgZ_m - 5.0`.

| Ruangan / Layer | Ukuran ($P \times L$) | Rentang Dunia `X` | Rentang Dunia `Z` | Titik Pusat (`origin`) | Pintu Masuk ke Bus (`Z = +7.4`) |
|---|---|---|---|---|---|
| **Room_LobbyReception** | $5.0 \times 6.0\text{ m}$ | `-1.0 .. +4.0` | `+7.4 .. +13.4` | `(+1.5, 0, +10.4)` | Tengah Utara: $X = +1.5\text{ m}$ (lebar 1.6 m) |
| **Room_PantryCafe** *(Tahap 2)* | $5.0 \times 6.0\text{ m}$ | `+4.0 .. +9.0` | `+7.4 .. +13.4` | `(+6.5, 0, +10.4)` | Tengah Utara: $X = +6.5\text{ m}$ |
| **Room_LoungeRelax** | $5.0 \times 6.0\text{ m}$ | `+9.0 .. +14.0` | `+7.4 .. +13.4` | `(+11.5, 0, +10.4)` | Tengah Utara: $X = +11.5\text{ m}$ (lebar 1.4 m) |
| **Focus Pods** *(Tahap 6)* | $4.0 \times 6.0\text{ m}$ | `+14.0 .. +18.0`| `+7.4 .. +13.4` | `(+16.0, 0, +10.4)` | *Tetap dinding kaca sementara* |
| **Room_ServerIT** | $4.0 \times 6.0\text{ m}$ | `+18.0 .. +22.0`| `+7.4 .. +13.4` | `(+20.0, 0, +10.4)` | Tengah Utara: $X = +20.0\text{ m}$ (lebar 1.0 m, akses RFID) |

---

## 3. Rincian Desain & Interior Tiap Ruangan

### A. Lobi & Resepsionis (`Room_LobbyReception` — $5 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Utara (`Z = +7.4`):** Pintu kaca otomatis geser ganda (*double sliding glass door*) selebar $1.6\text{ m}$ dengan sensor gerak dan pegangan pintu stainless steel panjang.
  - **Dinding Selatan (`Z = +13.4`):** Dinding marmer hitam Nero Marquina dengan logo metal timbul *"OFFICE AGENTS"* berlampu latar (*backlit LED warm white*).
  - **Lantai:** Marmer putih polesan tinggi (*polished white marble tiles*) dengan aksen garis border hitam tipis.
- **Furnitur & Aset 3D:**
  1. **Meja Resepsionis Melengkung:** Meja counter resepsionis kombinasi marmer Carrara dan bilah kayu vertikal, komputer terminal resepsionis, dan telepon interkom.
  2. **Kursi Resepsionis:** Kursi ergonomis modern di belakang counter.
  3. **Titik Spawn Agen:** Karpet bundar selamat datang (*welcome rug*) sebagai koordinat awal saat agen pertama kali aktif di gedung.
  4. **Papan Direktori Digital:** Standing kiosk layar sentuh vertikal menampilkan peta gedung lantai 1 dan status kehadiran agen.
  5. **Area Duduk Tamu Singkat:** 2 kursi aksen velvet warna teal dan meja bundar kecil.

---

### B. Lounge (`Room_LoungeRelax` — $5 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Utara (`Z = +7.4`):** Kaca transparan penuh (*clear architectural glass*) dengan bukaan tengah $1.4\text{ m}$ menghadap lurus ke Meeting Foyer ($X = 11.0\text{ m}$).
  - **Dinding Selatan (`Z = +13.4`):** Dinding cat sage green bertekstur dengan lukisan kanvas seni kontemporer dan rak buku dekoratif tipis.
  - **Lantai:** Karpet plush tebal abu-abu hangat (*warm grey plush carpet*) yang sangat nyaman.
- **Furnitur & Aset 3D:**
  1. **Sofa Sudut Mewah (Sectional L-Sofa):** Sofa sudut fabric warna krem/abu-abu terang dengan bantal aksen kuning mustard dan teal.
  2. **Coffee Table Rendah:** Meja kopi kayu walnut padat berkaki besi silang dengan buku arsitektur dan lilin aromaterapi dekoratif.
  3. **Lampu Lantai Melengkung (*Arc Floor Lamp*):** Lampu berdiri kubah kuningan melengkung di sudut sofa.
  4. **Rak Majalah & Tanaman:** Tanaman Areca Palm di pot keramik terakota dan standing magazine rack stainless.

---

### C. Server / IT Room (`Room_ServerIT` — $4 \times 6\text{ m}$)

- **Arsitektur & Dinding:**
  - **Dinding Utara (`Z = +7.4`):** Dinding partisi akustik kedap suara dengan pintu baja berpanel kaca kecil dan keypad akses kartu RFID di samping pintu ($X = +20.0\text{ m}$).
  - **Dinding Selatan, Barat, Timur:** Panel akustik peredam getaran warna abu-abu metalik.
  - **Lantai:** Ubin *Raised Access Floor* anti-statis (60×60 cm) dengan lubang ventilasi udara pendingin (*air grilles*).
- **Furnitur & Aset 3D:**
  1. **2× Server Rack 42U (`Server_Rack_42U.glb` — Pindahan Resmi):** Kedua rak server dari Ruang Kerja dipasang sejajar di tengah ruangan dengan kabel fiber optic rapi dan lampu LED status hijau/biru berkedip.
  2. **Unit AC Presisi Data Center (CRAC Unit):** Unit pendingin industri tinggi tegak di dinding timur untuk menjaga suhu ruangan server tetap dingin (18°C).
  3. **Konsol Meja IT Admin:** Meja kerja teknis sempit dengan kursi putar dan monitor ganda menampilkan grafik throughput jaringan, uptime server, dan monitoring keamanan database.
  4. **Kotak P3K & Tabung Pemadam Api Bersih (Clean Agent Extinguisher):** Di samping pintu masuk untuk standar keselamatan ruang data.

---

## 4. Pembaruan Jalur Navigasi Agen (`src/stage/navigation.ts`)

Topologi bus bertambah 3 portal baru:
```ts
FLOOR1_PORTALS.lobbyNorth = { x: 1.5, z: 7.4 };
FLOOR1_PORTALS.busLobbyDoor = { x: 1.5, z: 7.4 };

FLOOR1_PORTALS.loungeNorth = { x: 11.5, z: 7.4 };
FLOOR1_PORTALS.busLoungeDoor = { x: 11.5, z: 7.4 };

FLOOR1_PORTALS.serverNorth = { x: 20.0, z: 7.4 };
FLOOR1_PORTALS.busServerDoor = { x: 20.0, z: 7.4 };
```

- **Alur Agen Baru Masuk:** Agen spawn di Lobi ($X = +1.5$) $\rightarrow$ melangkah ke Jalan Utama $\rightarrow$ masuk ke Ruang Kerja lewat Pintu Barat atau Timur $\rightarrow$ duduk di meja kerja masing-masing.
- **Alur Santai Sebelum Rapat:** Agen dari Ruang Rapat $\rightarrow$ keluar Foyer $\rightarrow$ langsung menyeberang Jalan Utama ke Lounge ($X = +11.5$, hanya $3\text{ m}$ lurus).
- **Alur Maintenance IT:** Satria (Security) atau Bima (Programmer) $\rightarrow$ berjalan dari Ruang Kerja menuju Server Room ($X = +20.0$) untuk inspeksi server.

---

## 5. Hasil Analisa, Koreksi Plan & Status Implementasi

**Status:** Tahap 3 selesai diimplementasikan (17 November 2026). Tapak §2 dipakai apa adanya: Lobi `X -1..4`, Lounge `X 9..14`, Server / IT `X 18..22`, `Z 7.4..13.4`. Pintunya selebar 1,6 / 1,4 / 1,0 m di `X 1.5 / 11.5 / 20.0`. Ruas Focus Pods (`X 14..18`) tetap kaca sementara.

### A. Koreksi plan (ditemukan saat analisa, sebelum coding)

| # | Masalah di plan | Bukti (diukur dari kode / GLB) | Solusi yang diterapkan |
|---|---|---|---|
| 1 | Dinding samping Lobi & dinding barat Lounge tidak dibahas. | Dinding-dinding itu sudah ada: dinding timur Ruang Manajer (`X -1.24..-1.0`), dinding barat Pantry (`X 4.0..4.24`), dan dinding timur Pantry (`X 8.76..9.0`). | `buildSouthRoomShell` kini punya opsi `sides`. Lobi tidak membangun dinding samping (lebar bersih 5,0 m) dan Lounge tidak membangun dinding barat. |
| 2 | Portal §4 ditulis di garis dinding (`Z 7.4`) dengan koordinat dunia. | `FLOOR1_PORTALS` memakai koordinat lokal per ruangan (kesalahan yang sama terjadi di Tahap 2). | Portal bus di sumbu koridor (`Z 6.2`), portal ruangan di dalam ruangan (`Z 8.05`). |
| 3 | Logo "OFFICE AGENTS" (Lobi) & lukisan (Lounge) di dinding **selatan**. | Kamera `ISO_OFFSET (18, 12.95, 20)` memandang dari Tenggara: dinding selatan memudar dan muka dalamnya membelakangi kamera. | Logo pada dinding fitur marmer hitam di sisi **barat** Lobi, di belakang meja resepsionis yang menghadap Timur. Lukisan + rak tipis di muka barat Lounge. Dinding selatan tetap berlapis marmer hitam / cat sage. |
| 4 | CRAC setinggi ±1,9 m di dinding **timur** Server. | Sisi timur berada di antara kamera dan isi ruangan, sehingga CRAC menutupi rak & LED. | CRAC di dinding **barat**, menghadap Timur. Layar NOC juga dipasang di dinding barat. |
| 5 | Rak "sejajar di tengah ruangan" tanpa arah hadap. | GLB `Server_Rack_42U` menghadap +Z (LED ada di muka itu). | Kedua rak di tengah dengan muka ke Selatan (ke arah kamera). Lorong U mengitari rak (`polylineLane`). |
| 6 | Pintu Lounge disebut "lurus ke Foyer X 11,0", padahal ditempatkan di `X 11.5`. | Ada selisih 0,5 m dengan pintu foyer `X 10.15..11.85`. | Tetap `X 11.5` sesuai blueprint (ruangan simetris). Rute hanya berbelok 0,5 m di Jalan Utama. |
| 7 | Perilaku spawn agen, Lounge setelah rapat, dan inspeksi server belum ada. | Agen selalu mulai dalam posisi duduk di meja; saat offline agen hanya menghilang di kursi. | Diimplementasikan sesuai keputusan §5.B. |
| 8 | Memasukkan Server ke bingkai home menurunkan zoom ±16% (0,63 → 0,53 di 1440 × 900). | Diukur di browser. | Server dikeluarkan dari kotak bingkai. Ruangan itu tetap tampil utuh di pojok kanan bawah dan bisa difokuskan lewat dropdown. |

**Bug yang ditemukan saat verifikasi:** LED keypad RFID tidak berubah hijau karena `WallFader` mengklon material dinding saat registrasi. Warna kini diubah lewat material mesh yang aktif. Bar LED plafon Server juga dihapus karena scene tidak berplafon, sehingga bar itu terlihat melayang.

### B. Keputusan CEO (sebelum coding)

| Pertanyaan | Keputusan |
|---|---|
| Spawn Lobi | Live: agen yang online muncul di karpet Lobi lalu berjalan ke meja; agen yang offline berjalan ke Lobi lalu menghilang. Demo: saat halaman dibuka, agen datang bertahap (jeda 1,2 dtk). |
| Perilaku baru | Setelah rapat, 2–3 peserta duduk di sofa Lounge ±16–24 dtk lalu kembali ke meja. Satria/Bima yang sedang santai melakukan inspeksi Server / IT tiap 70–120 dtk (cek rak, lalu duduk di konsol). |
| Dinding fitur | Logo, lukisan, dan CRAC pindah ke sisi barat (menghadap kamera). |
| Fokus kamera | Satu dropdown "Fokus: ruangan" berisi 9 ruangan Lantai 1, menggantikan 4 tombol. |

### C. Koordinat final (dunia, `1 unit = 1 m`)

| Elemen | Nilai |
|---|---|
| Pintu Lobi / Lounge / Server | `X 0.7..2.3` (pintu geser ganda otomatis, sensor 1,6 m) / `X 10.8..12.2` / `X 19.5..20.5` (pintu baja berayun, sensor 1,5 m, keypad RFID di sisi Jalan Utama) |
| Karpet spawn Lobi | `(1.5, 10.95)`, menghadap pintu (Utara) |
| Dinding fitur logo | `X -1.0..-0.94`, `Z 9.7..12.5`, tinggi 2,6 m, menghadap Timur |
| Meja resepsionis | Puncak busur `(0.55, 11.1)`, muka cembung ke Timur; jejak `X -0.55..0.55, Z 9.9..12.3` (cincin R 0,756..1,60, ±48,6°; ledge 1,05 m, permukaan kerja 0,75 m); kursi di `(-0.5, 11.1)` |
| Kios direktori | `(3.4, 8.65)`, layar menghadap Selatan |
| Area tamu Lobi | Meja `(3.2, 12.05)`; kursi aksen `(2.48, 12.05)` menghadap Timur dan `(3.2, 11.32)` menghadap Selatan |
| Sofa L Lounge | Bagian utama `X 9.015..9.915, Z 10.545..13.145` (punggung di dinding barat); chaise `X 9.015..10.815, Z 12.232..13.145` (menyusuri dinding selatan). Kursi `(9.565, 11.072)` & `(9.565, 11.845)` menghadap Timur (berdiri dulu di `X 10.2`), tepi chaise `(10.4, 12.43)` menghadap Utara. Avatar duduk di `y 0.34`. Lorong Lounge: `(11.5, 8.05) → (11.5, 9.2) → (10.2, 9.2) → (10.2, 12.0)` |
| Meja kopi / lampu busur | `(10.825, 11.2)` 1,10 × 0,65 × 0,42 diputar 90° (`X 10.5..11.15, Z 10.65..11.75`) / kaki `(11.25, 12.75)`, di-yaw ke meja; rim kap `(10.93, y 1.65, 11.59)`, PointLight 10 cm di bawahnya |
| Lukisan / palm / rak majalah | Muka barat `X 9.0, y 1.85, Z 11.25` / `(9.57, 8.21)` (digeser dari `(9.35, 8.05)` agar kanopi Ø1,10 tidak menembus dinding barat & kaca utara) / `(9.3, 9.2)` |
| Rak server | `(19.615, 9.9)` & `(20.385, 9.9)`, muka ke Selatan; LED berdenyut 0,65 m di depannya |
| Lorong Server (U) | `(20.0, 8.75) → (21.25, 8.75) → (21.25, 11.05) → (19.4, 11.05)`; titik inspeksi `(20.0, 11.0)` menghadap rak |
| Konsol IT / kursi | Meja `X 20.15..21.55, Z 12.43..13.13` (menempel panel akustik); duduk di `(20.85, 12.22)` menghadap Selatan, berdiri dulu di `(20.85, 11.67)` |
| CRAC / NOC | `X 18.27..19.02, Z 10.8..12.0`, 1,20 × 0,75 × 2,05, menghadap Timur / `(18.245, y 1.75, 9.05)`, layar 85" diskala 0,65 (±55") |
| Pemadam / P3K | `(19.05, 7.78)` / dinding utara `(18.65, y 1.45, 7.66)` |

### D. Peta file

| File | Isi |
|---|---|
| `src/stage/layout.ts` | `ROOM_LOBBY/LOUNGE/SERVER`, `LOBBY`, `LOUNGE`, `SERVER`, frontage `built: true` |
| `src/stage/rooms/southWing.ts` | Opsi `sides` (melewati dinding tetangga) dan `north: 'solid'` (partisi penuh berpintu) |
| `src/stage/rooms/doors.ts` *(baru)* | `slidingGlassDoor` (pintu geser ganda otomatis) dan `swingSteelDoor` (baja + jendela intip + keypad RFID), dengan sensor jarak agen |
| `src/stage/rooms/lobbyReception.ts` *(baru)* | Marmer putih + list hitam, dinding fitur + logo berlampu, meja resepsionis melengkung, kios direktori (kanvas live), kursi aksen teal, karpet spawn, lampu cincin |
| `src/stage/rooms/loungeRelax.ts` *(baru)* | Karpet plush, cat sage, sofa L, meja kopi, lampu busur, areca palm, rak majalah, lukisan & rak tipis |
| `src/stage/rooms/serverRoom.ts` *(baru)* | Raised floor + grille, panel akustik, 2 rak + LED, tray fiber, CRAC, layar NOC (grafik beranimasi), konsol IT, pemadam & P3K |
| `src/stage/rooms/mainWorkspace.ts` | 2 server rack + LED dihapus dari ruang kerja |
| `src/stage/navigation.ts` | `polylineLane`, `lobbyPath`, `loungePath`, `serverPath`, 6 portal baru |
| `src/stage/IsometricOfficeStage.tsx` | Merakit 3 ruangan + konektor + walk zone. State baru: `away` / `walk_in_from_lobby` / `walk_out_to_lobby` / `walk_to_errand` / `errand_stay`. Juga: spawn demo & live, Lounge setelah rapat, jadwal inspeksi server, kios & KPI, dan debug `errandState()`, `lounge(id)`, `inspect(id)`, `leave(id)`, `arrive(id)` |
| `src/stage/officeDialogues.ts` | Dialog datang/pulang, Lounge, inspeksi server |
| `src/App.tsx` | Dropdown "Fokus: ruangan" (9 ruangan) |

### E. Slot GLB (placeholder prosedural)

Sudah disamakan dengan `tahap-3-3d-prompts.md` (kontrak lengkap di §5 dokumen itu). Satuan meter; depan = `+Z` kecuali disebut lain.

| Slot | Ukuran & pivot |
|---|---|
| `Office_Lobby_Reception_Desk.glb` | 2,40 × 1,05 × 1,10; origin = puncak busur depan di lantai, muka cembung ke −Z, pusat busur `(0, 0, 1.60)`, R 0,756..1,60, ±48,59° |
| `Office_Lobby_Directory_Kiosk.glb` | 0,55 × 1,75 × 0,45, origin bawah-tengah pelat; satu-satunya mesh `*Screen*` = `Kiosk_Screen` 43" (overlay kanvas dipaskan otomatis) |
| `Office_Lobby_Accent_Armchair.glb` / `Office_Lobby_Side_Table.glb` | 0,72 × 0,80 × 0,70 (dudukan 0,43) / Ø0,60 × 0,54 (permukaan marmer), origin lantai tengah; generator ada (lihat `tahap-3-prompts-tambahan.md`) |
| `Office_Lounge_Sectional_Sofa.glb` | 2,60 (X) × 0,78 × 1,80 (Z), origin = sudut belakang-kiri; hadap +Z, chaise di sisi −X; dudukan 0,44 |
| `Office_Lounge_Coffee_Table.glb` / `Office_Lounge_Arc_Floor_Lamp.glb` | 1,10 × 0,42 × 0,65, origin lantai tengah / kaki di origin, rim kap di `(0, 1.65, 1.20)`, tinggi 2,15 |
| `Office_Plant_Areca_Palm.glb` / `Office_Lounge_Magazine_Rack.glb` | Tinggi 1,70, kanopi maks. Ø1,10, pot Ø0,44 × 0,42 / 0,34 × 0,90 × 0,30 (majalah sampai 0,91), depan +Z; generator ada |
| `Office_Server_CRAC_Unit.glb` / `Office_Server_Admin_Console.glb` | 1,20 × 2,05 × 0,75 / 1,40 × 1,25 × 0,70; keduanya origin = belakang-bawah-tengah, depan +Z; konsol tanpa kursi |

Dipakai ulang: `Server_Rack_42U` (2×), `Office_Presentation_Display_85` (NOC, skala 0,65), `Office_Ergonomic_Chair` (resepsionis & konsol IT), `Office_Indoor_Plant`.

### F. Hasil verifikasi

- [x] `npm run typecheck` lulus; `npm test` 10 file / 64 test lulus; `vite build` live & `--mode demo` lulus.
- [x] Simulasi 600 detik (2 rapat, kunjungan ke Raka, uji pulang/datang, inspeksi server): **0 pelanggaran** dinding/perabot di 9 ruangan, tidak ada agen macet.
- [x] Demo: 10 agen datang bertahap dari karpet Lobi lalu duduk di mejanya. Uji pulang/datang lewat Lobi berjalan.
- [x] Setelah rapat, 3 peserta (Wulan, Fajar, Gita) duduk di 3 kursi sofa Lounge, lalu semuanya kembali ke meja. Rapat berkumpul dalam 25,4 dtk (batas 45 dtk).
- [x] Inspeksi otomatis Satria dimulai ±35–50 dtk setelah halaman dibuka (cek rak, lalu konsol IT). Uji manual dengan Bima juga berjalan.
- [x] Pintu otomatis Lobi bergeser terbuka saat agen mendekat. Pintu baja Server berayun ke dalam; LED keypad hijau saat terbuka dan merah saat tertutup.
- [x] Isometrik: logo, meja resepsionis, kios, sofa, lukisan, rak + LED, CRAC, dan layar NOC terlihat dari kamera Tenggara. Bingkai home pada zoom 0,63 menampilkan seluruh 9 ruangan.

### G. Catatan untuk Tahap 4
- Collaboration Commons (`X 15..25`, sisi **utara** Jalan Utama) dan Digital Garden (`X 22..27`, selatan). Dinding timur Server (`X 21.76..22.0`) sudah berupa dinding dalam, jadi Digital Garden cukup memakai dinding itu (`sides: { west: false }`).
- Ruangan di sisi utara bus belum punya pembangun cangkang; `southWing.ts` bisa dicerminkan (dinding kaca di `Z 4.76..5.0`).
- Bila bingkai home diperluas ke timur, zoom akan turun lagi. Pertimbangkan untuk tetap memakai dropdown fokus.
