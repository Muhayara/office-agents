# Rencana Kepadatan & Realisme Interior Kantor 3D (Office Density Plan)
> Disusun oleh: **Gita — Game Dev 2.5D** & **Tari — Desainer UI/UX**  
> Status: **Siap Eksekusi (Ready for 3D Generation)**

---

## 1. Analisis Kepadatan & Penataan Interior (Diorama 14×10m)

Agar ruangan kantor 3D terasa lebih hidup, padat, dan representatif layaknya markas startup / tech agency modern, berikut adalah pemetaan zona dan furnitur tambahan yang akan ditempatkan:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AC Dinding 1]         [Papan Tulis Scrum / Whiteboard]     [AC Dinding 2]  │
│ [Rak Buku Industrial]   (Raka - Manajer)      (Fajar - QA)   [Lemari Arsip] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│   │ Sari (Riset) │     │ Dimas (Tulis)│     │ Bima (Code)  │                │
│   ├──────────────┤     ├──────────────┤     ├──────────────┤                │
│   │ Tari (UI/UX) │     │ Wulan(Artis) │     │ Satria(Sec)  │                │
│   └──────────────┘     └──────────────┘     └──────────────┘                │
│     [Pod Barat: Riset & Kreatif]              [Pod Timur: Tech & Sec]       │
│                                                                             │
│ ═════════════════════ LORONG UTAMA (AISLE 2.5m) ═══════════════════════════ │
│                                                                             │
│  [Coffee Bar & Barista]                        [Meja Diskusi Bundar]        │
│  [Tempat Sampah Metalik]                       [4 Kursi Rapat Santai]       │
│  [Dispenser Galon Bawah]                       [Server Rack 42U Data Center]│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Daftar Aset 3D Tambahan & Spesifikasi Teknis

| No | Nama Aset | File Output | Dimensi (P × L × T) | Target Posisi (X, Y, Z) | Fungsi & Visual |
|---|---|---|---|---|---|
| 1 | **Unit AC Dinding Inverter** | `Office_Wall_AC_Unit.glb` | 0.85 × 0.22 × 0.30 m | `X: -1.5, Y: 2.8, Z: -4.85` & `X: 4.5, Y: 2.8, Z: -4.85` | Menempel di dinding atas, bodi putih glossy, flap kisi udara tipis, lampu indikator LED hijau halus. |
| 2 | **Rak Buku & File Industrial** | `Office_Bookshelf_Cabinet.glb` | 1.20 × 0.40 × 1.85 m | `X: -6.4, Y: 0, Z: -3.5` | Rangka besi hitam matte, 4 tingkat ambalan kayu oak hangat, diisi buku-buku teknis berwarna, binder dokumen, dan tanaman sukulen kecil di pot keramik. |
| 3 | **Papan Tulis Kaca / Scrum Board** | `Office_Whiteboard_Scrum.glb` | 1.60 × 0.45 × 1.80 m | `X: 0.0, Y: 0, Z: -4.75` | Whiteboard kaca beroda (mobile caster), partisi magnetik, sticky notes warna-warni (kuning, toska, pink), spidol dan penghapus di tatakan bawah. |
| 4 | **Dispenser Air Galon Bawah** | `Office_Water_Dispenser.glb` | 0.35 × 0.38 × 1.05 m | `X: -5.5, Y: 0, Z: 4.1` | Dispenser ramping modern hitam-silver, 3 tombol kran (Panas, Normal, Dingin), baki tetesan air metalik, lampu status LED biru/merah. |
| 5 | **Meja Rapat Bundar & 4 Kursi** | `Office_Meeting_Table_Round.glb` | 1.40 × 1.40 × 0.75 m | `X: 0.2, Y: 0, Z: 2.2` | Meja bundar kayu walnut kaki silang logam hitam, dikelilingi 4 kursi konferensi modern kain abu-abu untuk area diskusi cepat tim. |

---

## 3. Koleksi Prompt Pembuatan 3D (Siap Di-copy ke Claude Sonnet 3.5)

> **Catatan Penggunaan:**  
> Buka chat baru di Claude Sonnet 3.5 (High Effort / Upaya Tinggi). Copy-paste salah satu prompt di bawah. Claude akan membuatkan satu file HTML lengkap yang bisa langsung dibuka di browser desktop untuk di-review dan di-export menjadi file `.glb` via tombol "Export GLB".

---

### PROMPT 1: Unit AC Dinding Inverter (`Office_Wall_AC_Unit.glb`)

