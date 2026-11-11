# Laporan Fase 0 — Verifikasi Koneksi Semua AI & Matriks Kursi

**Tanggal Eksekusi:** 10 November 2026  
**Gateway Utama:** `9router v0.5.116` (`http://127.0.0.1:20128`)  
**Workspace Proyek:** `P:\gemini-lab\office`

---

## 1. Status Gateway `9router` & Akun Provider yang Terhubung

- **Proses:** Berjalan sebagai daemon (`9router -n -l --skip-update`) pada port `20128`.
- **Autentikasi:** `9router` mewajibkan header `Authorization: Bearer <API_KEY>` (atau `x-api-key` untuk protokol `/v1/messages`). Kunci API lokal disimpan di `P:\gemini-lab\office\.env` (`NINEROUTER_KEY`).
- **Perilaku Wire / Streaming:**
  - Secara default, `POST /v1/chat/completions` tanpa `"stream": false` akan mengembalikan aliran SSE (`data: {...}`). Driver `apps/server` wajib mengirim `"stream": false` dan menyertakan parser ganda (JSON objek tunggal + fallback rakit ulang SSE `data:` frame).
  - Model dengan *internal reasoning* (`groq/openai/gpt-oss-120b`, `groq/openai/gpt-oss-20b`, `ag/gemini-3.8-flash-*`) membutuhkan `max_tokens >= 400` (disarankan `1500` di produksi) agar token jawaban dan `tool_calls` tidak terpotong oleh token *reasoning*.

### Inventaris 6 Provider yang Terdaftar di Database `9router` (`%APPDATA%\9router\db\data.sqlite`)

| Provider Prefix | Nama Provider | Koneksi Akun | Status Saat Ini | Catatan Operasional |
|---|---|---|---|---|
| `groq/*` | **Groq Cloud API** | `mnr333` (API Key) | **AKTIF (200 OK)** | Sangat cepat (~420–825 ms). Menyediakan `groq/openai/gpt-oss-120b`, `groq/openai/gpt-oss-20b`, `groq/qwen/qwen3.8-27b`, dan `groq/allam-2-7b`. |
| `gemini/*` | **Google AI Studio Direct API** | `kai` & `bau` (2 API Key *Round-Robin*) | **AKTIF (200 OK)** | Menggunakan 2 API key terpisah dari kuota Antigravity. Menyediakan `gemini/gemini-3.6-flash`, `gemini/gemini-3.5-flash-lite`, `gemini/gemini-3.5-flash`, dan `gemini/gemma-4-26b-a4b-it`. |
| `ag/*` | **Antigravity OAuth** | `bnaga4962@gmail.com` (OAuth) | **AKTIF (200 OK)** | Menyediakan `ag/claude-sonnet-4-6`, `ag/claude-opus-4-6-thinking`, `ag/gpt-oss-120b-medium`, `ag/gemini-3.8-flash-high`, dan `ag/gemini-3.8-flash-medium`. |
| `kr/*` | **Kiro OAuth** | `Account 1` & `Account 2` (OAuth) | **PERLU RE-LOGIN (500)** | Token OAuth kedaluwarsa (`expiresAt: 2026-11-08`). Memiliki 25 model (`kr/deepseek-3.2`, `kr/qwen3-coder-next`, `kr/glm-5`, `kr/claude-sonnet-4.5`, dll.) yang langsung aktif begitu di-*refresh* di `http://127.0.0.1:20128/dashboard`. |
| `oc/*` | **OpenCode Zen Free** | Free Tier | **RATE-LIMITED (429)** | `oc/deepseek-v4.1-flash-free` & `oc/glm-5.3-flash-free` mengembalikan `FreeUsageLimitError` (kuota harian publik habis sementara). |
| `kc/*` | **KiloCode OAuth** | `bnaga4962@gmail.com` (OAuth) | **BUTUH KREDIT (402)** | Mengembalikan `402 Paid Model - Credits Required`. |

---

## 2. Hasil Uji Coba Semua Model Kandidat (`/v1/chat/completions` + Native `tool_calls`)

