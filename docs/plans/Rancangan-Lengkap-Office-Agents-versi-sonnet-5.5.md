# Rancangan Lengkap Office Agents

*Kantor virtual 2D/2.5D/3D tempat beberapa AI berbeda bekerja sebagai karyawan · Versi 1.0 · 10 November 2026*

## 1. Ringkasan

Tujuan proyek: membangun kantor virtual tempat beberapa agent AI dari model berbeda (Gemini, GLM, Claude, dan lainnya) bekerja sebagai karyawan. Kamu bisa memerintah satu agent atau semuanya, dan para agent saling berkomunikasi seperti kantor sungguhan.

**Keputusan kunci**

- Model-model itu tidak terhubung langsung satu sama lain. Yang menghubungkan adalah kode kita: sebuah *office bus* (MCP server + SQLite) dan sebuah *orchestrator*.
- Satu harness untuk semua agent otomatis: **OpenCode** (open source, 75+ provider, mode headless `opencode run`, mendukung MCP).
- Budget $0 dan laptop biasa, jadi semua model memakai tier gratis. **Kuota harian menjadi fitur utama** (meter jatah), bukan detail belakang layar.
- Paket Claude Free tidak mencakup Claude Code. Claude mendapat **kursi manual** lewat Claude Desktop yang dihubungkan ke office bus yang sama.
- Prioritas: agent mengerjakan tugas nyata (coding/riset). Visual dibangun setelah logika stabil, dengan memakai ulang visualizer yang sudah ada.
- v1 punya 3 kursi: Manager (otomatis), Dev (otomatis), Reviewer (manual, Claude Desktop).

## 2. Tujuan, Batasan, dan Kriteria Sukses

### Tujuan

- Memerintah satu agent (DM), semua agent (broadcast), atau Manager yang mendelegasikan.
- Agent berkomunikasi lewat inbox, papan tugas, dan laporan.
- Menyelesaikan tugas nyata kecil (coding/riset) di repo uji.
- Tampilan kantor 2D (nanti 2.5D/3D) yang mencerminkan aktivitas sungguhan.

### Batasan

- Budget model $0 per bulan.
- Laptop/PC biasa tanpa GPU besar: model lokal hanya untuk tugas ringan.
- Paket Claude Free (tanpa Claude Code).
- 2–3 agent bersamaan di versi pertama.

### Kriteria sukses v1

1. Satu perintah ke Manager dipecah menjadi minimal 2 tugas. Dev mengerjakan di branch sendiri, hasilnya direview, dan laporan akhir muncul tanpa intervensi manual di tengah.
2. Perintah `@dev` dan `@all` bekerja.
3. Meter jatah akurat, dan agent berhenti dengan rapi saat jatah habis.
4. Semua pesan dan aksi tercatat dan bisa diputar ulang.

## 3. Prinsip Desain

1. **Orchestrator, bukan telepati.** Pesan antar model selalu lewat bus yang kita kendalikan.
2. **Satu harness.** Semua agent otomatis dipanggil dengan cara yang sama, hanya model dan peran yang berbeda.
3. **Bus berbasis file.** Satu file SQLite bersama, supaya agent otomatis dan Claude Desktop (proses terpisah) melihat state yang sama.
4. **Kuota sebagai fitur.** Jatah dihitung, ditampilkan, dan menentukan perilaku agent.
5. **Visual = cermin event.** Visual hanya membaca event, tidak menjalankan logika, sehingga renderer bisa diganti tanpa mengubah inti.
6. **Manusia di jalur untuk aksi berisiko.** Perintah shell, hapus file, dan push butuh persetujuan.
7. **Mulai kecil.** 3 kursi dulu, lalu tambah.

## 4. Fakta Lapangan (per 10 November 2026)

Aturan dan kuota berubah cepat. Verifikasi ulang angka-angka ini pada Fase 0.

### 4.1 Kuota gratis

| Sumber | Batas | Catatan |
| --- | --- | --- |
| Gemini API key gratis | 250 request/hari, hanya Flash | Jalur gratis lewat akun Google untuk Gemini CLI sudah ditutup |
| OpenRouter model `:free` | 20 request/menit; 50 request/hari jika belum pernah membeli kredit | Naik ke 1.000/hari setelah pembelian kredit sekali (di luar budget $0). Model gratis bisa berganti tanpa pemberitahuan, dan loop retry bisa menghabiskan jatah |
| Cerebras (tier gratis) | sekitar 1 juta token/hari | Angka sering berubah |
| Model lokal (Ollama) | tergantung hardware | Laptop biasa: model kecil saja |
| Claude Free | chat terbatas | Tanpa Claude Code |

