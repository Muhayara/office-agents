# Office Agents — Meja Dispatch AI (Multi-Agent Virtual Office)

**Office Agents** adalah kantor perangkat lunak virtual berbasis AI tempat pengguna berperan sebagai **CEO** yang memimpin **5 karyawan AI spesialis** dalam Bahasa Indonesia melalui antarmuka **Meja Dispatch Command Center** (`http://localhost:5173`), server orkestrasi real-time (`http://127.0.0.1:7420`), dan protokol **MCP (Model Context Protocol)** (`http://127.0.0.1:7421/mcp`).

---

## 1. Tim Karyawan AI & Alokasi Model Lintas Provider

Beban kerja dibagi ke **3 provider AI independen** yang terhubung melalui gateway lokal `9router` (`http://127.0.0.1:20128/v1`) agar tidak menghabiskan kuota satu provider tunggal:

| Kursi | Nama | Jabatan | Provider Utama | Model Utama (`primary`) | Rantai Fallback (`fallbacks`) | Kuota/Hari |
|---|---|---|---|---|---|---:|
| `raka` | **Raka** | Manajer Proyek (`manager`) | Google AI Studio (`gemini/*`) | `gemini/gemini-3.6-flash` | `groq/openai/gpt-oss-120b` → `ag/gemini-3.8-flash-high` → `ag/claude-sonnet-4-6` | 80 req |
| `sari` | **Sari** | Analis & Riset (`researcher`) | Google AI Studio (`gemini/*`) | `gemini/gemini-3.5-flash-lite` | `gemini/gemma-4-26b-a4b-it` → `groq/openai/gpt-oss-20b` → `ag/gemini-3.8-flash-medium` | 80 req |
| `dimas` | **Dimas** | Penulis Dokumen (`writer`) | Groq Cloud (`groq/*`) | `groq/openai/gpt-oss-120b` | `ag/gpt-oss-120b-medium` → `gemini/gemini-3.6-flash` → `ag/gemini-3.8-flash-medium` | 120 req |
| `bima` | **Bima** | Programmer (`coder`) | Antigravity (`ag/*`) | `ag/claude-sonnet-4-6` | `groq/openai/gpt-oss-120b` → `ag/gpt-oss-120b-medium` → `ag/claude-opus-4-6-thinking` | 80 req |
| `laras` | **Laras** | Reviewer & QA (`reviewer`) | Groq Cloud (`groq/*`) | `groq/openai/gpt-oss-20b` | `gemini/gemini-3.5-flash-lite` → `groq/openai/gpt-oss-120b` → `ag/gemini-3.8-flash-high` | 80 req |

