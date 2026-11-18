# Rencana Teknis: Kamera First-Person (Mata Agen & Avatar Tamu), Kustomisasi Karakter, dan Dunia Bersama

> **Status:** Revisi 4 (18 November 2026). **F0, F2 (Dunia Bersama), dan F4 (login Google & peran) selesai** — CEO membalik K8: dunia real-time dijalankan dulu di server Node (K10–K13). Hasil, koreksi, dan angka ada di ledger §10. Seragam = Navy Tech (K7). Hosting publik & login Google DITUNDA (K14) sampai HP cadangan jadi server. Berikutnya (chat baru): F1 → F3 → F5 → F6; multiplayer (F7) ditunda.
> **Acuan:** `ide-fpv-kustomisasi-dan-gemini-ai.md` §2–§3, §5, §6 (Tahap A, C, D). Bagian Gemini (§4, Tahap B) hanya diberi catatan di §1.3 dan direncanakan terpisah.
> **Diperiksa terhadap kode:** `src/stage/IsometricOfficeStage.tsx`, `camera/cameraRig.ts`, `camera/wallFade.ts`, `rooms/doors.ts`, `rooms/managerOffice.ts`, `layout.ts`, `navigation.ts`, `graphics.ts`, `src/state/liveOffice.ts`, `apps/server/src/security/auth.ts`, `apps/server/src/drivers/api-driver.ts`, `office.config.json`, `wrangler.jsonc`, `docs/deployment-and-hosting-guide.md`.

---

## 0. Ringkasan

1. **Tinggi avatar 1,70 m** untuk agen dan tamu (tamu bisa memilih 1,60–1,80 m). Semua furnitur di scene sudah berskala manusia nyata, jadi 1,70 m justru paling cocok (§2).
2. **Avatar Rig v2** jadi fondasi bersama: proporsi manusia normal, siku dan lutut (kaki saat duduk akhirnya sampai ke lantai), kepala bisa menoleh, dan 1 draw call per avatar.
3. **Seragam agen hitam-biru formal.** Semua agen memakai seragam yang sama, dibedakan oleh rambut, warna kulit, kartu ID, dan beacon warna agen (§3.3).
4. **Dunia bersama real-time (K2) — SELESAI di server Node (K10, §10.2).** *Catatan revisi 3:* Sekarang, bahkan di mode live, rutinitas agen (kopi, Lounge, Commons, dan lainnya) diacak di setiap peramban, jadi tiap penonton melihat kantor yang berbeda. Rancangan solusinya sudah ada (§3.6): "sutradara" di server dan jam bersama. Karena butuh server yang menyala 24 jam, tahap ini ditunda. F1 tetap memisahkan pose dari logika keadaan supaya pemindahannya nanti mudah.
5. **Login — Google SELESAI (F4, §10.3); butuh OAuth client dari CEO.** *Catatan revisi 3:* Diputuskan memakai Google saja (K3). Login Google butuh alamat HTTPS publik dan server yang menyala saat pengunjung datang, jadi ikut ditunda bersama hosting. Sementara itu, Avatar Studio dan berjalan bebas memakai login yang sudah ada (token CEO / viewer). Ruang penting hanya bisa dimasuki agen, karyawan, dan CEO (§3.8).
6. **Urutan sekarang:** ~~F0~~ ✅ → ~~F2~~ ✅ → ~~F4~~ ✅ → F1 Rig v2 + seragam → F3 Mata Agen → F5 Avatar Studio → F6 Penjelajah FPV/TPV + ruang khusus + audio. **Ditunda:** F7 Multiplayer (K4) dan hosting publik (pilih A/B/C §3.6).

```
Selesai:   F0 Prototipe ─► F2 Dunia Bersama (server Node) ─► F4 Login Google & peran
Berikut:   F1 Rig v2 1,70 m ─► F3 Mata Agen ─► F5 Avatar Studio ─► F6 Penjelajah + audio
Ditunda:   F7 Multiplayer (K4) · hosting publik 24 jam (opsi A/B/C §3.6)
```

---

## 1. Tanggapan atas Dokumen Ide

### 1.1 Yang sudah tepat
- **Agen otonom, tidak bisa disetir:** cocok dengan mode live sekarang, karena pose sudah mengikuti `AgentStatus` asli.
- **Mata Agen tanpa login:** aman karena hanya menonton.
- **Toggle FPV/TPV untuk tamu:** TPV wajib ada. Tanpa TPV, hasil kustomisasi tidak pernah terlihat oleh pemiliknya.
- **Batal me-root HP:** setuju sepenuhnya.
- **Satu rig untuk agen dan tamu:** setuju. Seragam 10 agen juga ditulis sebagai `AvatarConfig` (§3.3), jadi sistem kustomisasinya hanya satu.

### 1.2 Koreksi fakta terhadap kode

| Dokumen ide | Kenyataan di kode | Dampak |
| :--- | :--- | :--- |
| Rig ada di `src/stage/avatarRig.ts` | File itu tidak ada. Avatar dibangun di `buildAvatars()` di dalam `IsometricOfficeStage.tsx` (±L1305). | Rig perlu dipisah ke modul sendiri (F1). |
| `headBone`, `Head_Bone`, `Neck_Bone` | Tidak ada tulang. Avatar terdiri dari ±9 mesh primitif dengan pivot hanya di bahu dan pinggul. Kepala menempel langsung di grup (Y 0,57), jadi tidak bisa menoleh. | FPV yang hidup butuh tulang leher dan kepala. |
| Tinggi mata 1,35–1,65 m | Berdiri: pusat kepala 0,57 m, puncak 0,69 m. Duduk (`sitY` 0,45): pusat kepala 1,02 m. Kaki 0,22 m tanpa lutut, jadi saat duduk kaki menggantung jauh dari lantai. | FPV saat berjalan = sudut pandang di bawah meja. |
| Kapsul r 0,35 m, tinggi 1,7 m | Tinggi 1,7 m sekarang sesuai keputusan K1. Radius 0,35 m terlalu gemuk: pintu tersempit 1,0 m dan banyak celah antar-perabot yang sempit. | Pakai r 0,25 m (§3.4). |
| Atlas palet 256² "tidak menambah draw call" | Draw call dihitung per mesh, bukan per tekstur. Avatar v1 sudah ±10 draw call per agen (±100 untuk 10 agen) walaupun materialnya dipakai bersama. | Draw call hanya turun kalau mesh digabung. Rig v2 = 1 mesh skinned per avatar (§3.2). |
| "Menengok rekan kerja" | Belum ada animasi menoleh. Badan berputar instan di setiap belokan lajur (`rotation.y = Math.atan2(…)`, ±L3219). | FPV akan "patah" 90° di setiap belokan. Perlu belok halus dan menoleh. |
| *Head-bobbing* halus | Saat berjalan, badan sekarang melompat 4 cm pada ±3,2 Hz (±L3214). | Goyangan kamera harus dihitung terpisah dan bisa dimatikan. |
| Suara desis pintu | Proyek belum punya sistem audio sama sekali. | Audio = lingkup baru (§3.9, F6). |
| §4.C Raka (Backend), Fajar (Tech Lead), Maya (Frontend) | `office.config.json`: Raka = Manajer, Fajar = Visual QA, Tari = Desainer UI/UX, Bima = Programmer. Tidak ada Maya. `src/roles.ts` juga tidak ada; peran ada di `packages/shared/src/config.ts`. | Persona agen harus mengikuti roster nyata. |
| §7.3 FPV "justru sangat menguntungkan" untuk performa | Frustum culling sudah berjalan di mode isometrik. FPV melihat jauh menembus dinding kaca, kameranya hampir selalu bergerak (Adaptive FPS tertahan di 60), dan `fitSunToView` memakai jarak 45 m untuk kamera perspektif sehingga bayangan di mode Tinggi melebar dan buram. | FPV kemungkinan sama berat atau lebih berat. Perlu anggaran khusus (§5). |
| Penonton melihat kantor yang sama | Hanya status agen yang sama. Semua rutinitas diacak `Math.random` (lewat `rand()` / `pick()`) di setiap peramban. Rapat dan kunjungan meja dibuat dari event WS saat diterima (`toStageEvents`), dan snapshot server tidak memuat keadaan panggung. | Perlu Dunia Bersama (§3.6). |

### 1.3 Catatan untuk bagian Gemini (di luar rencana ini)
1. **Driver tidak perlu ditulis ulang.** `apps/server/src/drivers/api-driver.ts` sudah memakai format OpenAI Chat Completions (tool calls dan SSE) lewat `gateway.baseUrl`. Gemini menyediakan endpoint yang kompatibel dengan OpenAI, jadi Tahap B cukup berupa lapisan "penyedia + kolam key" di gateway, tanpa migrasi ke `@google/genai`. Kompatibilitas tool calling dan streaming dengan model yang dipilih tetap harus dicek saat membangun.
2. **Kolam key dari banyak akun gratis berisiko.** Ketentuan Google APIs melarang upaya mengakali batas pemakaian, jadi key atau akun bisa diblokir. Selain itu, di tier gratis Google boleh memakai isi prompt untuk mengembangkan produknya, padahal agen mengirim isi repo dan file proyek. Saran: 1 project berbayar dengan batas anggaran, dan rotasi key hanya untuk failover (429/5xx) dengan backoff. Cek lagi ketentuan dan kuota terbaru saat Tahap B dimulai.
3. **Klaim kuota "lebih dari cukup" perlu dihitung ulang.** Satu tugas agen bisa memakan banyak request (setiap langkah tool = 1 request). Ukur dulu dari log `/api/runs`.
4. **Jangan hardcode model.** Bima, Gita, Tari, dan Satria sekarang memakai model Claude lewat 9router, jadi menghapus 9router total berarti 4 agen pindah model. Saran: penyedia dan model diatur per agen di `office.config.json`.
5. **Obrolan dari tamu membuka risiko prompt injection.** Agen punya tool (menulis file, git, `run_command` dengan persetujuan CEO). Pesan tamu tidak boleh masuk ke inbox atau daftar tugas agen. Saran: giliran khusus "obrolan saja" tanpa tool, pesan tamu ditandai tidak tepercaya, dan kuota per tamu dihitung di server.

