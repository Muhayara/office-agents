# Panduan & Rencana Hosting (Office Agents 3D)
> Revisi: 16 November 2026 — menggantikan rencana Railway/Docker sebelumnya.
> Prinsip: **gratis dulu**, dan **tidak membuka backend ke internet** sampai benar-benar perlu.

---

## 1. Ringkasan Keputusan

| Fase | Apa yang dihosting | Biaya | Status |
|---|---|---|---|
| **1** | Diorama 3D sebagai **demo statis** (simulasi template, tanpa backend) | Gratis | Siap dikerjakan |
| **2** | Akses CEO ke **kantor live di PC sendiri** dari HP/laptop lain | Gratis (Tailscale) | Siap setelah hardening keamanan (sudah selesai) |
| **3** | Seluruh sistem di server cloud 24/7 | Berbayar (VPS ±$4–5/bulan) | Ditunda |

### Kenapa backend belum bisa di cloud gratis
- Agen memanggil **9router lokal** (`127.0.0.1:20128`) yang memakai akun & kuota di PC ini.
- Auto-push git memakai kredensial **Git Credential Manager** di PC ini.
- `run_command` menjalankan proses di mesin tempat server berjalan — di cloud publik ini butuh sandbox container.
- Database SQLite (`data/office.db`) butuh **disk permanen**. Layanan gratis seperti Render free mematikan instance setelah 15 menit tanpa trafik dan filesystem-nya hilang setiap restart/spin-down.

### Kenapa Dockerfile versi lama tidak dipakai
Dokumen sebelumnya memuat Dockerfile yang tidak akan berjalan:
- `apps/server/tsconfig.json` memakai `noEmit: true` → tidak ada `apps/server/dist/index.js`; server dijalankan dengan `tsx`.
- `@office/shared` mengekspor sumber `.ts`, bukan `dist`.
- `node:20-alpine` tidak punya `node:sqlite` (perlu Node 22.5+).
- Server tidak menyajikan file statis, dan env `PORT`/`CORS_ORIGIN` tidak pernah dibaca kode.
- `workspace/office-next` tidak punya `package.json` sendiri.

---

## 2. Fase 1 — Demo Statis Gratis (Cloudflare Pages)

Build demo (`--mode demo`) menanam `VITE_DEMO=1`: aplikasi **tidak melakukan panggilan jaringan apa pun**, langsung menampilkan simulasi template (antrean kopi, obrolan, gumaman) — aman dibagikan publik karena tidak ada data kantor.

### Langkah
1. Push repo ke GitHub (repo private tetap bisa dipakai Cloudflare Pages).
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pilih repo.
3. Pengaturan build:
   | Kolom | Nilai |
   |---|---|
   | Framework preset | None |
   | Build command | `npm run build:next:demo` |
   | Build output directory | `workspace/office-next/dist` |
   | Environment variable | `NODE_VERSION` = `22` |
4. Deploy. Setiap push ke `main` akan membangun ulang otomatis.

`workspace/office-next/public/_headers` ikut tersalin ke output dan memberi header keamanan dasar (`nosniff`, `X-Frame-Options`, `Referrer-Policy`) serta cache 7 hari untuk `/models/*`.

### Batas yang perlu diingat
- Cloudflare Pages free: 500 build/bulan, 1 build berjalan bersamaan (dokumentasi resmi). Batas file (±20.000 file, 25 MB per file) bersumber dari pihak ketiga — cek ulang di halaman limits resmi.
- Ukuran build saat ini ±15 MB (65 file); GLB terbesar `Office_Bookshelf_Cabinet.glb` ±4,8 MB — masih jauh di bawah batas per file.
- Alternatif setara: Netlify, Vercel. GitHub Pages gratis hanya untuk repo publik.

### Build lokal di Windows gagal "remove …\Temp\esbuild-…: Access is denied"?
Ini masalah lingkungan (biasanya antivirus mengunci file sementara esbuild), bukan kode. Build CI di Linux tidak terpengaruh. Untuk mengecek lokal:
```powershell
npx vite build workspace/office-next --mode demo --target esnext --minify false
```
atau kecualikan folder `%TEMP%` dari pemindaian real-time Windows Defender.

---

## 3. Fase 2 — CEO Mengakses Kantor Live dari Mana Saja (Gratis)

Server tetap di PC dan tetap bind ke `127.0.0.1`. Yang dibuka hanyalah jalur privat terenkripsi.

### Prasyarat keamanan (sudah diterapkan di kode)
- Login token CEO wajib (`OFFICE_TOKEN` di `.env`, atau otomatis di `data/.office-token`); token pengunjung opsional (`OFFICE_VIEWER_TOKEN`, view-only).
- Cookie sesi `HttpOnly` + `SameSite=Strict` bertanda tangan HMAC; MCP wajib `Authorization: Bearer`.
- Validasi `Host` & `Origin` (anti CSRF, cross-site WebSocket hijacking, DNS rebinding); tanpa CORS `*`.
- Batas ukuran body, kebijakan `run_command` ketat, guard peran tolak-secara-default.

