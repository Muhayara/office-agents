# @office/shared

Kontrak tunggal antara `apps/server` dan `apps/web`. Semua tipe wire, konfigurasi, tool, dan envelope ada di sini. **Tidak ada logika bisnis dan tidak ada I/O** — paket ini murni skema + helper.

## Pakai

```ts
import {
  OfficeConfigSchema, parseOfficeConfig,
  ServerEventSchema, type ServerEvent,
  ClientCommandSchema, type ClientCommand,
  StateSnapshotSchema, type StateSnapshot,
  TOOL_DEFINITIONS, toOpenAITools, validateToolInput,
  EnvelopeSchema, extractEnvelope, actionToTool,
  TASK_TRANSITIONS, canTransitionTask,
} from '@office/shared';
```

Diasumsikan root repo memakai npm workspaces:

```json
{ "workspaces": ["apps/*", "packages/*"] }
```

Paket ini **tidak di-build**. `exports` menunjuk langsung ke `src/index.ts`, jadi jalankan server/web dengan `tsx`/Vite (bukan `node` polos pada file `.ts` di dalam `node_modules`). Import relatif antar-file ditulis tanpa ekstensi, cocok untuk `moduleResolution: "Bundler"`.

## Isi

| File | Isi |
|---|---|
| `src/events.ts` | Enum status/peran, `StateSnapshot`, event server, command klien, tipe entitas (`AgentView`, `Task`, `Message`, `Approval`, `Project`, `Usage`) |
| `src/config.ts` | Skema `office.config.json` (office, gateway, limits, agents) + validasi silang |
| `src/tools.ts` | 19 tool kantor: skema Zod, JSON Schema untuk function-calling, validasi input |
| `src/envelope.ts` | Fallback JSON `{ say, emotion, actions }`, ekstraksi dari teks, pemetaan ke tool |
| `src/index.ts` | Re-export + versi skema + urutan status + aturan transisi tugas |

## Aturan penting

- **Server adalah satu-satunya penulis** state; klien mengirim `ClientCommand`, menerima `ServerEvent`.
- **Jangan menambah field baru tanpa menaikkan `SCHEMA_VERSION`** di `src/index.ts`.
- **Jangan mengubah nama tool** tanpa memperbarui `docs/PROMPTS.md` dan `apps/server`.
- Semua timestamp ISO-8601 UTC (`new Date().toISOString()`).
- `AgentView.quota.cap === 0` berarti tanpa batas (kursi manual).
- `seat.driver === "manual"` wajib punya `channel`; kursi manual tidak punya `dailyCap` efektif.

## Versi

`SCHEMA_VERSION = "1.0.0"`. Perubahan breaking (menghapus/mengganti nama field atau tool) menaikkan versi minor; penambahan field opsional menaikkan patch.

Spec pendukung: [`docs/DESIGN.md`](../../docs/DESIGN.md) dan [`docs/PROMPTS.md`](../../docs/PROMPTS.md).