### 4.2 Aturan akses Claude

- Paket Free tidak mencakup Claude Code. Batas minimum adalah Pro ($20/bulan).
- Untuk paket berbayar, halaman bantuan Anthropic (diperbarui 7 Oktober 2026) menyatakan `claude -p` dan Agent SDK yang login dengan plan tetap memakai limit langganan. Rencana penagihan terpisah yang diumumkan Juni dijeda.
- Jangan memberikan token OAuth langganan ke klien selain Claude Code, dan jangan memakai tool yang menyamar sebagai Claude Code. Ada laporan akun diblokir.
- Claude Desktop mendukung server MCP lokal (lewat `claude_desktop_config.json` atau ekstensi). Konektor remote di paket Free dibatasi satu.

### 4.3 Gemini

Akses gratis Gemini CLI lewat akun Google dihentikan pada 18 Juni 2026 dan dialihkan ke Antigravity CLI. Untuk proyek ini jalur yang cocok adalah **API key gratis dari AI Studio**, dipanggil lewat OpenCode.

### 4.4 GLM (Z.ai)

Coding Plan mulai sekitar $3/bulan dan terhubung ke OpenCode serta Claude Code. Paketnya hanya untuk tool yang didukung resmi, dan GLM-5.3 tidak punya tier hosted gratis. Bukan bagian v1 karena budget $0, tetapi jadi langkah upgrade pertama.

### 4.5 Protokol

MCP menghubungkan agent ke tools dan sudah menjadi standar de facto. A2A menghubungkan agent ke agent lintas vendor, tetapi pemakaian di luar enterprise masih jarang. **v1 memakai MCP saja.** A2A hanya dipertimbangkan jika agent harus berjalan lintas mesin atau organisasi.

## 5. Arsitektur

```
Console web (kamu)
  @dev ... | @all ... | tanpa mention -> Manager
        |
        | WebSocket / HTTP
        v
Orchestrator (Python)  <---- event ---->  Visual (2D, lalu 2.5D/3D)
  - loop per agent
  - meter jatah
  - spawn proses
        |
        | subprocess: opencode run --model provider/model "prompt"
        v
+-----------+   +-----------+   +--------------------+
| Manager   |   | Dev       |   | Reviewer (manual)  |
| Gemini    |   | model     |   | Claude Desktop     |
| Flash     |   | :free     |   | (kamu yang chat)   |
+-----+-----+   +-----+-----+   +----------+---------+
      |               |                    |
      +---- MCP ------+-------- MCP -------+
                      |
                Office Bus (MCP server)
                      |
           SQLite (WAL) + git worktree per agent
```

## 6. Spesifikasi Komponen

### 6.1 Office Bus (MCP server + SQLite)

**Tools yang diekspos**

- `send_message(to, body, thread_id?)`
- `read_inbox(agent, mark_read=true)`
- `create_task(title, description, assignee?, parent_id?)`
- `list_tasks(status?, assignee?)`
- `claim_task(task_id, agent)`
- `update_task(task_id, status, note)`
- `post_report(task_id, summary, artifacts[])`
- `request_review(task_id, reviewer)`
- `get_budget(agent)`

**Skema SQLite (sketsa)**

- `agents(id, role, model, status, last_seen)`
- `messages(id, thread_id, sender, recipient, body, created_at, read_at)`
- `tasks(id, parent_id, title, description, assignee, status, branch, created_by, created_at, updated_at)`
- `task_events(id, task_id, actor, kind, payload, created_at)`
- `usage(agent, day, requests, tokens_est)`
- `events(id, ts, kind, payload)` untuk visual dan replay

**Status tugas:** `todo` → `claimed` → `in_progress` → `review` → `done` atau `blocked`.

**Catatan teknis:** aktifkan mode WAL dan `busy_timeout`. Setiap klien MCP (OpenCode, Claude Desktop) menjalankan proses server-nya sendiri, tetapi semuanya membaca dan menulis file SQLite yang sama.

### 6.2 Adapter agent (OpenCode)

