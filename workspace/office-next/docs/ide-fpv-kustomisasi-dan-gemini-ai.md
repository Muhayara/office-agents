# Dokumen Konsep & Ide: First-Person View, Kustomisasi Avatar, & Integrasi Multi-Key Gemini AI

> **Status:** Draft Diskusi Ide & Saran Arsitektur  
> **Tanggal:** 18 November 2026  
> **Fokus:** Transformasi Office Agents 2.5D menjadi *Immersive Virtual Living Office* dengan FPV Spectator, Avatar Tamu Interaktif, dan Otak AI Mandiri via Google Gemini API.

---

## 1. Ringkasan Visi & Filosofi Desain

Kita ingin membawa Office Agents dari sekadar **diorama isometrik pasif** menjadi **dunia virtual interaktif yang hidup** (*living virtual headquarters*):

1. **Prinsip Peran Agen (Autonomous Workers):**  
   Agen AI memiliki tugas dan rutinitas kerja nyata (ngoding, rapat, riset, rehat kopi di pantry, brainstorming di pods). Mereka bukan bidak catur yang bisa disuruh-suruh berjalan seenaknya oleh pengunjung sembarangan.
2. **Prinsip Kamera FPV Agen (Spectator Mode — Publik / Tanpa Login):**  
   Pengunjung tanpa login dapat melihat kantor dari "sudut pandang mata" agen (*first-person POV*). Pengunjung ikut merasakan apa yang dilihat agen saat mengetik di meja, menengok rekan kerja, berjalan ke ruang rapat, atau menyeduh kopi, namun **tidak bisa menggerakkan tubuh agen**.
3. **Prinsip Karakter Pengguna (Visitor Avatar — Wajib Login):**  
   Pengguna yang memiliki akun/token (CEO, staf, atau tamu terdaftar) dapat mendesain karakter 3D uniknya sendiri, lalu menjelajah kantor secara bebas dengan kontrol FPS (WASD / mouse look / virtual joystick) dengan sistem deteksi tabrakan fisik dinding dan perabot.
4. **Prinsip Kemandirian AI (Official Gemini API Pool):**  
   Menghentikan ketergantungan pada 9router lokal dan **membatalkan rencana me-root HP**. Sebagai gantinya, server menggunakan kolam (*pool*) beberapa Gemini API Key resmi dengan mekanisme load balancing dan rotasi otomatis.

---

## 2. Sistem Kamera & Mode Eksplorasi

### A. Hirarki Mode Kamera

```
[Mode Kamera]
  ├── 1. Isometrik Diorama (Default) ── Tinjauan makro seluruh lantai kantor
  ├── 2. Free Orbit / Cinematic ────── Kamera bebas berputar di atas partisi
  ├── 3. FPV Agen (Spectator) ──────── Menatap langsung dari mata agen yang sedang bekerja
  └── 4. FPV / TPV Avatar Tamu ────── Menjelajah mandiri dengan tubuh sendiri (Wajib Login)
```

### B. Mode 1: Agent FPV (Spectator Mode — Siapa Saja Bisa)
- **Cara Masuk:** 
  - Klik langsung avatar agen mana pun di layar, atau pilih nama agen dari menu *Eye-Cam* di HUD (contoh: *"Lihat dari Mata: Raka (Backend)"*).
- **Mekanika:**
  - Kamera menempel pada soket kepala/mata agen (`headBone` atau offset ketinggian mata `Y = 1.35m - 1.65m` tergantung agen duduk/berdiri).
  - Kamera mengikuti rotasi kepala dan arah hadap agen secara dinamis dan halus (*smooth slerp*).
  - Saat agen mengetik, pengguna melihat tangan avatar bergerak di keyboard dan baris kode berjalan di layar monitor.
  - Saat agen berjalan ke Pantry atau Boardroom, pengguna merasakan langkah kaki (*subtle head-bobbing*) melewati koridor dan pintu otomatis.
- **HUD FPV Agen:**
  - Menampilkan panel status agen di sudut layar:
    - Apa yang sedang dipikirkan agen (*Inner monologue / Thought bubble*).
    - Status tugas (*Task log*, misal: `Memperbaiki bug mutex pintu`).
    - Tombol *"Keluar dari Mata Agen"* untuk kembali ke kamera isometrik.
- **Restriksi:**
  - Kontrol pergerakan (WASD) dinonaktifkan. Pengguna adalah *penumpang pikiran* agen.

