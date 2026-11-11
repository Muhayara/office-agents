# Brief Penugasan CEO -> Raka (`manager`) — Fase A: Fondasi Ruang Kantor Isometrik 2.5D

> **Lokasi Proyek:** `office-next/` (di dalam `workspace/office-next/`)
> **Target Repositori GitHub:** `https://github.com/Muhayara/office-agents` (otomatis di-commit & di-push oleh `GitService` setiap tugas di-ACC oleh `Laras`)

---

## 1. Visi & Tujuan Fase A

Membangun ruang kantor virtual isometrik **2.5D** yang hidup, rapi, dan memukau di dalam `office-next/`, di mana pengunjung publik kelak dapat menonton aktivitas ke-10 agen dalam **Mode Pengunjung (*Spectator View-Only Mode*)**, sementara hanya **CEO** yang dapat mengirim instruksi dan menyetujui perintah.

Pada **Fase A**, fokus kita adalah menyempurnakan:
1. **Arsitektur Tata Ruang & Sistem Token Desain (`Tari` — `designer`):**
   - Spesifikasi 4 zona ruangan (`Zona Komando & Riset`, `Studio Kreatif & Desain`, `Sayap Engineering & Game 2.5D`, `Zona QA, Review & Keamanan`) beserta sistem permukaan mode gelap (`hallmark` Surface Ladder) di `office-next/docs/room-spec.md` dan `office-next/src/styles/tokens.css`.
2. **Aset Furnitur, Tile Lantai/Dinding, & Sprite Karakter 10 Agen (`Wulan` — `artist`):**
   - Menggambar komponen SVG/Canvas isometrik untuk meja kerja tiap departemen, kursi, lampu meja, rak server (`Satria` & `Bima`), papan kanban dinding (`Raka`), tanaman sudut, serta variasi pose/status 10 agen (`idle`, `thinking`, `working`, `messaging`, `meeting`, `error`) di `office-next/src/sprites/`.
3. **Engine Grid Isometrik, Kamera Pan/Zoom, & Balon Aktivitas (`Gita` — `gamedev`):**
   - Menyempurnakan engine di `office-next/src/isometric/` dan `office-next/src/stage/IsometricOfficeStage.tsx` dengan kontrol kamera (zoom `0.75x–1.5x`, pan drag, tombol *Reset View* & *Focus Active Agent*), *depth sorting* (`row + col`), serta indikator balon percakapan (`agent.say`) di atas kepala agen.
4. **Integrasi State Real-Time & Mode Spectator vs CEO (`Bima` — `coder`):**
   - Menyambungkan `office-next/src/App.tsx` dan `office-next/src/panels/` dengan aliran event WebSocket (`@office/shared`), filter log aktivitas, serta penguncian UI pada **Mode Pengunjung (*Spectator Mode*)** agar tombol komando/approval tersembunyi bagi penonton biasa.
5. **Verifikasi Kualitas, Visual QA, & Keamanan (`Laras`, `Fajar`, `Satria`):**
   - `Laras` (`reviewer`) memeriksa diff kode dan kepatuhan `anti-slop` (0 komentar sampah, 0 metrik palsu).
   - `Fajar` (`visual_qa`) memverifikasi tampilan dan keterbacaan kontras UI di browser.
   - `Satria` (`security`) menjalankan `security_scan` memastikan 0 kebocoran kredensial sebelum commit/push otomatis.

---

## 2. Pembagian Tugas yang Direkomendasikan untuk Raka

Saat CEO mengirim instruksi Fase A, `Raka` (`manager`) memecah pekerjaan menjadi tugas-tugas terfokus berikut:

1. **Tugas 1 -> `tari` (`designer`):**
   - *Judul:* `Spesifikasi tata ruang kantor isometrik 10 kursi dan sistem token UI`
   - *File target:* `office-next/docs/room-spec.md`, `office-next/src/styles/tokens.css`
2. **Tugas 2 -> `wulan` (`artist`):**
   - *Judul:* `Implementasi sprite furnitur kantor isometrik dan variasi status 10 avatar agen`
   - *File target:* `office-next/src/sprites/AgentAvatarIso.tsx`, `office-next/src/sprites/OfficeFurnitureIso.tsx`
3. **Tugas 3 -> `gita` (`gamedev`):**
   - *Judul:* `Implementasi kamera pan-zoom isometrik, highlight petak meja, dan balon percakapan agen`
   - *File target:* `office-next/src/isometric/coords.ts`, `office-next/src/stage/IsometricOfficeStage.tsx`
4. **Tugas 4 -> `bima` (`coder`):**
   - *Judul:* `Integrasi panel inspektur real-time, komando CEO, dan penguncian Spectator View-Only Mode`
   - *File target:* `office-next/src/panels/InspectorPanel.tsx`, `office-next/src/App.tsx`
5. **Tugas 5 -> `fajar` (`visual_qa`) & `satria` (`security`):**
   - *Judul:* `Audit visual panggung 2.5D dan pemindaian keamanan pre-release Fase A`

---

## 3. Contoh Prompt Cepat untuk CEO di Meja Dispatch

Salin dan kirimkan perintah berikut ke `→ Raka (Manajer)` di Meja Dispatch:

> **"Jalankan Fase A pembangunan ruang kantor virtual 2.5D di `office-next/` sesuai brief: tugaskan Tari merancang `office-next/docs/room-spec.md` & token, Wulan membuat sprite furnitur & 10 avatar di `office-next/src/sprites/`, Gita menambahkan kamera pan/zoom & balon percakapan di `office-next/src/stage/IsometricOfficeStage.tsx`, serta Bima menyempurnakan panel inspektur & Spectator Mode di `office-next/src/panels/InspectorPanel.tsx`. Minta Laras me-review setiap tahap dan Satria menjalankan `security_scan`."**
