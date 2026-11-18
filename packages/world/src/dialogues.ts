import type { AgentStatus } from '@office/shared';

/**
 * Dialog Templates Bahasa Indonesia untuk Agen Virtual Office 2.5D
 * 100% template-based tanpa memerlukan external API key.
 */

export interface DialogueBubble {
  speakerId: string;
  speakerName: string;
  speakerColor: string;
  role: string;
  text: string;
  durationMs: number;
}

export interface DialogueExchange {
  dialogues: Array<{
    speakerId: string;
    text: string;
    durationMs: number;
  }>;
}

// Dialog saat siklus kopi (ke Pantry, mengantre, menyeduh, ngopi di kursi bar, membuang cangkir)
export const COFFEE_ROUTINE_DIALOGUES = {
  going_to_pantry: [
    'Ke pantry dulu ah, rehat kopi sebentar!',
    'Otak butuh kafein, mampir pantry sebentar.',
    'Jalan ke pantry, sekalian peregangan kaki.',
    'Rehat lima menit di pantry, nanti lanjut lagi.',
  ],
  waiting_in_queue: [
    'Antre dulu, racikan espresso hari ini wangi banget...',
    'Sabar menunggu giliran, demi segelas kafein segar!',
    'Banyak yang butuh kafein hari ini, barista kita laris manis.',
    'Santai sejenak di antrean sambil mikirin solusi algoritma.',
    'Aroma Arabica gayo-nya udah kecium dari sini, mantap!',
  ],
  brewing: [
    'Bikin espresso single shot dulu biar kompilasi gak error...',
    'Wangi banget roast Arabica gayo pantry hari ini!',
    'Butuh asupan kafein sebelum review PR besar.',
    'Mesin espresso kantor kita emang juara, crema-nya tebal!',
    'Satu cangkir kopi hitam hangat biar ide terus ngalir.',
  ],
  walking_with_coffee: [
    'Kursi bar penuh, kopinya kubawa ke meja saja.',
    'Awas panas... jalan santai sambil mikirin arsitektur sistem.',
    'Aroma kopinya bikin mata langsung melek!',
  ],
  walking_to_bar: [
    'Duduk di bar island dulu, ngopi santai sebentar.',
    'Ada kursi kosong di island, pas banget!',
    'Kopi aman di tangan, cari kursi bar dulu.',
  ],
  sipping_at_bar: [
    'Srupuuut... rehat sebentar di pantry memang ampuh.',
    'Ngopi di island sambil ngelamunin solusi bug tadi.',
    'Kopi susu gula aren-nya pas banget hari ini.',
    'Pemandangan Jalan Utama dari pantry, adem juga.',
    'Lima menit santai, habis ini gaspol lagi!',
  ],
  sipping_at_desk: [
    'Srupuuut... mantap! Langsung on-fire lagi ngetik kode.',
    'Ah, nikmat dan pas. Sekarang fokus selesaikan modul ini.',
    'Kafein masuk, logika jalan lancar tanpa hambatan.',
    'Srupuuut... manis pahitnya pas buat nemenin sprint.',
  ],
  disposing: [
    'Buang cup ke tempat sampah dulu, kantor bersih kerja nyaman.',
    'Cup kosong beres dibuang, saatnya gaspol sprint lagi!',
    'Disiplin 5R: buang sampah pada tempatnya.',
  ],
};

