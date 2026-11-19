# PROMPTS.md — System Prompt Produksi & Injeksi Skill (10 Kursi v1.1.0)

*Dokumentasi perakitan system prompt untuk 10 kursi Office Agents (`apps/server/src/prompts.ts` & `apps/server/src/skills.ts`). Versi 1.1.0 · 11 November 2026.*

---

## 1. Cara Merakit Prompt

Setiap giliran, `apps/server/src/prompts.ts` menyusun system prompt secara berurutan:

```
ROLE[role][lang]  +  RULES[lang]  +  TOOLS[lang]  +  SKILLS_DIGEST[role][lang]  [+  ENVELOPE[lang] bila toolMode = "json"]
```

Format `{roster}` untuk 10 kursi:
```
raka—Manajer; sari—Peneliti; dimas—Penulis; bima—Programmer; gita—Game Dev 3D; tari—Desainer UI/UX; wulan—Pixel Artist; laras—Reviewer; fajar—Visual QA; satria—Auditor Keamanan
```

---

## 2. Matriks Skill Tersemat (`skills/vendor/`)

`apps/server/src/skills.ts` membaca file `DIGEST.md` (`<= 120` baris, `<= 4000` karakter) dari direktori `skills/vendor/<nama>@<sha>/`:

| Peran (`AgentRole`) | Kursi | Skill yang Disuntikkan |
|---|---|---|
| `manager` | Raka | `anti-slop@41b85ed` |
| `researcher` | Sari | `anti-slop@41b85ed` |
| `writer` | Dimas | `anti-slop@41b85ed` |
| `coder` | Bima | `anti-slop@41b85ed` |
| `gamedev` | Gita | `anti-slop@41b85ed`, `hallmark@7e213cb` |
| `designer` | Tari | `anti-slop@41b85ed`, `hallmark@7e213cb` |
| `artist` | Wulan | `anti-slop@41b85ed`, `hallmark@7e213cb` |
| `reviewer` | Laras | `anti-slop@41b85ed` |
| `visual_qa` | Fajar | `anti-slop@41b85ed`, `webapp-testing` |
| `security` | Satria | `anti-slop@41b85ed` |

---

## 3. Ringkasan Tanggung Jawab & Batas Hak Akses 10 Peran

1. **Raka (`manager`):** Memecah perintah CEO menjadi tugas spesifik untuk 9 anggota tim lain dan menyusun laporan akhir ke CEO. Dilarang menulis file atau menjalankan perintah terminal.
2. **Sari (`researcher`):** Mengumpulkan fakta dan konteks, menandai klaim yang belum pasti dengan *"perlu verifikasi"*, dan menyerahkan hasil ke `Dimas` atau `Tari`.
3. **Dimas (`writer`):** Menulis dokumentasi dan copy yang lugas di `workspace/` tanpa klise AI (`anti-slop`), lalu meminta review ke `Laras`.
4. **Bima (`coder`):** Mengembangkan arsitektur aplikasi, state WebSocket, dan komponen UI di `workspace/office-next/`, memeriksa `git_diff`, lalu meminta review ke `Laras`.
5. **Gita (`gamedev`):** Membangun panggung 3D isometrik Three.js: ruangan per lantai, navigasi koridor, rig avatar, kamera (isometrik, Free Cam, Mata Agen), dan loop animasi.
6. **Tari (`designer`):** Merancang arsitektur tata letak ruangan 3D, sistem token CSS (`hallmark`), hierarki permukaan mode gelap, dan ergonomi kontrol.
7. **Wulan (`artist`):** Membuat sprite karakter 10 agen, tile lantai/dinding isometrik, dan furnitur kantor (SVG/Canvas) dengan palet warna terpadu.
8. **Laras (`reviewer`):** Memeriksa diff dan kepatuhan standar `anti-slop`, lalu memutuskan **ACC** (`done` -> memicu auto-commit & auto-push `GitService`) atau **REJECT** (`in_progress`/`blocked`).
9. **Fajar (`visual_qa`):** Menguji tampilan dan interaksi aplikasi di browser (`npx playwright test`) serta memverifikasi kontras dan tidak adanya elemen yang tumpang tindih.
10. **Satria (`security`):** Menjalankan tool `security_scan` untuk memastikan tidak ada kebocoran API key/token, file sensitif, atau pola berbahaya sebelum kode di-commit/push ke GitHub. Dilarang mengedit kode proyek.
