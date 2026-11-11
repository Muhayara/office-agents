# DESIGN.md — UI Command Center (Dark)

*Spesifikasi visual untuk tahap awal: **tanpa objek 2D/3D**. Fokus: kirim perintah CEO, status live 5 karyawan AI, log pesan/operan tugas, Kanban, dan Approval. Lampiran HUD isometrik untuk Fase 3 ada di §12.*

Status: kontrak desain untuk `apps/web`. Versi 1.0 · 10 November 2026.

---

## 1. Arah Visual: "Meja Dispatch"

Kantornya belum punya gedung. Yang ada adalah **meja operator**: papan roster, jalur perintah, dan tumpukan work order. Bahasa visualnya diambil dari **papan keberangkatan stasiun dan ruang kendali operasi**, bukan dari dashboard SaaS.

Yang membuatnya khas:

- **Satu elemen tanda tangan: "tick".** Bar 20 segmen yang dipakai konsisten untuk kuota harian, progres tugas, dan sisa giliran. Ini identitas visual sekaligus informasi nyata — bukan ornamen.
- **Hierarki lewat garis dan tipe, bukan kartu.** Pemisah 1px, label kecil, angka sejajar. Tidak ada grid kartu bundar seragam.
- **Warna sebagai status, bukan hiasan.** Lima warna karyawan, empat warna sistem. Warna tidak pernah satu-satunya pembeda — selalu ada teks.
- **Tenang.** Tidak ada animasi masuk, tidak ada glow, tidak ada gradien. Gerak hanya sebagai jawaban atas aksi (modal, status berubah).

**Bukan** yang dimaksud: dashboard gelap generik dengan gradien ungu, kartu kaca, atau terminal palsu dengan teks hijau menyala.

---

## 2. Token

### 2.1 Warna dasar

| Token | Hex | Pemakaian |
|---|---|---|
| `--ink` | `#0F1A1F` | Latar aplikasi (petrol gelap, bukan hitam pekat) |
| `--surface` | `#14232A` | Panel, rail, bar |
| `--surface-2` | `#1A2C34` | Baris terpilih, header tabel, input |
| `--surface-3` | `#223841` | Hover, chip, kartu tugas |
| `--rule` | `#243B45` | Garis pemisah 1px |
| `--rule-strong` | `#31505C` | Garis fokus/aktif, border input |
| `--text` | `#E7E2D6` | Teks utama (paper warm, bukan putih bersih) |
| `--text-muted` | `#A9B4B4` | Meta, label, placeholder |
| `--text-faint` | `#78898C` | Hanya untuk non-esensial (ID, hitungan) |
| `--signal` | `#E9A23B` | Aksen utama: perintah, perhatian, brand |
| `--data` | `#63C3D9` | Aksen data: link, fokus, angka kuota |
| `--ok` | `#5DBB8A` | Selesai, sehat, tersambung |
| `--warn` | `#D98A2B` | Menunggu, antre, kuota menipis |
| `--danger` | `#E06A66` | Gagal, ditolak, offline |
| `--danger-strong` | `#D9534F` | Aksi destruktif (isi tombol) |

Aturan kontras: teks utama dan aksen ≥ 4.5:1 terhadap `--ink`; `--text-faint` tidak untuk informasi penting. Status selalu punya label teks.

### 2.2 Warna karyawan

| Karyawan | Token | Hex | Alasan |
|---|---|---|---|
| Raka — Manajer | `--a-raka` | `#E9A23B` | Sama dengan `--signal`: pemegang perintah |
| Sari — Peneliti | `--a-sari` | `#63C3D9` | Sama dengan `--data`: pembawa informasi |
| Dimas — Penulis | `--a-dimas` | `#A8C46B` | Olive, tenang, non-neon |
| Bima — Programmer | `--a-bima` | `#D9735F` | Clay, kontras dengan hijau/amber |
| Laras — Reviewer | `--a-laras` | `#C58BB0` | Rose pudar, satu-satunya di sisi magenta |

Setiap agen memakai warnanya hanya pada **edge tab 3px**, nama saat aktif, dan titik status. Latar tidak pernah diwarnai penuh.

### 2.3 Warna status

