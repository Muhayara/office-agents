# Matriks Kursi Karyawan AI Berdasarkan Beban Kerja (`docs/seat-matrix.md`)

Matriks kursi ini membagi 10 karyawan AI ke dalam **3 Tier berdasarkan tingkat kompleksitas pekerjaan** agar pemanfaatan model penalaran tingkat tinggi dan model berkecepatan tinggi berjalan teratur:

1. **Tier 1 — Pekerjaan Berat (Ngoding Core, Engine 2.5D, Desain UI/UX, Aset Visual):** Menggunakan model penalaran & generasi kode tertinggi (`claude-opus-5-5-high`, `claude-sonnet-5-5-high`, `gemini-4-argon-high`).
2. **Tier 2 — Pemeriksaan Kualitas & Keamanan (Gatekeepers):** Menggunakan model peninjau kritis (`gemini-4-argon-high`, `claude-sonnet-5-5-high`).
3. **Tier 3 — Pekerjaan Ringan / Frekuensi Tinggi (Orkestrasi, Riset, Dokumen, Cek Visual):** Menggunakan model respons cepat (`gemini-3.8-flash-high`) agar pengiriman tugas dan koordinasi tidak memakan kuota pekerjaan berat.

---

## 1. Alokasi 10 Kursi Karyawan AI (3-Tier)

| ID Kursi | Nama & Peran | Tier Beban Kerja | Model Utama (`primary`) | Rantai Fallback (`fallbacks`) | Mode Tool | Kuota / Hari |
|---|---|---|---|---|---|---:|
| **`bima`** | **Bima** — Programmer (`coder`) | **Berat** (Ngoding Core) | `claude-opus-5-5-high` | `["claude-sonnet-5-5-high", "gemini-4-argon-high", "gemini-3.8-flash-high"]` | `tools` | 250 req |
| **`gita`** | **Gita** — Game Dev 2.5D (`gamedev`) | **Berat** (Engine 2.5D) | `claude-opus-5-5-high` | `["claude-sonnet-5-5-high", "gemini-4-argon-high", "gemini-3.8-flash-high"]` | `tools` | 250 req |
| **`tari`** | **Tari** — Desainer UI/UX (`designer`) | **Berat** (UI/UX & Ruang) | `claude-sonnet-5-5-high` | `["gemini-4-argon-high", "claude-opus-5-5-high", "gemini-3.8-flash-high"]` | `tools` | 250 req |
| **`wulan`** | **Wulan** — Artis Visual (`artist`) | **Berat** (Sprite & SVG) | `gemini-4-argon-high` | `["claude-sonnet-5-5-high", "gemini-3.8-flash-high"]` | `tools` | 250 req |
| **`laras`** | **Laras** — Reviewer & QA (`reviewer`) | **Kritis** (Review & QA) | `gemini-4-argon-high` | `["claude-sonnet-5-5-high", "gemini-3.8-flash-high"]` | `tools` | 300 req |
| **`satria`** | **Satria** — Auditor Keamanan (`security`) | **Kritis** (Audit Keamanan) | `claude-sonnet-5-5-high` | `["gemini-4-argon-high", "gemini-3.8-flash-high"]` | `tools` | 250 req |
| **`raka`** | **Raka** — Manajer Proyek (`manager`) | **Ringan/Sering** (Dispatch) | `gemini-3.8-flash-high` | `["gemini-4-argon-high", "claude-sonnet-5-5-high"]` | `tools` | 350 req |
| **`sari`** | **Sari** — Analis & Riset (`researcher`) | **Ringan/Sering** (Riset) | `gemini-3.8-flash-high` | `["gemini-4-argon-high", "claude-sonnet-5-5-high"]` | `tools` | 300 req |
| **`dimas`** | **Dimas** — Penulis Dokumen (`writer`) | **Ringan/Sering** (Dokumen) | `gemini-3.8-flash-high` | `["claude-sonnet-5-5-high", "gemini-4-argon-high"]` | `tools` | 300 req |
| **`fajar`** | **Fajar** — Penguji Visual (`visual_qa`) | **Ringan/Sering** (Cek Visual) | `gemini-3.8-flash-high` | `["gemini-4-argon-high", "claude-sonnet-5-5-high"]` | `tools` | 300 req |

---

## 2. Model Alternatif Tambahan yang Didukung Gateway

Selain model utama di atas, gateway juga mendukung keluarga model berikut bila diperlukan untuk eksperimen atau cadangan tambahan:
- `openai/gpt-oss-120b` & `openai/gpt-oss-20b`
- `qwen/qwen3.8-27b` & `qwen3-coder-next`
- `gemini-3.6-flash`, `gemini-3.5-flash-lite`, & `gemma-4-26b-a4b-it`
- `deepseek-3.2` & `deepseek-v4.1-flash`
- `glm-5` & `glm-5.3-flash`

---

## 3. Cara Mengganti Model Kursi Kapan Saja

1. Buka file [office.config.json](file:///P:/gemini-lab/office/office.config.json).
2. Ubah field `"model"` atau `"fallbacks"` pada objek agen yang diinginkan.
3. Restart `@office/server` (`npm --workspace @office/server run start`) — saat boot, `OfficeCore.bootstrapState()` otomatis menyinkronkan model ke database SQLite dan menyiarkannya ke UI Meja Dispatch (dengan nama publik yang sudah dibersihkan dari prefix rute internal).
