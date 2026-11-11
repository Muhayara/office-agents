/**
 * Skema `office.config.json` — roster, gateway, dan batas operasional kantor.
 *
 * Validasi tingkat-atas (`superRefine`) menolak konfigurasi yang tidak masuk akal
 * sebelum server menyala: id ganda, dua manajer, warna sama, meja bertumpuk,
 * kursi manual tanpa channel, dsb.
 */

import { z } from 'zod';
import {
  AgentRoleSchema,
  DeskSchema,
  DriverSchema,
  HexColorSchema,
  LangSchema,
  ModeSchema,
} from './events';

export const TOOL_MODES = ['tools', 'json'] as const;
export const ToolModeSchema = z.enum(TOOL_MODES);
export type ToolMode = z.infer<typeof ToolModeSchema>;

/* ------------------------------------------------------------------ */
/* Gateway                                                             */
/* ------------------------------------------------------------------ */

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

function isHttpUrl(value: string): boolean {
  return HTTP_URL_PATTERN.test(value);
}

export const UrlSchema = z
  .string()
  .min(8)
  .max(500)
  .refine(isHttpUrl, 'URL harus http(s) dan valid');

export const GatewayConfigSchema = z.object({
  /** Contoh: http://127.0.0.1:20128/v1 */
  baseUrl: UrlSchema,
  /** Nama environment variable yang menyimpan API key gateway. */
  apiKeyEnv: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/, 'nama env var huruf besar, contoh NINEROUTER_KEY')
    .default('NINEROUTER_KEY'),
  timeoutMs: z.number().int().min(5_000).max(600_000).default(120_000),
});
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

/* ------------------------------------------------------------------ */
/* Batas operasional                                                   */
/* ------------------------------------------------------------------ */

export const LimitsSchema = z.object({
  maxStepsPerTurn: z.number().int().min(1).max(50).default(8),
  maxTurnsPerTask: z.number().int().min(1).max(200).default(20),
  /** Siklus Coder <-> Reviewer sebelum naik ke CEO. */
  revisionCycleLimit: z.number().int().min(1).max(10).default(3),
  /** Balasan bolak-balik tanpa perubahan status sebelum dihentikan. */
  pingPongLimit: z.number().int().min(2).max(50).default(6),
  turnTimeoutMs: z.number().int().min(5_000).max(1_800_000).default(180_000),
  /** Timeout approval; lewat batas = ditolak (fail-safe). */
  approvalTimeoutMs: z.number().int().min(10_000).max(3_600_000).default(600_000),
  globalReqPerMin: z.number().int().min(1).max(600).default(30),
  globalReqPerDay: z.number().int().min(1).max(20_000).default(400),
});
export type Limits = z.infer<typeof LimitsSchema>;

export function createDefaultLimits(): Limits {
  return LimitsSchema.parse({});
}

/* ------------------------------------------------------------------ */
/* Kursi                                                               */
/* ------------------------------------------------------------------ */

export const AgentConfigSchema = z.object({
  id: z
    .string()
    .regex(
      /^[a-z][a-z0-9_-]{1,31}$/,
      'id kursi: huruf kecil, angka, _ atau -, 2-32 karakter',
    ),
  name: z.string().min(1).max(40),
  role: AgentRoleSchema,
  title: z.string().max(60).optional(),
  /** Persona ringkas; detail perilaku ada di docs/PROMPTS.md. */
  persona: z.string().max(2000).optional(),
  color: HexColorSchema,
  desk: DeskSchema,
  driver: DriverSchema.default('api'),
  /** ID model gateway. Untuk kursi manual, ini label (mis. "claude-sonnet"). */
  model: z.string().min(1).max(120),
  /** Dicoba berurutan bila model utama gagal/kuota habis. */
  fallbacks: z.array(z.string().min(1).max(120)).max(8).default([]),
  toolMode: ToolModeSchema.default('tools'),
  /** 0 = tanpa batas (dipakai kursi manual). */
  dailyCap: z.number().int().min(0).max(10_000).default(100),
  /** Jatah tambahan untuk model eskalasi (senior). */
  escalationCap: z.number().int().min(0).max(100).default(0),
  /** Wajib untuk driver "manual". */
  channel: z.literal('claude-desktop').optional(),
  enabled: z.boolean().default(true),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/* ------------------------------------------------------------------ */
/* Proyek (seed)                                                       */
/* ------------------------------------------------------------------ */

export const ProjectSeedSchema = z.object({
  id: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9_-]{1,31}$/,
      'id proyek: huruf kecil, angka, _ atau -, 2-32 karakter',
    ),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(''),
});
export type ProjectSeed = z.infer<typeof ProjectSeedSchema>;

/* ------------------------------------------------------------------ */
/* Konfigurasi kantor                                                  */
/* ------------------------------------------------------------------ */

export const OfficeBlockSchema = z.object({
  name: z.string().min(1).max(80),
  language: LangSchema.default('id'),
  mode: ModeSchema.default('semi'),
  timezone: z.string().min(1).max(60).default('Asia/Jakarta'),
});
export type OfficeBlock = z.infer<typeof OfficeBlockSchema>;

