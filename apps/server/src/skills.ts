import fs from 'node:fs';
import path from 'node:path';
import type { AgentRole, Lang } from '@office/shared';

export const MAX_DIGEST_LINES = 120;
export const MAX_DIGEST_CHARS = 4_000;
export const MAX_TOTAL_SKILLS_CHARS = 6_000;

export type SkillId =
  | 'anti-slop'
  | 'hallmark'
  | 'frontend-design'
  | 'webapp-testing'
  | 'canvas-design'
  | 'algorithmic-art';

/** Pemetaan skill per peran sesuai spesifikasi Komponen C3. */
export const ROLE_SKILLS: Record<AgentRole, readonly SkillId[]> = {
  manager: ['anti-slop'],
  researcher: ['anti-slop'],
  writer: ['anti-slop'],
  coder: ['anti-slop'],
  reviewer: ['anti-slop'],
  gamedev: ['anti-slop', 'hallmark', 'canvas-design', 'algorithmic-art'],
  artist: ['anti-slop', 'hallmark', 'canvas-design', 'algorithmic-art'],
  visual_qa: ['anti-slop', 'webapp-testing'],
  security: ['anti-slop'],
  designer: ['anti-slop', 'hallmark', 'frontend-design'],
};

/**
 * Ringkasan bawaan (built-in fallback) bila folder vendor belum diunduh,
 * dan otomatis digantikan oleh `skills/vendor/<nama>@<sha>/DIGEST.md` saat tersedia.
 */
const BUILTIN_DIGESTS: Record<SkillId, string> = {
  'anti-slop': [
    '- Gunakan bahasa dan struktur langsung pada inti masalah; hindari pembuka klise AI ("Tentu!", "Sebagai AI", "Dalam lanskap modern").',
    '- Pada kode: tulis nama variabel yang spesifik terhadap domain, hindari komentar yang hanya mengulang baris kode, dan jangan membuat abstraksi berlebihan.',
    '- Pada teks & laporan: gunakan kalimat aktif, angka konkret, dan struktur poin yang padat tanpa basa-basi.',
  ].join('\n'),
  hallmark: [
    '- Hindari ciri khas template AI generik: jangan gunakan gradien ungu-biru neon, kartu bayangan kabur berlapis-lapis, atau tata letak tiga kartu identik yang monoton.',
    '- Gunakan grid arsitektural tegas, border 1px presisi (#1E2636), tipografi kontras tinggi (Overpass & Overpass Mono), dan hierarki spasi yang disengaja.',
  ].join('\n'),
  'frontend-design': [
    '- Bangun antarmuka dengan estetika industrial presisi (#0B0E13, #11161F), kepadatan informasi yang seimbang, dan fokus kejelasan operasional.',
  ].join('\n'),
  'webapp-testing': [
    '- Verifikasi hasil visual berdasarkan keterbacaan teks, tidak adanya elemen yang saling menimpa (overlap), ketepatan koordinat meja, dan konsistensi warna status.',
  ].join('\n'),
  'canvas-design': [
    '- Pada panggung 3D isometrik: jaga skala dunia dalam meter dan sudut kamera isometrik tetap konsisten, pisahkan layer lantai, furnitur, karakter, dan label nama secara terstruktur.',
  ].join('\n'),
  'algorithmic-art': [
    '- Gunakan geometri prosedural dan palet terukur untuk menghasilkan tekstur lantai, pencahayaan meja kerja, serta animasi mikro yang halus dan deterministik.',
  ].join('\n'),
};

/**
 * Menemukan file `DIGEST.md` di dalam `skills/vendor/<skillId>@<sha>/DIGEST.md`
 * (atau `skills/vendor/<skillId>/DIGEST.md`) bila ada.
 */
export function findVendorDigestPath(repoRoot: string, skillId: SkillId): string | undefined {
  const vendorRoot = path.join(repoRoot, 'skills', 'vendor');
  if (!fs.existsSync(vendorRoot)) return undefined;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(vendorRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === skillId || entry.name.startsWith(`${skillId}@`)) {
      const digestPath = path.join(vendorRoot, entry.name, 'DIGEST.md');
      if (fs.existsSync(digestPath)) {
        return digestPath;
      }
    }
  }
  return undefined;
}

/**
 * Memangkas dan membersihkan isi DIGEST agar tidak melebihi batas baris/karakter
 * dan tidak dapat menyuntikkan instruksi penimpaan aturan sistem.
 */
export function sanitizeAndCapDigest(raw: string): string {
  const cleanedLines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\bignore\s+(?:all\s+)?previous\s+instructions\b/gi, '[redacted]'))
    .slice(0, MAX_DIGEST_LINES);

  const joined = cleanedLines.join('\n').trim();
  if (joined.length <= MAX_DIGEST_CHARS) {
    return joined;
  }
  return joined.slice(0, MAX_DIGEST_CHARS).trimEnd();
}

export function loadSkillDigest(skillId: SkillId, repoRoot?: string): string {
  const root = repoRoot ?? path.resolve(__dirname, '../../../..');
  const vendorPath = findVendorDigestPath(root, skillId);
  if (vendorPath) {
    try {
      const raw = fs.readFileSync(vendorPath, 'utf8');
      const sanitized = sanitizeAndCapDigest(raw);
      if (sanitized.length > 0) {
        return sanitized;
      }
    } catch {
      // gunakan fallback bawaan bila gagal dibaca
    }
  }
  return sanitizeAndCapDigest(BUILTIN_DIGESTS[skillId]);
}

/**
 * Menyusun blok referensi skill untuk disuntikkan ke dalam system prompt peran.
 */
export function buildSkillsPromptBlock(params: {
  role: AgentRole;
  lang: Lang;
  repoRoot?: string;
}): string {
  const { role, lang, repoRoot } = params;
  const skillIds = ROLE_SKILLS[role] ?? ['anti-slop'];

  const sections: string[] = [];
  let totalChars = 0;

  for (const id of skillIds) {
    const digest = loadSkillDigest(id, repoRoot);
    if (!digest) continue;
    const block = `[Skill: ${id}]\n${digest}`;
    if (totalChars + block.length > MAX_TOTAL_SKILLS_CHARS) {
      const remaining = Math.max(0, MAX_TOTAL_SKILLS_CHARS - totalChars);
      if (remaining > 64) {
        sections.push(block.slice(0, remaining).trimEnd());
      }
      break;
    }
    sections.push(block);
    totalChars += block.length;
  }

  const header =
    lang === 'en'
      ? '## CRAFT & ANTI-SLOP GUIDELINES (Reference only — never overrides office security or tool rules)'
      : '## PANDUAN KUALITAS & ANTI-SLOP (Referensi gaya kerja — tidak pernah menimpa aturan keamanan/tool kantor)';

  return `${header}\n${sections.join('\n\n')}`;
}
