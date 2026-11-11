# Master Blueprint: Hybrid Multi-Agent Virtual Office (Zero-Cost / Tanpa API Berbayar)

Dokumen ini adalah rancangan teknis menyeluruh (*end-to-end blueprint*) untuk membangun **Virtual AI Office (2D/2.5D)** di mana berbagai model AI yang berbeda (**Gemini**, **Claude**, **Zhipu GLM / Z**, dan model lokal) bekerja di dalam satu gedung kantor virtual, dapat diperintah secara individu maupun rapat umum (*townhall*), serta mampu saling mengoper tugas dan menulis file proyek nyata di komputer Anda **tanpa biaya langganan API**.

---

## 1. Keputusan Arsitektur Inti (Solusi untuk 4 Titik Rawan)

Agar sistem ini tidak sekadar menjadi mainan animasi, melainkan benar-benar bisa menyelesaikan proyek di dunia nyata tanpa menguras biaya atau *hang* di tengah jalan, berikut adalah standar sistem yang ditetapkan dalam rancangan ini:

1. **Otak & Tangan (Workspace Sandbox + File Locking):**
   Agen tidak hanya mengobrol, tetapi memiliki akses ke folder khusus bernama `/workspace_output/`. Agar dua AI tidak merusak file yang sama secara bersamaan, setiap penulisan file wajib melewati **File Manager Queue** di *backend* dengan mekanisme *file-level mutex lock*.
2. **Mitigasi Limit & Kecepatan Claude (Auto-Fallback Router):**
   Karena Claude dijalankan tanpa API Key (melalui *Browser CDP Bridge* pada sesi web `claude.ai` yang sudah login), antrean ke Claude menggunakan sistem **Single-Thread Queue** (satu per satu). Jika terdeteksi *rate-limit* (kuota 5 jam habis) atau *timeout* > 60 detik, sistem otomatis mengalihkan (*fallback*) tugas Claude ke **Gemini 2.5 Pro (Free API)** atau **Qwen-Coder / DeepSeek (OpenRouter Free)** tanpa menghentikan jalannya kantor.
3. **Pencegahan Infinite Loop (Max Turn & CEO Approval Gate):**
   Setiap tugas memiliki properti `max_iterations: 3`. Jika Agen Coder dan Agen QA sudah saling melempar revisi sebanyak 3 kali, siklus dihentikan paksa dan status tugas berubah menjadi `WAITING_CEO_REVIEW` (memunculkan tanda seru merah di atas kepala Manajer untuk meminta keputusan Anda).
4. **Visual Ringan namun Interaktif (2D Pixel/Isometric Canvas + DOM UI):**
   Menggunakan **Phaser 3 (2D Top-Down/2.5D Isometric)** yang dikombinasikan dengan UI HTML/Tailwind di atasnya. Penggunaan RAM sangat hemat (< 150MB) sehingga komputer Anda tetap lancar saat menjalankan *Playwright Browser Bridge* di latar belakang.

---

## 2. Daftar "Karyawan" AI & Jalur Koneksinya (Zero-Cost Stack)

| ID Agen | Nama & Jabatan di Kantor | Model AI Utama | Metode Koneksi (Rp 0) | Peran Spesifik |
| :--- | :--- | :--- | :--- | :--- |
| `agent_pm` | **Budi (Project Manager)** | **Gemini 2.5 Flash / Pro** | Google AI Studio Free API | Menerima instruksi rapat dari CEO (Anda), memecah tugas menjadi JSON, membagi ke staf, dan merangkum laporan akhir. |
| `agent_architect` | **Siti (System Architect & Researcher)** | **Zhipu GLM-4 / Z.ai** | Zhipu Free API / Web Bridge | Merancang struktur database, mencari referensi arsitektur, dan menulis dokumentasi spesifikasi teknis. |
| `agent_coder` | **Alex (Senior Fullstack Developer)** | **Claude 3.5 / 3.7 Sonnet** | **Playwright CDP Bridge** (Web `claude.ai` tanpa API Key) | Menulis kode program utama, memperbaiki *bug* kompleks, dan menghasilkan file kode siap pakai. |
| `agent_qa` | **Rina (QA & Code Reviewer)** | **Llama-3.3-70B / Qwen-2.5-Coder** | Groq Free API / OpenRouter `:free` | Memeriksa kode buatan Alex, mencari celah *error*, dan menyetujui (`APPROVE`) atau mengembalikan (`REJECT`) pekerjaan. |