```markdown
Buatkan kode HTML tunggal (single-file HTML) lengkap yang memuat Three.js r128 dari CDN dan GLTFExporter untuk menghasilkan 3D Model GLB berkualitas PBR tinggi: "Office_Wall_AC_Unit" (Unit AC Dinding Kantor Modern Inverter).

PERSYARATAN TEKNIS & GEOMETRI:
1. Skala & Dimensi Realistis:
   - Lebar: 0.85 m (sumbu X)
   - Tebal/Kedalaman: 0.22 m (sumbu Z)
   - Tinggi: 0.30 m (sumbu Y)
   - Origin (0,0,0) berada di tengah bawah casing belakang AC (bagian yang menempel ke dinding). Menghadap ke arah +Z (arah hembusan udara).
2. Detail Komponen:
   - Casing Utama: Bentuk prisma persegi panjang dengan bevel kurva aerodinamis halus di tepi depan dan sudut samping. Finishing putih glossy modern (roughness: 0.25, metalness: 0.05).
   - Kisi Intake Udara Atas: Garis-garis lubang intake horizontal di bagian atas bodi.
   - Flap / Louver Kisi Angin Bawah: Kisi hembusan udara horizontal yang sedikit terbuka ke bawah (sudut rotasi 15 derajat), memperlihatkan rongga dalam ventilasi berwarna abu-abu gelap.
   - Display Digital LED: Panel display suhu kecil di sisi kanan depan (`24°C` atau strip indikator minimalis) dengan material emissive cyan/putih halus (emissiveIntensity: 1.5).
   - Badge Logo: Kotak aksen logo krom kecil di sudut casing.
3. Struktur Scene:
   - Root group diberi nama: `Office_Wall_AC_Unit`.
   - Tidak menyertakan lampu, kamera, atau lantai ke dalam grup yang di-export.
4. UI & Export:
   - Tampilkan inspektor 3D interaktif Three.js dengan OrbitControls, background studio gradien gelap, pencahayaan DirectionalLight + AmbientLight, dan grid ukuran meter.
   - Tombol "Export GLB" di pojok kanan atas yang langsung men-download file dengan nama "Office_Wall_AC_Unit.glb".
   - Tampilkan badge dimensi terukur (W x D x H) dan triangle count.
```

---

### PROMPT 2: Rak Buku & File Industrial (`Office_Bookshelf_Cabinet.glb`)

```markdown
Buatkan kode HTML tunggal (single-file HTML) lengkap yang memuat Three.js r128 dari CDN dan GLTFExporter untuk menghasilkan 3D Model GLB berkualitas PBR tinggi: "Office_Bookshelf_Cabinet" (Rak Buku & Lemari Arsip Industrial Kantor).

PERSYARATAN TEKNIS & GEOMETRI:
1. Skala & Dimensi Realistis:
   - Lebar: 1.20 m (sumbu X)
   - Kedalaman: 0.40 m (sumbu Z)
   - Tinggi: 1.85 m (sumbu Y)
   - Origin (0,0,0) berada di lantai tepat di tengah bawah rak. Menghadap ke arah +Z.
2. Detail Komponen:
   - Rangka Logam Industrial (Metal Frame): Rangka pipa besi hollow persegi warna hitam doff/matte (roughness: 0.6, metalness: 0.8) dengan palang penguat diagonal 'X' di bagian belakang rak.
   - Lemari Pintu Bawah (Tinggi 0.50m): 2 pintu kabinet kayu oak gelap dengan pegangan handle besi ramping hitam.
   - 4 Tingkat Ambalan Rak Terbuka: Papan kayu oak alami bertekstur serat hangat (roughness: 0.5, metalness: 0.05).
   - Isi Rak (Props Dekoratif Terintegrasi):
     * Tingkat 1: Deretan binder arsip dokumen berdiri berwarna biru tua, abu-abu, dan hitam.
     * Tingkat 2: Tumpukan dan deretan buku-buku pemrograman/desain dengan punggung buku berwarna kontras.
     * Tingkat 3: Pot keramik putih silinder berisi tanaman hias sukulen hijau kecil.
     * Tingkat 4: Kotak organizer minimalis kain abu-abu dan plakat penghargaan akrilik kecil.
3. Struktur Scene:
   - Root group diberi nama: `Office_Bookshelf_Cabinet`.
   - Hanya export grup rak dan isinya, tanpa kamera, lampu luar, atau lantai.
4. UI & Export:
   - Viewer 3D interaktif dengan OrbitControls, pencahayaan PBR studio, dan bayangan lembut.
   - Tombol "Export GLB" yang men-download "Office_Bookshelf_Cabinet.glb".
   - Panel HUD membaca dimensi aktual terukur dan jumlah poligon.
```

---

### PROMPT 3: Papan Tulis Kaca Scrum / Kanban (`Office_Whiteboard_Scrum.glb`)

