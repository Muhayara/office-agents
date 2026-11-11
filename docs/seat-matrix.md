# Matriks Kursi Karyawan AI Final (`docs/seat-matrix.md`)

Matriks kursi ini telah diseimbangkan ulang agar **tidak bergantung penuh pada satu provider (`ag/*` Antigravity)**, melainkan membagi beban secara merata ke **3 provider independen yang aktif** di `9router`:
1. **Google AI Studio Direct (`gemini/*`)** — menggunakan 2 API Key independen (`kai` & `bau`) dengan *round-robin*.
2. **Groq Cloud (`groq/*`)** — menggunakan akun API `mnr333` berlatensi sangat rendah (420–715 ms).
3. **Antigravity OAuth (`ag/*`)** — dikhususkan untuk model penulisan kode utama (`ag/claude-sonnet-4-6`) dan *fallback* cadangan.

---

## 1. Alokasi 5 Kursi Karyawan AI (Seimbang Lintas Provider)

| ID Kursi | Nama & Peran | Ember Kuota Utama | Model Utama (`primary`) | Rantai Fallback (`fallbacks`) | Mode Tool | Kuota / Hari |
|---|---|---|---|---|---|---:|
| **`raka`** | **Raka** — Manajer Proyek (`manager`) | Antigravity Argon (`ag/*`) | `ag/gemini-4-argon-high` | `["ag/claude-sonnet-5-5-high", "ag/gemini-3.8-flash-high"]` | `tools` | 80 req |
| **`sari`** | **Sari** — Analis & Riset (`researcher`) | Antigravity Flash (`ag/*`) | `ag/gemini-3.8-flash-high` | `["ag/gemini-4-argon-high", "ag/claude-sonnet-5-5-high"]` | `tools` | 80 req |
| **`dimas`** | **Dimas** — Penulis Dokumen (`writer`) | Antigravity Flash (`ag/*`) | `ag/gemini-3.8-flash-high` | `["ag/claude-sonnet-5-5-high", "ag/gemini-4-argon-high"]` | `tools` | 120 req |
| **`bima`** | **Bima** — Programmer (`coder`) | Antigravity Claude (`ag/*`) | `ag/claude-opus-5-5-high` | `["ag/claude-sonnet-5-5-high", "ag/gemini-4-argon-high", "ag/gemini-3.8-flash-high"]` | `tools` | 80 req |
| **`laras`** | **Laras** — Reviewer & QA (`reviewer`) | Antigravity Argon (`ag/*`) | `ag/gemini-4-argon-high` | `["ag/claude-sonnet-5-5-high", "ag/gemini-3.8-flash-high"]` | `tools` | 80 req |

---

## 2. Katalog Lengkap Model Non-Antigravity yang Siap Dipakai

Berikut adalah seluruh model **di luar `ag/*`** yang telah diuji dan dapat langsung dipasang ke kursi mana pun di `office.config.json`:

### A. Provider Groq Cloud (`groq/*` — AktifSekarang)
- `groq/openai/gpt-oss-120b` — OpenAI GPT-OSS 120B (715 ms, mendukung native `tool_calls`).
- `groq/openai/gpt-oss-20b` — OpenAI GPT-OSS 20B (424 ms, sangat cepat, mendukung native `tool_calls`).
- `groq/qwen/qwen3.8-27b` — Alibaba Qwen 3.8 27B (461 ms, gunakan dengan `"toolMode": "json"`).

### B. Provider Google AI Studio Direct (`gemini/*` — 2 API Key `kai` & `bau` Aktif Sekarang)
- `gemini/gemini-3.6-flash` — Gemini 3.6 Flash via Google AI Studio API Key (2.4 s, mendukung native `tool_calls`).
- `gemini/gemini-3.5-flash-lite` — Gemini 3.5 Flash Lite via Google AI Studio API Key (1.5 s, hemat kuota & cepat).
- `gemini/gemma-4-26b-a4b-it` — Google Gemma 4 26B MoE Open-Weight (5.3 s, mendukung native `tool_calls`).
- `gemini/gemini-3.5-flash` — Gemini 3.5 Flash (6.6 s, mendukung native `tool_calls`).

### C. Provider Kiro (`kr/*` — 25 Model Siap Aktif Setelah Re-Login Dashboard)
Akun Kiro (`Account 1` & `Account 2`) sudah terdaftar di `9router`, namun token OAuth-nya kedaluwarsa pada `8 Nov 2026`. Cukup buka `http://127.0.0.1:20128/dashboard` -> tab **Providers** -> klik **Reconnect/Refresh** pada **Kiro**, maka model-model berikut langsung dapat dipakai:
- `kr/deepseek-3.2` & `kr/deepseek-3.2-thinking-agentic` (DeepSeek v3.2)
- `kr/qwen3-coder-next` & `kr/qwen3-coder-next-thinking-agentic` (Qwen 3 Coder Next)
- `kr/glm-5` & `kr/glm-5-thinking-agentic` (Zhipu GLM-5)
- `kr/claude-sonnet-4.5` & `kr/claude-haiku-4.5`
- `kr/gpt-5.6-terra` & `kr/gpt-5.6-luna`

### D. Provider OpenCode Zen (`oc/*` — Reset Kuota Harian Otomatis)
- `oc/deepseek-v4.1-flash-free` (DeepSeek V4.1 Flash)
- `oc/glm-5.3-flash-free` (GLM 5.3 Flash)

---

## 3. Cara Mengganti Model Kursi Kapan Saja

1. Buka file [office.config.json](file:///P:/gemini-lab/office/office.config.json).
2. Ubah field `"model"` atau `"fallbacks"` pada objek agen yang diinginkan (`raka`, `sari`, `dimas`, `bima`, atau `laras`).
3. Restart `@office/server` (`npm --workspace @office/server run start`) — saat boot, `OfficeCore.bootstrapState()` otomatis menyinkronkan model baru ke database SQLite (`office.db`) dan menyiarkannya ke UI Meja Dispatch.
