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

// Dialog saat siklus kopi (mengantre, menyeduh kopi, menikmati, membuang cangkir)
export const COFFEE_ROUTINE_DIALOGUES = {
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
    'Kopi aman di tangan, saatnya balik ke workstation.',
    'Awas panas... jalan santai sambil mikirin arsitektur sistem.',
    'Aroma kopinya bikin mata langsung melek!',
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