- Panggilan headless: `opencode run --model <provider/model> "<prompt>"`. Format model selalu `provider/model`, dan prompt adalah argumen posisional (tanpa stdin).
- Prompt dirakit dari: peran, tugas aktif, pesan inbox, dan aturan kerja.
- Setiap agent punya direktori kerja sendiri (git worktree) supaya tidak saling menimpa file.
- Setiap panggilan punya timeout, batas panggilan beruntun, dan output yang disimpan ke log.
- Office MCP server didaftarkan di konfigurasi OpenCode (blok `mcp`). Sintaks persisnya diverifikasi pada Fase 0 dari dokumentasi OpenCode.

### 6.3 Orchestrator

Loop inti (pseudocode):

```
tiap tick (mis. 5 detik):
  untuk setiap agent otomatis:
    jika budget_habis(agent): status = offline; lanjut
    pesan = bus.ambil_inbox(agent)
    tugas = bus.tugas_aktif(agent)
    jika tidak ada pesan dan tidak ada tugas: status = idle; lanjut
    prompt = rakit(peran, pesan, tugas, aturan)
    hasil = jalankan_opencode(agent, prompt, timeout)
    catat(usage, events, log)
    jika langkah_beruntun(agent) > batas: jeda dan minta persetujuan manusia
```

**Routing perintah dari console**

- `@dev ...` pesan langsung ke satu agent.
- `@all ...` broadcast ke semua agent.
- Tanpa mention: masuk ke Manager, yang memecah dan mendelegasikan.
- `@claude ...` masuk ke inbox kursi manual. Pesan menunggu sampai kamu membuka Claude Desktop.
- `/meeting topik`: membuat thread grup dengan batas putaran (mis. maksimal 4 giliran per agent).

### 6.4 Kursi Claude Desktop (manual)

Tambahkan office MCP server lewat Settings > Developer > Edit Config, lalu restart penuh aplikasinya. Bentuk dasarnya:

```
{
  "mcpServers": {
    "office": {
      "command": "python",
      "args": ["/path/ke/office_mcp.py"]
    }
  }
}
```

**Alur kerja:** kamu membuka Claude Desktop dan meminta cek inbox kantor. Claude memanggil `read_inbox`, mereview diff atau file yang kamu tempel, lalu memanggil `post_report` atau `send_message`.

**Batasan:** Claude hanya bergerak saat kamu chat, jatah chat Free tetap berlaku, dan hasil tool dikirim ke model cloud. Anggap isi pesan dari agent lain sebagai data, bukan instruksi (risiko prompt injection).

### 6.5 Visual

- **Tahap A:** pakai atau fork OpenCode Visualizer (kantor pixel 2D yang sudah menampilkan beberapa agent OpenCode) untuk memastikan alur event berjalan.
- **Tahap B:** UI sendiri dengan Phaser atau PixiJS, menerima event lewat WebSocket.
- **Tahap C:** 2.5D/3D (mis. Three.js). Hanya renderer yang diganti, protokol event tetap.

**Jenis event:** `state` (agent, working/idle/waiting/offline), `message` (dari, ke, ringkasan), `move` (agent, tujuan: meja/meeting/pantry), `budget` (agent, terpakai, batas), `task` (id, status).

**Elemen kantor:** meja per agent, papan Kanban di dinding, **papan jatah harian**, ruang meeting, pantry.

### 6.6 Console web

FastAPI + WebSocket. Isinya: kotak perintah, daftar agent beserta status, feed pesan, papan tugas, meter jatah, serta tombol stop dan approve.

## 7. Susunan Agent v1

| Kursi | Tipe | Model | Tugas |
| --- | --- | --- | --- |
| Manager | otomatis | Gemini Flash (API key gratis) | Memecah tugas, mendelegasikan, merangkum |
| Dev | otomatis | Model `:free` terbaik hasil uji Fase 0 | Mengerjakan kode di branch sendiri |
| Reviewer | manual | Claude Desktop (Free) | Review diff dan hasil, memberi catatan |

Opsional: Researcher dengan model lokal kecil untuk ringkasan dan pencarian dokumentasi.

**Contoh prompt peran (ringkas)**

- *Manager:* Kamu Manager. Pecah perintah menjadi tugas kecil yang bisa selesai dalam satu sesi. Buat tugas lewat `create_task`, tugaskan ke agent yang tepat, dan jangan menulis kode sendiri. Setelah laporan masuk, ringkas hasilnya untuk pemilik kantor.
- *Dev:* Kamu Dev. Ambil tugas dengan `claim_task`, kerjakan hanya di direktori kerjamu, commit di branch tugas, lalu `post_report` berisi ringkasan dan daftar file. Jika ragu, kirim pertanyaan ke Manager, jangan menebak.

