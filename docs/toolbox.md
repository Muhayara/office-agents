# Toolbox & Referensi — Office Agents

*Aset, referensi desain, skill, dan agent yang layak dipakai untuk proyek kantor AI 2.5D. Diverifikasi 10 November 2026.*

**Kesimpulan singkat**

1. **Tidak ada tile set kantor isometrik modern yang gratis dan lengkap.** Yang gratis itu kulit bangunan (Kenney, Screaming Brain), bukan furnitur kantor. Ini harus diputuskan sebelum F3.
2. **Jiro & Refero memang punya MCP**, tapi domainnya web/landing page — berguna untuk UI panel, **tidak** untuk isometric game HUD. Mobbin bagus tapi berbayar.
3. **Skill yang paling mengubah hasil:** Superpowers (alur plan→TDD→review), Playwright MCP (verifikasi UI nyata), Context7 (dokumentasi Phaser/React terbaru). Tiga ini dipasang dulu.
4. **MCP game-dev resmi masih buruk** (Phaser/Tiled/Aseprite). Jangan dipasang; pakai Context7 + Playwright + debug handle.
5. **Screenshot referensi harus di-pin**, bukan diserahkan ke selera agent. Struktur `references/` + `docs/DESIGN.md` ada di §6.

---

## 1. Aset Visual — status lisensi

| Sumber | URL | Lisensi | Untuk apa | Catatan |
|---|---|---|---|---|
| Kenney — Isometric Tiles Buildings | https://kenney.nl/assets/isometric-tiles-buildings | **CC0** | Shell bangunan, dinding, lantai isometrik | Gaya 2014, tanpa furnitur interior |
| Kenney — Isometric Tiles City | https://kenney.nl/assets/isometric-tiles-city | **CC0** | Blok eksterior | Bukan interior |
| Kenney — Isometric Miniature Prototype / Library | https://kenney.nl/assets/isometric-miniature-prototype | **CC0** | Diorama ruangan mini (60 & 35 file) | Paling dekat ke "ruangan", tapi set kecil |
| Kenney — Furniture Kit | https://kenney.nl/assets/furniture-kit | **CC0** | 140 model furnitur **3D** | Harus dirender jadi sprite (§2) |
| Kenney — UI Pack / Interface Sounds / Game Icons | https://kenney.nl/assets/ui-pack | **CC0** | HUD, panel, suara klik | 430 elemen UI, 100 suara |
| Screaming Brain — Iso Town Pack | https://screamingbrainstudios.itch.io/iso-town-pack | **CC0** | 443 tile 2:1 iso yang benar | Shell, bukan interior |
| Poly Haven | https://polyhaven.com | **CC0** (aset) | Tekstur/PBR/HDRI untuk render | **API** wajib kredit "Powered by Poly Haven" + User-Agent unik |
| ambientCG | https://ambientcg.com | **CC0** | Material PBR lantai/dinding | — |
| Quaternius | https://quaternius.com | ⚠️ **QAL v1.0, bukan CC0** | Karakter low-poly + animasi | Boleh komersial, **tidak boleh redistribusi aset**; halaman paket lama masih menulis CC0 — jangan percaya |
| LimeZu — Modern Office / Interiors | https://limezu.itch.io/modernoffice | **Berbayar $1.5–5**, kredit wajib | Furnitur kantor terbaik | **Top-down 16×16**, bukan isometrik |
| Sprout Lands | https://cupnooble.itch.io/sprout-lands-asset-pack | Gratis = **non-komersial** | — | Versi komersial $3.99 |
| OpenGameArt LPC | https://opengameart.org | **CC-BY-SA 3.0** | Karakter top-down | Share-alike: turunan ikut CC-BY-SA |

**Jebakan lisensi:** Quaternius QAL (no redistribution) · LimeZu wajib kredit · Sprout gratis = non-komersial · LPC share-alike · Poly Haven API wajib kredit · Mobbin/Refero lisensi per-user, screenshot-nya tidak boleh didistribusikan.

---

## 2. Keputusan Aset yang Harus Diambil (sebelum F3)

Tiga jalur realistis:

| Jalur | Cara | Hasil | Biaya kerja | Rekomendasi |
|---|---|---|---|---|
| **A. 3D → sprite iso** | Blender + Kenney Furniture Kit/Quaternius → render ortho 2:1 → sprite 128×64 | Paling bagus, konsisten, bisa ganti furnitur | Tinggi (pipeline render sekali) | **Untuk "wow"** — pilih ini bila visual penting |
| **B. Tile Kenney + furnitur digambar** | Tile CC0 + furnitur prosedural/texture sendiri | Cepat, aman lisensi | Sedang | **Fallback** yang paling aman |
| **C. Top-down pixel (LimeZu)** | Beli paket, karakter top-down | Cepat & kaya furnitur | Rendah | Hanya bila rela meninggalkan isometrik |