| Provider | Model ID | Chat | Native `tool_calls` | Latensi Rata-rata | Status & Rekomendasi |
|---|---|---:|---:|---:|---|
| **Groq Cloud** | `groq/openai/gpt-oss-20b` | LULUS | LULUS (`ping({"msg":"halo"})`) | **424 ms** | **Aktif — Primary Laras (Reviewer/QA)** |
| **Groq Cloud** | `groq/openai/gpt-oss-120b` | LULUS | LULUS (`ping({"msg":"halo"})`) | **715 ms** | **Aktif — Primary Dimas (Writer) & Fallback Lintas Kursi** |
| **Groq Cloud** | `groq/qwen/qwen3.8-27b` | LULUS | JSON Envelope Mode | **461 ms** | **Aktif — Alternatif Cepat Non-Antigravity (`toolMode: json`)** |
| **Google AI Studio** | `gemini/gemini-3.5-flash-lite` | LULUS | LULUS (`ping({"msg":"halo"})`) | **1.512 ms** | **Aktif — Primary Sari (Researcher/Analis)** |
| **Google AI Studio** | `gemini/gemini-3.6-flash` | LULUS | LULUS (`ping({"msg":"halo"})`) | **2.463 ms** | **Aktif — Primary Raka (Manajer Proyek)** |
| **Google AI Studio** | `gemini/gemma-4-26b-a4b-it` | LULUS | LULUS (`ping({"msg":"halo"})`) | **5.389 ms** | **Aktif — Open-Weight Gemma 4 26B (Fallback Sari)** |
| **Google AI Studio** | `gemini/gemini-3.5-flash` | LULUS | LULUS (`ping({"msg":"halo"})`) | **6.636 ms** | **Aktif — Cadangan Google AI Studio** |
| **Antigravity** | `ag/claude-sonnet-4-6` | LULUS | LULUS (`ping({"msg":"halo"})`) | **1.533 ms** | **Aktif — Primary Bima (Programmer/Coder)** |
| **Antigravity** | `ag/claude-opus-4-6-thinking` | LULUS | LULUS (`ping({"msg":"halo"})`) | **2.236 ms** | **Aktif — Escalation Bima (Debugging Berat)** |
| **Antigravity** | `ag/gpt-oss-120b-medium` | LULUS | LULUS (`ping({"msg":"halo"})`) | **2.563 ms** | **Aktif — Fallback Dimas & Bima** |
| **Antigravity** | `ag/gemini-3.8-flash-medium` | LULUS | LULUS (`ping({"msg":"halo"})`) | **2.948 ms** | **Aktif — Fallback Cepat** |
| **Antigravity** | `ag/gemini-3.8-flash-high` | LULUS | LULUS (`ping({"msg":"halo"})`) | **3.924 ms** | **Aktif — Fallback Raka & Laras** |
| **9router Combo** | `ultra-combo-v2` | LULUS | LULUS (`ping({"msg":"halo"})`) | **2.712 ms** | **Aktif — Combo Otomatis 9router** |
| **OpenCode Free** | `oc/glm-5.3-flash-free` | GAGAL (429) | GAGAL (429) | 569 ms | `FreeUsageLimitError` — Kuota gratis harian penuh |
| **OpenCode Free** | `oc/deepseek-v4.1-flash-free` | GAGAL (429) | GAGAL (429) | 406 ms | `FreeUsageLimitError` — Kuota gratis harian penuh |
| **Kiro OAuth** | `kr/deepseek-3.2` / `kr/qwen3-coder-next` | GAGAL (500) | GAGAL (500) | 1.006 ms | Token OAuth Kiro kedaluwarsa 8 Nov 2026; perlu klik Reconnect di dashboard `9router` |

---

## 3. Hasil Uji Coba Protokol Anthropic (`/v1/messages`) & CLI Eksternal

1. **Endpoint `/v1/messages` (Anthropic Messages API di `9router`):**
   - Diuji dengan model `ag/claude-sonnet-4-6`.
   - **Hasil:** `HTTP 200 OK` dalam `2.371 ms`, mengembalikan blok konten teks `"PONG"` dengan struktur standar Anthropic (`id`, `type: "message"`, `content`, `usage`).

2. **Claude Code CLI (`claude.exe v2.1.319`):**
   - Perintah uji:
     ```powershell
     $env:ANTHROPIC_BASE_URL="http://127.0.0.1:20128"
     $env:ANTHROPIC_AUTH_TOKEN=$env:NINEROUTER_KEY
     claude -p "Jawab singkat: PONG" --model "ag/claude-sonnet-5-5-high" --output-format json --no-session-persistence
     ```
   - **Hasil:** **LULUS (`exitCode: 0`, `2.244 ms`)**. Output JSON terstruktur (`{"type":"result","subtype":"success","is_error":false,"result":"PONG"}`).
   - **Rekomendasi:** Siap dipakai sebagai `CliClaudeDriver` opsional untuk eskalasi tugas refactoring multi-file Bima.

3. **Antigravity CLI (`C:\Users\Muhayara\.gemini\bin\agy.exe`):**
   - Perintah uji: `agy.exe -p "Jawab singkat: PONG" --output-format stream-json --mode agent`
   - **Hasil:** `agy.exe` adalah wrapper Electron VS Code/Antigravity yang meneruskan flag `--headless` ke instance IDE GUI yang sedang terbuka.
   - **Rekomendasi:** Gunakan `agy.exe chat` hanya sebagai jembatan interaktif ke IDE saat CEO ingin membuka file secara visual, bukan sebagai subprocess pekerja latar belakang.

4. **Claude Desktop (`Claude.exe` + `claude_desktop_config.json`):**
   - Terpasang dan terkonfigurasi di `C:\Users\Muhayara\AppData\Roaming\Claude\claude_desktop_config.json`.
   - **Rekomendasi:** Dipakai sebagai **Zero-Cost External Reviewer** melalui jembatan MCP `office` (`P:\gemini-lab\office\apps\server\src\mcp-stdio.ts` -> `:7421/mcp`).
