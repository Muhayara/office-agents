# Arsip Analisa & Rencana Awal (Initial Plans & Blueprints Archive)

Folder ini berisi seluruh dokumen analisa awal, riset kebutuhan, dan cetak biru arsitektur dari berbagai perspektif model AI sebelum implementasi **Office Agents** disatukan ke dalam arsitektur monorepo saat ini.

---

## Daftar File Analisa & Rencana Kerja

| No | Nama File | Penyusun / Perspektif | Fokus Utama Dokumen |
|:---:|---|---|---|
| 1 | [analisis-5-plan-office-agents-antigravity-opus-5.5.md](file:///P:/gemini-lab/office/docs/plans/analisis-5-plan-office-agents-antigravity-opus-5.5.md) | **Claude Opus 5.5 (Antigravity)** | Analisis komparatif 5 proposal awal, sintesis kelebihan/kekurangan masing-masing rancangan, dan rekomendasi keputusan arsitektur. |
| 2 | [master_blueprint_architecture_plan_hybrid_ai_virtual_office-versi-gemini-argon-4.md](file:///P:/gemini-lab/office/docs/plans/master_blueprint_architecture_plan_hybrid_ai_virtual_office-versi-gemini-argon-4.md) | **Gemini 4 Argon** | Cetak biru arsitektur *Hybrid AI Virtual Office*, pemisahan ranah server/web, dan pembagian tugas agen. |
| 3 | [Rancangan-Lengkap-Office-Agents-versi-sonnet-5.5.md](file:///P:/gemini-lab/office/docs/plans/Rancangan-Lengkap-Office-Agents-versi-sonnet-5.5.md) | **Claude Sonnet 5.5** | Rancangan komprehensif sistem antarmuka kantor virtual, tata letak visual, dan interaksi agen. |
| 4 | [master-plan-office-agents-deepseek-harness.md](file:///P:/gemini-lab/office/docs/plans/master-plan-office-agents-deepseek-harness.md) | **DeepSeek Harness** | Master plan teknis pelaksanaan proyek, definisi paket monorepo, pembagian fase (Fase 0 - Fase 3), dan protokol komunikasi agen. |
| 5 | [implementation_plan-opus-5.5-antigravity.md](file:///P:/gemini-lab/office/docs/plans/implementation_plan-opus-5.5-antigravity.md) | **Claude Opus 5.5** | Panduan implementasi teknis langkah demi langkah untuk backend, frontend, persistensi SQLite, dan server MCP. |
| 6 | [research-brief-ai-office.md](file:///P:/gemini-lab/office/docs/plans/research-brief-ai-office.md) | **Research Brief** | Riset kebutuhan dasar, persona ke-5 karyawan AI (Raka, Sari, Dimas, Bima, Laras), dan aturan kerja kantor virtual. |
| 7 | [analisis-referensi-threads-github.md](file:///P:/gemini-lab/office/docs/plans/analisis-referensi-threads-github.md) | **Antigravity (Sonnet 5.5)** | Analisa 7 link Threads dan 2 repo GitHub (`claude-code-templates`, `anthropics/skills`), serta usulan agen baru untuk 2.5D. |
| 8 | [plan-agen-baru-skill-github-keamanan.md](file:///P:/gemini-lab/office/docs/plans/plan-agen-baru-skill-github-keamanan.md) | **Antigravity (Sonnet 5.5)** | Rencana 5 agen baru (Gita, Wulan, Fajar, Satria, Tari), skill anti-slop, push GitHub otomatis, dan gerbang keamanan. **Status: disetujui sebagai rencana, eksekusi ditunda.** |

---

## Dokumen Implementasi Aktif Saat Ini

Dokumen operasional yang aktif dipakai oleh sistem saat ini berada di folder induk `docs/`:
- [docs/ARCHITECTURE.md](file:///P:/gemini-lab/office/docs/ARCHITECTURE.md) — Arsitektur teknis end-to-end yang berjalan sekarang.
- [docs/DESIGN.md](file:///P:/gemini-lab/office/docs/DESIGN.md) — Spesifikasi desain antarmuka Command Center "Meja Dispatch".
- [docs/PROMPTS.md](file:///P:/gemini-lab/office/docs/PROMPTS.md) — System prompt Bahasa Indonesia untuk ke-5 kursi agen.
- [docs/seat-matrix.md](file:///P:/gemini-lab/office/docs/seat-matrix.md) — Matriks alokasi model per kursi karyawan AI.
- [docs/f0-report.md](file:///P:/gemini-lab/office/docs/f0-report.md) — Laporan pengujian koneksi model nyata & gateway 9router.