| Status | Warna | Label UI (ID) | Ikon |
|---|---|---|---|
| `idle` | `--text-faint` | Menganggur | titik kosong |
| `thinking` | `--data` | Berpikir | tiga titik berdenyut pelan (1.6s) |
| `working` | `--ok` | Bekerja | kotak terisi |
| `messaging` | `--signal` | Mengirim pesan | panah keluar |
| `meeting` | `--a-sari` | Rapat | dua garis sejajar |
| `waiting_approval` | `--warn` | Menunggu izin | tanda seru |
| `error` | `--danger` | Gagal | silang |
| `offline` | `--text-faint` | Offline | garis putus |

Warna status sistem **tidak sama** dengan warna agen; jangan pakai `--a-*` untuk status.

### 2.4 Tipografi

- **UI/display: Overpass** (400, 500, 600). Grotesque yang lahir dari rambu jalan — cocok dengan bahasa dispatch, dan bukan Inter/Space Grotesk/Geist yang jadi default.
- **Data: Overpass Mono** (400, 500). Hanya untuk waktu, ID tugas, angka kuota, dan isi perintah terminal.
- Muat via `@fontsource/overpass` dan `@fontsource/overpass-mono` (SIL OFL). Fallback: `system-ui, sans-serif` / `ui-monospace, monospace`.

| Peran | Ukuran / line-height | Weight | Pemakaian |
|---|---|---|---|
| `text-2xl` | 34 / 1.15 | 600 | Nama kantor di status rail (satu-satunya tempat besar) |
| `text-xl` | 26 / 1.2 | 600 | Judul panel, judul modal |
| `text-lg` | 20 / 1.3 | 600 | Nama agen di detail |
| `text-md` | 16 / 1.4 | 500 | Judul tugas, isi perintah |
| `text-base` | 14 / 1.45 | 400 | Isi log, isi kartu, input |
| `text-sm` | 13 / 1.4 | 400/500 | Meta, label tombol, role |
| `text-xs` | 12 / 1.35 | 500 | ID, waktu, angka tick |

Aturan: tanpa ALL-CAPS, tanpa letter-spacing dekoratif, tanpa eyebrow di atas judul. Mono hanya untuk kolom yang harus sejajar.

### 2.5 Spacing, radius, garis, gerak

- Skala spacing: `4 8 12 16 20 24 32 40 56` (basis 4).
- Padding panel: 16. Jarak antarbaris rail: 0 (dipisah garis). Jarak antarkartu Kanban: 8.
- Radius bertingkat: **2px** untuk tag/chip, **6px** untuk input/tombol, **12px** untuk modal. Kartu tugas **4px**. Tidak ada radius 999px.
- Tinggi baris: roster 64px, log 44–64px (variabel isi), kartu Kanban 72–96px.
- Elevasi: **tanpa box-shadow** kecuali scrim modal (`rgba(0,0,0,.55)`). Kedalaman dari selisih `--surface*`.
- Gerak: 140ms `ease-out` untuk perubahan status/panel; 200ms modal; tanpa animasi masuk halaman; `prefers-reduced-motion` mematikan denyut dan transisi.

---

## 3. Layout