### C. Mode 2: User Avatar FPV / TPV (Interactive Explorer — Wajib Login)
- **Syarat:** Pengguna login dengan token/akun valid.
- **Spawn Point:** Masuk dari Lift (`Office_Access_Elevator_Portal`) atau Pintu Masuk Lobi (`LobbyReception`).
- **Pilihan Sudut Pandang:**
  - **FPV (First-Person):** Kamera di mata avatar sendiri. Memberikan sensasi berada langsung di dalam kantor skala 1:1.
  - **TPV (Third-Person / Over-the-Shoulder):** Kamera di belakang bahu avatar, sehingga pengguna bisa melihat pakaian, gaya rambut, dan animasi jalan karakternya sendiri.
- **Sistem Kontrol:**
  - **Desktop:** Pointer Lock API (klik layar untuk mengunci kursor mouse untuk menengok), tombol `W, A, S, D` untuk melangkah, `Shift` untuk jalan santai / jalan cepat.
  - **Mobile / Tablet:** Virtual Thumbstick kiri untuk gerak maju/mundur/strafe, area sentuh kanan untuk sapuan rotasi kamera (*swipe to look*).
- **Sistem Fisika & Tabrakan (Collision):**
  - Avatar pengguna memiliki kapsul collider fisik (radius 0,35m, tinggi 1,7m).
  - Tidak bisa menembus dinding, kaca partisi, meja, server rack, atau tanaman.
  - Terintegrasi dengan pintu geser otomatis: mendekati sensor pintu (`door mutex / trigger radius`) akan membuat pintu membuka otomatis dengan suara desis halus.
- **Interaksi Sekitar (Proximity Interaction):**
  - Dekati agen: Muncul prompt `[E] Bicara dengan Gita`.
  - Dekati Pantry: Muncul prompt `[E] Ambil Kopi`.
  - Dekati Sofa Lounge / Bangku Taman: Muncul prompt `[E] Duduk Santai`.
  - Dekati InfoWall: Layar Command Display menampilkan data status kantor secara interaktif.

---

## 3. Sistem Kustomisasi Karakter (Avatar Studio)

### A. Alur UX Kustomisasi
1. **Pintu Masuk:** Tombol *"Profil & Kostum"* di HUD pojok atas (hanya muncul saat sudah login).
2. **Ruang Ganti Virtual (Locker Room):** Layar beralih ke preview 3D avatar yang berputar lembut dengan pencahayaan studio.
3. **Penyimpanan Profil:** 
   - Konfigurasi disimpan di `localStorage` per peramban dan di-cache ke database SQLite (`data/office.db`) pengguna.
   - Karakter tetap tersimpan saat pengguna kembali di sesi berikutnya.

### B. Parameter Kustomisasi yang Direkomendasikan
Untuk mempertahankan performa tinggi (Intel UHD friendly) dan gaya visual low-poly/stylized office:

| Kategori | Opsi Kustomisasi | Implementasi Teknis |
| :--- | :--- | :--- |
| **Bentuk Tubuh & Gender** | Maskulin, Feminin, Netral | Variasi skala proporsi rig avatar |
| **Warna Kulit** | 6–8 pilihan palet warna kulit alami | Swap `color` pada `avatarSkinMaterial` |
| **Gaya Rambut** | Botak, Cepak, Belah Samping, Ikal, Kuncir Kuda, Bob, Berhijab | 7 mesh rambut modular yang di-attach ke `Head_Bone` |
| **Warna Rambut** | Hitam, Cokelat, Pirang, Merah Bata, Perak, Pastel | Swap `color` pada mesh rambut |
| **Atasan (Top)** | Kemeja Formal, Kaos Polos, Hoodie Kasual, Blazer Eksekutif | Variasi mesh torso + palet warna kustom |
| **Bawahan (Bottom)** | Celana Kain, Jeans, Rok Kerja, Chino | Variasi mesh kaki + tekstur/warna |
| **Sepatu** | Sneaker, Pantofel, Loafers | Variasi mesh kaki bawah |
| **Aksesoris** | Kacamata, Headphone Leher, Kartu ID Pegawai (Lanyard) | Attachment node ke `Neck_Bone` / `Head_Bone` |
| **Nama & Gelar** | Teks nama (misal: "Budi — Tamu VIP") | Sprite 2D floating text di atas kepala |

### C. Efisiensi Grafis Avatar Pengguna
- Memakai rig animasi yang sama persis dengan avatar agen di `src/stage/avatarRig.ts` (jalan, idle bernapas, duduk, menengok, mengetik).
- Semua part kustomisasi berbagi satu tekstur palet (*palette atlas texture* 256×256) sehingga **tidak menambah draw call baru** per render frame.