---

## 2. Skala Avatar: Diputuskan 1,70 m

### 2.1 Mengapa 1,70 m cocok
Semua furnitur dan pintu di scene sudah berskala manusia nyata. Yang tidak cocok justru avatar v1 (0,69 m).

| Elemen | Ukuran di kode | Cocok untuk orang 1,70 m |
| :--- | :--- | :--- |
| Tinggi pintu (`DOOR_HEIGHT`) | 2,57 m | Ya |
| Meja kerja / pusat monitor | 0,75 m / ±0,95 m | Ya: mata duduk ±1,24 m, pandangan turun ±21° ke monitor |
| Podium Workshop | 1,12 m | Ya. Sekarang pembicara chibi 0,69 m lebih pendek dari podiumnya |
| Meja bar Pantry | 1,05 m (stool tinggi) | Ya |
| Dudukan diner pod | 0,45 m | Ya |
| Focus pod | tinggi 1,48 m | Ya: kepala duduk ±1,37 m |
| Rig kamera Studio | 1,68 m | Ya, setinggi mata operator |
| Pintu lift | 2,45 m | Ya |
| Dinding | 3,2 m | Ya |

**Dampak ke tampilan isometrik:** agen yang berdiri jadi ±2,5× lebih tinggi. Menurut sinar isometrik di `CLAUDE.md` (per 1 m tinggi: ΔX −1,39, ΔZ −1,544), kepala di 1,70 m menutupi lantai ±2,4 m di barat laut agen. Agen duduk hanya naik ±0,2 m. F0 memeriksa lorong ruang kerja, antrean kopi, dan Commons lewat screenshot.

### 2.2 Proporsi target (`height` 1,0 = 1,70 m)

| Titik | Tinggi |
| :--- | :--- |
| Puncak kepala | 1,70 m |
| Mata (soket `eye`) | 1,58 m |
| Bahu | 1,38 m |
| Sendi pinggul | 0,87 m |
| Lutut | 0,47 m |
| Pergelangan kaki | 0,07 m |
| **Mata saat duduk** di dudukan 0,45 m | **±1,24 m** |

Proporsi manusia normal ±1:7 (tinggi kepala ±0,24 m), dengan gaya low-poly stylized supaya serasi dengan GLB kantor. Tamu memilih `height` 0,94–1,06 (1,60–1,80 m). Semua agen 1,70 m.

---

## 3. Arsitektur Target

### 3.1 Mode kamera

`CameraMode` diperluas dari `'iso' | 'free'` menjadi `'iso' | 'free' | 'eye' | 'explore'`.

| Mode | Siapa | Kontrol |
| :--- | :--- | :--- |
| `iso` | Semua | Seperti sekarang (OrbitControls). |
| `free` | Semua | Seperti sekarang (terbang bebas, tanpa tabrakan). |
| `eye` (Mata Agen) | Semua, termasuk publik tanpa login | Gerak dimatikan. Seret = **lirik** (yaw ±60°, pitch ±35°), kembali ke arah agen 1,5 dtk setelah dilepas. ←/→ ganti agen, Esc keluar. |
| `explore` (Penjelajah) | Wajib login (sekarang token CEO / viewer; nanti juga akun Google) | Avatar sendiri dengan sub-tampilan `fpv` / `tpv` (tombol V). |

- **Transisi masuk:** dari kamera ortografis ke perspektif tidak bisa di-tween mulus. Urutannya: layar meredup 0,2 dtk, lalu kamera perspektif meluncur 0,8 dtk dari titik 2,5 m di belakang-atas kepala agen ke soket mata. Keluar = kebalikannya.
- **Lensa:** FOV 70° untuk FPV, 60° untuk TPV, near 0,05, far 60 m (sekarang 250 m).
- **Antarmuka sumber mata** (supaya kamera tidak bergantung pada detail rig):

```ts
// src/stage/camera/eyeCam.ts
export interface EyeSource {
  /** Posisi & orientasi mata di dunia (sudah termasuk tolehan kepala). */
  eye(outPos: THREE.Vector3, outQuat: THREE.Quaternion): void;
  /** Fase langkah 0..1 saat berjalan, null saat diam (dasar head-bob). */
  gait(): number | null;
  /** Sembunyikan kepala & aksesori agar tidak menembus near plane. */
  setFirstPerson(on: boolean): void;
}
```

- **Peredaman:** posisi diredam eksponensial (τ 0,08 dtk saat duduk, 0,12 dtk saat berjalan). Rotasi memakai slerp (τ 0,15 dtk).
- **Head-bob:** naik-turun ±2 cm pada 2× frekuensi langkah dan geser samping ±1 cm. Mati otomatis bila `prefers-reduced-motion`, dan bisa dimatikan dengan toggle HUD "Goyang kepala".

### 3.2 Avatar Rig v2

**Struktur modul baru** (keluar dari file panggung yang sudah 3.796 baris):

```
src/stage/avatar/
  config.ts      // tipe AvatarConfig, default, palet warna (skema Zod di @office/shared)
  parts.ts       // geometri prosedural tiap bagian (low-poly, tanpa GLB)
  rig.ts         // AvatarRig: tulang, mesh skinned gabungan, setFirstPerson, recolor
  poses.ts       // kosakata pose (lihat di bawah)
  lookAt.ts      // target tolehan kepala per agen
  agentLooks.ts  // seragam agen + rambut/kulit per agen
```

**Tulang:** `root` (lantai) → `hips` → `spine` → `chest` → `neck` → `head` → `eye` (soket kamera). Lalu bahu → siku → tangan kiri dan kanan, pinggul → lutut → kaki kiri dan kanan. Soket properti ada di tangan kiri (map dokumen) dan tangan kanan (cangkir kopi).

**Satu mesh skinned per avatar:**
- Setiap bagian dibuat prosedural, diikat kaku ke satu tulang (`skinWeight` 1), lalu digabung dengan `mergeGeometries`. Warna disimpan di *vertex color*, jadi semua avatar memakai **satu material yang sama**.
- Mengganti bagian = menggabung ulang geometri (target < 5 ms, hanya saat config berubah).
- Draw call: v1 ±10 mesh per agen → v2 1 mesh + beacon (+ cangkir atau dokumen saat dipegang). Hemat ±80 draw call untuk 10 agen.
- FPV menyembunyikan kepala dengan menskalakan tulang `head` ke 0. Verteks kepala, rambut, kacamata, dan hijab ikut kolaps tanpa mesh terpisah.
- Klik untuk memilih agen tetap jalan karena `SkinnedMesh.raycast` di three r187 menghitung posisi tulang. Kalau terasa berat, pakai kapsul tak terlihat per avatar.
- Bagian yang butuh skinning 2 tulang: rok dan ujung blazer (pinggul + paha). Ini titik rawan *clipping* saat duduk dan diuji di matriks dudukan.

**Kosakata pose (`poses.ts`):** `stand`, `walk(phase)`, `sitDown(t)` / `standUp(t)`, `sit`, `type(speed)`, `lounge`, `discuss`, `inspect`, `present`, `raiseHand`, `scratchHead`, `sip`, `carryDoc`, `carryCup`. Ke-91 baris `…Pivot.rotation.set(…)` di switch pose diganti panggilan ini. `AgentMeshRefs` mendapat `rig: AvatarRig` sebagai pengganti 4 pivot.

**Menoleh (`lookAt.ts`).** Prioritas target, diredam τ 0,25 dtk, dibatasi yaw ±70° dan pitch ±30°:
1. Lawan bicara yang sedang ber-bubble (obrolan, kunjungan meja, pods, Commons).
2. Presenter atau TV saat rapat dan Workshop.
3. Titik 1,5 m di depan pada lajur saat berjalan. Kepala menoleh lebih dulu sebelum badan berbelok, jadi FPV terasa mulus.
4. Monitor saat mengetik, dengan lirikan acak ke meja tetangga setiap 8–15 dtk.
5. Avatar tamu yang lewat dalam jarak < 2 m (F6).

**Belok halus:** laju putar badan dibatasi ±7 rad/dtk, sehingga belokan 90° di lajur tidak lagi instan.

**Offset yang ikut berubah:** beacon (Y 0,92 → ±1,95), bubble (`+1,05` → `+2,05`), cincin seleksi, radius bayangan kontak. Jarak antre kopi (0,9 m) dan ambang *avoidance* (0,67 m) diperiksa ulang karena badan lebih lebar.

**Flag sementara `?rig=v1`** selama migrasi untuk membandingkan versi lama dan baru berdampingan.