Basis 1440×900, minimum 1024. Bukan layout 3 kartu; ini meja kerja.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ STATUS RAIL · Office Agents · gateway: OK · mode: Semi · ⏸ · ID/EN · 21:04  │ 48
├──────────────┬───────────────────────────────────────────┬───────────────────┤
│ ROSTER       │ WORK ORDERS (Kanban 5 tray)               │ APPROVAL & DETAIL │
│ 264          │ todo · doing · review · done · blocked    │ 320               │
│              │                                           │                   │
│ ▍Raka        ├───────────────────────────────────────────┤ Menunggu izin (2) │
│ ▍Sari        │ DISPATCH LOG                              │ ┌───────────────┐ │
│ ▍Dimas       │ 21:03  Raka → Bima  "…"                   │ │ Bima          │ │
│ ▍Bima        │ 21:04  Bima  task #t3 → in_progress       │ │ npm test      │ │
│ ▍Laras       │ 21:04  Sari → Raka  "…"                   │ │ [Setujui][Tolak]│ │
│              │                                           │ └───────────────┘ │
│ (kuota ticks)├───────────────────────────────────────────┤ Detail terpilih   │
│              │ COMMAND COMPOSER  @target │ teks… │ Kirim│ (agen/tugas)      │
└──────────────┴───────────────────────────────────────────┴───────────────────┘
```

- **Status rail 48px**: nama kantor (14/600, bukan 34 — simpan `text-2xl` untuk halaman kosong), indikator gateway, mode, pause, bahasa, jam. Jam pakai mono.
- **Roster kiri 264px**: 5 baris, bukan kartu. Setiap baris: edge tab 3px warna agen, nama 14/600, role 12 muted, status (dot + label), tick kuota, judul tugas aktif 12 satu baris.
- **Tengah**: Kanban di atas (tinggi adaptif, min 240), log di bawah (flex), composer menempel di dasar tengah.
- **Kanan 320px**: antrean approval di atas, detail entitas terpilih di bawah. Di bawah 1200px, rail kanan jadi slide-over.
- **1024–1199px**: roster menyusut jadi strip horizontal 5 chip di atas log; Kanban 2 kolom dengan scroll horizontal.
- **<1024px**: satu kolom; navigasi tab `Log · Tugas · Approval`; composer sticky bawah.

Grid internal panel: 12 kolom, gutter 24, padding 16. Konten rata kiri; tidak ada teks tengah kecuali empty state.

---

## 4. Komponen

### 4.1 StatusRail
Tinggi 48. Kiri: nama kantor + indikator gateway (`titik + "Gateway OK"` / `"Gateway offline"`). Kanan: segmented control mode (`Semi` / `Penuh`), tombol pause (ikon ⇣? gunakan Lucide `Pause`), toggle bahasa (`ID` / `EN`), jam `HH:MM` mono, dan badge jumlah approval (angka di kotak, bukan lingkaran merah).

### 4.2 RosterRow (5)
```
▍ Raka            Manajer                     ● Menunggu izin
  ag/gemini-3.8   ███████░░░░░░░░░░░░░  32/80
  Tugas: t3 · Bangun halaman harga
```
- Tinggi 64, border-bottom `--rule`.
- Baris terpilih: `--surface-2` + border kiri 2px warna agen.
- Baris offline: opasitas teks 0.55 + label "Offline" + alasan di tooltip.
- Klik = pilih (detail di rail kanan), klik ganda = isi target composer.

### 4.3 Tick (signature)
- 20 segmen, lebar 4, gap 2, tinggi 8. Terisi `--data` (kuota) atau warna agen (progres), kosong `--rule`.
- Angka di kanan: `32/80` mono 12.
- Saat sisa ≤20%: segmen terisi `--warn`; saat 0: `--danger` dan label "habis".
- Tick **tidak** beranimasi kecuali saat nilainya berubah (140ms width).

### 4.4 DispatchLog
- Kolom waktu 56px mono 12 `--text-faint`, rata kanan.
- Badge aktor: nama 12/600 berwarna agen + arah (`→ Bima`, `→ CEO`) 12 muted.
- Isi 14/1.45, maksimal 3 baris lalu "selengkapnya".
- Baris sistem (tool call, status) memakai `--surface-2` dan teks 13; bukan kartu.
- Baris approval memakai border kiri 2px `--warn`.
- Virtualisasi setelah 200 baris. Auto-scroll hanya bila pengguna sedang di dasar.
- `aria-live="polite"` pada kontainer; jangan mengumumkan setiap token.

### 4.5 CommandComposer
```
[@ Raka ▾]  Tulis perintah untuk kantor…            [Kirim ⏎]
            /rapat · @all · Esc batal
```
- Chip target: warna agen, klik untuk ganti (`Raka`, `Semua`, `Manajer`, atau agen lain).
- Textarea auto-grow 1–4 baris, `Enter` kirim, `Shift+Enter` baris baru.
- Saat gateway offline: textarea tetap bisa diketik, tombol nonaktif dengan alasan "Gateway offline — perintah akan diantrekan".
- Perintah dikirim sebagai `ceo.send` (lihat kontrak `packages/shared`), bukan teks bebas.

### 4.6 WorkOrderBoard (Kanban)
- Lima tray: `todo`, `in_progress`, `review`, `done`, `blocked`. Header: judul 13/600, jumlah mono, garis status 2px.
- Kartu: judul 13/600 (2 baris maks), baris bawah `#t3` mono 11 + assignee chip warna + waktu relatif.
- Kartu `blocked` menampilkan alasan dalam satu baris `--danger`.
- Drag-and-drop memanggil `task.move`; bila server menolak transisi, kartu kembali + toast.
- Tidak ada bayangan; hover = `--surface-2` + border `--rule-strong`.

