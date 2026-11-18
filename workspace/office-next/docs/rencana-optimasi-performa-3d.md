# Rencana Teknis Optimasi Performa 3D (`office-next`)
> **Status:** Disepakati melalui sesi `/grill-me` (18 November 2026) — Siap Eksekusi Bertahap  
> **Lingkup:** `workspace/office-next` (Panggung Three.js 0.187, HUD `App.tsx`, & Pipeline Aset `public/models/*.glb`)  
> **Target Perangkat:** PC Desktop, Laptop Tipis / iGPU, dan Smartphone (Demo Statis Cloudflare Pages & Mode Live via Tailscale)

---

## 1. Ringkasan Masalah & Baseline Terukur

Berdasarkan audit kode sumber `workspace/office-next/src/` dan pemindaian biner terhadap **47 file `.glb`** di `public/models/`, penyebab utama halaman terasa sangat berat saat pertama dibuka (*startup freeze* 1,5–4+ detik) sekaligus memicu panas GPU/CPU berkelanjutan saat berjalan adalah **5 bottleneck yang terjadi serentak pada `t = 0` (`useEffect` mount)**:

| Metrik Baseline (Sebelum Optimasi) | Angka Terukur Aktual | Akar Masalah di Kode / Aset |
|---|---|---|
| **Unduhan GLB Saat Buka Halaman** | **46 file GLB = 27,32 MB** (serentak di `t = 0`) | Seluruh 14 ruangan langsung memanggil `load('/models/...')` pada saat mount, termasuk 6 ruangan timur/utara yang berada di luar bingkai kamera awal (`homeBox`). |
| **GLB Belum Terkompresi** | **29 dari 46 file (17,69 MB)** tanpa `Meshopt` | Aset Tahap 2–5 diekspor mentah dari generator HTML tanpa `@gltf-transform` (contoh: `Office_Commons_Collab_Table.glb` **3,2 MB** dengan 2,9 MB PNG mentah; `Office_Garden_Living_Wall.glb` **2,3 MB** dengan 61.080 verteks mentah). |
| **Lampu Real-Time di Shader PBR** | **35 lampu aktif** (`32 PointLight` + `2 DirectionalLight` + `1 HemisphereLight` + PMREM IBL) | Di WebGL Forward Rendering, setiap piksel `MeshStandardMaterial` di seluruh gedung menghitung loop ke-32 `PointLight` sekaligus dan memicu kompilasi ulang shader HLSL/GLSL raksasa di Windows (ANGLE/D3D11). |
| **Draw Calls per Frame** | **~3.000 mesh × 2 pass = ~5.000–6.000 draw calls/frame** | Sub-mesh GLB belum digabung (`Office_Bookshelf_Cabinet.glb` = 193 mesh & 50 material × 2 = 386 draw calls; `Office_Ergonomic_Chair.glb` = 18 mesh × 24 kursi = 432 draw calls) dan `enableShadow()` menyalakan `castShadow = true` pada setiap sub-mesh kecil ke *shadow map* `2048×2048` setiap frame. |
| **Beban Sinkron Main Thread & DOM** | **37 `<canvas>` 2D sinkron** + `rebuildDesks()` **3×** + `querySelector` tiap frame | Pembuatan tekstur piksel `256×256` s.d. `1536×584` berjalan sinkron sebelum frame pertama; meja dibangun ulang 3 kali tanpa `dispose` placeholder; speech bubble memakai `querySelector` + `left/top` + `backdrop-filter: blur(10px)` di atas kanvas WebGL. |

---

## 2. Keputusan Arsitektur yang Dikunci (`/grill-me`)