// Dialog percakapan berbalas antar sesama agen di kantor
export const OFFICE_CONVERSATIONS: DialogueExchange[] = [
  {
    dialogues: [
      {
        speakerId: 'raka',
        text: 'Bim, status pipeline CI/CD rilis v1.1.0 aman?',
        durationMs: 4000,
      },
      {
        speakerId: 'bima',
        text: 'Aman Pak Raka! Test 26/26 hijau semua, zero warning!',
        durationMs: 4200,
      },
    ],
  },
  {
    dialogues: [
      {
        speakerId: 'sari',
        text: 'Dimas, aku nemu riset baru optimasi latensi inference lokal.',
        durationMs: 4200,
      },
      {
        speakerId: 'dimas',
        text: 'Menarik Mbak Sari! Aku siap bantu rangkum ke dokumentasi.',
        durationMs: 4000,
      },
    ],
  },
  {
    dialogues: [
      {
        speakerId: 'tari',
        text: 'Git, kontras warna HUD diorama 3D sudah aku update ke token baru.',
        durationMs: 4200,
      },
      {
        speakerId: 'gita',
        text: 'Mantap Mbak Tari, sekarang teksnya super tajam dan kebaca jelas!',
        durationMs: 4200,
      },
    ],
  },
  {
    dialogues: [
      {
        speakerId: 'wulan',
        text: 'Model 3D coffee bar dan kursi sudah rapi dengan PBR specular.',
        durationMs: 4200,
      },
      {
        speakerId: 'gita',
        text: 'Keren banget Mbak Wulan! Pantulan chrome dan kayu-nya hidup.',
        durationMs: 4000,
      },
    ],
  },
  {
    dialogues: [
      {
        speakerId: 'satria',
        text: 'Hasil audit keamanan bersih, zero secret leaks di git commit.',
        durationMs: 4200,
      },
      {
        speakerId: 'laras',
        text: 'Bagus Satria, PR langsung aku approve dan merge ke main!',
        durationMs: 4000,
      },
    ],
  },
  {
    dialogues: [
      {
        speakerId: 'fajar',
        text: 'Viewport responsif di semua resolusi lolos uji visual 100%.',
        durationMs: 4000,
      },
      {
        speakerId: 'tari',
        text: 'Sip Fajar, padding dan grid layout-nya sudah pas presisi.',
        durationMs: 4000,
      },
    ],
  },
  {
    dialogues: [
      {
        speakerId: 'raka',
        text: 'Sprint review jam 2 siang ya rekan-rekan, progress fitur mantap!',
        durationMs: 4500,
      },
      {
        speakerId: 'laras',
        text: 'Siap Pak Raka, rekap quality gate dan test report sudah siap.',
        durationMs: 4200,
      },
    ],
  },
];

// Monolog / gumaman agen saat sedang fokus bekerja mengetik di meja
export const AGENT_SOLO_THOUGHTS: Record<string, string[]> = {
  raka: [
    'Burndown chart minggu ini on track, tim bergerak sangat solid.',
    'Prioritas task: pastikan integrasi 3D dan backend tersinkronisasi.',
  ],
  sari: [
    'Analisis perbandingan model: Sonnet 3.5 menang telak di akurasi geometri.',
    'Mengekstrak data benchmark untuk laporan teknis kuartal ini.',
  ],
  dimas: [
    'Merangkum panduan integrasi sistem ke dalam format Markdown rapi.',
    'Dokumentasi API endpoint REST dan WebSocket sudah sinkron.',
  ],
  tari: [
    'Mengatur kurva transisi bezier untuk micro-interaction antarmuka.',
    'Palet warna tema gelap Glassmorphism ini terasa sangat nyaman.',
  ],
  wulan: [
    'Memeriksa topologi mesh dan baking normal map agar low poly tetap detail.',
    'Proporsi espresso bar 1.80m x 0.65m pas sekali dengan skala diorama.',
  ],
  bima: [
    'Refactoring loop async... kompleksitas waktu turun drastis!',
    'Memastikan event-driven architecture bebas dari memory leak.',
  ],
  gita: [
    'Animasi lengan mengetik dan walking cycle tembus 60 FPS stabil!',
    'Pencahayaan RoomEnvironment PMREM memberi refleksi realistis.',
  ],
  satria: [
    'Menjalankan scanner deterministik terhadap file konfigurasi sensitif.',
    'Firewall dan validasi payload server aktif berlapis.',
  ],
  laras: [
    'Code review pull request: penamaan variabel bersih dan modular.',
    'Unit test coverage mencapai 94%, siap rilis production.',
  ],
  fajar: [
    'Memastikan rasio kontras warna tombol memenuhi standar WCAG AA.',
    'Semua animasi transisi berjalan halus di 60 Hz maupun 120 Hz.',
  ],
};

// Ucapan singkat saat status agen sebenarnya berubah (mode live)
export const LIVE_STATUS_LINES: Partial<Record<AgentStatus, readonly string[]>> = {
  thinking: [
    'Oke, saya pelajari dulu permintaannya...',
    'Sebentar, saya susun langkahnya.',
    'Baca konteks dulu sebelum mulai.',
  ],
  working: [
    'Mulai eksekusi, fokus mode on.',
    'Langsung dikerjakan!',
  ],
  waiting_approval: [
    '✋ Menunggu izin CEO untuk menjalankan perintah.',
    '✋ Pak/Bu CEO, perlu persetujuan dulu ya.',
  ],
  error: [
    'Hmm, ada kendala. Saya cek ulang dulu.',
    'Waduh, gagal. Perlu dicoba lagi nanti.',
  ],
  offline: [
    'Kuota hari ini habis, pamit pulang dulu!',
    'Sampai besok, kuota sudah terpakai semua.',
  ],
};

// Ajakan pimpinan rapat saat memanggil tim ke ruang rapat
export const MEETING_CALL_LINES: readonly string[] = [
  'Tim, kumpul di ruang rapat sekarang ya!',
  'Rapat sebentar di ruang rapat, yuk!',
  'Semua ke ruang rapat, ada yang perlu dibahas.',
];