```markdown
Buatkan kode HTML tunggal (single-file HTML) lengkap yang memuat Three.js r128 dari CDN dan GLTFExporter untuk menghasilkan 3D Model GLB berkualitas PBR tinggi: "Office_Whiteboard_Scrum" (Papan Tulis Kaca Agile Scrum Board Beroda).

PERSYARATAN TEKNIS & GEOMETRI:
1. Skala & Dimensi Realistis:
   - Lebar: 1.60 m (sumbu X)
   - Kedalaman Kaki Penopang: 0.50 m (sumbu Z)
   - Tinggi Total: 1.80 m (sumbu Y)
   - Origin (0,0,0) di lantai tengah roda. Menghadap ke +Z.
2. Detail Komponen:
   - Rangka & Kaki Beroda: Struktur baja tubular putih/silver anodized dengan 4 roda castor hitam kecil di tiap sudut kaki.
   - Permukaan Papan Kaca (Glass Whiteboard): Kaca tempered putih frosted transparan halus (roughness: 0.1, transmission/opacity: 0.95, metalness: 0.1).
   - Grid Kolom Sprint: Garis kolom tipis pembagi area: `TODO`, `IN PROGRESS`, `TESTING`, `DONE`.
   - Sticky Notes 3D: Kotak-kotak kecil berwarna kuning pastel, toska, dan merah muda tersebar di kolom-kolom papan.
   - Tatakan Bawah (Marker Tray): Tatakan aluminium horizontal di bawah kaca berisi 2 buah spidol (hitam & biru) dan 1 penghapus papan abu-abu.
3. Struktur Scene:
   - Root group diberi nama: `Office_Whiteboard_Scrum`.
4. UI & Export:
   - Viewer 3D OrbitControls dengan bayangan dan pencahayaan studio.
   - Tombol "Export GLB" men-download "Office_Whiteboard_Scrum.glb".
```

---

### PROMPT 4: Dispenser Air Galon Bawah (`Office_Water_Dispenser.glb`)

```markdown
Buatkan kode HTML tunggal (single-file HTML) lengkap yang memuat Three.js r128 dari CDN dan GLTFExporter untuk menghasilkan 3D Model GLB berkualitas PBR tinggi: "Office_Water_Dispenser" (Dispenser Air Minum Galon Bawah Modern).

PERSYARATAN TEKNIS & GEOMETRI:
1. Skala & Dimensi Realistis:
   - Lebar: 0.35 m (sumbu X)
   - Kedalaman: 0.38 m (sumbu Z)
   - Tinggi: 1.05 m (sumbu Y)
   - Origin (0,0,0) di lantai tengah bawah dispenser. Menghadap ke +Z.
2. Detail Komponen:
   - Bodi Utama: Casing plastik ABS hitam matte berkualitas tinggi dengan aksen pelat stainless steel di pintu kabinet bawah dan area kran.
   - Area Ceruk Kran (Water Spout Niche):
     * 3 kran tombol sentuh/tuas (Air Panas warna merah, Dingin warna biru, Normal warna abu-abu).
     * Baki tatakan tetesan air (drip tray) kisi metalik krom di bagian bawah ceruk.
   - Indikator LED: Lampu LED kecil status pemanas dan pendingin.
   - Pintu Bawah: Garis bukaan lemari tempat meletakkan galon air di dalam kabinet.
3. Struktur Scene:
   - Root group diberi nama: `Office_Water_Dispenser`.
4. UI & Export:
   - Viewer 3D Three.js lengkap dengan turntable, orbit controls, dan tombol "Export GLB" men-download "Office_Water_Dispenser.glb".
```

---

### PROMPT 5: Meja Diskusi Bundar & Kursi Rapat (`Office_Meeting_Table_Round.glb`)

```markdown
Buatkan kode HTML tunggal (single-file HTML) lengkap yang memuat Three.js r128 dari CDN dan GLTFExporter untuk menghasilkan 3D Model GLB berkualitas PBR tinggi: "Office_Meeting_Table_Round" (Meja Diskusi Bundar Kolaboratif dengan 4 Kursi Konferensi).

PERSYARATAN TEKNIS & GEOMETRI:
1. Skala & Dimensi Realistis:
   - Diameter Meja: 1.20 m (sumbu X & Z)
   - Tinggi Meja: 0.75 m (sumbu Y)
   - Total Jejak dengan 4 Kursi: Diameter ~1.85 m
   - Origin (0,0,0) di lantai tepat di tengah tiang meja.
2. Detail Komponen:
   - Meja Bundar:
     * Daun meja bundar tebal 3cm kayu walnut gelap (roughness: 0.45, metalness: 0.05).
     * Kaki meja: Tiang silinder baja hitam tunggal di tengah dengan piringan pelat dasar (round disc base) kokoh di lantai.
     * Modul Grommet Kabel: Lubang penutup kabel bundar krom kecil di tengah meja.
   - 4 Kursi Konferensi Modern:
     * Ditempatkan simetris di 4 sudut (rotasi 0, 90, 180, 270 derajat menghadap ke pusat meja).
     * Dudukan dan sandaran ergonomis busa berbalut kain abu-abu gelap (roughness: 0.85).
     * Rangka kaki ramping besi hitam 4 kaki.
3. Struktur Scene:
   - Root group diberi nama: `Office_Meeting_Table_Round`.
4. UI & Export:
   - Viewer 3D interaktif OrbitControls, pencahayaan studio realistis, dan tombol "Export GLB" men-download "Office_Meeting_Table_Round.glb".
```