### 4.7 ApprovalModal
- Scrim `rgba(0,0,0,.55)`, panel 560px, radius 12, surface `--surface-2`.
- Isi: judul "Persetujuan perintah", agen + tugas, blok mono berisi perintah persis, alasan singkat, catatan risiko, hitung mundur 10:00.
- Tombol: `Tolak` (outline danger) kiri, `Setujui` (isi `--signal`) kanan. Alasan penolakan opsional 1 baris.
- Keyboard: `A` setujui, `D` tolak, `Esc` tutup (dihitung tidak menjawab). Focus trap; fokus awal ke `Setujui`.
- Timeout = tolak otomatis, tampilkan toast "Kedaluwarsa — perintah ditolak".

### 4.8 Banner, toast, empty state
- Banner gateway offline di bawah status rail: latar `--surface-2`, garis kiri 2px `--danger`, satu kalimat + tombol "Coba lagi".
- Toast kiri bawah, 4 detik, tanpa ikon selain titik status, aksi tunggal.
- Empty state: satu kalimat + satu aksi. Contoh log kosong: "Belum ada aktivitas. Kirim perintah pertama ke Raka." — bukan ilustrasi besar.

---

## 5. Interaksi & Keyboard

| Tombol | Aksi |
|---|---|
| `/` | Fokus composer |
| `@` | Buka pemilih target |
| `Enter` | Kirim perintah (composer) |
| `Shift+Enter` | Baris baru |
| `Esc` | Tutup modal / batal target |
| `A` / `D` | Setujui / tolak (saat modal fokus) |
| `↑` `↓` | Navigasi log saat fokus di daftar |
| `J` / `K` | Kartu Kanban berikutnya/sebelumnya (opsional) |

Fokus terlihat: outline 2px `--data`, offset 2. Target klik minimum 32×32. Tidak ada hover-only action penting.

---

## 6. Aksesibilitas

- Kontras teks ≥4.5:1 (besar ≥3:1), diuji dengan token di §2.
- Status tidak pernah hanya warna: selalu label teks + ikon bentuk berbeda.
- `role="dialog"` + `aria-modal` pada approval; `aria-live="polite"` pada log.
- Form: label eksplisit, bukan placeholder sebagai label.
- Hormati `prefers-reduced-motion`; tanpa autoplay suara.
- Kanban dapat dipindah lewat keyboard (menu kartu: "Pindahkan ke…").

---

## 7. Lima Pantangan Visual

1. **Tanpa gradien, glow, atau kaca.** Tidak ada ungu/indigo, tidak ada `backdrop-filter`, tidak ada bayangan berwarna, tidak ada "aura AI".
2. **Tanpa kumpulan kartu seragam.** Jangan membuat grid kartu bundar identik dengan bayangan sama. Hierarki dari garis, ukuran tipe, dan spacing. Maksimal dua tingkat radius per layar.
3. **Tanpa dekorasi tipografi.** Tanpa ALL-CAPS eyebrow, tanpa meta "A · B · C", tanpa penomoran 01/02/03, tanpa mono untuk label hiasan. Mono hanya untuk data yang sejajar.
4. **Tanpa data palsu.** Setiap angka, kartu, dan status terikat ke event stream. Tidak ada grafik demo, tidak ada skeleton yang berfungsi sebagai ilustrasi, tidak ada angka contoh di build produksi.
5. **Tanpa emoji atau ikon campur.** Satu set ikon (Lucide), 16/20px, stroke 1.5. Tanpa panah "→" ditempel di label. Tanpa emoji di UI, termasuk status.

Tambahan: tidak ada animasi masuk per bagian, tidak ada parallax, tidak ada hover yang menggeser layout.

---

## 8. Data Binding (kontrak `packages/shared`)

| UI | Sumber |
|---|---|
| RosterRow | `AgentView`: `name`, `role`, `status`, `model`, `quota.used/cap`, `currentTaskId`, `currentTaskTitle` |
| Tick kuota | `AgentView.quota` → `used`, `cap`, `resetAt` |
| DispatchLog | event `message.created` / `agent.say` / `run.*` |
| Kanban | `Task[]` dari `state.snapshot` dan event `task.updated` |
| ApprovalModal | event `approval.requested`; jawaban `approval.respond` |
| Status rail gateway | `StateSnapshot.office.gateway.status` |
| Mode & bahasa | `office.mode`, `office.language`; klien kirim `office.setMode` / `office.setLanguage` |
| Pause | `office.paused`; klien kirim `office.pauseAll` |