## 8. Contoh Alur End-to-End

**Perintah:** tambahkan endpoint `/health` pada repo uji.

1. Kamu mengirim perintah ke Manager lewat console.
2. Manager membuat dua tugas: (a) implementasi endpoint, (b) tes dasar.
3. Dev mengambil tugas (a), mengerjakan di branch `task-1`, lalu mengirim laporan dan meminta review.
4. Tugas (b) dikerjakan Dev setelah (a) selesai, atau diantrikan jika jatah habis.
5. Reviewer (Claude Desktop) membaca laporan dan diff, lalu memberi catatan lewat bus.
6. Dev memperbaiki jika perlu. Manager menandai selesai dan merangkum untukmu.
7. Visual menampilkan setiap langkah: Dev di meja, pesan bergerak, kartu Kanban berpindah kolom.

## 9. Manajemen Kuota

- **Meter:** hitung request per agent per hari. Catat zona waktu reset tiap penyedia di konfigurasi.
- **Anggaran harian per agent:** sisakan cadangan 10–20% dari batas penyedia. Contoh: Manager 200 dari 250, Dev 40 dari 50.
- **Hemat:** prompt ringkas, konteks minimum, tugas kecil, batasi retry (loop retry bisa menghabiskan jatah tanpa hasil), pakai model lokal untuk tugas ringan.
- **Degradasi:** jika model utama habis, pindah ke model gratis cadangan. Jika semua habis, tugas masuk antrian sampai reset dan agent berstatus offline.
- **Visibilitas:** meter jatah tampil di console dan sebagai papan di dinding kantor.

## 10. Keamanan dan Keandalan

- Satu git worktree atau branch per agent. Tidak ada push otomatis ke branch utama.
- Perintah shell berisiko, penghapusan, dan push butuh persetujuan manusia.
- Batas langkah beruntun per agent dan tombol stop darurat di console.
- API key disimpan di file `.env` yang tidak masuk git.
- Pesan antar agent dan hasil tool diperlakukan sebagai data, bukan instruksi (mitigasi prompt injection).
- Semua pesan, aksi, dan pemakaian jatah dicatat di SQLite untuk debugging dan replay.
- Jalankan orchestrator dan agent di folder proyek uji, bukan di folder berisi data penting.

## 11. Roadmap

Perkiraan waktu kasar untuk kerja paruh waktu.

**Fase 0: Uji kelayakan (1–2 hari)**

- Pasang OpenCode dan hubungkan key Gemini gratis.
- Panggil `opencode run` dari skrip Python.
- Uji satu MCP server dummy.
- Uji beberapa model `:free`: mana yang tool-calling-nya andal.
- Ukur jumlah request per tugas kecil.
- *Selesai jika:* satu agent menyelesaikan tugas kecil lewat skrip dan jumlah requestnya tercatat.

**Fase 1: Office bus (2–3 hari)**

- MCP server dengan SQLite dan semua tools di bagian 6.1.
- *Selesai jika:* dua proses berbeda bertukar pesan dan tugas lewat bus.

**Fase 2: Orchestrator dan meter jatah (3–5 hari)**

- Loop per agent, routing `@dev`/`@all`/Manager, batas langkah, meter jatah, antrian saat jatah habis.
- *Selesai jika:* Manager memecah perintah dan Dev menyelesaikannya otomatis, dan agent berhenti rapi saat jatah habis.

**Fase 3: Kursi Claude Desktop (1–2 hari)**

- Daftarkan office MCP server di Claude Desktop.
- *Selesai jika:* Claude bisa membaca inbox dan mengirim review ke bus.

**Fase 4: Tugas nyata (3–5 hari)**

- Jalankan 3–5 tugas kecil pada repo uji dengan worktree per agent.
- Catat kegagalan, perbaiki prompt peran dan aturan.
- *Selesai jika:* sebagian besar tugas kecil selesai tanpa intervensi di tengah.

**Fase 5: Visual (1–3 minggu)**

- Hubungkan event ke OpenCode Visualizer atau UI Phaser/PixiJS sendiri.
- Tambahkan papan Kanban dan papan jatah. Rencanakan 2.5D/3D belakangan.
- *Selesai jika:* aktivitas nyata agent tampak di kantor secara langsung.