**Kalibrasi dudukan.** `sitY` v1 adalah tinggi titik asal avatar v1, bukan tinggi dudukan. Rig v2 memakai tinggi dudukan nyata, diukur dari bounding box mesh dudukan GLB (atau tabel `SEAT_HEIGHT` bila GLB belum ada).

| Jenis dudukan | Jumlah | `sitY` v1 | Sumber |
| :--- | :---: | :---: | :--- |
| Kursi kerja (ruang kerja + Raka) | 10 | 0,45 | `sitLocal()` |
| Kursi rapat Boardroom | 10 | dari `board.seatWorld()` | `BOARDROOM_SEATS` |
| Stool bar Pantry | 4 | 0,65 | `PANTRY.stoolSitY` |
| Sofa Lounge | 3 | 0,34 | `LOUNGE.sitY` |
| Kursi Commons | 6 | 0,45 | `COMMONS.sitY` |
| Bangku teak Garden | 3 | 0,35 | `GARDEN.sitY` |
| Kursi Workshop | 6 | 0,45 | `WORKSHOP.sitY` |
| Diner pod | 4 | 0,35 | `COLLABPODS.sitY` |
| Focus pod | 2 | 0,35 | `FOCUSPODS.sitY` |
| Kursi editor Studio | 1 | 0,45 | `STUDIO.sitY` |
| Kursi konsol Server | 1 | 0,45 | errand `server` |
| **Total** | **50** | | 11 jenis |

Setiap jenis diperiksa: pinggul tidak tenggelam, lutut tidak menembus meja, **telapak kaki menapak lantai** (atau pijakan stool), dan tangan sampai ke keyboard.

### 3.3 `AvatarConfig` dan seragam agen

Skema dipakai bersama klien dan server (`packages/shared/src/avatar.ts`):

```ts
export const AvatarConfigSchema = z.object({
  v: z.literal(1),
  body: z.enum(['tegap', 'ramping', 'netral']),
  height: z.number().min(0.94).max(1.06),          // × 1,70 m → 1,60–1,80 m
  skin: z.number().int().min(0).max(7),            // 8 warna kulit
  hair: z.enum(['botak', 'cepak', 'belah_samping', 'ikal', 'kuncir', 'bob', 'hijab']),
  hairColor: z.number().int().min(0).max(7),       // untuk hijab: indeks palet kain
  top: z.enum(['kemeja', 'kaos', 'hoodie', 'blazer']),
  topColor: z.number().int().min(0).max(11),       // warna luar (blazer / kaos / hoodie)
  innerColor: z.number().int().min(0).max(11),     // kemeja dalam (hanya untuk blazer)
  bottom: z.enum(['celana_kain', 'jeans', 'rok', 'chino']),
  bottomColor: z.number().int().min(0).max(11),
  shoes: z.enum(['sneaker', 'pantofel', 'loafer']),
  shoesColor: z.number().int().min(0).max(7),
  acc: z.object({ glasses: z.boolean(), headphones: z.boolean(), lanyard: z.boolean(), tie: z.boolean() }).strict(),
  name: z.string().trim().min(1).max(24).regex(/^[\p{L}\p{N} .'\-]+$/u),
  title: z.string().trim().max(28).regex(/^[\p{L}\p{N} .'\-—]*$/u).optional(),
}).strict();
```

- Warna disimpan sebagai **indeks palet terkurasi**, bukan hex bebas. Gaya visual tetap konsisten dan validasinya sederhana.
- "Bentuk tubuh" memakai label netral (Tegap / Ramping / Netral) dan hanya mengubah proporsi bahu dan pinggul. Semua pilihan rambut dan pakaian, termasuk rok dan hijab, tersedia untuk semua bentuk.
- Nama dan gelar ditampilkan lewat `textContent` pada label DOM yang dipindah dengan `translate3d`, seperti speech bubble. Tidak ada draw call tambahan.
- Jumlah kombinasi bentuk: 3 × 7 × 4 × 4 × 3 × 2⁴ = **16.128**. Semuanya bisa diuji otomatis di Vitest karena pembangun geometri tidak butuh WebGL.

**Seragam agen (K7).** Ke-10 agen memakai satu seragam (`AGENT_UNIFORM`). Yang berbeda per agen hanya rambut, warna rambut, warna kulit, bentuk tubuh, dan kacamata (opsional). Identitas warna agen tetap ada di beacon, tepi bubble, pendar monitor, cincin seleksi, dan garis tipis di kartu ID. Tiga varian palet hitam-biru dibuat di F0, lalu CEO memilih dari screenshot:

| Varian | Luar | Kemeja dalam | Aksen | Bawah & sepatu |
| :--- | :--- | :--- | :--- | :--- |
| **1. Midnight Blue** *(rekomendasi)* | Blazer hitam arang `#15181D` | Biru royal `#1F4FBF` | Lanyard biru elektrik `#3B82F6`, kartu ID putih | Celana kain hitam `#121417`, pantofel hitam |
| **2. Navy Tech** | Blazer navy tua `#13233F` | Hitam `#0E0F12` | Piping kerah & saku biru elektrik `#3B82F6` | Celana kain hitam, pantofel hitam |
| **3. Corporate Classic** | Jas hitam `#121417` | Putih `#F1F5F9` | Dasi biru `#1E40AF` | Celana kain hitam, pantofel hitam |

Hijab untuk agen (bila dipilih CEO) memakai navy `#13233F` atau hitam. **Risiko keterbacaan:** dari kamera isometrik, punggung blazer hitam bisa menyatu dengan kursi kerja yang juga gelap. Varian 1 paling aman karena bagian biru kemejanya lebar. F0 memeriksa ini.

### 3.4 Peta Tabrakan

Usulan memakai **grid 2D yang dipanggang dari geometri scene**, bukan mesin fisika.

- **Ukuran:** sel 5 cm untuk tapak dunia X −7..31, Z −5..13,4 = 760 × 368 sel (±280 KB `Uint8Array`).
- **Isi:** segitiga dunia dari semua mesh statis ruangan di pita tinggi **0,10–1,80 m**. Lantai, karpet, lampu gantung, dan plafon otomatis terlewat. Daun pintu dikecualikan (nama dari `rooms/doors.ts`).
- **Kode sel:** 0 bebas, 1 padat buram (dinding, perabot), 2 kaca (padat tapi tembus pandang), 3 pintu (tertaut ke sensornya dan aturan aksesnya, §3.8).
- **Pemanggangan:** per ruangan, saat GLB ruangan itu terpasang. Dicacah di `requestIdleCallback` supaya frame tidak tersendat.
- **Gerak avatar tamu:** lingkaran r 0,25 m, langkah dipecah ≤ 4 cm, sumbu X lalu Z diselesaikan terpisah sehingga avatar meluncur di sepanjang dinding. Agen dianggap lingkaran dinamis r 0,25 m yang memblok tamu.
- **Pintu:** sel pintu bebas hanya bila daunnya terbuka ≥ 60 %. Sensor membuka pintu saat avatar masuk radius `doorSense` (1,5–1,6 m), kecuali pintu ruang khusus untuk peran yang tidak berhak.
- **Dipakai ulang untuk:** lengan pegas kamera TPV (DDA 2D + batas plafon 3,0 m), garis pandang bubble di FPV, peredaman suara di balik dinding (§3.9), dan validasi titik spawn.
- **Debug:** `__officeStageDebug.collision(true)` menampilkan grid sebagai `DataTexture` di lantai.
- **Alternatif** bila grid kurang akurat: `three-mesh-bvh` (kapsul vs segitiga).

### 3.5 Integrasi dengan sistem yang sudah ada

| Sistem | Perubahan |
| :--- | :--- |
| `WallFader` | Kamera `eye` / `explore` di dalam tapak dan di bawah 3,2 m otomatis masuk mode jalan kaki (semua dinding utuh). TPV dibatasi plafon 3,0 m. |
| Pintu sensor (`lobby.update(dt, agentPts)` dan kawan-kawan) | Posisi avatar tamu ditambahkan ke `agentPts`, dengan aturan akses per pintu (§3.8). |
| *Avoidance* antar-agen (±L2684) | Tamu ikut sebagai rintangan: agen menyingkir, tamu diblok lingkaran agen. |
| Okupansi dudukan (`sofaOccupant`, `commonsOccupant`, `podOccupant`, `stoolOccupant`, …) | Tamu memesan kursi dengan id `visitor:<id>` di daftar okupansi yang sama, jadi agen tidak akan duduk di kursi yang sedang dipakai tamu. Semua pemanggilan `animMap.get(occupant)` diberi guard. Saat F2 dikerjakan, okupansi pindah ke sutradara di server (§3.6). |
| Speech bubble (±L3350) | Offset Y dari rig. Di mode `eye`, bubble agen yang diikuti pindah ke subtitle HUD. Bubble agen lain hanya tampil bila ≤ 12 m dan garis pandangnya tidak terpotong sel buram. |
| Adaptive FPS (`cam.isActive`) | Mode `eye` dianggap aktif hanya saat kecepatan sudut atau linear kamera melewati ambang. Agen yang duduk mengetik = 30 FPS di Hemat. |
| `fitSunToView` | Jarak potong 45 m diturunkan ke 14 m untuk `eye` / `explore`. |
| Antrean GLB gelombang 2 | Promosi ruangan berdasarkan posisi kamera (sudah ada), ditambah pemanggangan peta tabrakan ruangan itu. |
| Klik agen | Klik = pilih agen (tetap). Klik ganda atau tombol "Lihat dari mata" di Inspector = masuk `eye`. |
| Debug hooks baru | `eye(id)`, `eyeState()`, `explore(config?)`, `visitorAt(pos)`, `collision(show)`, `rigCompare()`, `uniform(variant)`, `worldState()`, `clockOffset()`. |