1. **Sakelar HUD `Grafis: Hemat / Tinggi` (`localStorage: 'office.graphicsQuality'`):**
   - **Default awal saat pertama kali dibuka:** **`Hemat` (`'low'`)** di semua perangkat agar pembukaan pertama selalu instan dan dingin; pilihan pengguna disimpan di `localStorage`.
   - **Spesifikasi Mode `Hemat` (`low`):**
     - `0 PointLight` di seluruh scene.
     - `renderer.shadowMap.enabled = false` (tanpa *shadow map* matahari *real-time*), digantikan **Fake Contact Shadow** ringan (`PlaneGeometry` transparan bergradasi radial `MeshBasicMaterial`, `depthWrite: false`) di bawah avatar, kursi, dan meja.
     - `renderer.setPixelRatio(1.0)`.
     - **Adaptive FPS:** berjalan mulus **60 FPS** selama kamera digerakkan (pan/zoom/orbit/WASD Free Cam/animasi `focusRoom`) hingga `1,5 detik` setelah interaksi berhenti, lalu otomatis turun ke **30 FPS** saat kamera diam menonton simulasi.
   - **Spesifikasi Mode `Tinggi` (`high`):**
     - **Camera-Following Light Pool** maksimal **3 `PointLight`** hangat *reusable* yang berpindah mengikuti ruangan fokus kamera.
     - `renderer.shadowMap.enabled = true` (`PCFSoftShadowMap` resolusi **`1024×1024`**, frustum bayangan mengikuti area pandang kamera, dan `castShadow` dibatasi hanya untuk objek bersiluet besar).
     - `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))`.
     - **60 FPS penuh** selama tab aktif.

2. **Penghapusan Ledakan `PointLight` & Kompilasi Shader Async:**
   - Hapus permanen ke-10 `PointLight` `screenGlow` di meja agen (`IsometricOfficeStage.tsx`) serta 2 `PointLight` LED rak server (`serverRoom.ts`); ganti dengan bidang *fake glow decal* di permukaan meja/lantai + `emissiveIntensity` pada material layar/LED (**biaya shader = 0 lampu**).
   - Seluruh lampu ruangan di modul `src/stage/rooms/*.ts` diubah dari `new THREE.PointLight(...)` menjadi metadata **`RoomLightAnchor`** (`{ pos, color, intensity, distance, decay }`). Hanya manajer *Light Pool* di `IsometricOfficeStage.tsx` yang memegang objek `THREE.PointLight` (0 di `Hemat`, tepat 3 di `Tinggi`) sehingga jumlah lampu di shader tidak pernah membengkak.
   - Jalankan `await renderer.compileAsync(scene, cam.active())` untuk memanaskan shader di *background thread* GPU (`KHR_parallel_shader_compile`) tanpa mengunci UI.

3. **Two-Wave Progressive Loading (Klaster Kamera Utama → Latar Belakang Saat Idle):**
   - **Gelombang 1 (Prioritas Utama — Tampil Cepat):** Muat GLB untuk klaster yang masuk bingkai kamera awal (`MainWorkspace`, `Boardroom`, `MeetingFoyer`, `Corridor_MainBus`, `ManagerOffice`, `LobbyReception`, `PantryCafe`, `LoungeRelax`) dengan batas antrean maksimal **4 unduhan paralel**. Tunggu `desk.glb` dan `Office_Ergonomic_Chair.glb` selesai bersama (`Promise.all`) agar `rebuildDesks()` hanya dipanggil **1 kali** (bukan 3 kali).
   - **Gelombang 2 (Otomatis Saat Idle + Prioritas Fokus):** Enam ruangan di luar bingkai awal (`Server`, `CollabCommons`, `DigitalGarden`, `WorkshopTraining`, `InfoWall`, `CollabPods` — serta 3 ruangan Tahap 6 nantinya: `StudioContent`, `FocusPods`, `AccessHub`) tetap merakit cangkang dinding & *placeholder* ringan untuk navigasi agen, tetapi pembuatan tekstur `<canvas>` detail dan pengunduhan GLB-nya dicicil saat browser *idle* (`requestIdleCallback`, konkurensi **1–2 file**). Jika pengguna memilih ruangan lewat dropdown `"Fokus: ruangan…"` atau menggeser kamera mendekati ruangan tersebut, antrean GLB ruangan itu langsung dipromosikan ke prioritas tertinggi.

