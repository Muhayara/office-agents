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
