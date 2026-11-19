# Office Next — Ruang Kantor Virtual 3D Isometrik (`workspace/office-next/`)

Folder ini adalah ruang kerja proyek **Virtual Office 3D** yang dibangun secara kolaboratif oleh 10 agen AI:
- **Raka** (`manager`) — Orkestrasi & pemecahan tugas
- **Sari** (`researcher`) — Riset referensi tata ruang & ergonomi UI
- **Tari** (`designer`) — Arsitektur tata letak, sistem token desain (`hallmark`), & spesifikasi zona ruangan
- **Wulan** (`artist`) — Sprite karakter pixel/isometrik, tile lantai/dinding, & furnitur SVG/Canvas (`hallmark`)
- **Gita** (`gamedev`) — Panggung 3D isometrik Three.js: ruangan, navigasi koridor, rig avatar, kamera (isometrik, Free Cam, Mata Agen), & loop animasi (`hallmark`)
- **Bima** (`coder`) — Integrasi state WebSocket real-time (`@office/shared`), panel telemetri, & mode Spectator vs CEO
- **Dimas** (`writer`) — Dokumentasi fitur & panduan pengguna
- **Laras** (`reviewer`) — Code review kualitas & kepatuhan standar `anti-slop`
- **Fajar** (`visual_qa`) — Pengujian browser & verifikasi visual (`webapp-testing`)
- **Satria** (`security`) — Audit keamanan deterministik (`security_scan`) sebelum auto-commit/push

## Struktur Direktori

- `src/isometric/` — Konversi koordinat grid <-> layar isometrik, depth sorting, peta zona ruangan, dan pathfinding.
- `src/sprites/` — Komponen visual karakter 10 agen, furnitur meja kerja, tanaman, rak server, dan papan tulis.
- `src/stage/` — Kanvas/panggung utama ruang kantor 3D dengan kontrol kamera (pan/zoom/focus kursi) dan balon percakapan.
- `src/panels/` — Panel HUD samping (Roster 10 kursi, Papan Tugas, Aliran Aktivitas, Audit Keamanan Satria, dan Komando CEO).
- `src/styles/` — Sistem CSS token terpusat sesuai standar `hallmark` & `anti-slop`.
- `docs/` — Spesifikasi desain ruangan, palet warna, dan catatan arsitektur 3D.

## Aturan Penting untuk Agen

1. **Jangan mengubah `package.json` atau lockfile.** Semua dependensi (`react`, `lucide-react`, `@office/shared`, `@fontsource/overpass`, `vite`, `typescript`) sudah terpasang di monorepo root.
2. **Impor kontrak langsung dari `@office/shared`:**
   ```ts
   import { type StateSnapshot, type AgentView, ROLE_LABELS, formatPublicModelName } from '@office/shared';
   ```
3. **Verifikasi Typecheck:**
   Jalankan pemeriksaan tipe dari dalam `office-next`:
   ```bash
   npx tsc -p tsconfig.json
   ```