// Celetukan singkat agen saat berangkat ke ruang rapat
export const MEETING_ON_THE_WAY: readonly string[] = [
  'Siap, otw ruang rapat!',
  'Oke, saya simpan kerjaan dulu.',
  'Bawa catatan dulu, sebentar.',
];

// Balasan peserta saat rapat di ruang rapat
export const MEETING_REPLIES: readonly string[] = [
  'Siap, dicatat.',
  'Setuju, saya ambil bagian saya.',
  'Noted, nanti saya update di papan tugas.',
  'Oke, timeline-nya masuk akal.',
  'Ada risiko kecil, nanti saya sampaikan detailnya.',
];

// Jawaban rekan saat mejanya dikunjungi (serah-terima / minta review)
export const VISIT_ACKS: readonly string[] = [
  'Oke, saya terima.',
  'Siap, langsung saya cek.',
  'Taruh di sini saja, nanti saya review.',
  'Noted, makasih!',
];

// Tahap 3: datang & pulang lewat Lobi
export const ARRIVAL_LINES: readonly string[] = [
  'Selamat pagi semua! Langsung ke meja ya.',
  'Hadir! Siap lanjut sprint hari ini.',
  'Baru sampai, cek tugas dulu di meja.',
  'Pagi! Kopi nanti saja, kerjaan dulu.',
];

export const LEAVING_LINES: readonly string[] = [
  'Pamit dulu, sesi saya selesai.',
  'Offline sebentar, sampai nanti!',
  'Keluar lewat lobi dulu ya.',
];

// Tahap 3: santai di Lounge setelah rapat
export const LOUNGE_GOING: readonly string[] = [
  'Mampir lounge dulu, rapat tadi seru juga.',
  'Lima menit di sofa, lanjut bahas santai.',
  'Ke lounge yuk, kepala perlu napas sebentar.',
];

export const LOUNGE_CHAT: readonly string[] = [
  'Poin tadi soal deadline masuk akal sih.',
  'Sofa ini empuk banget, bahaya kalau kelamaan.',
  'Habis ini aku langsung pecah tugasnya jadi sub-task.',
  'Lampunya hangat, enak buat mikir ulang arsitektur.',
  'Setuju, demo minggu depan harus lebih rapi.',
];

// Tahap 3: inspeksi Server / IT (Satria & Bima)
export const SERVER_GOING: readonly string[] = [
  'Cek rak server dulu, ada alert kecil tadi.',
  'Waktunya inspeksi rutin ruang server.',
  'Mau lihat log keamanan langsung dari konsol.',
];

export const SERVER_INSPECT: readonly string[] = [
  'LED hijau semua, rak A dan B aman.',
  'Kabel fiber rapi, suhu CRAC stabil 18 derajat.',
  'Throughput normal, tidak ada lonjakan aneh.',
];

export const SERVER_CONSOLE: readonly string[] = [
  'Scan keamanan database: bersih.',
  'Uptime 99,98%. Catat di laporan mingguan.',
  'Patch kecil terpasang, restart nanti malam.',
];

// Tahap 4: diskusi kelompok lintas tim di Collaboration Commons
export const COMMONS_GOING: readonly string[] = [
  'Ke Commons yuk, bahas bareng biar cepat beres.',
  'Diskusi lintas tim di meja kolaborasi, sebentar saja.',
  'Bawa laptop, kita sinkron dulu di Commons.',
];

export const COMMONS_CHAT: readonly string[] = [
  'Coba gambar alurnya di whiteboard dulu.',
  'Dari sisi desain, tombol ini terlalu kecil di layar HP.',
  'Kalau API-nya siap, aku bisa sambungkan hari ini.',
  'QA perlu skenario uji untuk data kosong.',
  'Setuju, kita pecah jadi tiga tugas kecil.',
  'Riset pengguna bilang mereka butuh mode gelap.',
  'Aku catat keputusan ini di dokumen sprint.',
  'Render 2.5D-nya masih patah di sudut timur.',
  'Review keamanan dulu sebelum fitur ini rilis.',
];

// Tahap 4: rehat setelah tugas selesai di Digital Garden
export const GARDEN_GOING: readonly string[] = [
  'Tugas beres, napas dulu di Digital Garden.',
  'Mata butuh lihat yang hijau sebentar.',
  'Ke taman dulu, dengar air mancur lima menit.',
];

export const GARDEN_CHAT: readonly string[] = [
  'Suara air mancurnya bikin tenang.',
  'Green wall ini seperti hutan mini.',
  'Duduk sebentar di sini, ide baru biasanya muncul.',
  'Rumputnya sintetis, tapi segarnya terasa asli.',
];