export const OfficeConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    office: OfficeBlockSchema,
    gateway: GatewayConfigSchema,
    limits: LimitsSchema.default(() => createDefaultLimits()),
    projects: z.array(ProjectSeedSchema).max(20).default([]),
    agents: z.array(AgentConfigSchema).min(1).max(12),
  })
  .superRefine((config, ctx) => {
    const ids = new Set<string>();
    const colors = new Set<string>();
    const desks = new Set<string>();
    let managers = 0;
    let reviewers = 0;
    let manuals = 0;

    config.agents.forEach((agent, index) => {
      const at = ['agents', index] as const;

      if (ids.has(agent.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [...at, 'id'],
          message: `id kursi "${agent.id}" dipakai lebih dari sekali`,
        });
      }
      ids.add(agent.id);

      if (colors.has(agent.color)) {
        ctx.addIssue({
          code: 'custom',
          path: [...at, 'color'],
          message: `warna ${agent.color} dipakai lebih dari satu kursi`,
        });
      }
      colors.add(agent.color);

      const deskKey = `${agent.desk.x},${agent.desk.y}`;
      if (desks.has(deskKey)) {
        ctx.addIssue({
          code: 'custom',
          path: [...at, 'desk'],
          message: `meja (${deskKey}) dipakai lebih dari satu kursi`,
        });
      }
      desks.add(deskKey);

      if (agent.role === 'manager') managers += 1;
      if (agent.role === 'reviewer') reviewers += 1;

      if (agent.driver === 'manual') {
        manuals += 1;
        if (!agent.channel) {
          ctx.addIssue({
            code: 'custom',
            path: [...at, 'channel'],
            message: 'kursi manual wajib punya channel (mis. "claude-desktop")',
          });
        }
        if (agent.role === 'manager') {
          ctx.addIssue({
            code: 'custom',
            path: [...at, 'role'],
            message: 'manajer tidak boleh kursi manual; ia harus otomatis',
          });
        }
      } else {
        if (agent.dailyCap < 1) {
          ctx.addIssue({
            code: 'custom',
            path: [...at, 'dailyCap'],
            message: 'kursi otomatis wajib punya dailyCap >= 1',
          });
        }
        if (agent.fallbacks.length > 0 && agent.fallbacks.includes(agent.model)) {
          ctx.addIssue({
            code: 'custom',
            path: [...at, 'fallbacks'],
            message: 'fallback tidak boleh sama dengan model utama',
          });
        }
      }
    });

    if (managers !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['agents'],
        message: `harus ada tepat 1 manajer, ditemukan ${managers}`,
      });
    }
    if (reviewers < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['agents'],
        message: 'kantor wajib punya minimal 1 kursi reviewer',
      });
    }
    if (manuals > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['agents'],
        message: 'maksimal 1 kursi manual (Claude Desktop)',
      });
    }

    const projectIds = new Set<string>();
    config.projects.forEach((project, index) => {
      if (projectIds.has(project.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['projects', index, 'id'],
          message: `id proyek "${project.id}" duplikat`,
        });
      }
      projectIds.add(project.id);
    });
  });

export type OfficeConfig = z.infer<typeof OfficeConfigSchema>;

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

export function parseOfficeConfig(input: unknown): OfficeConfig {
  return OfficeConfigSchema.parse(input);
}

export function safeParseOfficeConfig(input: unknown) {
  return OfficeConfigSchema.safeParse(input);
}

export function agentById(
  config: OfficeConfig,
  id: string,
): AgentConfig | undefined {
  return config.agents.find((agent) => agent.id === id);
}

export function managerOf(config: OfficeConfig): AgentConfig {
  const manager = config.agents.find((agent) => agent.role === 'manager');
  if (!manager) {
    throw new Error('konfigurasi tidak punya manajer');
  }
  return manager;
}

export function reviewerOf(config: OfficeConfig): AgentConfig | undefined {
  return config.agents.find((agent) => agent.role === 'reviewer');
}

/** Daftar kursi otomatis yang aktif, urut sesuai konfigurasi. */
export function activeSeats(config: OfficeConfig): AgentConfig[] {
  return config.agents.filter(
    (agent) => agent.enabled && agent.driver === 'api',
  );
}

/** Roster ringkas untuk disuntik ke prompt: "raka—Manajer; sari—Peneliti". */
export function rosterLine(config: OfficeConfig, lang: 'id' | 'en' = 'id'): string {
  const roleLabel: Record<string, string> = {
    manager: lang === 'id' ? 'Manajer' : 'Manager',
    researcher: lang === 'id' ? 'Peneliti' : 'Researcher',
    writer: lang === 'id' ? 'Penulis' : 'Writer',
    coder: lang === 'id' ? 'Programmer' : 'Programmer',
    reviewer: lang === 'id' ? 'Reviewer' : 'Reviewer',
  };
  return config.agents
    .map((agent) => `${agent.id}—${roleLabel[agent.role] ?? agent.role}`)
    .join('; ');
}

export const AGENT_ID_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