4. **Pipeline Aset Murni Node.js (`npm run optimize:models`):**
   - Memakai `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `meshoptimizer`, dan `sharp` (100% Node.js tanpa ketergantungan binary eksternal `KTX-Software`).
   - Menjalankan `dedup` → `prune` → `palette` → `flatten` & `join` (dengan daftar pelindung nama *node* kontrak) → kompresi geometri `EXT_meshopt_compression` + `KHR_mesh_quantization` → kompresi tekstur `EXT_texture_webp` (maksimal `1024×1024`).
   - Menimpa *in-place* `public/models/*.glb` secara **idempoten** (aman dijalankan ulang kapan saja, termasuk setiap selesai mengekspor GLB baru di Tahap 6).

5. **Batasan Wajib (Invariants & Out of Scope):**
   - Seluruh 14 ruangan Lantai 1 (dan kompatibilitas Tahap 6), mesin status 10 agen, antrean kopi, rapat ruang rapat, mode *live* & *demo*, *Wall Auto-Fade*, serta teks Bahasa Indonesia wajib 100% tetap berjalan tanpa perubahan perilaku fungsional.
   - Tidak menggunakan kompresi tekstur KTX2/BasisU eksternal.

---

## 3. Kontrak Nama Node GLB yang Wajib Dilindungi (`PROTECTED_NODES`)

Saat skrip `optimize:models` menggabungkan mesh (`flatten` + `join`), daftar *node/mesh* berikut **dilarang keras digabung ke induknya atau diubah namanya** karena diakses langsung oleh kode runtime:

| File GLB | Nama Node / Pola Regex Kontrak | Pemakai di Kode |
|---|---|---|
| `office_room_shell.glb` | `Back_Wall`, `Back_Wall_Inset`, `Back_Baseboard`, `Back_Top_Cap`, `Transom_Window`, `Ceiling_Light_Strip`, `Left_Wall`, `Left_Wall_Inset`, `Left_Baseboard`, `Left_Top_Cap`, `Left_Wall_Accent`, `Partition_Left_Glass`, `Floor_Slab`, `/^(Timber_\|Front_Cutaway_Threshold$\|Partition_Bolt_\|Sliding_Door_Handle$)/` | `mainWorkspace.ts` (`WallFader`, penutup kaca timur, & penyembunyian bagian lama) |
| `Office_Boardroom_Shell.glb` | `North_Wall`, `West_Wall_Acoustic`, `WW_Baseboard_Pier`, `Floor_Carpet_AcousticCharcoal`, `/^(Doorway_Portal\|Curb_South\|Curb_Corner_Cap_SE)/` | `boardroom.ts` (`WallFader`, material karpet lantai seragam, & penutup pintu barat) |
| `Office_Conference_Chair.glb` | `Chair_Base`, `Chair_Swivel` | `boardroom.ts` (animasi putar kursi menghadap TV saat sesi rapat) |
| `Office_Presentation_Display_85.glb` | `Screen_ActiveArea_4K` (serta mesh cocok `/screen/i`) | `boardroom.ts`, `managerOffice.ts`, `serverRoom.ts`, `workshopTraining.ts` (`fitOverlay`) |
| `Office_Lobby_Directory_Kiosk.glb` | `Kiosk_Screen` (serta mesh cocok `/screen/i`) | `lobbyReception.ts` (pengepasan kanvas direktori Lobi 15 ruangan) |
| `Office_InfoWall_Command_Display.glb` | `InfoWall_Main_Screen`, `Command_Screen_Active` | `infoWall.ts` (`fitOverlay` kanvas komando 3 kolom) |
| `Office_Collab_Diner_Pod.glb` | `Pod_Occupancy_LED` | `collabPods.ts` (indikator lampu okupansi hijau/kuning) |
| `Office_Focus_Solo_Pod.glb` | `Focus_Status_LED` | `focusPods.ts` (indikator lampu *Deep Focus* hijau/merah koral) |
| `Office_Access_Floor_Map_Totem.glb` | `Access_Map_Screen` | `accessHub.ts` (pengepasan matriks kanvas miring peta 16 zona Lantai 1) |

---

## 4. Peta Ketergantungan (Dependency Graph)

```text
Task 1: Hook Telemetri & Baseline (__officeStageDebug.perf)
   │
   ├──► Task 2: Tipe GraphicsQuality + Sakelar HUD "Grafis: Hemat / Tinggi" + Adaptive FPS & DPR
   │       │
   │       ├──► Task 3: Reformasi Pencahayaan (Hapus 32 PointLight → Fake Glow + 3-Light Pool) & Contact Shadow
   │       │
   │       └──► Task 6: Seleksi castShadow Berbasis Ukuran & Frustum Bayangan Kamera (Mode Tinggi)
   │
   ├──► Task 4: Skrip Node `npm run optimize:models` & Kompresi/Join 47 GLB di `public/models/`
   │
   ├──► Task 5: Two-Wave Progressive Loader + Single `rebuildDesks` + `renderer.compileAsync()`
   │
   └──► Task 7: Optimasi Render Loop, Dedup Material `WallFader`, Cache DOM Speech Bubble, & Culling Kanvas
           │
           └──► Task 8: Instancing / Shared Geometry Aset Berulang & Verifikasi Akhir End-to-End
```

---

## 5. Rincian Tugas Implementasi (Task Breakdown)

### Fase 1 — Pondasi Pengukuran, Mode Grafis, & Pencahayaan (P0)

#### Task 1: Hook Telemetri Performa Terukur (`__officeStageDebug.perf`)
**Deskripsi:** Menambahkan pembacaan metrik nyata (`drawCalls`, `triangles`, `geometries`, `textures`, `programs` shader WebGL, jumlah lampu aktif, progres unduhan GLB, serta rata-rata FPS / frame time ms) pada `__officeStageDebug.perf()` di mode dev supaya setiap perubahan sesudahnya punya angka *before vs after* yang objektif.

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] `window.__officeStageDebug.perf()` mengembalikan objek ringkas berisi `fps`, `frameMs`, `calls`, `triangles`, `geometries`, `textures`, `programs`, `lights`, dan `loadedGlbs`.
- [ ] Angka *baseline* awal dicatat ke tabel log verifikasi sebelum optimasi lain dijalankan.

**Verifikasi:**
- [ ] Typecheck lulus: `npm run typecheck`
- [ ] Cek manual di DevTools Console pada `npm run dev:next`: panggil `__officeStageDebug.perf()`.

**Ketergantungan:** Tidak ada  
**File yang disentuh:**
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`

**Estimasi cakupan:** XS (1 file)

---

#### Task 2: Sakelar HUD `Grafis: Hemat / Tinggi`, Penyimpanan `localStorage`, & Loop Adaptive FPS
**Deskripsi:** Menambahkan state `GraphicsQuality` (`'low' | 'high'`, default `'low'`, disimpan ke `localStorage` dengan kunci `'office.graphicsQuality'`) beserta tombol sakelar **`Grafis: Hemat` / `Grafis: Tinggi`** di bilah header `App.tsx`, lalu menghubungkannya ke `IsometricOfficeStage.tsx` untuk mengatur `pixelRatio` (`1.0` vs `<= 1.5`), pause otomatis saat `document.hidden`, dan *Adaptive FPS* (`60 FPS` saat kamera aktif bergerak + `1,5 dtk` sesudahnya, `30 FPS` saat kamera diam di mode `Hemat`).

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Saat halaman dibuka pertama kali tanpa `localStorage`, tombol menampilkan **`Grafis: Hemat`** (`pixelRatio = 1.0`, idle `30 FPS`, gerak kamera `60 FPS`).
- [ ] Klik tombol mengubah mode secara langsung tanpa me-mount ulang scene atau mereset posisi agen, dan pilihan bertahan setelah halaman di-refresh.
- [ ] Saat tab browser tidak aktif (`visibilitychange`), *render loop* berhenti sementara dan `dt` tetap aman (terkunci `<= 0.1 s`) saat kembali aktif.

**Verifikasi:**
- [ ] Typecheck lulus: `npm run typecheck`
- [ ] Build demo lulus: `npm run build:next:demo`
- [ ] Cek manual: klik sakelar `Grafis: Hemat ↔ Tinggi`, geser kamera (60 FPS), lepaskan 2 detik (turun ke 30 FPS di mode Hemat).

**Ketergantungan:** Task 1  
**File yang disentuh:**
- `workspace/office-next/src/App.tsx`
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`
- `workspace/office-next/src/stage/camera/cameraRig.ts`

**Estimasi cakupan:** S (3 file)

---

#### Task 3: Reformasi 32 `PointLight` ke Emissive + Fake Glow Decal & 3-Light Camera Pool + Contact Shadow
**Deskripsi:** Menghapus ke-10 `PointLight` `screenGlow` meja agen, 4 `zoneLight`, dan 18 `PointLight` statis di modul ruangan. Mengganti pancaran layar monitor & LED rak dengan *fake glow decal* (`MeshBasicMaterial` transparan bergradasi radial, `depthWrite: false`), menambahkan *fake contact shadow* lembut di bawah avatar & kursi/meja untuk mode `Hemat`, serta membangun manajer **Light Pool (maks 3 `PointLight`)** yang hanya aktif di mode `Tinggi` mengikuti ruangan terdekat fokus kamera.

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Jumlah objek `THREE.PointLight` aktif di scene adalah **0** pada mode `Hemat` dan **maksimal 3** pada mode `Tinggi` (terverifikasi lewat `__officeStageDebug.perf().lights`).
- [ ] Meja agen tetap memancarkan pendar warna status (`idle`, `working`, `waiting_approval`, `error`, `offline`) melalui *screen emissive* + *fake desk glow decal*.
- [ ] Pada mode `Hemat` (`shadowMap.enabled = false`), avatar dan kursi tetap tampak menapak lantai berkat *contact shadow* ringan (tidak terlihat melayang).

**Verifikasi:**
- [ ] Typecheck & tes lulus: `npm run typecheck && npm test`
- [ ] Cek metrik `__officeStageDebug.perf()`: `lights` turun dari `35` menjadi `3` (`Hemi + 2 Dir`) di mode `Hemat` dan `6` (`Hemi + 2 Dir + 3 Point`) di mode `Tinggi`.

**Ketergantungan:** Task 2  
**File yang disentuh:**
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`
- `workspace/office-next/src/stage/rooms/assets.ts`
- `workspace/office-next/src/stage/rooms/*.ts` (penggantian `new THREE.PointLight` ke data anchor lampu ruangan)

**Estimasi cakupan:** M (modul panggung + helper lampu ruangan)

---

### Checkpoint Fase 1 (Setelah Task 1–3)
- [ ] `npm run typecheck` dan `npm test` hijau tanpa error.
- [ ] *Freeze* kompilasi shader akibat 32 `PointLight` hilang; mode default `Grafis: Hemat` berjalan dingin dengan `0 PointLight` dan *Adaptive FPS*.
- [ ] Catat selisih FPS & jumlah program shader sebelum lanjut ke Fase 2.

---

### Fase 2 — Kompresi 47 GLB & Progressive Room Loading (P1 & P2)

#### Task 4: Skrip Node.js `npm run optimize:models` (`@gltf-transform` Meshopt + WebP + Join Aman Kontrak)
**Deskripsi:** Membuat skrip idempoten `scripts/optimize-models.mjs` untuk memproses seluruh file `.glb` di `workspace/office-next/public/models/`: deduplikasi material/tekstur, penggabungan sub-mesh statis se-material (`palette` + `flatten` + `join`) sambil mengunci seluruh node di tabel `PROTECTED_NODES` (§3), kuantisasi & kompresi geometri `Meshopt`, serta konversi tekstur PNG/JPEG menjadi `WebP` (maks `1024×1024`).

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Seluruh 47 file `.glb` di `public/models/` memiliki ekstensi `EXT_meshopt_compression` dan tekstur terkompresi (`WebP <= 1024px`).
- [ ] Total ukuran direktori `public/models/` turun dari **28,02 MB** menjadi **<= 7 MB**, dan jumlah mesh `Office_Bookshelf_Cabinet.glb` (193 mesh) serta `Office_Commons_Collab_Table.glb` (83 mesh) menyusut drastis.
- [ ] Seluruh kontrak node di §3 (`Chair_Swivel`, dinding *auto-fade*, karpet ruang rapat, layar aktif TV/NOC/InfoWall, LED pod) terverifikasi tetap utuh oleh pemeriksaan otomatis di akhir skrip.

**Verifikasi:**
- [ ] Jalankan `npm run optimize:models` dua kali berturut-turut untuk memastikan sifat idempoten dan pemeriksaan kontrak node lulus 100%.
- [ ] Cek visual & fungsional rapat (`/rapat` → kursi berputar menghadap TV, layar agenda tampil pas) dan *Wall Auto-Fade* di browser.

**Ketergantungan:** Task 1 (dapat dikerjakan paralel dengan Task 2–3)  
**File yang disentuh:**
- `package.json` (devDependencies `@gltf-transform/*`, `sharp`, `meshoptimizer` & skrip `optimize:models`)
- `scripts/optimize-models.mjs`
- `workspace/office-next/public/models/*.glb`

**Estimasi cakupan:** M (2 file kode + regenerasi biner GLB)

---

#### Task 5: Two-Wave Progressive Loader, Single `rebuildDesks`, & `renderer.compileAsync()`
**Deskripsi:** Memecah antrean `ModelLoader` menjadi 2 gelombang berbatas konkurensi: **Gelombang 1** (maks 4 paralel) memuat aset klaster kamera awal + menggabungkan pemuatan `desk.glb` & `Office_Ergonomic_Chair.glb` sehingga `rebuildDesks()` dieksekusi **1 kali** dengan pembersihan memori placeholder yang rapi + memanggil `renderer.compileAsync(scene, cam.active())`. **Gelombang 2** mencicil pembuatan tekstur `<canvas>` prosedural & unduhan GLB 6 ruangan luar layar (`Server`, `Commons`, `Garden`, `Workshop`, `InfoWall`, `CollabPods`) saat *idle* (1–2 paralel), dengan promosi prioritas instan saat `focusRoom(room)` dipanggil.

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Pada detik pertama buka tab, Network panel hanya mengunduh GLB Gelombang 1 (klaster kamera utama); Gelombang 2 baru menyusul setelah panggung utama siap dan ter-render mulus.
- [ ] Memilih ruangan Timur/Utara dari dropdown `"Fokus: ruangan…"` saat Gelombang 2 belum selesai langsung memindahkan GLB ruangan tersebut ke urutan pertama antrean.
- [ ] `rebuildDesks()` tidak lagi bocor geometri/material sementara dan hanya membangun ulang meja kerja 1 kali saat aset siap.

**Verifikasi:**
- [ ] Typecheck & build demo lulus: `npm run typecheck && npm run build:next:demo`
- [ ] Cek Network Waterfall di DevTools (throttling Fast 4G): waktu tampil interaktif klaster utama < 1,5 detik tanpa *frame drop* panjang.

**Ketergantungan:** Task 2, Task 4  
**File yang disentuh:**
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`
- `workspace/office-next/src/stage/rooms/assets.ts`

**Estimasi cakupan:** M (2 file)

---

### Checkpoint Fase 2 (Setelah Task 4–5)
- [ ] Ukuran unduh awal Gelombang 1 berada di kisaran **±2,5–4 MB** (turun dari 27,32 MB).
- [ ] Tidak ada *freeze* panjang saat pertama kali membuka tab maupun saat 6 ruangan luar layar selesai dimuat di latar belakang.

---

### Fase 3 — Optimasi Bayangan Mode Tinggi, Render Loop, DOM, & Instancing (P3 & P4)

#### Task 6: Seleksi `castShadow` Berbasis Ukuran & Frustum Bayangan Mengikuti Kamera (Mode `Tinggi`)
**Deskripsi:** Memperbarui `enableShadow()` di `assets.ts` agar hanya menyalakan `castShadow = true` pada mesh yang bounding sphere radiusnya `>= 0.12 m` (mengabaikan detail mikro seperti buku kecil, cangkir, gagang pintu, baut), menurunkan `sun.shadow.mapSize` dari `2048` ke `1024`, serta menyempitkan frustum `sun.shadow.camera` mengikuti jangkauan pandang kamera aktif (bukan seluruh bentang gedung 38 m sekaligus).

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Di mode `Grafis: Tinggi`, bayangan meja, kursi, kabinet, dinding, dan avatar tampil lebih tajam pada resolusi `1024×1024` karena frustum bayangan terfokus pada area pandang kamera.
- [ ] Jumlah *triangles* yang diproses pada *shadow pass* berkurang signifikan dibanding baseline.

**Verifikasi:**
- [ ] Typecheck lulus: `npm run typecheck`
- [ ] Cek manual di mode `Grafis: Tinggi` pada kamera Isometrik maupun Free Cam 3D (orbit & geser ke ujung timur gedung, bayangan tetap utuh tanpa terpotong di layar).

**Ketergantungan:** Task 3  
**File yang disentuh:**
- `workspace/office-next/src/stage/rooms/assets.ts`
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`

**Estimasi cakupan:** S (2 file)

---

#### Task 7: Cache DOM Speech Bubble (`translate3d`), Dedup Material `WallFader`, & Frustum Culling Kanvas
**Deskripsi:** Menghilangkan seluruh pemanggilan `querySelector` dan `left/top` di loop `renderFrame` dengan menyimpan referensi elemen bubble di `Map`, menggerakkan posisi memakai `transform: translate3d(...)` tanpa `backdrop-filter: blur()`, hanya menulis `textContent` saat kalimat berubah, mengganti kloning material per-mesh di `wallFade.ts` menjadi per-material-unik per dinding, serta melewati penggambaran ulang kanvas dinamis (`codeTexture`, `NocScreen`, `InfoWallScreen`, `WorkshopScreen`, animasi air fountain) apabila ruangannya sedang di luar *camera frustum*.

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Nol pemanggilan `querySelector` di dalam `renderFrame` dan nol properti `left`/`top`/`backdropFilter` pada elemen speech bubble agen.
- [ ] `WallFader.collect()` mengklon maksimal 1 material untuk setiap material sumber yang sama di dalam satu entri dinding.
- [ ] Kanvas `NocScreen` dan `InfoWallScreen` tidak memanggil `ctx.fillRect` / `tex.needsUpdate = true` saat ruangan tersebut tidak terlihat oleh kamera aktif.

**Verifikasi:**
- [ ] Typecheck lulus: `npm run typecheck`
- [ ] Cek Performance trace DevTools: waktu *Recalculate Style / Layout* per frame mendekati 0 ms saat beberapa speech bubble tampil bersamaan.

**Ketergantungan:** Task 2  
**File yang disentuh:**
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`
- `workspace/office-next/src/stage/camera/wallFade.ts`
- `workspace/office-next/src/stage/rooms/serverRoom.ts`
- `workspace/office-next/src/stage/rooms/digitalGarden.ts`

**Estimasi cakupan:** M (4 file)

---

#### Task 8: Sharing Geometri/Material Avatar & Perabot Berulang + Audit Akhir
**Deskripsi:** Membagikan satu set `BufferGeometry` & `Material` statis bersama untuk bagian tubuh/kaki/tangan/cangkir/dokumen/keyboard/mouse/monitor ke-10 agen (tidak membuat puluhan `CylinderGeometry`/`SphereGeometry`/`BoxGeometry` baru per agen), menggabungkan batu pijakan `DigitalGarden` & baki kabel `ServerRoom` per material, lalu melakukan pengukuran akhir dan merapikan tabel hasil *Baseline vs Final* di dokumen ini.

**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Total `geometries` dan `calls` (draw calls) di `__officeStageDebug.perf()` mencapai target **< 400–600 draw calls/frame** (turun dari ~5.000–6.000).
- [ ] Seluruh pengujian monorepo (`npm run typecheck`, `npm test`, `npm run build:next`, `npm run build:next:demo`) lulus 100%.
- [ ] Semua skenario simulasi (`__officeStageDebug.meeting()`, `coffee()`, `commons()`, `workshop()`, `infowall()`, `pod()`, mode Isometrik & Free Cam jalan kaki) terverifikasi bebas regresi.

**Verifikasi:**
- [ ] `npm run typecheck && npm test && npm run build:next:demo`
- [ ] Bandingkan dan dokumentasikan tabel metrik `__officeStageDebug.perf()` sebelum vs sesudah di bagian §7 dokumen ini.

**Ketergantungan:** Task 4, Task 5, Task 6, Task 7  
**File yang disentuh:**
- `workspace/office-next/src/stage/IsometricOfficeStage.tsx`
- `workspace/office-next/src/stage/rooms/digitalGarden.ts`
- `workspace/office-next/src/stage/rooms/serverRoom.ts`
- `workspace/office-next/docs/rencana-optimasi-performa-3d.md`

**Estimasi cakupan:** M (4 file)

---

## 6. Peluang Paralelisasi & Mitigasi Risiko

### A. Matriks Paralelisasi
- **Aman dikerjakan paralel:** **Task 4** (skrip Node `optimize:models` & pemrosesan `public/models/*.glb`) tidak menyentuh kode runtime React/Three.js sehingga dapat dijalankan paralel bersamaan dengan **Task 2 & Task 3**.
- **Wajib berurutan:** `Task 1 → Task 2 → Task 3 → Task 6`, serta `Task 4 → Task 5 → Task 8` (karena keduanya menyentuh `IsometricOfficeStage.tsx`).

### B. Tabel Risiko & Mitigasi

| Risiko | Dampak | Strategi Mitigasi |
|---|---|---|
| Penggabungan mesh (`join`) di `gltf-transform` menyatukan bagian kursinya `Office_Conference_Chair.glb` atau menghilangkan nama mesh layar TV | Tinggi | Kunci semua nama node pada tabel `PROTECTED_NODES` (§3) agar dilewati tahap `flatten/join`, dan sertakan *assertion* otomatis di akhir `scripts/optimize-models.mjs` yang menggagalkan skrip bila ada satu pun nama kontrak yang hilang. |
| Perpindahan 3 lampu di *Camera-Following Light Pool* (mode `Tinggi`) terlihat berkedip (*popping*) saat kamera digeser cepat | Sedang | Interpolasikan posisi dan warna ke-3 `PointLight` secara halus (`lerp` berbasis `dt`), bukan lompat instan antar-koordinat ruangan. |
| Antivirus Windows mengunci file sementara `esbuild` saat verifikasi `npm run build:next:demo` | Rendah | Gunakan prosedur baku proyek di `CLAUDE.md` §4 (`$env:TEMP = "$PWD\.esbuild-tmp"`). |
| Aset baru Tahap 6 (`Studio`, `FocusPods`, `AccessHub`) diekspor kembali dalam kondisi mentah (belum terkompresi) | Sedang | Jadikan `npm run optimize:models` idempoten dan tambahkan ke daftar periksa penyelesaian Tahap 6 sehingga GLB baru otomatis terkompresi dengan aturan yang sama. |

---

## 7. Ledger Verifikasi (Diisi Saat Eksekusi)

| Tahap / Eksperimen | Draw Calls (`calls`) | Segitiga (`triangles`) | Lampu Aktif (`lights`) | Unduhan GLB Awal (MB) | FPS Laptop / iGPU | Keputusan (`Keep` / `Revert`) |
|---|---|---|---|---|---|---|
| **Baseline Awal (Sebelum Optimasi)** | *diukur di Task 1* | *diukur di Task 1* | 35 (32 `PointLight`) | 27,32 MB (46 GLB) | *diukur di Task 1* | — |
| **Sesudah Fase 1 (Task 1–3: Hemat/Tinggi + Light Pool)** | — | — | — | — | — | — |
| **Sesudah Fase 2 (Task 4–5: GLB Optimize + Progressive)** | — | — | — | — | — | — |
| **Sesudah Fase 3 (Task 6–8: Shadow + DOM + Instancing)** | — | — | — | — | — | — |