### 3.6 Dunia Bersama (K2) — ✅ dikerjakan di server Node (K10), lihat koreksi §10.2

> **Status:** ditunda sampai ada hosting 24 jam. Sampai saat itu, setiap penonton menjalankan simulasinya sendiri seperti sekarang. Rancangannya tetap dicatat di sini supaya F1–F6 tidak menutup jalannya.

**Masalah sekarang:**
- **Demo:** semua rutinitas diacak di peramban, jadi setiap penonton melihat kantor yang berbeda.
- **Live:** hanya status agen (mengetik, angkat tangan, error, offline) yang sama. Kopi, obrolan, Lounge, Commons, Workshop, dan rutinitas lain tetap diacak per peramban.
- Rapat dan kunjungan meja dibuat dari event WS saat event itu diterima (`toStageEvents` di `liveOffice.ts`). Penonton yang membuka halaman di tengah rapat tidak melihat rapat itu, karena `state.snapshot` dari server tidak memuat keadaan panggung.

**Solusi: sutradara di server + jam bersama.**
- **Paket baru `packages/world`** (TypeScript murni, tanpa Three.js). Isinya: `layout.ts` dan `navigation.ts` (keduanya sudah tidak mengimpor Three.js), mesin keadaan rutinitas, penjadwal, pemesanan kursi, door mutex, antrean kopi, orkestrasi rapat, dan pemilihan baris dialog. Semua keacakan memakai PRNG ber-seed milik sutradara.
- **Server menjalankan `WorldDirector`** dengan tick tetap 10 Hz. Inputnya: status agen nyata, pesan (`/rapat`, kunjungan meja), dan kehadiran agen.
- **Yang dikirim ke penonton adalah keputusan, bukan posisi per frame.** Contoh: `{ agent, state, path, startAt, speed, seat, line, until }`. Posisi pada waktu t = titik di `path` sejauh `(t − startAt) × speed`. Karena graf navigasinya sama di semua penonton, posisi yang dihitung juga sama. Lalu lintasnya hanya puluhan event per menit.
- **Jam bersama:** klien mengukur selisih jamnya ke server lewat ping WS (NTP sederhana), lalu semua waktu memakai jam server. Selisih antar-penonton < ±100 ms.
- **Penonton yang baru datang** menerima `world.snapshot` (keadaan semua agen + rutinitas yang sedang berjalan + waktu mulainya). Kalau rapat sedang berlangsung, ia langsung melihat agen duduk di kursinya.
- **Klien hanya merender:** pose, tolehan kepala, bob, dan bubble. Hal kosmetik kecil (lirikan acak, napas) boleh berbeda antar-penonton tanpa mengubah keadaan dunia.
- **Demo statis tanpa server:** `WorldDirector` yang sama berjalan di peramban dengan label SIMULASI. Satu kode untuk dua tempat.
- **Interaksi tamu yang mengubah dunia** (duduk di kursi, antre kopi) dikirim ke server sebagai permintaan. Dengan begitu sutradara tidak mengirim agen ke kursi yang sedang dipakai tamu. Interaksi kosmetik (agen menoleh atau menyapa tamu) tetap lokal sampai multiplayer.
- **Bukan multiplayer.** Dunia bersama = semua orang melihat **agen** yang sama. Multiplayer (F7) = penonton juga saling melihat **avatar tamu** lain. Setelah F2 selesai, kanal WS untuk F7 sudah tersedia, jadi F7 tinggal menambah kanal `presence`.

**Dampak ke kode:** ini pemisahan besar. Switch keadaan di `IsometricOfficeStage.tsx` (±L2710–L3240) dipecah menjadi logika dunia (pindah ke `packages/world`) dan pemetaan keadaan → pose (tetap di panggung, memakai `poses.*` dari F1). Posisi dunia yang sekarang dibaca dari scene graph (`SeatAnchor_*` via `getWorldPosition`, `lobby.spawnWorld()`, `board.seatWorld()`) diganti hitungan murni. Ini aman karena ruangan hanya digeser, tidak diputar.

**Hosting untuk situs publik (K8, perlu keputusan sebelum peluncuran):** dunia bersama butuh server yang selalu menyala dan bisa dijangkau publik.

| Opsi | Cara | Kelebihan | Kekurangan |
| :--- | :--- | :--- | :--- |
| **A. Cloudflare Tunnel ke PC rumah** | Server yang sekarang dibuka lewat Tunnel (tanpa membuka port; sudah dibahas di `deployment-and-hosting-guide.md` Opsi B). Publik hanya mendapat kanal `world` baca-saja. | Paling sedikit kode; satu server, satu sistem login. | PC harus menyala 24/7. PC rumah menerima lalu lintas publik (dilindungi Cloudflare, tapi tetap risiko). |
| **B. Relay Cloudflare Durable Object** *(rekomendasi untuk publik)* | `WorldDirector` berjalan di Durable Object. PC rumah hanya mengirim status agen nyata keluar ke relay. Penonton dan login Google terhubung ke relay. | Kantor tetap hidup 24/7 walau PC mati (agen tampil offline atau SIMULASI). PC rumah tidak menerima koneksi publik. Kemungkinan cukup dengan paket gratis karena yang dikirim hanya keputusan (cek batasnya saat memilih). | Ada codebase Worker baru dan dua deployment. Login dan profil tinggal di relay. |
| **C. VPS ±$4–5/bulan** | Seluruh server pindah ke VPS. | Selalu menyala, satu server. | Berbayar. Agen bekerja di repo, jadi workspace git juga harus ikut pindah. |

Opsi B berjalan di server Cloudflare, jadi tidak butuh perangkat fisik sendiri yang menyala 24 jam. Yang tetap butuh PC menyala hanyalah agen AI aslinya; saat PC mati, kantor tampil dengan agen offline atau simulasi.

Karena `WorldDirector` ditulis di `packages/world` tanpa ketergantungan Node atau Three.js, ia bisa dijalankan di server sekarang dulu (pengembangan dan Tailscale), lalu dipindah ke opsi A, B, atau C tanpa ditulis ulang.

### 3.7 Login & Peran (K2, K3)

**Diputuskan (K3): Google saja dulu.** Login Google butuh alamat HTTPS publik untuk redirect dan server yang menyala saat pengunjung datang, jadi dikerjakan bersama hosting (F4, ditunda).

**Sementara (sebelum F4):**
- Token CEO = CEO.
- Token viewer (`OFFICE_VIEWER_TOKEN`) = tamu: boleh membuat avatar dan berjalan bebas, ditolak di ruang khusus.
- Peran karyawan baru tersedia setelah login Google.
- Demo statis publik = hanya menonton (isometrik + Mata Agen), sesuai K2.

**Peran (setelah F4):**

| Peran | Cara masuk | Hak |
| :--- | :--- | :--- |
| **Publik** | Tanpa login | Menonton diorama dan Mata Agen. Bubble hanya template, tanpa `agent.say` asli (K9). |
| **Tamu** | Masuk dengan Google | + Avatar Studio, berjalan bebas FPV/TPV di area umum. |
| **Karyawan** | Akun Google yang dinaikkan CEO | + Masuk ruang khusus (§3.8), membaca bubble `agent.say` asli. |
| **CEO** | Token CEO (seperti sekarang) | Semua hak, termasuk persetujuan dan tugas. |
| Agen | — | Selalu bisa ke mana saja. |

Akun Google CEO **tidak otomatis** menjadi CEO. Tindakan berbahaya (persetujuan, `run_command`, tugas) tetap butuh token CEO, supaya akun Google yang dibobol tidak bisa mengendalikan agen.

**Opsi login:**

| Opsi | Cocok untuk | Catatan |
| :--- | :--- | :--- |
| **Google (OpenID Connect)** *(dipilih, K3)* | Hampir semua pengunjung | Gratis. Butuh project Google Cloud + OAuth client, domain HTTPS publik untuk redirect, dan layar persetujuan (nama aplikasi, halaman kebijakan privasi). Scope cukup `openid email profile`. |
| GitHub OAuth | Pengunjung developer | Gratis, setup mirip. Cocok sebagai tombol kedua. |
| Email + kode sekali pakai | Yang tidak punya akun Google | Butuh layanan kirim email. Rawan spam bila tidak dibatasi. |
| Passkey (WebAuthn) | Login cepat tanpa password | Paling aman, tapi UX lintas perangkat lebih rumit. Cocok sebagai tambahan nanti. |
| Kode undangan | Tamu khusus | Paling sederhana, tanpa pihak ketiga. |
| Cloudflare Access | Tim internal | Login tanpa kode, tapi menggerbangi seluruh URL. Kurang cocok untuk situs yang boleh ditonton tanpa login. |

