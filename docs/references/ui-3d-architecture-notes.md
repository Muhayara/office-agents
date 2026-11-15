# Catatan Referensi Visual, 3D, & Arsitektur UI Virtual Office (`docs/references/ui-3d-architecture-notes.md`)

> **Status Dokumen:** *Living Knowledge Base* (Catatan aktif internal untuk referensi desain, teknologi 3D, dan tata letak UI yang dikumpulkan bersama pengguna).  
> **Tujuan:** Menjadi acuan tunggal saat menyusun rencana implementasi (*plan*), sehingga seluruh preferensi visual, arsitektur dashboard, dan teknologi 3D tetap presisi dan tidak membingungkan.

---

## 1. Visi Utama & Standar Kualitas Proyek

- **Tujuan Akhir:** Membangun platform **Virtual Office AI** yang rapi, hidup, dan memukau seperti kantor asli untuk di-hosting secara publik.
- **Dua Persona Pengguna:**
  1. **CEO (Pemilik/Pengguna):** Memiliki kendali penuh untuk mengirim instruksi, mengelola perizinan terminal/approval, memilih model, serta memantau kesehatan sistem.
  2. **Pengunjung / Publik (*Spectator Mode*):** Hanya dapat menonton aktivitas ke-10 agen secara real-time (*view-only*), melihat panggung kantor 2.5D/3D, membaca ringkasan tugas, dan terkesan dengan operasional kantor tanpa bisa mengirim perintah berbahaya.
- **Standar Estetika:** *Dark industrial command center* berkelas tinggi, modern dev-tools (mirip Bloomberg terminal / developer OS), padat informasi namun sangat terstruktur dan bersih (*anti-slop*).

---

## 2. Bedah Referensi UI/UX Dashboard Master: **ZEVN/OS** (`os.zevn.dev`)