// Tahap 5: sesi Workshop / Tech Demo
export const WORKSHOP_TOPICS: readonly string[] = [
  'Arsitektur multi-agen & router gedung',
  'Rendering 2.5D dengan Three.js',
  'Keamanan run_command & izin CEO',
  'Riset pengguna untuk dasbor baru',
  'Desain UI: komponen kartu tugas',
  'Review sprint & rencana rilis',
];

export const WORKSHOP_GOING: readonly string[] = [
  'Ada sesi tech demo di Workshop, ikut yuk.',
  'Ke Workshop dulu, mau lihat demo terbaru.',
  'Sesi berbagi ilmu sebentar, bawa catatan.',
];

export const WORKSHOP_TALK: readonly string[] = [
  'Slide berikutnya: alur data dari router ke ruangan.',
  'Perhatikan bagian ini, ini yang sering bikin bug.',
  'Demo langsung ya, semoga tidak error di depan kalian.',
  'Pertanyaan boleh di akhir, atau sela saja.',
  'Intinya: setiap ruangan punya navigasi lokal sendiri.',
];

export const WORKSHOP_CHAT: readonly string[] = [
  'Oh, jadi portalnya di dalam ruangan ya.',
  'Boleh minta slide-nya nanti?',
  'Ini bisa dipakai juga di proyekku.',
  'Catat: cek izin sebelum menjalankan perintah.',
];

// Tahap 5: cek metrik di Information Wall
export const INFOWALL_GOING: readonly string[] = [
  'Cek Information Wall dulu, lihat status tim.',
  'Mau lihat papan kanban & metrik terbaru.',
  'Ke ruang telemetri sebentar.',
];

export const INFOWALL_CHAT: readonly string[] = [
  'Siapa yang masih menunggu izin CEO?',
  'Kolom Review mulai penuh, perlu dibantu.',
  'Grafik aktivitas naik, tim lagi produktif.',
  'Kartu ini sudah bisa pindah ke Done.',
];

// Tahap 5: pair huddle di Collaboration Pods
export const PODS_GOING: readonly string[] = [
  'Pair sebentar di pod yuk, lebih cepat.',
  'Bahas berdua di Collaboration Pods saja.',
  'Pod kosong tuh, kita review di sana.',
];

export const PODS_CHAT: readonly string[] = [
  'Coba share layar, aku lihat kodenya.',
  'Fungsi ini bisa dipecah jadi dua.',
  'Desainnya oke, tinggal jarak antar-elemen.',
  'Sip, aku lanjutkan dari bagian ini.',
  'Tambahkan tes untuk kasus tepi, ya.',
];

// ---------------------------------------------------------------------------
// Tahap 6: Studio / Content, Focus Pods, Digital Access Hub
// ---------------------------------------------------------------------------
export const STUDIO_GOING: readonly string[] = [
  'Ke Studio dulu, rekam demo fitur baru.',
  'Mau render & color-grading video rilis.',
  'Ambil footage green screen sebentar.',
];

/** Talent di tanda ✕ green screen. */
export const STUDIO_TALK: readonly string[] = [
  'Halo! Hari ini kita demo fitur terbaru.',
  'Take dua, aku ulang dari awal ya.',
  'Fitur ini bikin kerja tim jauh lebih cepat.',
  'Oke, satu kalimat penutup lagi.',
];

/** Kameramen & editor. */
export const STUDIO_CREW: readonly string[] = [
  'Rolling… dan, action!',
  'Fokus aman, cahaya pas.',
  'Warnanya kurang hangat, aku naikkan sedikit.',
  'Render 4K tinggal 30%.',
  'Cut! Yang tadi bagus.',
];

export const FOCUS_GOING: readonly string[] = [
  'Masuk Focus Pod dulu, butuh deep work.',
  'Debug bagian rumit ini di pod hening.',
  'Jangan diganggu dulu ya, mode fokus.',
];

export const FOCUS_MUTTER: readonly string[] = [
  'Hmm… ternyata race condition.',
  'Satu tes lagi lulus.',
  'Oke, alurnya mulai jelas.',
];

export const ACCESS_GOING: readonly string[] = [
  'Cek peta ekspansi gedung di Access Hub.',
  'Lihat rencana Lantai 2 sebentar.',
  'Ke Digital Access Hub, cek totem peta.',
];

export const ACCESS_MAP: readonly string[] = [
  '16 dari 16 zona Lantai 1 sudah aktif.',
  'Lantai 2 nanti buat agen baru, ya.',
  'Rute ke semua ruangan sudah lengkap.',
];

export const ACCESS_LIFT: readonly string[] = [
  'Lift Lantai 2 masih "Segera".',
  'Panel lift sudah siap, tinggal lantainya.',
];