**Alur Google:** `GET /api/auth/google` → redirect ke Google dengan `state`, `nonce`, dan PKCE → `GET /api/auth/google/callback` → kode ditukar di server (client secret di `.env`, tidak pernah ke klien) → ID token diverifikasi (tanda tangan JWKS Google, `iss`, `aud`, `exp`, `nonce`, `email_verified`) → upsert tabel `users` (id, provider, sub, nama, email, peran, dibuat) → cookie sesi `v2.<peran>.<userId>.<exp>.<sig>`.
- Cookie `state` OAuth memakai `SameSite=Lax` khusus untuk callback, karena redirect dari Google bersifat lintas-situs. Cookie sesi tetap `HttpOnly` + `SameSite=Strict`.
- Data yang disimpan hanya `sub`, nama tampilan, email (hanya dilihat CEO untuk menaikkan karyawan, tidak pernah ditampilkan ke orang lain), dan profil avatar.
- Panel CEO baru: daftar pengguna, naikkan ke karyawan atau turunkan, blokir.

### 3.8 Ruang Khusus (K5)

Prinsip: ruang penting hanya bisa dimasuki agen, karyawan, dan CEO. Daftar ruangannya sudah dikonfirmasi CEO (K5b):

| Ruangan | Kapan terkunci untuk tamu | Pintu sekarang | Perlu ditambah |
| :--- | :--- | :--- | :--- |
| Server / IT | Selalu | Pintu baja + keypad RFID (LED merah/hijau) | Aturan akses saja |
| Ruang Manajer | Selalu | Daun pintu geser kaca, tetapi diam di posisi terbuka | Pintu dianimasikan dengan sensor + pembaca kartu |
| Boardroom | Saat rapat berlangsung | Pintu terbuka dari foyer, tanpa daun pintu | Pintu kaca geser (`slidingGlassDoor`) + pembaca kartu |
| Studio | Saat lampu ON AIR menyala | Pintu terbuka dari Commons (X 18), tanpa daun pintu | Pintu kaca geser + pembaca kartu |
| Ruangan lain | Tidak pernah | — | — |

- Saat tamu mendekat ke pintu ruang khusus, pembaca kartu berbunyi "ditolak", LED-nya merah, dan muncul toast "Ruang ini khusus karyawan". Pintu tidak membuka dan sel pintunya tetap padat.
- Untuk agen, karyawan, dan CEO, pintu membuka seperti biasa (LED hijau).
- Sebelum multiplayer, pembatasan dilakukan di klien. Itu cukup, karena yang bisa dilanggar hanya tampilan milik orang itu sendiri. Di F7, server juga menolak posisi tamu di dalam zona khusus.
- Catatan: Mata Agen tetap memperlihatkan isi ruang khusus saat agen ada di sana (misalnya Satria di Server). Isinya simulasi. Kalau nanti layar NOC memuat data nyata, data itu disembunyikan untuk publik.

### 3.9 Audio (K6)

| Suara | Kapan | Di mana | Terdengar di mode |
| :--- | :--- | :--- | :--- |
| Desis pintu geser | Pintu otomatis membuka atau menutup | Lobi, Focus Pods, Garden, Access Hub, + pintu baru ruang khusus | FPV / TPV / Mata Agen |
| Bip pembaca kartu (diterima / ditolak) | Ada yang masuk atau tamu ditolak | Server / IT, Ruang Manajer, Boardroom, Studio | FPV / TPV / Mata Agen |
| Denting lift | Lampu panggil menyala, pintu lift | Access Hub | FPV / TPV / Mata Agen |
| Mesin espresso (giling + uap) | Agen atau tamu menyeduh kopi | Pantry, Coffee Bar | FPV / TPV / Mata Agen |
| Langkah kaki | Avatar berjalan; bunyinya beda per lantai (marmer Lobi, karpet ruang kerja, kerikil Garden) | Semua ruangan | FPV / TPV (langkah agen di sekitar lebih pelan) |
| Ketikan keyboard | Agen mengetik | Ruang kerja, Ruang Manajer, Focus Pods, konsol Server, meja editor Studio | Dalam ±4 m |
| Gemericik air mancur (loop) | Selalu | Garden | Di dekat Garden |
| Dengung server & AC (loop) | Selalu | Server / IT | Di dalam ruangan |
| Bel rapat | `/rapat` dimulai | Boardroom & foyer | Semua mode (di isometrik pelan, sebagai notifikasi) |
| Notifikasi UI | Agen butuh persetujuan, ada pesan baru | HUD | Semua mode, khusus CEO |

Aturan:
- **Mati (mute) secara default** sampai pengunjung mengklik tombol 🔊. Ini juga diwajibkan kebijakan autoplay peramban. Ada slider volume di HUD.
- Suara ruang (posisional) hanya di FPV / TPV / Mata Agen. Di isometrik hanya bel rapat dan notifikasi UI.
- Suara di balik dinding buram diredam (lowpass), memakai garis pandang dari peta tabrakan.
- Maksimal 8 sumber bersamaan, dipotong di jarak > 10 m.
- Pintu, bip, denting lift, dan bel disintesis dengan Web Audio (tanpa file). Langkah, espresso, air mancur, dan dengung server memakai sampel CC0 pendek (OGG ±20–80 KB per file, total < 500 KB) yang baru diunduh saat audio pertama kali dinyalakan.
- Suara suasana kantor dihapus karena terlalu ramai (K6).

---

## 4. Tahapan Pengerjaan

**Urutan sekarang:** F0 → F1 → F3 → F5 → F6. **Ditunda sampai ada hosting 24 jam (K8):** F2, F4, F7. Nomor tahap sengaja tidak diubah supaya rujukan di dokumen ini tetap sama.

### F0 — Prototipe & baseline ✅ (§10.1)
- Hook dev `rigCompare()`: avatar v1 dan prototipe Rig v2 1,70 m berdampingan di samping meja kerja, podium Workshop, stool Pantry, dan focus pod. Screenshot isometrik dan FPV.
- Hook dev `uniform(variant)`: 3 varian seragam (§3.3) dipakai 10 agen. Screenshot isometrik (cek keterbacaan punggung blazer di kursi gelap) dan close-up.
- Baseline FPV: `freeAt()` di ketinggian 1,58 m dan 1,24 m di 5 titik (ruang kerja, Jalan Utama, Boardroom, Pantry, Commons), mode Hemat dan Tinggi. Catat `fps`, `frameMs`, `calls`, `triangles` dari `perf()`.
- **Hasil:** varian seragam dipilih CEO, proporsi dikunci, angka anggaran di §5 terisi.

### F1 — Avatar Rig v2 1,70 m & seragam agen
- Modul `src/stage/avatar/` (§3.2), skema `AvatarConfig` di `@office/shared`, seragam `AGENT_UNIFORM`, rambut dan kulit per agen (usulan saya, direvisi CEO).
- Migrasi switch pose ke `poses.*`, `AgentMeshRefs.rig`, offset beacon/bubble/cincin/bayangan.
- Tolehan kepala (`lookAt.ts`) dan pembatas laju putar badan.
- Kalibrasi 50 dudukan (tabel §3.2) + flag `?rig=v1`.
- **Selesai bila:** `fastForward(640)` menjalankan semua rutinitas tanpa error; 11 jenis dudukan lolos cek visual dengan kaki menapak lantai; draw call avatar turun; `npm run typecheck` dan `npm test` lulus.

### F2 — Dunia Bersama ✅ (§10.2)
- `packages/world`: pindahkan `layout.ts`, `navigation.ts`, mesin keadaan rutinitas, penjadwal, okupansi kursi, door mutex, antrean kopi, orkestrasi rapat, dan PRNG ber-seed.
- Server: `WorldDirector` (tick 10 Hz) di `@office/server`, kanal WS `world` (event keputusan + `world.snapshot`), sinkronisasi jam (ping).
- Klien: panggung membaca keadaan dunia lalu menghitung posisi dari `path` + `startAt`. Demo statis menjalankan `WorldDirector` lokal.
- **Selesai bila:** dua peramban yang dibuka bersamaan menampilkan posisi agen yang sama (selisih < 10 cm, diuji otomatis dengan `worldState()` di dua tab Playwright); peramban yang dibuka di tengah rapat langsung melihat rapat itu; demo statis tetap berjalan; tes `packages/world` (determinisme seed, antrean kopi, door mutex, rapat) lulus.

### F3 — Mata Agen (Spectator, tanpa login)
- `camera/eyeCam.ts`: mode `eye`, `EyeSource`, peredaman, head-bob, transisi masuk/keluar, lirik.
- HUD: dropdown **"Mata Agen: pilih…"** di samping dropdown Fokus; panel kecil di kiri bawah berisi nama · peran · status · ruangan · tugas (sesuai hak peran, §3.7) · baris bicara terakhir; tombol **Keluar (Esc)**; ←/→ untuk ganti agen.
- Agen yang diikuti pergi (`away`): kamera otomatis keluar ke isometrik + toast "Raka sudah pulang".
- Aturan bubble (§3.5), batas `fitSunToView`, kebijakan FPS.
- **Selesai bila:** masuk/keluar mulus dari 10 agen; perjalanan meja → Boardroom tidak punya lompatan yaw > 25° per frame; bob mati saat `prefers-reduced-motion`; Hemat 30 FPS saat agen duduk; bubble tidak tembus dinding buram; berjalan di `build:next:demo`.

F3 tidak bergantung pada F2: kamera membaca tulang rig, jadi tetap berjalan dengan simulasi per peramban seperti sekarang.