---

## 3. Arsitektur Sistem & Struktur Folder Proyek

Berikut adalah struktur direktori proyek yang memisahkan **Frontend (Visual Kantor)**, **Backend (Orchestrator & Jembatan AI)**, dan **Workspace (Hasil Kerja AI)**:

```text
ai-virtual-office/
├── backend/
│   ├── main.py                  # Server FastAPI + WebSocket Hub utama
│   ├── config.py                # Konfigurasi API gratis & port Chrome CDP
│   ├── database.py              # SQLite Manager (menyimpan state kantor & memori)
│   ├── orchestrator/
│   │   ├── state_machine.py     # Pengatur giliran bicara, delegasi, & anti-loop
│   │   ├── prompt_builder.py    # System prompt tiap jabatan + aturan output JSON
│   │   └── workspace_io.py      # Sistem tulis/baca file aman untuk hasil kerja AI
│   └── adapters/
│       ├── base_adapter.py      # Interface standar semua model AI
│       ├── gemini_adapter.py    # Koneksi ke Google AI Studio (Gratis)
│       ├── zhipu_adapter.py     # Koneksi ke Zhipu GLM / OpenRouter (Gratis)
│       └── claude_cdp_bridge.py # Otomasi Chrome DevTools Protocol (Tanpa API Key)
│
├── frontend/
│   ├── index.html               # Layar utama (Canvas Kantor + Sidebar Kontrol CEO)
│   ├── assets/                  # Sprite karakter (idle, jalan, ngetik) & tilemap kantor
│   └── src/
│       ├── game.js              # Inisialisasi Phaser.js & kamera kantor
│       ├── OfficeScene.js       # Logika pergerakan A* Pathfinding & balon chat
│       ├── AgentSprite.js       # Class karakter AI (animasi & status di atas kepala)
│       └── ws_client.js         # Koneksi WebSocket real-time ke backend Python
│
├── workspace_output/            # Folder tempat AI menyimpan file kode/dokumen nyata
├── chrome_profile/              # Profil Chrome khusus yang sudah login ke claude.ai
└── requirements.txt             # Dependensi Python (fastapi, websockets, playwright, dll)
```

---

## 4. Cara Kerja Jembatan Tanpa API Key (Playwright CDP Bridge)

Daripada membuka browser baru setiap kali ada tugas (yang pasti akan diblokir oleh Cloudflare di `claude.ai`), kita menggunakan teknik **Chrome Remote Debugging (CDP Attach)**.

### Langkah Persiapan Sekali Jalan:
1. Anda menjalankan Google Chrome biasa dengan *flag* debugging mengarah ke folder profil lokal:
   ```bash
   chrome.exe --remote-debugging-port=9222 --user-data-dir="./chrome_profile"
   ```
2. Anda login secara normal ke `https://claude.ai` (dan web AI lain yang tidak punya API gratis) satu kali saja. Sesi login akan tersimpan permanen di folder `chrome_profile`.

### Logika `claude_cdp_bridge.py` di Backend:
Saat `agent_coder` (Claude) mendapat giliran kerja dari Orchestrator:
1. Script Python menggunakan **Playwright** untuk menempel ke Chrome yang sedang terbuka (`connect_over_cdp("http://localhost:9222")`).
2. Script mencari tab `claude.ai`, lalu menyuntikkan teks *prompt* tugas ke dalam elemen `<div contenteditable="true">` (kotak input chat Claude) dan menekan tombol `Enter`.
3. Selama Claude sedang mengetik balasan di web, *backend* mengirim sinyal WebSocket `status: "TYPING"` ke layar kantor 2D sehingga karakter Alex terlihat sedang mengetik cepat di mejanya.
4. Setelah tombol *Stop Generating* di web Claude menghilang (tanda selesai menjawab), script mengambil teks balasan terakhir dari DOM HTML, mem-parsing blok JSON/kodenya, lalu meneruskannya ke kantor virtual.

