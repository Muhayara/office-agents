# Spesifikasi Arsitektur Tata Ruang Kantor Virtual 3D (`room-spec.md`)
*Dirancang oleh: Tari (Desainer UI/UX) & Wulan (Artist) — Standar Hallmark & Anti-Slop*

Dokumen ini mendefinisikan denah, dimensi fisik, pembagian zona lantai, partisi kaca, serta koordinat peletakan furnitur untuk **Kantor Virtual 10 Agen**.

---

## 1. Parameter Fisik Ruangan (Isometric Cutaway Diorama)

- **Gaya Arsitektur:** Modern Minimalist Industrial Command Center (Diorama terbuka 2 sudut).
- **Dimensi Total:** 
  - **Panjang (Sumbu X):** 14 meter (14 unit grid)
  - **Lebar / Kedalaman (Sumbu Z):** 10 meter (10 unit grid)
  - **Tinggi Dinding (Sumbu Y):** 3.2 meter
  - **Skala Grid:** 1 petak = `1.0m × 1.0m` (toleransi jalan kaki antar meja minimal 1.2m).
- **Struktur Dinding:**
  - **Dinding Belakang (Z = 0):** Dinding solid cat abu-abu gelap (`#14232A`) dengan panel aksen akustik kayu dan jendela kaca horizontal tipis di bagian atas.
  - **Dinding Kiri (X = 0):** Dinding solid dengan rak pajangan dan logo kantor timbul berpendar lembut.
  - **Dinding Depan (Z = 10) & Kanan (X = 14):** **Terbuka (Cutaway)** setinggi 0.2m (hanya lis lantai) agar kamera isometrik bebas memandang ke dalam ruangan tanpa halangan.

---

## 2. Pembagian 4 Zona Departemen & Tekstur Lantai

| Zona | Koordinat Grid (X, Z) | Departemen & Anggota | Karakteristik Lantai & Suasana |
|---|---|---|---|
| **Zona A: Komando & Strategi** | `X: 1 - 5, Z: 1 - 4` | **Raka** (`manager`), **Sari** (`researcher`), **Dimas** (`writer`) | Lantai parket kayu gelap hangat (`#1A2C34`). Meja manajer menghadap ke seluruh ruangan. Papan kanban strategi di dinding belakang. |
| **Zona B: Studio Kreatif & Desain** | `X: 1 - 5, Z: 5 - 8` | **Tari** (`designer`), **Wulan** (`artist`) | Lantai karpet abu-abu lembut (`#1E333D`). Suasana estetik dengan papan moodboard dan tanaman hias monstera di sudut. |
| **Zona C: Engineering & Game Lab** | `X: 7 - 12, Z: 1 - 5` | **Bima** (`coder`), **Gita** (`gamedev`) | Lantai semen poles abu-abu industri (`#172830`) dengan aksen garis neon biru data (`#4DA8DA`) di lantai. Duduk berdampingan dengan setup multi-monitor. |
| **Zona D: QA & Security Vault** | `X: 7 - 12, Z: 6 - 9` | **Satria** (`security`), **Laras** (`reviewer`), **Fajar** (`visual_qa`) | Lantai graphite doff gelap (`#111C22`). Dikelilingi sekat partisi kaca tempered transparan dengan pintu geser terbuka. Memuat rak server rack 42U di pojok. |
| **Lorong Utama (Walkway)** | `X: 5.5 - 6.5, Z: 1 - 9` | Koridor publik bebas hambatan | Lebar koridor 1.5 meter menghubungkan pintu masuk lobi hingga ke dinding belakang. |
| **Lobi & Coffee Bar** | `X: 1 - 4, Z: 8.5 - 9.5` | Area rehat & resepsionis | Mesin kopi espresso, dispenser air, meja bar tinggi, dan sofa santai 2 dudukan. |

---

## 3. Matriks Koordinat Meja 10 Kursi Karyawan

Tiap meja kerja berukuran standar modular: **Panjang 1.4m × Lebar 0.7m × Tinggi 0.75m**.

| Agen | Jabatan | Posisi Meja (X, Z) | Arah Hadap | Ciri Khas Meja |
|---|---|---|---|---|
| **Raka** | Manajer | `X: 3.0, Z: 1.5` | Menghadap ke Selatan (+Z) | Meja terluas, papan kanban di belakang, dokumen proyek. |
| **Sari** | Peneliti | `X: 1.5, Z: 3.5` | Menghadap ke Timur (+X) | Tumpukan buku referensi, tablet riset, lampu meja hangat. |
| **Dimas** | Penulis | `X: 4.5, Z: 3.5` | Menghadap ke Barat (-X) | Keyboard mekanikal rapi, cangkir kopi, monitor vertikal teks. |
| **Tari** | Desainer UI/UX | `X: 1.5, Z: 6.5` | Menghadap ke Timur (+X) | Layar display lebar color-accurate, tablet gambar stylus. |
| **Wulan** | Pixel Artist | `X: 4.5, Z: 6.5` | Menghadap ke Barat (-X) | Monitor preview aset game, figurin maskot meja, tanaman kaktus mini. |
| **Bima** | Programmer | `X: 8.5, Z: 2.0` | Menghadap ke Selatan (+Z) | Setup dual monitor horizontal + vertikal, stiker dev di casing mini. |
| **Gita** | Game Dev 3D | `X: 11.5, Z: 2.0` | Menghadap ke Selatan (+Z) | Layar preview kanvas 60fps, controller gamepad di samping keyboard. |
| **Satria** | Auditor Keamanan | `X: 8.5, Z: 7.5` | Menghadap ke Utara (-Z) | Bersebelahan langsung dengan Server Rack 42U, monitor terminal status hijau. |
| **Laras** | Reviewer Kode | `X: 11.5, Z: 7.5` | Menghadap ke Utara (-Z) | Layar perbandingan diff file side-by-side, checklist review rapi. |
| **Fajar** | Visual QA | `X: 10.0, Z: 6.0` | Menghadap ke Selatan (+Z) | Monitor pengujian browser responsive dengan grid garis bantu UI. |

---

## 4. Pencahayaan & Suasana (Lighting Setup)

Sesuai filosofi *dark mode parity* (Hallmark):
- **Cahaya Ambien (Ambient Light):** Warna biru gelap lembut (`#0F1A1F`), intensitas 0.4.
- **Cahaya Utama (Directional Sun/Ceiling Light):** Cahaya putih netral lembut dari sudut serong atas (`x: 10, y: 15, z: 10`) dengan bayangan halus (*soft shadow*).
- **Lampu Meja & LED Aksen:**
  - Lampu baca hangat (`#E9A23B`) di meja Raka, Sari, dan Dimas.
  - Sinar pendar monitor biru muda (`#63C3D9`) dan hijau (`#5DBB8A`) di zona Engineering & Keamanan.
  - Indikator LED server rack Satria berkedip halus.