### F4 — Login Google & peran ✅ (§10.3)
- Endpoint OAuth Google (§3.7), tabel `users`, peran `publik / tamu / karyawan / CEO` di `auth.ts`, cookie v2 (cookie v1 tetap diterima sampai kedaluwarsa).
- Panel CEO: daftar pengguna, naikkan/turunkan karyawan, blokir.
- Kanal `world` difilter per peran: publik tidak menerima `agent.say` asli atau judul tugas (K9).
- **Tes serangan:** `state` atau `nonce` palsu, ID token dengan `aud` lain atau kedaluwarsa, cookie v2 dipalsukan atau subjeknya ditukar, tamu memanggil endpoint CEO, pengguna yang diblokir.

### F5 — Avatar Studio (wajib login)
- Tombol **"Avatar Saya"** di HUD, hanya untuk pengguna yang login (sekarang token CEO / viewer; nanti juga akun Google). Tidak tersedia di demo statis publik (K2).
- Mode panggung `studio`: render kantor dijeda, renderer yang sama menggambar scene studio kecil (latar gradasi, lantai bulat, 1 lampu kunci + env map yang sudah ada). Tidak ada konteks WebGL kedua.
- Panel kanan dengan tab **Tubuh · Rambut · Atasan · Bawahan · Sepatu · Aksesori · Nama**, tombol Acak, 6 preset awal, Batal/Simpan, dan pratinjau pose (berdiri, berjalan, duduk mengetik).
- Simpan: `GET/PUT /api/me/avatar` (JSON ≤ 2 KB, divalidasi `AvatarConfigSchema` di server, tabel `avatar_profiles`). Sesi CEO punya satu profil di server. Token viewer dipakai bersama banyak orang, jadi profil viewer disimpan di `localStorage` peramban masing-masing sampai login Google (F4) memberi akun per orang.
- Untuk CEO: Ekspor/Impor JSON untuk menyetel rambut dan kulit 10 agen.
- **Selesai bila:** 16.128 kombinasi bentuk lolos uji Vitest; UI bisa dipakai di layar 360 px; nama berisi HTML tampil sebagai teks biasa; profil tersimpan dan muncul lagi setelah login ulang.

### F6 — Penjelajah FPV/TPV + ruang khusus + audio
- **Spawn:** karpet Lobi (`lobby.spawnWorld()`) atau pintu lift Access Hub.
- **Kontrol desktop:** klik kanvas untuk Pointer Lock; WASD; Shift untuk berlari (1,4 → 2,6 m/dtk); V untuk FPV/TPV; E untuk interaksi; Esc untuk melepas kursor. Bila Pointer Lock ditolak, pakai seret seperti Free Cam.
- **Kontrol sentuh:** joystick virtual di kiri (DOM, tanpa library), usap di kanan untuk menoleh, tombol E dan V di layar. Opsi "ketuk lantai untuk berjalan" memakai router `createBuildingNav`.
- **TPV:** lengan pegas 2,2 m di belakang-kanan bahu, dipendekkan oleh peta tabrakan, dibatasi plafon 3,0 m. Avatar menjadi 50 % transparan bila kamera berjarak < 0,6 m darinya.
- **Peta tabrakan** (§3.4) + overlay debug.
- **Interaksi** (prompt [E] muncul dalam jarak ≤ 1,2 m):
  - **Duduk:** kursi bebas, dipesan di daftar okupansi lokal (§3.5).
  - **Ambil kopi:** antre di antrean yang sama dengan agen, lalu animasi seduh.
  - **Lihat layar:** InfoWall, TV KPI, kios Lobi, totem Access Hub. Kamera mendekat ke layar.
  - **Sapa agen:** agen menoleh dan membalas dengan baris template "Halo, {nama}!" dari `officeDialogues.ts`, tanpa API.
  - **Bicara (chat AI):** baru tampil setelah Tahap B (Gemini) selesai.
- **Ruang khusus** (§3.8): pintu baru Boardroom dan Studio, animasi pintu Ruang Manajer, pembaca kartu, aturan akses per peran.
- **Audio** (§3.9).
- **Selesai bila:** skrip uji berjalan dari Lobi ke semua ruang umum tanpa menembus dinding atau perabot dan tanpa tersangkut di pintu; sesi viewer ditolak di 4 ruang khusus, sedangkan sesi CEO bisa masuk (peran karyawan diuji saat F4); FPV/TPV bisa ditukar kapan saja; audio mati sampai diklik; anggaran §5 terpenuhi.

### F7 — Multiplayer ⏸ ditunda (K4, K8)
- Kanal WS `presence` di atas kanal `world` dari F2: posisi, yaw, dan animasi 10 Hz; server me-relay ke penonton lain (batas jumlah tamu ditentukan saat itu); interpolasi 100 ms; avatar dan label tamu lain tampil.
- Server menolak posisi tamu di zona khusus.
- Agen menyapa atau menoleh ke tamu secara bersama (keputusan sutradara), tidak lagi hanya lokal.

---

## 5. Anggaran Performa FPV (Intel UHD)

Angka target final diisi dari baseline F0. Aturan awal:

| Ukuran | Target |
| :--- | :--- |
| Mode Hemat, `eye` / `explore` | ≥ 30 FPS stabil; tidak lebih berat dari Free Cam mode jalan kaki di titik yang sama. |
| Draw call avatar (10 agen + 1 tamu) | ≤ 25 (v1 ±100). |
| Peta tabrakan | Dipanggang saat idle, 0 ms per frame; ±280 KB memori. |
| Kanal `world` (F2, ditunda) | Rata-rata < 2 KB/dtk per penonton (event keputusan, bukan posisi). |
| Audio | ≤ 8 sumber bersamaan; sampel < 500 KB, diunduh saat audio dinyalakan. |
| Studio | Render kantor dijeda selama studio terbuka. |

Langkah yang sudah pasti:
1. `far` 60 m di `eye` / `explore`.
2. `fitSunToView` dipotong 14 m.
3. Kebijakan FPS di Hemat: `eye` duduk = 30, `eye` berjalan / `explore` bergerak = 60. Bila `frameMs` rata-rata > 20 ms selama 3 dtk, target turun ke 45.
4. Joystick, label nama, dan subtitle = DOM dengan `translate3d`, tanpa `backdrop-filter`.
5. Bubble dan label di-cull menurut jarak dan garis pandang.

---

## 6. Keamanan & Privasi
- **Login Google:** `state` + `nonce` + PKCE, ID token diverifikasi penuh di server, client secret hanya di `.env`. Akun Google tidak pernah mendapat hak CEO.
- **Kanal `world` difilter per peran.** `agent.say` dari agen asli bisa memuat isi proyek, jadi publik hanya melihat bubble template dan status (K9).
- Nama dan gelar tamu: regex karakter, batas panjang, dan selalu dirender lewat `textContent`.
- Config avatar divalidasi ketat di server (`.strict()`). Tidak ada URL atau teks bebas selain nama dan gelar.
- Data pribadi yang disimpan hanya `sub` Google, nama tampilan, dan email (hanya untuk CEO).
- Selama belum ada hosting publik, penonton publik hanya ada di demo statis, yang memang hanya berisi dialog template (K9).
- Mulai F2, permintaan dunia dari tamu (`seat.claim`) divalidasi server: kursi ada, kosong, dan tidak berada di ruang khusus untuk peran itu. Ada rate limit per pengguna.
- Aturan "tanpa API key" untuk panggung tetap berlaku: sapaan agen ke tamu memakai template `officeDialogues.ts`.

---

## 7. Pengujian & Verifikasi
- `npm run typecheck` dan `npm test`, ditambah tes baru: skema avatar, pembangun 16.128 kombinasi, peta tabrakan, aturan akses ruang, serta (saat tahap yang ditunda dikerjakan) determinisme `WorldDirector` dan OAuth Google dengan JWKS tiruan.
- Playwright headless dengan flag GPU wajib (`--disable-gpu`, `--disable-gpu-compositing`, `--disable-accelerated-2d-canvas`, `--disable-accelerated-video-decode`), dan `browser_close` di akhir setiap batch.
- Skenario: `fastForward(640)` untuk semua rutinitas; `eye` ke setiap agen 30 dtk; dua tab membandingkan `worldState()` (F2); tamu berjalan ke semua ruang umum dan ditolak di ruang khusus; `perf()` per mode kamera.
- Seperti tahap-tahap sebelumnya: koreksi dan angka final dicatat di ledger §10 dokumen ini, dan `CLAUDE.md` §3 diperbarui per tahap.

---

## 8. Keputusan CEO

### 8.1 Sudah diputuskan (18 November 2026)