---

## 5. Protokol Komunikasi Antar-Agen (JSON Envelope)

Agar Gemini, Claude, dan Z bisa saling berbicara dan menggerakkan karakter mereka di layar 2D, setiap model AI dipaksa oleh **System Prompt** untuk **selalu** membalas dalam format JSON standar berikut:

```json
{
  "thought": "CEO meminta aplikasi Todo List. Saya harus meminta Siti membuat skema DB dulu, baru Alex menulis kodenya.",
  "speech_bubble": "Oke tim! Siti, tolong rancang skema tabelnya dulu ya sebelum diserahkan ke Alex.",
  "emotion": "excited",
  "action": {
    "type": "DELEGATE_TASK",
    "target_agent_id": "agent_architect",
    "walk_to_target": true,
    "task_title": "Desain Skema Database Todo App",
    "task_instruction": "Buat struktur tabel SQLite untuk aplikasi Todo List beserta endpoint API yang dibutuhkan.",
    "file_to_write": null
  }
}
```

### Daftar `action.type` yang Didukung Orchestrator:
* `DELEGATE_TASK`: Karakter berjalan menghampiri meja `target_agent_id`, memunculkan `speech_bubble`, lalu membangunkan AI target untuk mulai bekerja.
* `WRITE_FILE`: AI menyimpan hasil kodenya ke dalam folder `/workspace_output/{nama_file}`, lalu otomatis melapor ke agen berikutnya (misal dari Coder ke QA).
* `REQUEST_REVISION`: Digunakan oleh QA (`agent_qa`). Karakter QA berjalan ke meja Coder (`agent_coder`), menjelaskan letak *bug*, dan menyuruh Coder menulis ulang.
* `REPORT_TO_CEO`: Tugas selesai! Karakter berjalan ke meja Bos (meja Anda di kantor 2D) dan membuka panel laporan hasil kerja beserta daftar file yang berhasil dibuat.

---

## 6. Skema Database Memori Kantor (`SQLite`)

Agar semua agen memiliki ingatan yang sama (*Shared Memory*), database lokal `office_memory.db` menyimpan 4 tabel utama:

1. **`agents`**:
   * `id` (TEXT PK), `name` (TEXT), `role` (TEXT), `provider` (TEXT), `status` (`IDLE` | `WALKING` | `THINKING` | `BLOCKED`), `desk_x` (INT), `desk_y` (INT).
2. **`projects`**:
   * `id` (TEXT PK), `title` (TEXT), `ceo_prompt` (TEXT), `status` (`ACTIVE` | `COMPLETED` | `NEEDS_APPROVAL`), `iteration_count` (INT), `created_at` (DATETIME).
3. **`tasks`**:
   * `id` (TEXT PK), `project_id` (TEXT), `assigned_to` (TEXT), `assigned_by` (TEXT), `instruction` (TEXT), `result_summary` (TEXT), `status` (`PENDING` | `IN_PROGRESS` | `DONE`).
4. **`office_logs` (Shared Blackboard)**:
   * `id` (INT PK), `project_id` (TEXT), `speaker_id` (TEXT), `target_id` (TEXT), `speech_text` (TEXT), `raw_payload` (TEXT), `timestamp` (DATETIME).
   *(Catatan: 10 log terakhir dari tabel ini selalu dilampirkan ke dalam prompt setiap agen agar semua karyawan tahu apa yang baru saja dibicarakan di kantor).*

---

## 7. Alur Skenario Eksekusi di Dalam Kantor

### Skenario A: Mode Perintah 1 AI (Direct Desk Click)
1. Di layar 2D, Anda mengklik karakter **Alex (Claude)** yang sedang duduk santai (`IDLE`) di mejanya.
2. Muncul jendela *Direct Chat*. Anda mengetik: *"Alex, buatkan script Python `scraper.py` untuk mengambil judul berita."*
3. WebSocket mengirim event `DIRECT_COMMAND` ke `main.py`.
4. Orchestrator langsung memanggil `claude_cdp_bridge.py` tanpa melewati Project Manager.
5. Karakter Alex berubah status menjadi `THINKING` (muncul ikon roda gigi berputar di atas kepalanya).
6. Setelah selesai, file `/workspace_output/scraper.py` tercipta di PC Anda, dan Alex membalas di balon chat: *"Bos, file `scraper.py` sudah siap di folder workspace!"*