---

## 4. Arsitektur AI: Multi-Key Gemini API Pool (Selamat Tinggal 9router & Root HP)

### A. Mengapa Membatalkan Root HP adalah Keputusan yang Tepat?
1. **Risiko Keamanan & Perbankan:** Rooting membuka celah keamanan sistem operasi, memicu deteksi SafetyNet/Play Integrity, dan sering kali membuat aplikasi perbankan/keuangan tidak bisa dibuka.
2. **Ketidakstabilan Hardware & Baterai:** Menjadikan HP sebagai server lokal 24/7 dengan koneksi proxy tethering sering kali menyebabkan *thermal throttling*, baterai menggembung, dan koneksi putus-putus.
3. **Kompleksitas Perawatan:** Jika HP mati lampu, restart OS, atau terputus Wi-Fi, seluruh agen kantor lumpuh total.
4. **Keunggulan Gemini API Resmi:**
   - Respons dalam hitungan milidetik (*ultra-low latency*).
   - Resmi, stabil, dan memiliki kuota free tier yang sangat memadai (khususnya model Flash).
   - Server backend kita di PC/Cloud bisa langsung memanggil endpoint HTTPS Google tanpa perantara rumit.

### B. Multi-Key API Rotation Pool (Load Balancer Cerdas)
Untuk menghindari limit kuota (RPM/TPM atau 429 *Resource Exhausted*) pada akun gratis, kita membangun modul **`GeminiKeyPool`** di `@office/server`:

```
                    [ Permintaan Tugas / Obrolan Agen ]
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │       GeminiKeyPool Manager   │
                   │  - Round-Robin Selector       │
                   │  - Cooldown & Backoff Tracker │
                   │  - Health-Check Status        │
                   └───────┬───────────────┬───────┘
                           │               │
            Key #1 Aktif   │               │   Key #2 (Cadangan / Failover)
                   ▼                       ▼
          [ Google Gemini API ]   [ Google Gemini API ]
```

**Fitur Kunci `GeminiKeyPool`:**
- **Konfigurasi Mudah di `.env`:**
  ```dotenv
  GEMINI_API_KEYS=AIzaSyA...1,AIzaSyB...2,AIzaSyC...3
  GEMINI_MODEL=gemini-2.5-flash
  ```
- **Rotasi Seimbang (Round-Robin with Weights):** Setiap agen memanggil key secara bergantian agar beban terbagi rata.
- **Failover Otomatis saat 429 (Rate Limit):** Jika Key A terkena limit kuota per menit, Key A otomatis masuk status *Cooldown* selama 60 detik, dan permintaan langsung dialihkan seketika ke Key B tanpa membuat agen macet/gagal.
- **Model Rekomendasi:** 
  - `gemini-2.5-flash`: Sangat cepat, hemat token, dan sangat cerdas untuk percakapan agen, pembuatan kode, serta simulasi kantor.

### C. Persona & Otak 10 Agen
Setiap agen memiliki memori dan kepribadian mandiri:
- **Raka (Backend):** Pragmatis, memikirkan arsitektur, database, dan konkurensi.
- **Gita (Game Dev 2.5D):** Kreatif, fokus pada optimasi Three.js, visual, dan pengalaman pemain.
- **Maya (Frontend & UI/UX):** Perfeksionis pada estetika, warna, animasi, dan aksesibilitas.
- **Fajar (Tech Lead):** Menjaga standar kode, alur Git, dan koordinasi tim.
- **Agen Lainnya:** Sesuai matriks peran yang sudah ada di `src/roles.ts`.

---

## 5. Matriks Hak Akses & Keamanan (RBAC)

Agar kantor tidak disalahgunakan atau kehabisan kuota Gemini oleh pengunjung publik yang usil:

| Fitur | Tamu Publik (Tanpa Login) | Pengguna Terdaftar (Tamu Kantor) | CEO / Admin (`OFFICE_TOKEN`) |
| :--- | :---: | :---: | :---: |
| **Melihat Diorama 3D Isometrik** | ✅ Ya | ✅ Ya | ✅ Ya |
| **Kamera FPV Agen (Spectator)** | ✅ Ya (Hanya Nonton) | ✅ Ya | ✅ Ya |
| **Menggerakkan Agen** | ❌ Dilarang | ❌ Dilarang | ❌ Dilarang (Agen Otonom) |
| **Membuat Karakter Kustom** | ❌ Tidak | ✅ Ya (Tersimpan) | ✅ Ya (Tersimpan) |
| **Jalan Bebas FPV / TPV Avatar** | ❌ Tidak | ✅ Ya (Kamera + Tubuh Sendiri) | ✅ Ya (Kamera + Tubuh Sendiri) |
| **Ngobrol dengan Agen (Gemini AI)** | ❌ Read-Only (Hanya baca obrolan) | ✅ Ya (Dibatasi misal: 10 pesan/jam) | ✅ Tanpa Batas |
| **Menyetujui Tugas / CLI Server** | ❌ Dilarang | ❌ Dilarang | ✅ Mode Semi / Penuh |

---

## 6. Pentahapan Pengerjaan yang Direkomendasikan (Roadmap)

Agar pekerjaan terstruktur rapi, tidak bentrok, dan dapat diverifikasi di setiap langkah:

### 🔹 Tahap A: Fondasi FPV Agen (Spectator Mode di Frontend)
- Buat sistem kamera FPV yang bisa menempel pada kepala avatar agen mana pun.
- Buat dropdown/shortcut di HUD untuk memilih agen yang ingin dilihat matanya.
- Kunci kontrol WASD pada mode FPV agen dan beri tombol *Exit FPV*.
- Pasang animasi halus transisi kamera dari Isometrik ke FPV Agen.
- **Hasil yang bisa diuji:** Pengunjung web sudah bisa merasakan FPV dari mata Raka, Gita, Fajar, dll. saat mereka bekerja.

### 🔹 Tahap B: Mesin AI Gemini Multi-Key di Backend
- Hapus ketergantungan 9router di `@office/server`.
- Implementasikan `@google/genai` dengan modul `GeminiKeyPool` (mendukung banyak key di `.env`).
- Sambungkan agen server ke model `gemini-2.5-flash` untuk dialog dan evaluasi tugas.
- Hubungkan streaming respon agen ke WebSocket diorama (balon obrolan & layar monitor berubah dinamis).
- **Hasil yang bisa diuji:** Agen benar-benar berpikir dan berbicara dengan otak Gemini tanpa perantara ponsel.

### 🔹 Tahap C: Sistem Autentikasi Tamu & UI Kustomisasi Karakter
- Buat modal dialog *Avatar Studio* di `office-next`.
- Buat UI pemilihan gender, warna kulit, gaya rambut, pakaian, dan nama tamu.
- Tautkan sistem login sederhana (token/passcode tamu atau login akun) agar hanya pengguna terdaftar yang bisa membuat avatar.
- Simpan konfigurasi avatar di `localStorage` dan profil server.

### 🔹 Tahap D: Avatar Pengguna Fisik & Kontrol FPV/TPV Bebas
- Spawn mesh avatar pengguna di lobi/lift saat login berhasil.
- Pasang kontrol pergerakan (Pointer Lock mouse + WASD di PC; joystick virtual di HP/touch).
- Pasang collider kapsul agar avatar pengguna tidak bisa menembus dinding dan perabot.
- Tambahkan sensor interaksi: dekati agen untuk mengajak ngobrol, dekati kursi untuk duduk.

---

## 7. Saran & Masukan untuk Diskusi Awal

1. **Tentang Gemini Key:**
   - Bro bisa membuat 2 sampai 4 API key gratis dari akun Google yang berbeda di Google AI Studio (aistudio.google.com).
   - Dengan 3 key `gemini-2.5-flash`, kuota RPM (Requests Per Minute) dan RPD (Requests Per Day) sudah lebih dari cukup untuk 10 agen beroperasi seharian.
2. **Kamera Tamu: FPV vs TPV:**
   - Sangat disarankan menyediakan tombol toggle FPV (sudut pandang mata) dan TPV (kamera di belakang bahu). Dengan TPV, pengguna bisa melihat keindahan avatar dan pakaian yang sudah ia kustomisasi sendiri!
3. **Performa di Intel UHD:**
   - Karena sudah ada fondasi *Mode Grafis Hemat*, penambahan FPV justru sangat menguntungkan: saat kamera berada di dalam ruangan dalam mode FPV, sebagian besar ruangan lain di belakang kepala pemain akan terpotong oleh frustum culling, sehingga frame time render menjadi sangat ringan!

---
*Dokumen ini siap dijadikan acuan bersama sebelum kita menyusun spesifikasi teknis dan pembagian tugas pengerjaan.*