### Opsi A (disarankan): Tailscale — tanpa domain, tanpa port publik
1. Pasang Tailscale di PC kantor dan di HP/laptop CEO, login dengan akun yang sama.
2. Di PC kantor, sajikan dashboard ke tailnet saja (HTTPS otomatis `*.ts.net`):
   ```powershell
   tailscale serve --bg 5174   # diorama 3D (atau 5173 untuk Meja Dispatch)
   ```
   (Sintaks `tailscale serve` berubah antarversi — cek `tailscale serve --help`.)
3. Tambahkan ke `.env` (ganti dengan nama mesin tailnet kamu):
   ```dotenv
   OFFICE_ALLOWED_HOSTS=pc-kantor.tailnet-xyz.ts.net
   OFFICE_ALLOWED_ORIGINS=https://pc-kantor.tailnet-xyz.ts.net
   OFFICE_COOKIE_SECURE=1
   ```
   `OFFICE_ALLOWED_HOSTS` dibaca server **dan** kedua `vite.config.ts` (hanya variabel itu, tidak terkirim ke browser).
4. Restart `start.bat`, buka `https://pc-kantor.tailnet-xyz.ts.net` dari HP, login dengan token CEO.

### Opsi B: Cloudflare Tunnel + Cloudflare Access (URL publik dengan login)
- Butuh domain yang DNS-nya di Cloudflare (biasanya berbayar ±$10/tahun).
- `cloudflared tunnel` → hostname `office.domainkamu.com` → `http://localhost:5174`.
- Wajib pasang **Cloudflare Access** (gratis s.d. 50 pengguna) dengan kebijakan email OTP hanya untuk CEO, sehingga dua lapis login: Access + token kantor.
- Isi `OFFICE_ALLOWED_HOSTS=office.domainkamu.com`, `OFFICE_ALLOWED_ORIGINS=https://office.domainkamu.com`, `OFFICE_COOKIE_SECURE=1`.
- **Jangan** memakai Quick Tunnel `trycloudflare.com` untuk kantor live: URL acak tanpa lapisan Access.

### Opsi 3B (dipilih CEO 18 Nov, K14): Kantor 3D PUBLIK lewat Tailscale Funnel — gratis, tanpa domain

Funnel membuka **satu** alamat HTTPS publik `https://<nama-pc>.<tailnet>.ts.net/` ke server di PC ini. Server
melayani UI hasil build + API + kanal dunia bersama dari port 7420, jadi cookie login tetap satu situs.
Publik bisa menonton tanpa login (dunia bersama, teks asli disamarkan); tamu masuk dengan Google; CEO tetap
memakai token.

**Mengapa Funnel (bukan Cloudflare / VPS):**

| Opsi | Biaya | Kemudahan | Catatan |
| :--- | :--- | :--- | :--- |
| **Tailscale Funnel** ✅ | Gratis (semua paket) | Tanpa kode baru di luar repo ini, tanpa domain, HTTPS otomatis, URL tetap | PC harus menyala (agen AI memang butuh PC menyala); bandwidth Funnel dibatasi Tailscale tanpa angka resmi — cukup untuk penonton sedikit, unduhan awal ±10 MB per pengunjung baru (lalu di-cache peramban) |
| Cloudflare Tunnel (bernama) | Butuh domain (±$10/tahun) | Mudah | URL stabil hanya dengan domain sendiri |
| Cloudflare Quick Tunnel | Gratis | Mudah | URL acak berubah tiap restart → login Google rusak; jangan dipakai |
| Cloudflare Durable Object (opsi B §3.6 rencana FPV) | Gratis dengan kuota harian | Sulit: codebase Worker baru + relay | Sutradara 20 Hz membuat objek tidak pernah tidur → ±10.800 dari 13.000 GB-s/hari gratis; berisiko kena batas |
| VPS | Berbayar | Sedang | Workspace git ikut pindah |

