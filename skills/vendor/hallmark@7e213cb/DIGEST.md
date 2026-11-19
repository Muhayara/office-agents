# Hallmark Design Craft Digest (`hallmark@7e213cb`) — App & Workbench Standard

> Terapkan langsung saat merancang arsitektur UI, palet token, tata letak ruangan 3D, serta komponen kontrol (JANGAN berhenti untuk bertanya pre-flight dan JANGAN menjalankan script eksternal `theme.mjs`/`sloplint.mjs`).

## 1. The Floor (Aturan Dasar Wajib)
1. **Token-Driven Styling:** Semua warna, permukaan, font, dan spasi wajib dideklarasikan melalui CSS custom properties (`:root`) atau sistem token terpusat.
2. **Motion & Performance:** Dilarang menggunakan `transition: all` atau menganimasikan `width`, `height`, `top`, `left`. Gunakan hanya `transform` dan `opacity`.
3. **Overflow & Grid Safety:** Gunakan `overflow-x: clip` pada `html`/`body` (bukan `100vw`). Track grid yang memuat kanvas/visual wajib memakai `minmax(0, 1fr)` dan `min-width: 0`.
4. **Fokus & Reduced Motion:** Setiap elemen interaktif wajib memiliki `:focus-visible` instan (`>= 3:1`) dan menghormati `prefers-reduced-motion: reduce`.
5. **Kejujuran Visual:** Dilarang membuat metrik/angka palsu, gradien ungu-biru generik, emoji sebagai pengganti ikon struktural, atau kartu di dalam kartu (*card-in-a-card*).

## 2. Disiplin App Screen & Split Workbench (Kantor Virtual 3D)
- **Kanvas Sebagai Bintang Utama:** Untuk layar aplikasi/simulasi (*App Screen / Workbench*), kanvas ruang kantor 3D adalah objek utama (*the signature*), bukan hiasan di bawah teks panjang.
- **Kepadatan Terukur (Density is the Design):** Tinggi kontrol aplikasi `32px–40px` (dengan area klik ramah aksesibilitas), tata letak proporsional antara panggung utama (kanvas isometrik) dan panel inspeksi/telemetri di samping (*Split Studio / Workbench*).
- **Empat State Data Wajib:** Setiap panel/region data wajib menangani state `loading`, `empty`, `error`, dan `full` secara eksplisit.
- **Angka Tabular:** Semua angka metrik, koordinat `(col, row)`, FPS, kuota request, dan timer wajib menggunakan `font-variant-numeric: tabular-nums` agar tidak bergoyang saat berubah real-time.

## 3. Tangga Permukaan (Surface Ladder) & Dark Mode Parity
- **Urutan Pemisah (Surface Ladder):** Gunakan urutan ini untuk memisahkan kelompok informasi tanpa menumpuk kotak:
  1. Ruang kosong (*whitespace* terukur pada skala `4 / 8 / 12 / 16 / 24 / 40px`)
  2. Garis rambut (`1px` hairline `--color-rule`)
  3. Sumur berwarna halus (*tinted well* `--color-paper-2` tanpa border)
  4. Kartu (*card* dengan border `1px` ATAU bayangan halus, **jangan pernah keduanya sekaligus**)
- **Disiplin Mode Gelap (Dark Mode):**
  - Jangan pernah memakai hitam murni (`#000000`) sebagai permukaan utama atau putih murni (`#ffffff`) sebagai teks panjang; gunakan permukaan gelap bernuansa (*tinted dark surface*, mis. `L 12%–18%`) dan teks hangat/jernih (`L 90%–96%`).
  - **Elevasi = Terang:** Di mode gelap, permukaan yang lebih tinggi (`paper-2`, `paper-3`, panel melayang) memiliki tingkat kecerahan sedikit lebih terang (`+3% L` per level) dengan ring hairline `1px`, bukan `drop-shadow` gelap yang berubah menjadi kabut/glow.
  - **Aksen Sebagai Sinyal (< 5% Viewport):** Warna aksen dipakai khusus untuk aksi utama, status aktif, dan indikator fokus — bukan membanjiri latar belakang.

## 4. Tipografi & Micro-Craft
- **Maksimal 2 Keluarga Font (+1 Monospace):** Satu font UI/display, satu font body (boleh satu keluarga yang sama), serta satu monospace khusus kode, log, ID komit, dan angka telemetri.
- **Label & Header Tabel:** Gunakan sentence case yang bersih tanpa `uppercase` ber-tracking lebar berlebihan pada setiap label kecil.