## 12. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Kuota gratis berubah atau habis | Agent berhenti, tugas macet | Meter jatah, model cadangan, antrian, verifikasi limit tiap minggu |
| Model gratis lemah di tool-calling | Tugas gagal atau berputar | Seleksi di Fase 0, tugas kecil, aturan ketat, review manual |
| Model gratis berganti tanpa pemberitahuan | Konfigurasi rusak | Daftar model cadangan di konfigurasi, pengecekan sebelum jalan |
| Agent saling menimpa file | Kode rusak | Worktree/branch per agent, tidak ada push otomatis |
| Loop tanpa akhir antar agent | Jatah habis | Batas giliran, batas langkah, tombol stop |
| Kebijakan akses Claude berubah | Jalur berhenti jalan | Claude hanya sebagai kursi manual di v1; cek halaman bantuan sebelum otomatisasi |
| Prompt injection lewat pesan atau hasil tool | Agent melakukan aksi tak terduga | Perlakukan sebagai data, approval untuk aksi berisiko |
| Cakupan visual membengkak | Logika tertunda | Visual setelah logika; pakai ulang visualizer yang ada |

## 13. Jalur Upgrade

1. **GLM Coding Plan (sekitar $3/bulan):** Dev lebih kuat, dipakai lewat OpenCode (tool yang didukung resmi).
2. **Kredit OpenRouter $10 sekali beli:** jatah model gratis naik ke 1.000 request/hari.
3. **Claude Pro ($20/bulan):** Claude Code tersedia, sehingga `claude -p` bisa jadi agent otomatis. Jalankan binary `claude` resmi sendiri dan cek kebijakan terbaru.
4. **Agent tambahan:** Researcher, QA, Desainer.
5. **A2A:** hanya jika agent harus lintas mesin atau organisasi.
6. **Visual 2.5D/3D.**

## 14. Struktur Repo (usulan)

```
office-agents/
  bus/            # office MCP server + skema SQLite
  orchestrator/   # loop agent, routing, meter jatah
  agents/         # prompt peran + konfigurasi per agent
  console/        # web console (FastAPI + WebSocket)
  visual/         # renderer 2D (lalu 2.5D/3D)
  workspaces/     # git worktree per agent
  data/           # file SQLite, log
  .env            # API key (tidak di-commit)
```

## 15. Checklist Hari Pertama

- [ ] Buat API key Gemini gratis di AI Studio.
- [ ] Pasang OpenCode dan jalankan satu `opencode run`.
- [ ] Buat repo uji kecil dan inisialisasi git.
- [ ] Tulis skrip Python yang memanggil OpenCode dan mencatat jumlah request.
- [ ] Daftar 3–5 model `:free` untuk diuji tool-calling-nya.
- [ ] Pasang Claude Desktop dan cek menu Settings > Developer.

## 16. Pertanyaan Terbuka

- Repo uji apa yang akan dipakai, dan dalam bahasa pemrograman apa?
- OS laptop apa? Ini memengaruhi path konfigurasi Claude Desktop dan cara menjalankan proses.
- Gaya visual yang diinginkan: pixel art, isometrik, atau 3D?
- Bahasa kerja agent: Indonesia, Inggris, atau campuran?
- Zona waktu reset kuota tiap penyedia (dicek di Fase 0).

## 17. Sumber

- OpenCode Visualizer: https://github.com/psinetron/opencode-visualiser
- Pixel Agent Desk: https://github.com/Mgpixelart/pixel-agent-desk
- pixtuoid: https://github.com/IvanWng97/pixtuoid
- Halaman bantuan Claude Agent SDK dengan plan Claude: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Claude Code dan paket Free: https://www.morphllm.com/claude-code-subscription
- Claude Desktop dan MCP: https://scalar.com/learn/mcp/connect-mcp-server-to-claude
- Kuota Gemini CLI: https://geminicli.com/docs/resources/quota-and-pricing/
- Batas OpenRouter model gratis: https://pinggy.io/blog/free\_ai\_model\_apis\_unlimited\_tokens\_openrouter/
- Perbandingan API LLM gratis: https://openrouter.ai/blog/tutorials/free-llm-apis-compared/
- GLM di Claude Code / OpenCode: https://www.developersdigest.tech/setup/zai/claude-code
- Perbandingan CLI coding agent 2026: https://inventivehq.com/blog/terminal-ai-coding-clis-compared-2026
- MCP vs A2A: https://beam.ai/agentic-insights/agent2agent-vs-mcp-2026-ai-agent-stack
