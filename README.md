# Office Agents — Meja Dispatch & 2.5D Virtual AI Office

**Office Agents** adalah kantor perangkat lunak virtual berbasis AI tempat pengguna berperan sebagai **CEO** yang memimpin **10 karyawan AI spesialis** dalam Bahasa Indonesia melalui antarmuka **Meja Dispatch Command Center & 2.5D Isometric Office** (`http://localhost:5173`), server orkestrasi real-time (`http://127.0.0.1:7420`), dan protokol **MCP (Model Context Protocol)** (`http://127.0.0.1:7421/mcp`).

---

## 1. Tim Karyawan AI & Alokasi Model Berdasarkan Beban Kerja (3-Tier)

Beban kerja dibagi secara terstruktur ke dalam **3 Tier berdasarkan tingkat kompleksitas tugas** melalui *Unified OpenAI-Compatible LLM Gateway* lokal agar pemanfaatan model dan kuota berjalan optimal:

| Kursi | Nama | Jabatan | Tier Beban Kerja | Model Utama (`primary`) | Rantai Fallback (`fallbacks`) | Kuota/Hari |
|---|---|---|---|---|---|---:|
| `bima` | **Bima** | Programmer (`coder`) | **Berat** (Ngoding Core) | `claude-opus-5-5-high` | `claude-sonnet-5-5-high` → `gemini-4-argon-high` → `gemini-3.8-flash-high` | 250 req |
| `gita` | **Gita** | Game Dev 2.5D (`gamedev`) | **Berat** (Engine 2.5D) | `claude-opus-5-5-high` | `claude-sonnet-5-5-high` → `gemini-4-argon-high` → `gemini-3.8-flash-high` | 250 req |
| `tari` | **Tari** | Desainer UI/UX (`designer`) | **Berat** (UI/UX & Ruang) | `claude-sonnet-5-5-high` | `gemini-4-argon-high` → `claude-opus-5-5-high` → `gemini-3.8-flash-high` | 250 req |
| `wulan` | **Wulan** | Artis Visual (`artist`) | **Berat** (Sprite & SVG) | `gemini-4-argon-high` | `claude-sonnet-5-5-high` → `gemini-3.8-flash-high` | 250 req |
| `laras` | **Laras** | Reviewer & QA (`reviewer`) | **Kritis** (Review & QA) | `gemini-4-argon-high` | `claude-sonnet-5-5-high` → `gemini-3.8-flash-high` | 300 req |
| `satria` | **Satria** | Auditor Keamanan (`security`) | **Kritis** (Keamanan & Veto) | `claude-sonnet-5-5-high` | `gemini-4-argon-high` → `gemini-3.8-flash-high` | 250 req |
| `raka` | **Raka** | Manajer Proyek (`manager`) | **Ringan/Sering** (Dispatch) | `gemini-3.8-flash-high` | `gemini-4-argon-high` → `claude-sonnet-5-5-high` | 350 req |
| `sari` | **Sari** | Analis & Riset (`researcher`) | **Ringan/Sering** (Riset) | `gemini-3.8-flash-high` | `gemini-4-argon-high` → `claude-sonnet-5-5-high` | 300 req |
| `dimas` | **Dimas** | Penulis Dokumen (`writer`) | **Ringan/Sering** (Dokumen) | `gemini-3.8-flash-high` | `claude-sonnet-5-5-high` → `gemini-4-argon-high` | 300 req |
| `fajar` | **Fajar** | Penguji Visual (`visual_qa`) | **Ringan/Sering** (Cek Visual) | `gemini-3.8-flash-high` | `gemini-4-argon-high` → `claude-sonnet-5-5-high` | 300 req |

