# Provenance & Security Audit — `hallmark@7e213cb`

- **Repository URL:** `https://github.com/Nutlope/hallmark`
- **Commit SHA (Full):** `7e213cb6feb4ef82733bd66a0600b2e54ca0994c`
- **Commit SHA (Short):** `7e213cb`
- **Upstream Commit Date:** `2026-11-10 18:01:18 +0000`
- **License:** MIT (`Copyright (c) 2026 Hallmark contributors`) — see [`LICENSE`](./LICENSE)
- **Audited Date:** `2026-11-11`

## Security & Behavioral Audit Findings

1. **Shallow Clone with Hooks Disabled:**
   - Cloned into an isolated temporary folder outside the workspace using `git -c core.hooksPath=NUL clone --depth 1`.
2. **Executable Scripts & External Tooling Excluded:**
   - Upstream includes Node scripts (`scripts/theme.mjs`, `scripts/sloplint.mjs`, `scripts/capture.mjs`, `scripts/picture.mjs`, `scripts/imagegen.mjs`, `scripts/install-hook.mjs`) and photo libraries.
   - All `.mjs`/`.js` scripts and binary assets were excluded; only verified `.md` design reference files and `LICENSE` were copied into `skills/vendor/hallmark@7e213cb/`.
3. **Autonomous Office Adaptation (`DIGEST.md`):**
   - Upstream `SKILL.md` contains an interactive pre-flight question block (`Step 1: Ask once`) and `node <skill-dir>/scripts/...` invocations.
   - In our autonomous multi-agent office, [`apps/server/src/skills.ts`](../../../apps/server/src/skills.ts) injects only [`DIGEST.md`](./DIGEST.md) (`<= 120` lines, `<= 4000` chars), distilling Hallmark's **The Floor**, **App Screens & Workbench Discipline**, **Surface Ladder & Dark Mode Parity**, and **Typography/Motion Rules** for passive application by `Tari`, `Wulan`, and `Gita`.
