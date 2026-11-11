# Analisa Referensi: Threads + 2 Repo GitHub (11 Nov 2026)

Sumber: 7 link Threads (6 terbaca, 1 mati/404), `davila7/claude-code-templates`, `anthropics/skills`.
Status temuan: yang ditandai **[terverifikasi]** dibaca langsung; **[klaim]** hanya pengakuan penulis post.

---

## 1. Threads

| # | Penulis | Isi | Relevansi |
|---|---|---|---|
| 1 | @wbwcihuy | Virtual office AI mirip kita: CEO (user), Manager "Raka", HRD yang bisa membuat agen baru ("magang → kartap"), 30 agen, ruang rapat, manager menghampiri meja agen yang macet. Alur kerja: brainstorm di ChatGPT → file `.md` → coding via Claude Code. Biaya terbesar ada di testing karena token API. Dashboard menampilkan budget per proyek (`$2.76 / $10.00`). **[klaim]** | **Tinggi.** Konsepnya sama persis dengan kita. |
| 2 | @miqdadbadjuber | Skill "anti-slop" (38 aturan) agar output UI, copy, dan kode tidak generik. Pasang via `npx antislop-ai`. Penulis menyebut sudah ada plugin Antigravity. **[klaim]** | Sedang. Berguna untuk agen UI dan penulis. |
| 3 | @heytanzil | Daftar referensi desainer: jiro.build, navbar.gallery, footer.design, cta.gallery, styles.refero.design | Rendah. Kita sudah memasang MCP `jiro`. |
| 4 | (tidak diketahui) | **404, link mati** | Tidak ada. |
| 5 | @oversightstudio | supply.madebyoversight.com: 192+ referensi website dan 70 section siap salin untuk Claude | Rendah. Untuk web biasa, bukan game isometrik. |
| 6 | @nabhansq | promptedsite.com (prompt + kode situs 3D), shadcn/ui, reactbits, kokonutui, dll. | Rendah-sedang untuk polesan UI. |
| 7 | @petriv_olga | prettysites.io, mobbin.com, godly.website, minimal.gallery | Rendah. Mobbin sudah punya skill di mesin ini. |

**Pelajaran dari Thread 1 yang layak diadopsi:**
1. **Budget per proyek** di dashboard. Kita sudah punya `UsageMeter`, tinggal ditampilkan per proyek.
2. **Agen HRD** yang membuat agen baru. Menarik, tapi menambah agen otomatis akan membakar kuota. Hanya aman dengan Approval Gate dan batas jumlah.
3. **Rapat sebelum kerja** dan **manager menghampiri agen yang macet**. Itu sudah ada di blueprint 2.5D kita, tinggal dihubungkan ke event `agent.status`.
4. **Layout kantor dirancang dulu** (jumlah meja, ruang manager, ruang rapat, kafetaria) sebelum dibuat visualnya.

**Catatan:** referensi desain di #3, #5, #6, #7 pada dasarnya untuk situs web. Untuk 2.5D isometrik, aset yang lebih cocok adalah sprite dan tileset isometrik gratis. Karena itu saya sarankan sprite dibuat prosedural (SVG/Canvas) oleh agen artis, bukan menyalin template web.

---

## 2. `davila7/claude-code-templates` **[terverifikasi]**

- Katalog 1.980+ komponen Claude Code (skills, subagents, commands, hooks, MCP, settings). Pasang dengan `npx claude-code-templates@latest`. Lisensi MIT. README mencantumkan sponsor (Swiftproxy), jadi bacalah sebagai README produk.
- Kategori agen yang relevan: `game-development`, `ui-analysis`, `accessibility`, `realtime`, `development-team`, `performance-testing`, `deep-research-team`, `documentation`.
- **Batasan penting:** komponen ini berformat Claude Code. Agen kita berjalan lewat driver API 9router dengan prompt sendiri, jadi tidak bisa "install lalu jalan". Pemakaian yang realistis:
  1. **Bahan prompt** untuk `docs/PROMPTS.md` (misalnya agen `game-development`).
  2. **Driver CLI Claude** di Fase 3 (`claude -p` sudah lulus tes), di mana komponennya berfungsi apa adanya.
- Sebelum memasang apa pun dari katalog publik, baca isinya dulu. Repo ini sendiri memakai pemindai keamanan, tapi itu bukan jaminan.

## 3. `anthropics/skills` **[terverifikasi]**

19 skill resmi (Apache 2.0 untuk sebagian besar): `frontend-design`, `canvas-design`, `algorithmic-art`, `web-artifacts-builder`, `webapp-testing`, `mcp-builder`, `skill-creator`, `theme-factory`, `claude-api`, `docx/pdf/pptx/xlsx`, dan lainnya.

- Sudah terpasang di kita: `frontend-design`, `mcp-builder`, `webapp-testing`.
- **Baru dan relevan untuk 2.5D:** `canvas-design` dan `algorithmic-art` (seni dan grafis berbasis kode), `web-artifacts-builder`, `skill-creator`.
- Format skill (folder + `SKILL.md`) sama dengan skill di mesin ini. **Celah:** agen kita belum membaca skill. Perlu fitur kecil di `prompts.ts` untuk menyuntikkan `SKILL.md` yang relevan ke system prompt per peran.

---

## 4. Usulan penambahan agen untuk 2.5D

Batas kuota dan `maxConcurrent = 2` membuat 8 agen sekaligus tidak ideal. Saya usulkan **3 agen baru**, bukan lebih:

| Kursi | Peran | Tugas | Model awal |
|---|---|---|---|
| **Gita** | `gamedev` | Engine 2.5D (Phaser/Canvas), grid isometrik, kamera, pergerakan agen | `ag/claude-sonnet-5-5-high` |
| **Wulan** | `artist` | Sprite/tile prosedural (SVG/Canvas), palet sesuai `DESIGN.md`, animasi dasar | `ag/gemini-3.8-flash-high` |
| **Fajar** | `visual-qa` | Uji visual dengan Playwright (screenshot, cek console), melapor ke Laras | `ag/gemini-3.8-flash-high` |

Ditunda: **HRD** yang membuat agen baru, sampai batas jumlah agen dan persetujuan CEO dirancang.

**Dampak teknis:** peran baru menyentuh `packages/shared` (enum peran, `FILE_WRITING_ROLES`, `DEFAULT_AGENTS`), `docs/PROMPTS.md`, `office.config.json`, dan teks "Employee Seats (5)" di UI. Paket `shared` dan dua dokumen itu dikerjakan DeepSeek Harness, jadi perubahannya perlu dicatat di `docs/deepseek-sync.md`.