> Lihat panduan konfigurasi kursi selengkapnya di [docs/seat-matrix.md](file:///P:/gemini-lab/office/docs/seat-matrix.md).

---

## 2. Struktur Monorepo

```text
P:\gemini-lab\office\
├── packages/
│   └── shared/                 # @office/shared — Kontrak tipe v1.1.0, skema Zod, 20 definisi tool MCP, & konstanta izin
├── apps/
│   ├── server/                 # @office/server — Node.js + SQLite (node:sqlite) + HTTP/SSE (:7420) + MCP (:7421)
│   │   └── src/
│   │       ├── db.ts           # Skema SQLite WAL (projects, agents, tasks, messages, approvals, usage, audit)
│   │       ├── prompts.ts      # Builder System Prompt Bahasa Indonesia (10 peran) & parser JSON envelope
│   │       ├── security/       # Pemindai keamanan deterministik (rahasia, .env, .gitignore, izin peran)
│   │       ├── git/            # Layanan auto-commit & auto-push terverifikasi per tugas
│   │       ├── core/
│   │       │   ├── office-core.ts  # Mesin state utama, 20 tool handler, sandbox workspace, & Approval Gate
│   │       │   └── scheduler.ts    # Orkestrator giliran agen (kursi paralel, anti-loop guard)
│   │       ├── drivers/
│   │       │   ├── api-driver.ts   # Driver OpenAI-compatible LLM Gateway (tool_calls + fallback model otomatis)
│   │       │   └── mock-driver.ts  # Driver deterministik untuk pengujian tanpa kuota
│   │       ├── mcp-server.ts   # Streamable HTTP MCP Server (:7421/mcp)
│   │       ├── mcp-stdio.ts    # Stdio MCP proxy untuk klien eksternal
│   │       ├── index.ts        # Entrypoint server HTTP + SSE (:7420)
│   │       └── office.test.ts  # Suite pengujian unit & E2E (Vitest)
│   └── web/                    # @office/web — React 18 + Vite Command Center ("Meja Dispatch") (:5173)
│       └── src/
│           ├── styles/tokens.css       # Palet industrial gelap (#0B0E13), tipografi Overpass & Overpass Mono
│           └── components/             # StatusRail, RosterRow, Tick, WorkOrderBoard, DispatchLog, CommandComposer, DetailRail, ApprovalModal
├── workspace/                  # Folder kerja terisolasi tempat agen membangun proyek 2.5D (workspace/office-next)
├── docs/                       # Dokumentasi arsitektur, desain, prompt, dan rencana pengembangan
├── office.config.json          # Konfigurasi kursi agen, model, fallback, dan batas kuota harian
└── .mcp.json                   # Konfigurasi MCP workspace
```

---

## 3. Cara Menjalankan Proyek

### Prasyarat
- **Node.js** `>= 22.5.0` (menggunakan modul bawaan `node:sqlite`)
- **OpenAI-Compatible LLM Gateway** aktif sesuai konfigurasi `.env`

### Langkah Menjalankan Semua Layanan

1. **Jalankan cepat menggunakan skrip launcher:**
   ```powershell
   .\start.bat
   ```
   *(Atau hentikan semua layanan kapan saja dengan `.\stop.bat`).*

2. **Instal dependensi & jalankan verifikasi tipe/tes secara manual:**
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

## 4. Mode Keamanan (`Semi` vs `Penuh`), Scanner Deterministik & Sandbox Workspace

- **Isolasi Path (`workspace/`):** Seluruh operasi baca/tulis file oleh agen (`read_file`, `write_file`, `edit_file`) dikunci di dalam `workspace/`. Upaya keluar direktori (`..`) atau menyentuh `.env` / `.git/config` otomatis ditolak dan dicatat ke `audit`.
- **Pemindai Keamanan Deterministik (`security_scan`):** Sebelum setiap auto-commit dan auto-push, pemindai memeriksa keberadaan dan pengabaian `.env`, aturan `.gitignore`, kebocoran kunci/token rahasia, dan matriks izin peran. Temuan `HARD` otomatis memblokir push tanpa membocorkan nilai rahasia ke model.
- **Whitelist Perintah (`run_command`):** Hanya mengizinkan `npm`, `npx`, `node`, `git`, `python`, `tsc`, dan `vitest` tanpa shell interpolation.
- **Mode `Semi` (Default):** Perintah `run_command` memunculkan kartu **Menunggu Izin CEO** di panel kanan dan modal persetujuan (`Setujui [Y]` / `Tolak [N]`).
- **Mode `Penuh`:** Perintah yang berada di dalam *whitelist* dieksekusi langsung tanpa menunggu klik CEO.

---

## 5. Indeks Dokumentasi Proyek

- [docs/plans/](file:///P:/gemini-lab/office/docs/plans/README.md) — Arsip dokumen analisa awal, riset, dan cetak biru arsitektur.
- [docs/ARCHITECTURE.md](file:///P:/gemini-lab/office/docs/ARCHITECTURE.md) — Dokumentasi teknis arsitektur sistem, alur data, API HTTP/SSE, dan MCP.
- [docs/DESIGN.md](file:///P:/gemini-lab/office/docs/DESIGN.md) — Spesifikasi sistem desain visual *Meja Dispatch*.
- [docs/PROMPTS.md](file:///P:/gemini-lab/office/docs/PROMPTS.md) — Spesifikasi *system prompt* Bahasa Indonesia untuk kursi karyawan AI.
- [docs/seat-matrix.md](file:///P:/gemini-lab/office/docs/seat-matrix.md) — Matriks kursi karyawan AI & alokasi beban kerja.
- [docs/toolbox.md](file:///P:/gemini-lab/office/docs/toolbox.md) — Inventaris CLI, MCP, dan skill pendukung.