Catatan penting: **plan v3 memilih Phaser isometrik**, jadi jalur C berarti mundur dari keputusan itu. Saya sarankan **A sebagai target, B sebagai jaring pengaman**, diputuskan di awal F3 — jangan menulis kode scene sebelum asetnya jelas.

---

## 3. Referensi Desain (untuk agent maupun untuk Anda)

| Situs | Isi | Gratis? | Akses agent | Cocok untuk proyek ini |
|---|---|---|---|---|
| **jiro.build** | 1.464 template/section + prompt | Freemium, banyak "Premium" | ✅ **MCP** di https://jiro.build/mcp | UI landing/panel, **bukan** game HUD |
| **styles.refero.design** | 2.000+ `DESIGN.md` sistem desain | Gratis browsing (Beta) | MCP berbayar (Pro/Team) | ⭐ Token warna/tipografi untuk UI gelap |
| **mobbin.com** | 600.000+ layar produk nyata | **Berbayar** | MCP (Pro/Team) | ⭐ Alur chat/kanban/dashboard |
| **designspells.com** | Arsip micro-interaction | Gratis | Tidak ada API | Detail animasi panel/notifikasi |
| **supahero.io** | ~150 hero section | Gratis | Tidak ada | Minor; bukan prioritas |
| **Game UI Database** | https://www.gameuidatabase.com | Gratis | — | ⭐ HUD game gelap, ikon status, dialog |
| **Interface In Game** | https://interfaceingame.com | Gratis | — | 6.000+ menu/dialog game |
| Dribbble / Behance "isometric office" | Inspirasi komposisi ruangan | Gratis | — | ⭐ Referensi tata letak kantor |

**Aturan pakai:** pilih **6–10 gambar hero** lalu pin di `references/03_ui/` / `references/02_renders/`. Jangan menyuruh agent "cari yang bagus" — itu sumber output generik.

---

## 4. Skill & Agent — Pasang Sekarang

| Nama | URL | Lisensi | Kenapa penting di proyek ini | Status |
|---|---|---|---|---|
| **Superpowers** | https://github.com/obra/superpowers | MIT | Memaksa alur brainstorming → plan → TDD → subagent → code review. Ini yang menjaga proyek 3–4 minggu tidak jadi kacau | ✅ aktif |
| **Anthropic skills** (`frontend-design`, `webapp-testing`, `mcp-builder`) | https://github.com/anthropics/skills | ⚠️ SPDX tidak tercantum — baca LICENSE sebelum dipakai produksi | `mcp-builder` langsung berguna karena kita menulis MCP server; `webapp-testing` untuk verifikasi UI | ✅ isi terverifikasi |
| **claude-plugins-official** | https://github.com/anthropics/claude-plugins-official | Apache-2.0 | `code-review`, `feature-dev`, `commit-commands` | ✅ |
| **Playwright MCP** | https://github.com/microsoft/playwright-mcp | Apache-2.0 | Verifikasi UI nyata dari agent. **Catatan canvas:** Phaser canvas tidak terbaca accessibility tree → pakai screenshot + klik koordinat + expose `window.__game` untuk assert state | ✅ |
| **Context7** | https://github.com/upstash/context7 | MIT | Dokumentasi Phaser 3.x / React 19 / Vite terbaru; data latih model sering basi | ✅ |
| **dbhub** | https://github.com/bytebase/dbhub | MIT | Inspeksi SQLite `office.db` (schema, seed) tanpa menulis query manual; ada `--readonly` | ✅ |
| **engram** | https://github.com/Gentleman-Programming/engram | MIT | SQLite + FTS5 untuk memori agent; sekaligus contoh desain tabel memori kita | ✅ |

**Command pemasangan (Claude Code):**
```
/plugin install superpowers@claude-plugins-official
/plugin marketplace add anthropics/skills
claude mcp add playwright npx @playwright/mcp@latest
```

**Di harness ini (DSH):** yang langsung tersedia adalah **subagent + workflow + skill filesystem**. Dari katalog resmi lokal ada bundle eksperimental yang relevan: **Agent Teams**, **worktree/forge**, **session-search**, dan **plugin market**. Bundle `dsh-subagent-claude-code` / `dsh-subagent-codex` ada di katalog tapi **belum tersedia untuk platform ini**; `cua-bundle` juga unsupported. Jangan pasang plugin komunitas — yang ditemukan hanya repo 0 bintang berumur dua hari.

---

## 5. Jangan Dipasang (jebakan)