*Sumber Referensi: Tangkapan layar Threads (November 2026).*

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ZEVN/OS]  Inbox  Agents (10)  [Chat]  Town  Term  Server           20:53:55 WIB  4/7  │
├───────────────┬──────────────────────────────────────────┬─────────────────────────────┤
│ DAFTAR TUGAS  │ PANGGUNG EKSEKUSI TENGAH                 │ KANAN: TELEMETRI & KANTOR   │
│ & THREADS     │                                          │                             │
│ • Filter Agen │ • Tab Tugas Aktif                        │ ┌─────────────────────────┐ │
│ • Pinned      │ • Status Eksekusi (1m 13s, 7 steps)      │ │ 🏢 VIRTUAL OFFICE 2.5D  │ │
│ • Pohon Sub-  │ • Progress Bar Sub-agen Paralel (4 bar)  │ │   (Live in Town View)   │ │
│   tugas       │ • Kartu Aksi Tool (Bash, Read, Tests)    │ └─────────────────────────┘ │
│ • Status dot  │ • Aliran Log & Obrolan Agen              │ • Profil Agen Aktif         │
│   (Working/   │ • Bar Komando CEO (Prompt + Model Picker)│ • Kuota Multi-Akun (72%)    │
│    Done)      │                                          │ • Context Meter (30% / 1.0M)│
│               │                                          │ • Git Branch & Files Changed│
└───────────────┴──────────────────────────────────────────┴─────────────────────────────┘
```

### 2.1 Global Top Bar (Navigasi Sistem)
- **Brand / OS Name:** Identitas sistem di kiri atas (`ZEVN/OS` -> kita adaptasi jadi `OFFICE/OS` atau `Office Agents`).
- **Modul Utama (Tab Bar):** `Inbox`, `Agents (10)`, `Chat (Aktif)`, `Town` (Layar penuh kantor virtual), `Term` (Terminal CLI), `Server` (Status backend).
- **Indikator Kanan:** Jam real-time format lokal (`WIB`), indikator beban kerja agen (`4/7` agen aktif), serta status server.

### 2.2 Panel Kiri: Pusat Tugas & Percakapan (Thread Hub)
- **Penyaring Model/Agen:** Filter cepat di atas (`All`, `Claude`, `Hermes`, dll.) untuk memfilter obrolan.
- **Pencarian & Urutan:** Input pencarian thread tugas + pengurutan aktivitas (*latest activity / time*).
- **Struktur Pohon Tugas (Task Hierarchy):**
  - Kategori *Pinned*, *Working*, dan *Today*.
  - Tugas utama memuat pohon anak sub-tugas yang sedang berjalan (misal: `4 running`, waktu elapsed `30s`, `10m`).
  - Status dot dinamis (hijau untuk `working`, oranye untuk `waiting`, merah untuk `blocked/unapproved`).

### 2.3 Panggung Tengah: Eksekusi Multi-Agen & Bar Komando
- **Multi-Tab Navigasi Tugas:** Deretan tab di atas panggung tengah untuk berpindah antar tugas aktif tanpa kehilangan konteks.
- **Kartu Ringkasan Eksekusi:** Menampilkan durasi tugas, jumlah langkah (*steps*), dan file yang terpengaruh (mis. `Worked for 1m 13s · 7 steps · 1 files`).
- **Visualisasi Sub-agen Paralel (Parallel Progress Bars):**
  - Menampilkan 2–4 progress bar horisontal animasi halus untuk sub-tugas yang berjalan bersamaan.
  - Setiap bar memiliki label sub-tugas dan persentase/status selesai.
- **Kartu Aksi Transparan (Action Cards):** Menampilkan operasi tool yang sedang berjalan (nama sub-agen, perintah bash/tool yang dieksekusi, durasi per langkah, model yang dipakai).
- **Bar Komando CEO di Bawah:**
  - Input teks instruksi multi-baris.
  - Pemilih model cepat (`Opus 5.5`, `Auto`, dll.).
  - Tombol audio/mic dan tombol kirim dengan status antrean jika agen sedang sibuk (*message gets queued*).

### 2.4 Panel Kanan: *The Magic Combo* (Telemetri + Embedded Mini-Office)
- **Top-Right Mini-Stage ("Live in Town"):**
  - **Inovasi Kunci:** Panggung kantor virtual 2.5D/3D disematkan langsung di pojok kanan atas!
  - Menampilkan miniatur ruangan kantor dengan meja, komputer, furnitur, dan avatar agen yang duduk/berpindah secara real-time.
  - Disertai badge link *"Live in Town"* yang bisa diklik untuk memperbesar kantor ke tab penuh (`Town`).
- **Bottom-Right Telemetri & Status Teknis:**
  - **Profil Agen Aktif:** Avatar, nama, model, dan host VPS.
  - **Kuota Multi-Akun:** Bar persentase kuota per akun (misal: `Account quota - Azura: 72%`, `mqg: 72%`) — sangat cocok dengan konfigurasi 4 akun Antigravity Pro kita!
  - **Context Window Meter (1.0M Scale):** Visualisasi pemakaian context window (mis. `30% used · 295.4K / 1.0M`) yang dipecah menjadi: `Messages`, `Tool calls`, `System/skills`, `Autocompact buffer`, dan `Free space`.
  - **Status Git & Perubahan File:** Menampilkan branch aktif (`master`), metrik diff (`+111 -15`), serta daftar file yang baru saja diubah (`ChatView.jsx`, `rapat.png`, `ChatSide.jsx`).

---

## 3. Bedah Referensi Teknologi 3D & Generasi Aset

### 3.1 `ccore/Qwen3.5-4B-3D-Coder` (Hugging Face)
- **Tipe Model:** Model bahasa kecil (~4B parameter) hasil *fine-tune* Qwen3.5, fokus pada pembuatan kode **Three.js procedural** dan aset 3D (GLB/GLTF).
- **Spesifikasi Teknis:**
  - Input: Prompt teks atau gambar referensi (dengan vision projector `mmproj`).
  - Output: Script Three.js mandiri yang menghasilkan geometri, material, pencahayaan, dan animasi 3D.
  - Resource: Sangat ringan, dapat dijalankan secara lokal via Ollama / llama.cpp / LM Studio dengan VRAM ~2–3 GB (format GGUF Q4_K_M).
- **Potensi untuk Kantor Virtual:**
  - Mesin pembuat aset furnitur/properti 3D lokal yang hemat kuota token cloud.
  - Membantu `Wulan` (`artist`) dan `Gita` (`gamedev`) memprogram komponen meja, rak server, monitor, dan lampu kantor dalam bentuk mesh Three.js.

### 3.2 `speridlabs/idol` (Hugging Face)
- **Tipe Model:** Single-Image to 3D Gaussian Splatting (3DGS) model (~0.66B rectified-flow transformer).
- **Spesifikasi Teknis:**
  - Arsitektur: Vision encoder DINOv3 + FLUX.2 VAE.
  - Input: 1 foto / gambar 2D konsep furnitur atau karakter.
  - Output: File 3D Gaussian Splat (`.ply`) berisi hingga 1.05 juta Gaussians dengan pencahayaan dan pantulan fotorealistis.
  - Kecepatan & Hardware: Menghasilkan 3D dalam beberapa detik pada GPU konsumen (~7.2 GB VRAM).
- **Potensi untuk Kantor Virtual:**
  - Membuat aset dekorasi "signature" (logo 3D kantor di lobi, piala penghargaan, sofa santai, mesin kopi, tanaman sudut yang kompleks) langsung dari gambar 2D konsep.
  - Dapat di-render langsung di Three.js menggunakan library 3DGS loader (`@mkkellogg/gaussian-splats-3d`).

### 3.3 Matriks Keputusan: Kapan Three.js Mesh vs Kapan 3D Gaussian Splatting?

| Kebutuhan Ruangan | Teknologi Pilihan | Alasan Teknis |
|---|---|---|
| **Lantai Grid, Dinding, Meja Kerja, Pergerakan Agen** | **Three.js Mesh / Procedural (Qwen 3D-Coder)** | Presisi koordinat grid, interaksi klik meja, ukuran file sangat kecil (KB), animasi jalan/rotasi mudah diatur. |
| **Pencahayaan & Kamera Ruangan** | **Three.js OrthographicCamera + PBR Lights** | Sudut pandang isometrik sejati tanpa distorsi perspektif, bayangan lembut (*soft shadows*), pendaran monitor (*bloom*). |
| **Objek Signature / Dekorasi Estetik Kompleks** | **3D Gaussian Splatting (`speridlabs/idol`)** | Tekstur fotorealistis langsung dari 1 gambar konsep, menghasilkan visual yang membuat pengunjung terkesan. |

---

## 4. Pemetaan ke Arsitektur Backend Kita Saat Ini

Semua referensi di atas langsung cocok dengan infrastruktur yang sudah kita bangun di repositori `https://github.com/Muhayara/office-agents`:

1. **10 Agen Spesialis:** Sudah memiliki konfigurasi unik (`Raka`, `Sari`, `Dimas`, `Bima`, `Gita`, `Tari`, `Wulan`, `Laras`, `Fajar`, `Satria`).
2. **Scheduler Paralel 3 Kursi:** Siap divisualisasikan menjadi *Parallel Sub-agent Progress Bars* di panggung tengah.
3. **Telemetri 4 Akun Antigravity Pro:** Siap divisualisasikan pada bar kuota multi-akun di panel kanan bawah.
4. **GitService & Security Scanner Satria:** Siap memasok data real-time branch, commit terakhir, file changed, dan temuan keamanan ke panel kanan.
5. **Virtual Office Panggung:** Siap disematkan di pojok kanan atas sebagai *Mini-Town View* yang terhubung ke WebSocket `StateSnapshot`.

---

## 5. Log Referensi Masuk (Akan Terus Diperbarui)

| Tanggal | Sumber / URL | Kategori | Ringkasan Inti |
|---|---|---|---|
| 2026-11-13 | `https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder` | 3D AI / Code | Model 4B untuk generasi kode Three.js & GLB prosedural. |
| 2026-11-13 | `https://huggingface.co/speridlabs/idol` | 3D AI / 3DGS | Single-image to 3D Gaussian Splatting fotorealistis (.ply). |
| 2026-11-13 | `https://www.threads.com/share/BAaVlJ31RJ` (ZEVN/OS) | UI/UX Dashboard | Desain OS multi-agen 3 kolom dengan live mini-office di kanan atas & progress bar paralel. |

*(Bagian ini akan otomatis ditambahkan setiap kali kamu membagikan link/gambar referensi baru).*