Aturan: server adalah sumber kebenaran; klien optimistis hanya untuk composer dan drag Kanban, lalu rekonsiliasi dari event.

---

## 9. Copywriting UI

- Sentence case, kata kerja aktif: "Kirim perintah", "Setujui", "Tolak", "Coba lagi".
- Nama aksi konsisten di seluruh alur (tombol "Setujui" → toast "Disetujui").
- Error menjelaskan apa yang terjadi dan langkah berikutnya, tanpa meminta maaf.
- Kosong = ajakan bertindak, satu kalimat.
- Istilah tetap: **kursi** (seat), **tugas**, **laporan**, **approval**, **kuota**, **giliran**.

---

## 10. Struktur File UI (usulan untuk `apps/web`)

```
src/
  styles/tokens.css        # semua token §2
  components/
    StatusRail.tsx
    RosterRow.tsx  Tick.tsx  QuotaMeter.tsx
    DispatchLog.tsx  LogRow.tsx
    CommandComposer.tsx
    WorkOrderBoard.tsx  TaskCard.tsx
    ApprovalModal.tsx
    Banner.tsx  Toast.tsx  EmptyState.tsx
  lib/events.ts            # import tipe dari @office/shared
```

Tidak ada komponen yang menghitung status; semua berasal dari state/event.

---

## 11. Checklist Sebelum Dianggap Selesai

- [ ] Semua warna dari token §2, tidak ada hex lepas di komponen.
- [ ] Font Overpass + Overpass Mono termuat lokal, bukan CDN.
- [ ] Tidak ada gradien/glow/backdrop-blur di mana pun.
- [ ] Tidak ada kartu dengan radius & bayangan identik.
- [ ] Mono hanya pada waktu, ID, kuota, perintah terminal.
- [ ] Semua status punya label teks + bentuk ikon berbeda.
- [ ] Log virtualized, auto-scroll hanya saat di dasar.
- [ ] ApprovalModal: focus trap, keyboard A/D/Esc, timeout menolak.
- [ ] Gateway offline: banner + composer menjelaskan antrean.
- [ ] `prefers-reduced-motion` diuji.
- [ ] Kontras diuji untuk teks utama, muted, dan aksen.

---

## 12. Lampiran — HUD Isometrik 2:1 untuk Fase 3

Ditunda, tapi tokennya disiapkan sekarang agar tidak ada penulisan ulang.

**Proyeksi & grid**
- Isometrik 2:1, tile dasar **64×32 px**; tinggi bangunan kelipatan 16.
- Anchor sprite: bottom-center. Depth-sort: `y` lalu `x` (naik = belakang).
- Kamera orthografik, tanpa rotasi; zoom 1 / 1.5 / 2; pan dibatasi peta 24×14 tile.
- DPR maksimum 2; canvas dirender pada resolusi tetap lalu di-scale (hindari teks blur).

**Ukuran karakter**
- Sprite 48×64 (idle) dan 48×72 (duduk) — one frame per arah; 4 arah cukup.
- Nama: 12/600 Overpass, underline warna agen 2px, satu baris.
- Status ring: ellipse 20×8 di lantai, warna agen, opasitas 0.5; bukan glow.
- Balon ucapan: maks 220×120, radius 6, surface `--surface-2`, border `--rule-strong`, teks 13/1.4, maks 3 baris + elipsis buntut 6px. Satu balon per agen; antre bila bentrok.

**Konsistensi visual**
- Palet sama dengan §2; lantai `--surface`/`--surface-2`, dinding `--surface`, aksen `--signal` untuk pintu/meeting.
- Tanpa shadow map berbayar: bayangan = ellipse `rgba(0,0,0,.28)` di lantai.
- Lighting flat; tidak ada bloom, tidak ada fog, tidak ada post-processing di v1.

**Performa**
- 5 aktor + ≤40 objek statis; target 60 fps, memori <150 MB.
- Sprite atlas tunggal; instancing untuk ubin lantai; tanpa alokasi per frame.
- `window.__game` mengekspos state ringkas untuk Playwright (karena canvas tidak terbaca accessibility tree).

**Transisi dari Command Center**
- HUD (status rail, approval, composer) tetap memakai komponen §4; kanvas menggantikan area tengah.
- Semua animasi karakter dipicu event yang sama dengan log — tidak ada sumber data kedua.