| No | Keputusan |
| :---: | :--- |
| **K1** | Tinggi avatar **1,70 m** untuk semua agen; tamu bisa memilih 1,60–1,80 m. |
| **K2** | **Dunia bersama real-time**: semua penonton melihat agen yang sama pada saat yang sama. **Wajib login** untuk membuat karakter dan berjalan bebas. |
| **K4** | Multiplayer (tamu saling melihat) dikerjakan **nanti** (F7). |
| **K5** | Ruang penting hanya untuk **agen, karyawan, dan CEO**. |
| **K7** | Agen memakai **satu seragam hitam-biru formal**. Varian dipilih dari screenshot F0 (rekomendasi: Midnight Blue). |
| **K3** | Login memakai **Google saja dulu**. Dikerjakan bersama hosting (F4); sementara memakai token CEO / viewer. CEO tetap memakai token. |
| **K5b** | Ruang khusus: Server/IT dan Ruang Manajer selalu terkunci; Boardroom saat rapat; Studio saat ON AIR (§3.8). |
| **K6** | Semua suara di §3.9 dengan mute default, **tanpa** suara suasana kantor. |
| **K8** | Hosting 24 jam untuk dunia bersama **ditunda**. F2, F4, dan F7 menunggu keputusan hosting (opsi A/B/C di §3.6). |
| **K9** | Publik hanya melihat **dialog template**; `agent.say` asli untuk karyawan dan CEO. |
| **K10** | (18 Nov, membalik K8) Dunia real-time + login Google **dikerjakan sekarang** di **server Node** (localhost/LAN/Tailscale); `@office/world` portabel untuk hosting publik nanti. |
| **K11** | Sinkronisasi = **server otoritatif + snapshot posisi** 10 Hz, interpolasi 200 ms di klien (bukan keputusan path + startAt). |
| **K12** | Dunia real-time boleh **ditonton publik tanpa login** (`/ws/world` baca-saja, terfilter K9, dibatasi per IP). |
| **K13** | Token viewer tetap **membaca state penuh** (setara karyawan untuk data, tidak bisa memerintah). |
| **K7 (final)** | (18 Nov, dari screenshot F0) Seragam agen = **varian 2 Navy Tech** (`AGENT_UNIFORM` di `avatar/looks.ts`). Sementara dipasang di avatar v1; Rig v2 memakainya di F1. |
| **K14** | ⏸ **Ditunda CEO 18 Nov** sampai HP cadangan (di-root) dijadikan server; login Google juga ditunda bersama hosting. Kode Funnel sudah siap dan diuji lokal. Rencana awal: Hosting publik = **Tailscale Funnel** (gratis, tanpa domain, URL `.ts.net` tetap, tanpa codebase baru). PC harus menyala. Langkah di `deployment-and-hosting-guide.md` Opsi 3B, skrip `start-public.bat`. |

### 8.2 Masih terbuka
- Rambut / kulit / bentuk tubuh per agen di `avatar/looks.ts` masih usulan (direvisi CEO di F1).
- Seragam (K7) dan hosting publik (K14) sudah diputuskan 18 Nov.

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
| :--- | :--- |
| Migrasi rig menyentuh hampir semua pose, jadi rawan regresi visual. | Flag `?rig=v1`, matriks 50 dudukan, screenshot per ruangan sebelum dan sesudah. |
| Pemisahan dunia (F2) mengubah inti loop panggung. | Dikerjakan setelah F1 (pose sudah terpisah dari keadaan), tes determinisme di `packages/world`, uji dua tab. |
| Agen 1,70 m menutupi lebih banyak isi ruangan di isometrik. | Cek screenshot F0 dengan sinar isometrik; wall fade tetap berjalan. |
| Punggung blazer hitam menyatu dengan kursi gelap di isometrik. | Varian Midnight Blue, piping biru di bahu bila perlu, cek di F0. |
| Rok dan ujung blazer menembus paha saat duduk. | Skinning 2 tulang + diuji di matriks dudukan. |
| Mabuk gerak (*motion sickness*) di FPV. | Bob kecil yang bisa dimatikan, FOV 70°, tanpa roll kamera, peredaman rotasi, belok badan dibatasi. |
| Situs publik dengan dunia bersama butuh server 24/7. | Ditunda (K8). `WorldDirector` dirancang portabel, jadi nanti bisa dijalankan di Cloudflare, Tunnel, atau VPS tanpa ditulis ulang. |
| Setup OAuth Google butuh domain HTTPS publik dan layar persetujuan. | Disiapkan bersamaan dengan K8; selama pengembangan pakai redirect `localhost` (diizinkan Google). |
| `IsometricOfficeStage.tsx` sudah 3.796 baris. | Semua logika baru masuk modul sendiri (`avatar/`, `camera/eyeCam.ts`, `camera/exploreCam.ts`, `collision/`, `audio/`, `packages/world`). |
| Pointer Lock ditolak (iframe, kebijakan peramban). | Fallback seret-untuk-menoleh. |
| Performa di HP/tablet. | Mode Hemat jadi default di perangkat sentuh, opsi ketuk-untuk-berjalan, target 30 FPS. |

---

## 10. Ledger (diisi saat pengerjaan)

### 10.1 F0 — Prototipe & baseline (18 November 2026)

**Kode:** `src/stage/avatar/protoRig.ts` (prototipe STATIS v2 1,70 m: primitif low-poly di grup sendi, IK 2 tulang untuk kaki duduk, soket `eye` 1,58 m) dan `src/stage/avatar/looks.ts` (palet kulit/rambut 8 warna, 3 varian seragam §3.3, usulan rambut/kulit/bentuk per agen). Hook dev baru: `seatTop(x, z, maxY?)`, `rigCompare(on?, hideAgents?, variant?)`, `uniform(variant | null)`. Avatar v1 tidak berubah di luar hook ini.

**Tinggi dudukan terukur (raycast ke GLB, bukan `sitY` v1):**

| Dudukan | Permukaan | Catatan |
| :--- | :---: | :--- |
| Kursi kerja (9 meja) | 0,450 m | `sitY` v1 0,45 kebetulan sama dengan tinggi dudukan |
| Kursi eksekutif Raka | 0,473 m | |
| Stool bar Pantry | 0,734 m | Kaki v2 tidak sampai lantai → pijakan 0,26 m (heuristik `seat − 0,47`); `sitY` v1 0,65 |
| Focus pod | 0,450 m | `sitY` v1 0,35 (selisih 10 cm) |
| Meja kerja (permukaan) | 0,750 m | |

Semua dudukan di atas dicapai kaki v2 tanpa sisa (`gap` 0) dengan IK; stool butuh pijakan. Tabel 50 dudukan lengkap tetap dikerjakan di F1.

**Skala 1,70 m (`docs/img/f0/rig-compare-*-iso.png` / `*-fpv.png`):** podium Workshop 1,12 m sampai pinggang pembicara (v1 lebih pendek dari podiumnya); agen v2 yang duduk di focus pod tetap terlihat dari kamera SE (kepala di bawah atap 1,48 m, beacon di atas atap); mata duduk 1,25 m pas di depan monitor lengkung pod; di stool mata 1,53 m.

**Seragam (`docs/img/f0/uniform-{1,2,3}-workspace.png` & `-closeup.png`):** dari kamera isometrik yang terlihat hampir selalu **punggung dan bahu**; panel kemeja biru di depan dada hanya terlihat pada agen yang menghadap kamera. Akibatnya **varian 1 (Midnight Blue) dan 3 (Corporate Classic) menyatu dengan kursi kerja gelap**, sedangkan **varian 2 (Navy Tech) tetap terbaca**. Ini membalik asumsi §3.3 ("varian 1 paling aman karena bagian biru kemejanya lebar"). Keputusan CEO masih terbuka (§8.2): varian 2, atau varian 1 + piping biru di bahu/punggung.

**Baseline FPV (Free Cam mode jalan kaki, `perf()`, headless Chromium + SwiftShader, 1280 × 800):**

| Titik (arah pandang) | Hemat 1,58 m: calls / tris / frameMs | Hemat 1,24 m: calls / tris / frameMs | Tinggi 1,58 m: calls / tris |
| :--- | :--- | :--- | :--- |
| Isometrik home (pembanding) | 1.222 / 828 k / 10,8 | — | 1.809 / 1,55 M |
| Ruang kerja (0, −0,3) → utara | 34 / 37 k / 2,1 | 34 / 37 k / 2,2 | 308 / 340 k |
| Jalan Utama (8, 6,2) → timur | 625 / 207 k / 6,4 | 625 / 207 k / 6,6 | 998 / 608 k |
| Boardroom (11, 1,6) → utara | 101 / 111 k / 2,6 | 101 / 111 k / 2,7 | 549 / 649 k |
| Pantry (6,6, 8,9) → mesin kopi | 97 / 132 k / 2,7 | 88 / 133 k / 2,6 | 224 / 460 k |
| Commons (20, 3,6) → utara | 127 / 52 k / 2,9 | 131 / 53 k / 2,9 | 434 / 386 k |

- **Koreksi §1.2:** di mode Hemat, FPV justru **jauh lebih ringan** dari isometrik di kelima titik (calls 3–36 × lebih sedikit, frameMs 2–6,6 vs 10,8). Titik terberat = Jalan Utama memandang sepanjang 38 m menembus dinding kaca (625 calls). Risiko yang tersisa: kebijakan FPS (kamera FPV hampir selalu bergerak) dan jarak `fitSunToView` di mode Tinggi.
- Mode Tinggi di SwiftShader ±1 fps **di semua kamera, termasuk isometrik** (artefak renderer software, bukan khas FPV). Untuk Tinggi hanya calls/triangles yang valid; fps nyata harus diukur di Intel UHD (headed, oleh CEO).
- **Anggaran §5 diperbarui:** Hemat `eye`/`explore` ≤ 650 calls di titik terburuk (Jalan Utama), ≤ 150 calls di dalam ruangan, `frameMs` CPU ≤ 7 ms. Draw call avatar tetap target F1 (≤ 25).

### 10.2 F2 — Dunia Bersama (18 November 2026, K8 dibalik)

CEO memutuskan dunia real-time dikerjakan sekarang (K10–K13, §8.1). Struktur akhir:

| Bagian | Isi |
| :--- | :--- |
| `packages/world` (`@office/world`) | `layout.ts`, `navigation.ts`, `dialogues.ts` (dipindah dengan `git mv`; file lama di `office-next/src/stage/` tinggal shim `export *`), `rng.ts` (mulberry32), `spots.ts` (semua titik rutinitas + kursi rapat + router gedung, murni origin + lokal), `sim.ts` (`WorldSim`: seluruh mesin keadaan, 12 penjadwal, rapat, antrean kopi, door mutex, 10 jenis errand), `wire.ts` (protokol & encoder), `events.ts` (event server → event dunia) |
| Server | `apps/server/src/world/world-director.ts`: `WorldSim` live 20 Hz, kirim 10 Hz, kanal `/ws/world` (publik baca-saja, maks 6 koneksi/IP & 200 total, payload klien ≤ 512 B, hanya `ping`, permessage-deflate) |
| Klien | `src/state/worldFeed.ts`: `NetWorldFeed` (interpolasi 200 ms di belakang jam server, sinkron jam ping NTP sederhana, reconnect) & `LocalWorldFeed` (demo / server mati). `IsometricOfficeStage.tsx` kini renderer murni (3.796 → ±2.050 baris) |

**Koreksi terhadap §3.6:**
1. **Yang dikirim adalah snapshot posisi ringkas, bukan keputusan path + startAt** (K11). Baris agen 11 angka (cm / milirad), hanya agen yang berubah, bubble sekali per `bubbleSeq`, props hanya saat berubah. Terukur: rata-rata rutinitas harian < 2 KB/dtk per penonton (tes 600 dtk), puncak 10 agen berjalan ke rapat < 4 KB/dtk JSON mentah sebelum deflate.
2. **Temuan:** *avoidance* antar-agen di panggung lama selalu tertimpa `position.set(wx, bob, wz)` di langkah yang sama, jadi tidak pernah berpengaruh. Tidak dipindahkan ke `WorldSim` (perilaku visual sama persis); `CLAUDE.md` dikoreksi.
3. Posisi dunia di `spots.ts` dicek terhadap scene graph setiap dev start: log `[office] F2: semua titik dunia @office/world cocok dengan scene graph.` (lobi, sofa, Commons, Garden, Workshop + presenter, Info Wall, Pods, Focus, Studio, Access, Server, 10 kursi rapat + pintu, 10 meja + titik tamu, antrean kopi, stool).
4. Publik (tanpa login) & tamu Google: ucapan `agent.say`, isi pesan kunjungan, dan topik rapat dari CEO diganti baris template / "Rapat tim" di server (K9); status agen tetap asli. CEO, viewer, dan karyawan menerima teks asli.
5. Mode publik di UI: `/api/state` tidak dipanggil; Inspector memakai status dari dunia (`onAgentStatuses`) dengan chip "Publik · dunia bersama".
6. Hook debug yang memulai rutinitas (`coffee`, `meeting`, `fastForward`, …) hanya bekerja di simulasi lokal; di mode live dunia dikendalikan sutradara. Hook baru: `feed()`, `worldState(atServerMs?)`, `serverNow()`, `clockOffset()`.

**Verifikasi:** `npm test` 86 lulus (dunia 8: determinisme seed, demo 640 dtk, rapat penuh 10 agen, antrean kopi + door mutex ≥ 0,75 dtk antar-lintasan, offline/online live, kabel round-trip + penyaringan publik, bandwidth rata-rata & puncak, event server; server +4 tes `/ws/world`: publik vs CEO posisi sama, teks rahasia tidak bocor, hanya ping, batas per IP + Origin asing). Playwright dua tab publik terhadap server `OFFICE_DRIVER=mock`: **selisih posisi 0 cm** pada jam server yang sama (8 sampel, termasuk agen berjalan), **selisih jam antar-tab 1 ms**, keadaan 10 agen identik. Simulasi lokal: `fastForward(640)` tanpa error, rapat lokal 10/10 duduk (`docs/img/f0/f2-local-meeting.png`).

**Belum:** hosting publik (Cloudflare DO / Tunnel / VPS) tetap keputusan terpisah; `WorldDirector` + `@office/world` sudah portabel. Penonton yang membuka halaman di tengah rapat langsung melihat rapat itu (hello membawa keadaan penuh) — diuji di tingkat kabel, belum dengan rapat asli dari `/rapat` di peramban.

### 10.3 F4 — Login Google & peran (18 November 2026)

| Bagian | Isi |
| :--- | :--- |
| `security/google-oidc.ts` | Authorization code + PKCE S256, `state` + `nonce`, tukar kode di server, verifikasi ID token RS256 dengan JWKS Google (cache sesuai `max-age`, unduh ulang kid baru maks 1×/menit), cek `iss`, `aud`/`azp`, `exp`/`iat` (toleransi 60 dtk), `nonce`, `email_verified`. Tanpa dependensi baru. |
| `users.ts` | Tabel `users` (id `u_…`, provider, sub, nama, email, peran `guest`/`employee`, blokir). |
| `security/auth.ts` | Peran `ceo | viewer | employee | guest`; cookie v2 `v2.<userId>.<exp>.<sig>` HttpOnly + SameSite=Strict; cookie state OAuth SameSite=Lax (Path `/api/auth/google`, 10 menit); `resolvePrincipal`, `canReadOffice`, `seesRealSpeech`. |
| Endpoint | `GET /api/auth/google`, `GET /api/auth/google/callback` (gagal → `/?login_error=<kode>`), `GET /api/me`, `GET /api/users` & `POST /api/users/update` (CEO). `/api/session` kini membawa `user` & `googleEnabled`. |
| UI | Tombol "Masuk" (overlay: Google + token + simulasi lokal), chip `Nama · Tamu/Karyawan`, panel **Pengguna** untuk CEO (naikkan/turunkan, blokir). |

**Koreksi terhadap §3.7:**
1. Cookie v2 **tidak menyimpan peran** (`v2.<peran>.<userId>…` di rencana). Peran & blokir dibaca dari DB setiap request, jadi turun pangkat / blokir langsung berlaku tanpa menunggu cookie kedaluwarsa.
2. Token viewer tetap membaca state penuh (K13), setara karyawan untuk data; perannya terhadap ruang khusus diputuskan di F6.
3. Tamu Google (`guest`) hanya `/api/me` + kanal dunia terfilter; `/api/state`, `/ws`, `/api/runs`, perintah = 403.

**Tes serangan (`google-oidc.test.ts`, `google-login.test.ts`):** state palsu, cookie OAuth hilang / tanda tangan dipalsukan, ID token dengan nonce sesi lain, `aud` lain, kedaluwarsa, `iss` palsu, email belum terverifikasi, tanda tangan kunci lain, `alg: none` / HS256, kid tak dikenal, payload diubah setelah ditandatangani, cookie v2 dengan userId ditukar / masa berlaku diperpanjang / akun tidak ada, tamu memanggil endpoint CEO, akun diblokir (sesi berjalan & login ulang), karyawan tetap tidak bisa memerintah, cookie v2 tidak pernah mendapat hak CEO.

**Menyalakan login Google (langkah CEO):**
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → tipe **Web application**.
2. *Authorized redirect URI*: `http://localhost:5174/api/auth/google/callback` (pengembangan; Google mengizinkan `http://localhost`). Untuk akses lain (Tailscale/domain) tambahkan URI `https://…/api/auth/google/callback` dan isi `GOOGLE_REDIRECT_URI`.
3. OAuth consent screen: nama aplikasi, email dukungan, scope `openid email profile`. Selama status *Testing*, hanya akun yang didaftarkan sebagai *test user* yang bisa masuk.
4. Isi `.env`: `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET=…` (secret hanya dibaca server). Restart server; log menampilkan `Login Google aktif`.

### 10.4 Hosting publik — Tailscale Funnel (18 November 2026, K14)

- **Pilihan:** Funnel menang atas Cloudflare Tunnel (butuh domain berbayar untuk URL tetap; Quick Tunnel ber-URL acak merusak login Google), Durable Object (kode Worker baru + sutradara 20 Hz memakan ±10.800 dari ±13.000 GB-s gratis per hari), dan VPS (berbayar). Konsekuensi: PC harus menyala (agen AI memang butuh PC); bandwidth Funnel dibatasi tanpa angka resmi.
- **Kode:** `apps/server/src/static-ui.ts` (UI hasil build dari port 7420, CSP ketat, gzip, cache), `setTrustProxy` / `requestHost` di `http-util.ts` (`X-Forwarded-*` hanya dari loopback), beberapa `GOOGLE_REDIRECT_URI` dipilih per host, `start-public.bat`, `stop.bat` menutup Funnel.
- **Temuan saat uji:** CSP awal `connect-src 'self'` memblokir tekstur GLB (GLTFLoader memuat tekstur lewat `fetch(blob:)`) → `connect-src 'self' blob: data:`. Setelah itu: 54 GLB, 0 error konsol, kanal dunia LIVE di `http://localhost:7420/`.
- **Google OAuth Anda:** kredensial valid; `http://localhost:5174/api/auth/google/callback` sudah terdaftar (Google menampilkan halaman masuk). `http://localhost:7420/...` belum terdaftar (`redirect_uri_mismatch`) — tambahkan bersama URL `.ts.net`.
- **Belum diuji:** perilaku header Funnel (Host asli vs `X-Forwarded-*`) karena Tailscale belum terpasang di PC ini.