| Kandidat | Alasan |
|---|---|
| **Phaser MCP resmi** | Terakhir diperbarui Sep 2025, untuk Phaser Editor bukan runtime, tanpa lisensi jelas |
| **Tiled / LDtk MCP** | Repo 6 bintang, satu commit — ditinggalkan. Pakai format JSON + codegen sendiri |
| **Aseprite MCP** | Immature; pakai CLI `aseprite -b --script` di CI |
| **Jiro untuk game HUD** | Domainnya landing page; HUD isometrik butuh referensi game (Game UI Database) |
| **Plugin pack komunitas DSH** | 0 bintang, dibuat 2 hari lalu, mem-pin kernel rc — risiko |
| **AutoGen / CrewAI sebagai runtime** | Pola peran-crew tidak cocok untuk 5 karyawan tetap; ambil polanya, bukan framework-nya |

---

## 6. Struktur Referensi yang Bisa Dibaca Agent

```
references/
  00_manifest.json        # url, lisensi, atribusi, tanggal, sha256 — mesin-dulu
  01_tiles/               # tile set CC0 + LICENSE.txt per sumber
  02_renders/             # render 3D → sprite, gambar referensi ruangan
  03_ui/                  # dashboard, chat, kanban, HUD game
  local/                  # gitignored: screenshot berlisensi per-user
docs/DESIGN.md            # token, proyeksi, aturan visual
CREDITS.md                # digenerate dari manifest
.mcp.json                 # daftar MCP server proyek
```

Contoh `00_manifest.json`:
```json
{
  "assets": [
    {
      "name": "kenney-isometric-tiles-buildings",
      "url": "https://kenney.nl/assets/isometric-tiles-buildings",
      "license": "CC0-1.0",
      "attribution": false,
      "downloaded": "2026-11-10",
      "files": ["01_tiles/kenney_iso_buildings/"]
    }
  ]
}
```

`docs/DESIGN.md` minimal memuat: proyeksi (2:1), ukuran tile (64×32 / 128×64), palet (hex), 5 aturan visual yang tidak boleh dilanggar, dan daftar gambar hero yang di-pin. Ini yang membuat agent menghasilkan gaya konsisten alih-alih "slop".

---

## 7. Pola Multi-Agent yang Layak Ditiru

| Sumber | Pola | Dipakai untuk |
|---|---|---|
| LangGraph (MIT) | Supervisor graph, `interrupt` untuk approval manusia, checkpointer durable | ApprovalGate + run yang bisa dilanjutkan setelah restart |
| OpenAI Agents SDK (MIT) | Handoff antar-agent + tracing per span | Pencatatan token/latensi per karyawan |
| a16z ai-town | Tick engine deterministik terpisah dari langkah agent | Scheduler kantor yang tidak memblokir LLM |
| pixel-agents (MIT) | Satu event bus → state sprite | Sinkronisasi kantor 2.5D |

**Wajib:** batas token/tool-call per karyawan. Tanpa itu, 5 loop bisa menghabiskan kuota gratis dalam satu jam.

---

## 8. Tumpukan Verifikasi (standar 2026)

- **Vitest** — unit/komponen, native Vite.
- **Playwright Test** — e2e lewat WebSocket + `toHaveScreenshot` untuk baseline visual kantor.
- **@axe-core/playwright** — a11y pada overlay React (bukan canvas).
- **Lighthouse CI** — anggaran performa; risiko terbesar adalah ukuran bundle Phaser.

---

## 9. Checklist Sebelum Mulai F1

- [ ] Pasang **Superpowers** + skill `frontend-design`, `webapp-testing`, `mcp-builder`.
- [ ] Pasang **Playwright MCP**, **Context7**, **dbhub**.
- [ ] Buat `references/` + `docs/DESIGN.md`, pin 6–10 gambar hero.
- [ ] Unduh paket **CC0**: Kenney Isometric Tiles, Furniture Kit, UI Pack, Interface Sounds; Screaming Brain Iso Town.
- [ ] Putuskan jalur aset **A / B / C** (§2).
- [ ] Baru jalankan **F0** (verifikasi 9router, model, Claude Desktop MCP, Claude Code→9router).

---

## 10. Sumber

[Kenney](https://kenney.nl/assets/tag:isometric) · [Quaternius license](https://quaternius.com/license) · [Poly Haven](https://polyhaven.com/license) · [ambientCG](https://docs.ambientcg.com/license) · [Screaming Brain](https://screamingbrainstudios.itch.io/iso-town-pack) · [LimeZu](https://limezu.itch.io/modernoffice) · [Jiro MCP](https://jiro.build/mcp) · [Refero Styles](https://styles.refero.design) · [Mobbin MCP](https://mobbin.com/mcp) · [Design Spells](https://www.designspells.com) · [Game UI Database](https://www.gameuidatabase.com) · [Superpowers](https://github.com/obra/superpowers) · [Anthropic skills](https://github.com/anthropics/skills) · [Playwright MCP](https://github.com/microsoft/playwright-mcp) · [Context7](https://github.com/upstash/context7) · [dbhub](https://github.com/bytebase/dbhub) · [engram](https://github.com/Gentleman-Programming/engram) · [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) · [ai-town](https://github.com/a16z-infra/ai-town)
