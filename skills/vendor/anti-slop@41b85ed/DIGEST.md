# Anti-Slop Digest (`anti-slop@41b85ed`) — Mode 1 (Passive DURING Filter)

> Terapkan otomatis sebagai filter pasif saat merancang, menulis kode, menggambar aset, atau mengaudit (JANGAN pernah berhenti untuk bertanya Mode 1/2, JANGAN membaca `%APPDATA%`, dan JANGAN menjalankan `npx`).

## 1. Standar Kerajinan Inti (Craftsmanship Standard C-1 s/d C-5)
- **C-1 Purpose & Intent:** Setiap elemen UI, animasi, warna, atau komentar kode wajib punya alasan fungsional yang jelas. Hapus dekorasi tanpa fungsi.
- **C-2 One Coherent Direction:** Pilih satu arah visual/arsitektural yang konsisten di seluruh layar; jangan mencampur gaya secara acak.
- **C-3 Real Content & Hierarchy:** Satu titik fokus utama per layar/panel. Skala tipografi dan kontras ruang memandu mata dari primer -> sekunder -> tersier.
- **C-4 Complete & Usable UI:** Setiap tampilan data wajib memiliki state `loading`, `empty`, `error`, dan `ready`. Kontras teks minimal WCAG AA (`4.5:1` teks normal, `3:1` teks besar/komponen interaktif).
- **C-5 Restraint:** Lebih sedikit warna, font, dan efek yang dieksekusi presisi selalu mengalahkan tumpukan dekorasi generik.

## 2. Aturan Anti-Slop Visual & Layout (`antislop-ui`)
- **Dilarang Keras (Tiers 1-2):**
  - Gradien ungu-ke-biru/indigo-ke-violet generik tanpa alasan produk.
  - Glow neon berlebihan (`box-shadow` berlapis-lapis) di atas latar gelap yang mengaburkan batas permukaan.
  - _Card-inside-a-card_ (kartu berborder di dalam kontainer berborder) atau grid 3 kartu identik berikon bulat tanpa struktur data nyata.
  - Angka metrik palsu (`99.9%`, `10x faster`), testimoni fiktif, atau tombol/tab dekoratif yang tidak melakukan apa-apa (`dead controls`).
- **Kewajiban Layout & Interaksi:**
  - Gunakan CSS token/variabel terpusat untuk warna, ruang, dan radius.
  - Setiap kontrol interaktif wajib memakai elemen semantik (`<button>`, `<a href>`), memiliki `cursor: pointer`, state `:hover`, `:active`, `:focus-visible` (kontras `>= 3:1`), dan `:disabled`.
  - Hormati `@media (prefers-reduced-motion: reduce)` untuk semua transisi/animasi non-esensial.

## 3. Aturan Anti-Slop Kode & Komentar (`antislop-code`)
- **Hapus Komentar Tanpa Nilai Tambah:**
  - Jangan tulis komentar yang hanya mengulang nama fungsi/variabel (`// increment counter`, `// render component`).
  - Jangan tinggalkan kode mati yang di-comment out (`// const old = ...`), `TODO` kosong tanpa konteks, atau banner pembatas ASCII (`// =======`).
  - Jangan sisipkan narasi percakapan di dalam kode (`// Here we updated...`, `// Fixed as requested`).
- **Kapan Komentar Diizinkan:**
  - Hanya untuk menjelaskan **mengapa (WHY)**: alasan bisnis/invariant tersembunyi, workaround bug browser/library beserta kondisinya, atau rumus matematika/isometrik non-trivial (`screenX = (col - row) * (tileW / 2)`).

## 4. Aturan Anti-Slop Copywriting & Label (`antislop-copywriting`)
- **Larangan Frasa Klise AI:** Hindari kata-kata kosong seperti *"Revolutionize"*, *"Unleash"*, *"Seamless"*, *"Next-gen"*, *"Delve"*, *"Tapestry"*, *"Game-changer"*, atau kalimat pembuka *"In today's fast-paced world..."*.
- **Gunakan Bahasa Spesifik & Konkret:**
  - Tulis label tombol dengan kata kerja spesifik aksi nyata (`"Kirim Instruksi"`, `"Jalankan Scan"`, `"Buka Ruang Server"`), bukan label kabur.
  - Pesan error wajib menyebutkan: (1) apa yang gagal, (2) mengapa, dan (3) langkah memperbaikinya.