**Sekali saja (± 10 menit):**
1. Pasang Tailscale di PC ini: <https://tailscale.com/download> → login.
2. Admin console Tailscale (<https://login.tailscale.com/admin>):
   - **DNS** → aktifkan **MagicDNS** dan **HTTPS Certificates**.
   - **Access controls** → tambahkan atribut Funnel ke policy (console biasanya menawarkan tombol "Enable Funnel" saat pertama kali menjalankan `tailscale funnel`).
3. Catat nama mesin: `tailscale status --json` → `Self.DNSName` (mis. `pc-kantor.tail1234.ts.net`).
4. Google Cloud Console → Credentials → OAuth client Anda → **Authorized redirect URIs**, pastikan ketiganya ada:
   - `http://localhost:5174/api/auth/google/callback` (dev, Vite)
   - `http://localhost:7420/api/auth/google/callback` (produksi lokal)
   - `https://pc-kantor.tail1234.ts.net/api/auth/google/callback` (publik)
5. OAuth consent screen: tambahkan `pc-kantor.tail1234.ts.net` di *Authorized domains*. Selama status **Testing**, hanya
   akun yang didaftarkan sebagai *test user* yang bisa masuk; klik **Publish app** bila ingin semua akun Google bisa
   masuk (scope `openid email profile` tidak butuh verifikasi Google).

**Setiap kali online:** jalankan `start-public.bat`. Skrip itu: build UI (`npm run build:next`), menyalakan 9router +
server dengan `OFFICE_SERVE_UI=1`, `OFFICE_TRUST_PROXY=1`, `OFFICE_COOKIE_SECURE=1`, host/origin `.ts.net`, dan tiga
redirect Google, lalu `tailscale funnel --bg 7420`. `stop.bat` juga menutup Funnel (`tailscale funnel reset`).

**Yang sudah diamankan di kode (18 Nov):**
- Server tetap bind `127.0.0.1`; hanya port 7420 yang di-Funnel. MCP (7421) tidak pernah publik.
- `X-Forwarded-For` / `X-Forwarded-Host` hanya dipercaya dari loopback dan hanya bila `OFFICE_TRUST_PROXY=1`
  (batas `/ws/world` 6 koneksi per IP & pembatas login memakai IP asli pengunjung).
- UI statis: anti path traversal, `/api` & `/ws` tidak pernah tertimpa, CSP ketat
  (`script-src 'self' 'wasm-unsafe-eval'`, tanpa skrip inline / sumber luar, `frame-ancestors 'none'`),
  `X-Frame-Options: DENY`, gzip untuk JS/CSS/HTML, cache aset 1 tahun (nama ber-hash) dan model 7 hari.
- Redirect Google dipilih sesuai host yang dibuka peramban (cookie state OAuth terikat host).
- Diuji: `hosting.test.ts` (traversal, CSP, SPA, gzip, proxy palsu dari LAN ditolak, pilihan redirect) dan Playwright
  terhadap `http://localhost:7420/` (54 GLB termuat, 0 error CSP, kanal dunia LIVE).

**Belum diuji (butuh akun Tailscale Anda):** apakah Funnel meneruskan header `Host` asli atau `X-Forwarded-*`.
Keduanya sudah ditangani: host `.ts.net` diizinkan lewat `OFFICE_ALLOWED_HOSTS`, dan bila hanya `127.0.0.1` yang
terlihat, server tetap jalan (pembatas per IP lalu berlaku untuk semua pengunjung Funnel sekaligus). Setelah online,
cek log server / `tailscale funnel status`, lalu laporkan bila ada yang aneh.

---

## 4. Fase 3 — Cloud Penuh 24/7 (Ditunda, Berbayar)

Baru masuk akal setelah semua ini siap:
1. Gateway LLM yang dihosting (bukan 9router lokal) + secret di environment, bukan file.
2. Disk permanen untuk `data/` (SQLite WAL) dan backup berkala.
3. `run_command` dijalankan di container sandbox terpisah tanpa kredensial git.
4. Deploy key GitHub khusus repo ini (bukan kredensial pribadi) untuk auto-push.
5. Runtime Node 22+ (`node:sqlite`), server dijalankan dengan `tsx`, `OFFICE_BIND_HOST=0.0.0.0` di dalam container.

Topologi VPS yang direkomendasikan tetap: **Caddy** (HTTPS otomatis) menyajikan `workspace/office-next/dist` dan me-reverse-proxy `/api` + `/ws` ke `127.0.0.1:7420`, dengan env:
```dotenv
OFFICE_TOKEN=<acak, minimal 24 karakter>
OFFICE_ALLOWED_HOSTS=office.domainkamu.com
OFFICE_ALLOWED_ORIGINS=https://office.domainkamu.com
OFFICE_COOKIE_SECURE=1
```

---

## 5. Checklist Sebelum Membuka Akses Apa Pun

1. [x] `npm run typecheck` bersih & `npm test` lulus (64 test, termasuk simulasi serangan CSRF/DNS rebinding/MCP palsu).
2. [x] Login token + cookie aman + validasi Host/Origin aktif.
3. [ ] Token CEO dibuat acak (biarkan server membuat `data/.office-token`, atau isi `OFFICE_TOKEN` ≥ 24 karakter).
4. [ ] Mode otonomi tetap **Semi** saat diakses dari luar (mode Penuh menyetujui `run_command` otomatis).
5. [ ] `OFFICE_ALLOWED_HOSTS` / `OFFICE_ALLOWED_ORIGINS` hanya berisi host yang benar-benar dipakai.
6. [ ] Folder `data/` tidak pernah ikut di-commit (sudah di `.gitignore`).