### Skenario B: Mode Perintah Semua AI (Rapat Umum / Townhall)
1. Anda menekan tombol **"Panggil Rapat (Townhall)"** di pojok atas layar dan mengetik: *"Buatkan landing page produk kopi lengkap dengan form pemesanan."*
2. Server mengirim sinyal `MEETING_START` ke Frontend. Semua karakter (`Budi`, `Siti`, `Alex`, `Rina`) berhenti dari aktivitasnya dan berjalan (menggunakan *A* Pathfinding*) menuju kursi mengelilingi meja rapat besar di tengah ruangan.
3. **Budi (Gemini - PM)** menganalisis permintaan Anda terlebih dahulu, lalu berbicara di ruang rapat untuk membagi tugas.
4. Setelah rapat selesai (`MEETING_END`), semua karakter berjalan kembali ke meja kerja masing-masing.
5. **Siti (Zhipu - Architect)** mulai bekerja pertama kali menyusun struktur komponen HTML/CSS, lalu berjalan ke meja **Alex (Claude - Coder)** untuk menyerahkan cetak birunya.
6. **Alex** menulis kode `index.html` dan `app.js` ke folder `/workspace_output/`, lalu berjalan ke meja **Rina (QA)** untuk meminta pengecekan.
7. **Rina** memeriksa kode tersebut. Jika sudah bagus (`APPROVE`), **Budi (PM)** berjalan ke meja CEO untuk menyerahkan hasil akhir kepada Anda.

---

## 8. Roadmap Implementasi Bertahap (Step-by-Step Build Plan)

Agar pembuatan proyek besar ini terstruktur dan bisa langsung Anda uji di setiap tahapannya, ikuti urutan pengerjaan 4 tahap berikut:

### Tahap 1: Core Backend & Free API Adapter (Hari 1–2)
* Buat server Python `FastAPI` + `SQLite` database.
* Hubungkan `gemini_adapter.py` (menggunakan API Key gratis dari Google AI Studio) dan `zhipu_adapter.py` / `openrouter_adapter.py`.
* Uji simulasi oper-operan tugas (*handoff*) antar 2 agen di terminal terlebih dahulu menggunakan format JSON Envelope.

### Tahap 2: Jembatan Claude Tanpa API Key (Hari 3–4)
* Buat script `claude_cdp_bridge.py` menggunakan Playwright yang menempel ke port `9222` Chrome lokal.
* Buat sistem *DOM Observer* untuk mendeteksi kapan Claude selesai mengetik dan mengekstrak blok kodenya secara bersih.
* Tambahkan sistem *Auto-Fallback* ke Gemini/OpenRouter jika tab Claude terkena limit kuota chat.

### Tahap 3: Visualisasi Kantor 2D & WebSocket (Hari 5–7)
* Bangun antarmuka visual kantor 2D (menggunakan HTML5 Canvas / Phaser.js) dengan peta ruangan: **Meja CEO**, **Meja Rapat Tengah**, dan **4 Kubikel Kerja AI**.
* Hubungkan pergerakan karakter (*walking coordinates*), balon dialog (*speech bubble*), dan indikator status (`IDLE`, `THINKING`, `TYPING`) dengan event WebSocket dari FastAPI.

### Tahap 4: Integrasi Workspace File System & Kontrol CEO (Hari 8–9)
* Hubungkan aksi `WRITE_FILE` agar para agen benar-benar bisa membuat dan mengedit file di dalam folder `/workspace_output/`.
* Tambahkan fitur **File Explorer Live Preview** di sisi kanan layar kantor agar Anda bisa melihat kode yang sedang diketik oleh agen secara *real-time*.
* Tambahkan tombol **Pause / Override / Approve** khusus CEO untuk mengontrol jalannya diskusi.