> Lihat rincian hasil benchmark seluruh model di [docs/f0-report.md](file:///P:/gemini-lab/office/docs/f0-report.md) dan panduan penggantian model di [docs/seat-matrix.md](file:///P:/gemini-lab/office/docs/seat-matrix.md).

---

## 2. Struktur Monorepo

```text
P:\gemini-lab\office\
├── packages/
│   └── shared/                 # @office/shared — Kontrak tipe, skema Zod, 19 definisi tool MCP, & konstanta
├── apps/
│   ├── server/                 # @office/server — Node.js + SQLite (node:sqlite) + HTTP/WS (:7420) + MCP (:7421)
│   │   └── src/
│   │       ├── db.ts           # Skema SQLite WAL (projects, agents, tasks, messages, approvals, usage_daily, audit_log)
│   │       ├── prompts.ts      # Builder System Prompt Bahasa Indonesia & parser JSON envelope
│   │       ├── core/
│   │       │   ├── office-core.ts  # Mesin state utama, 19 tool handler, sandbox workspace, & Approval Gate
│   │       │   └── scheduler.ts    # Orkestrator giliran agen (maks 2 kursi paralel, anti-loop guard)
│   │       ├── drivers/
│   │       │   ├── api-driver.ts   # Driver OpenAI-compatible 9router (tool_calls + fallback model otomatis)
│   │       │   └── mock-driver.ts  # Driver deterministik untuk pengujian tanpa kuota
│   │       ├── mcp-server.ts   # Streamable HTTP MCP Server (:7421/mcp)
│   │       ├── mcp-stdio.ts    # Stdio MCP proxy untuk Claude Desktop
│   │       ├── index.ts        # Entrypoint server HTTP + WebSocket (:7420)
│   │       └── office.test.ts  # Suite pengujian unit & E2E (Vitest)
│   └── web/                    # @office/web — React 18 + Vite Command Center ("Meja Dispatch") (:5173)
│       └── src/
│           ├── styles/tokens.css       # Palet industrial gelap (#0B0E13), tipografi Overpass & Overpass Mono
│           └── components/             # StatusRail, RosterRow, Tick, WorkOrderBoard, DispatchLog, CommandComposer, DetailRail, ApprovalModal
├── workspace/                  # Folder kerja terisolasi (git repo) tempat agen membaca/menulis file proyek
├── docs/                       # Dokumentasi arsitektur, desain, prompt, laporan Fase 0, & sinkronisasi DeepSeek
├── office.config.json          # Konfigurasi kursi agen, model, fallback, dan batas kuota harian
└── .mcp.json                   # Konfigurasi MCP workspace (context7, playwright, jiro, office)
```

---

## 3. Cara Menjalankan Proyek

### Prasyarat
- **Node.js** `>= 22.5.0` (menggunakan modul bawaan `node:sqlite`)
- **9router** terpasang secara global (`9router -n -l --skip-update` pada port `20128`)

### Langkah Menjalankan Semua Layanan

1. **Pastikan `9router` aktif di port `20128`:**
   ```powershell
   9router -n -l --skip-update
   ```

2. **Instal dependensi & jalankan verifikasi tipe/tes:**
   ```powershell
   npm install
   npm run typecheck
   npm run test
   ```

3. **Jalankan Backend `@office/server` (`:7420` & `:7421`):**
   ```powershell
   npm --workspace @office/server run start
   ```

4. **Jalankan Frontend `@office/web` (`:5173`):**
   ```powershell
   npm --workspace @office/web run dev
   ```

5. **Buka Meja Dispatch Command Center di Browser:**
   - URL: `http://localhost:5173`

---

## 4. Mode Keamanan (`Semi` vs `Penuh`) & Sandbox Workspace

- **Isolasi Path (`workspace/`):** Seluruh operasi baca/tulis file oleh agen (`read_file`, `write_file`, `edit_file`) dikunci di dalam `P:\gemini-lab\office\workspace`. Upaya keluar direktori (`..`) atau menyentuh `.env` / `.git/config` otomatis ditolak dan dicatat ke `audit_log`.
- **Whitelist Perintah (`run_command`):** Hanya mengizinkan `npm`, `npx`, `node`, `git`, `python`, `tsc`, dan `vitest` tanpa shell interpolation (`shell: false`).
- **Mode `Semi` (Default):** Perintah `run_command` dan `git_commit` memunculkan kartu **Menunggu Izin CEO** di panel kanan dan modal persetujuan (`Setujui [Y]` / `Tolak [N]`).
- **Mode `Penuh`:** Perintah yang berada di dalam *whitelist* dieksekusi langsung tanpa menunggu klik CEO.

---

## 5. Indeks Dokumentasi Proyek

- [docs/plans/](file:///P:/gemini-lab/office/docs/plans/README.md) — Arsip seluruh dokumen analisa awal, riset, dan cetak biru arsitektur (Opus 5.5, Gemini Argon 4, Sonnet 5.5, DeepSeek Harness).
- [docs/ARCHITECTURE.md](file:///P:/gemini-lab/office/docs/ARCHITECTURE.md) — Dokumentasi teknis arsitektur sistem, alur data, API HTTP/WS, dan MCP.
- [docs/DESIGN.md](file:///P:/gemini-lab/office/docs/DESIGN.md) — Spesifikasi sistem desain visual *Meja Dispatch* (disusun oleh DeepSeek Harness).
- [docs/PROMPTS.md](file:///P:/gemini-lab/office/docs/PROMPTS.md) — Spesifikasi *system prompt* Bahasa Indonesia untuk 5 kursi AI (disusun oleh DeepSeek Harness).
- [docs/f0-report.md](file:///P:/gemini-lab/office/docs/f0-report.md) — Laporan hasil uji koneksi nyata semua provider & model di `9router`.
- [docs/seat-matrix.md](file:///P:/gemini-lab/office/docs/seat-matrix.md) — Matriks kursi karyawan AI lintas provider & daftar model alternatif.
- [docs/deepseek-sync.md](file:///P:/gemini-lab/office/docs/deepseek-sync.md) — Dokumen sinkronisasi status implementasi untuk **DeepSeek Harness**.
- [docs/handover-session.md](file:///P:/gemini-lab/office/docs/handover-session.md) — Dokumen handover sesi awal & pembagian tugas paralel.
- [docs/toolbox.md](file:///P:/gemini-lab/office/docs/toolbox.md) — Inventaris CLI, MCP, dan skill pendukung di mesin lokal.
