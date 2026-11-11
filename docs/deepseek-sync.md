# Dokumen Sinkronisasi untuk DeepSeek Harness (`docs/deepseek-sync.md`)

**Kepada:** DeepSeek Harness (Penulis `docs/DESIGN.md`, `docs/PROMPTS.md`, dan `packages/shared/`)  
**Dari:** Antigravity Agent (Eksekutor Fase 0, `@office/server`, `@office/web`, & Integrasi MCP)  
**Waktu Sinkronisasi:** 10 November 2026  

---

## 1. Ringkasan Status Integrasi Paralel

Seluruh artefak fondasi yang Anda kerjakan di:
- [docs/DESIGN.md](file:///P:/gemini-lab/office/docs/DESIGN.md)
- [docs/PROMPTS.md](file:///P:/gemini-lab/office/docs/PROMPTS.md)
- [packages/shared/src/index.ts](file:///P:/gemini-lab/office/packages/shared/src/index.ts)

telah **diintegrasikan 100% tanpa perubahan destruktif** ke dalam:
1. **`apps/server` (`@office/server`)** — memakai seluruh skema Zod, ke-19 `TOOL_DEFINITIONS`, `TASK_TRANSITIONS`, dan protokol `ServerEvent`/`ClientCommand` dari `@office/shared`, serta mengimplementasikan *prompt builder* dan parser `extractEnvelope` persis sesuai `docs/PROMPTS.md`.
2. **`apps/web` (`@office/web`)** — mengimplementasikan seluruh token warna industrial `#0B0E13`, tipografi `@fontsource/overpass` & `@fontsource/overpass-mono`, komponen `Tick` 20-segmen, dan tata letak **Meja Dispatch** sesuai `docs/DESIGN.md` (tanpa elemen 2D/3D Phaser di Fase 1–2).
3. **Verifikasi Build & Test:**
   - `npm run typecheck` lulus 0 error di ketiga workspace (`@office/shared`, `@office/server`, `@office/web`).
   - `npm run test` lulus **7/7 pengujian** (`apps/server/src/office.test.ts`), mencakup alur end-to-end `CEO -> Raka -> Sari -> Dimas -> Bima -> Laras (ACC) -> Raka -> CEO`.

---

## 2. Update Penting Matriks Model Lintas Provider (Non-Antigravity)

Berdasarkan audit mendalam ke database `9router` (`%APPDATA%\9router\db\data.sqlite`) dan pengujian langsung ke API provider:
- Selain `ag/*` (Antigravity OAuth), terdapat **2 provider aktif lain dengan API key langsung** yang sangat cepat dan bebas dari kuota Antigravity:
  1. **Groq Cloud (`groq/*` — akun `mnr333`):**
     - `groq/openai/gpt-oss-120b` (715 ms, native `tool_calls`)
     - `groq/openai/gpt-oss-20b` (424 ms, native `tool_calls`)
     - `groq/qwen/qwen3.8-27b` (461 ms, mode JSON envelope)
  2. **Google AI Studio Direct (`gemini/*` — 2 API key `kai` & `bau` *round-robin*):**
     - `gemini/gemini-3.6-flash` (2.463 ms, native `tool_calls`)
     - `gemini/gemini-3.5-flash-lite` (1.512 ms, native `tool_calls`)
     - `gemini/gemma-4-26b-a4b-it` (5.389 ms, open-weight MoE, native `tool_calls`)
     - `gemini/gemini-3.5-flash` (6.636 ms, native `tool_calls`)
- **Status Model DeepSeek di `9router`:**
  - `oc/deepseek-v4.1-flash-free` (OpenCode Zen) saat ini mengembalikan HTTP `429 FreeUsageLimitError` karena batas harian gratis tercapai sementara.
  - `kr/deepseek-3.2` dan `kr/deepseek-3.2-thinking-agentic` (Kiro OAuth) sudah terdaftar di `9router`, namun token OAuth Kiro kedaluwarsa pada `8 Nov 2026`. Begitu pengguna melakukan *Reconnect* Kiro di `http://127.0.0.1:20128/dashboard`, model `kr/deepseek-3.2` dapat langsung diaktifkan kembali di `office.config.json`.

### Konfigurasi Kursi Aktif Saat Ini di `office.config.json`
- **Raka (`manager`):** `gemini/gemini-3.6-flash` (Google AI Studio Direct)
- **Sari (`researcher`):** `gemini/gemini-3.5-flash-lite` (Google AI Studio Direct)
- **Dimas (`writer`):** `groq/openai/gpt-oss-120b` (Groq Cloud)
- **Bima (`coder`):** `ag/claude-sonnet-4-6` (Antigravity)
- **Laras (`reviewer`):** `groq/openai/gpt-oss-20b` (Groq Cloud)

*(Catatan: Daftar agen default dikonfigurasi langsung melalui `office.config.json` dan divalidasi oleh `OfficeConfigSchema` di `packages/shared/src/config.ts` saat boot).*

---

## 3. Titik Sambung Berikutnya untuk Kolaborasi (Fase 3 / Ekstensi)

Jika DeepSeek Harness melanjutkan pengembangan pada sesi berikutnya, berikut titik sambung yang sudah disiapkan:
1. **Driver Tambahan (`apps/server/src/drivers/`):**
   - Antarmuka `AgentDriver` di [types.ts](file:///P:/gemini-lab/office/apps/server/src/drivers/types.ts) siap menerima `CliClaudeDriver` (`claude -p --output-format json` via `9router`) untuk eskalasi tugas koding kompleks Bima.
2. **Kanvas 2D/3D Opsional (Fase 3):**
   - Komponen panggung tengah di [App.tsx](file:///P:/gemini-lab/office/apps/web/src/App.tsx) (`<div className="center-stage">`) dirancang modular sehingga tab atau *drawer* kanvas piksel isometrik (`Phaser 3`) dapat disisipkan di atas `WorkOrderBoard` tanpa mengubah protokol `ServerEvent` (`agent.status`, `agent.say`, `desk_x`, `desk_y` sudah tersedia penuh di snapshot).
