# Provenance & Security Audit — `anti-slop@41b85ed`

- **Repository URL:** `https://github.com/miqdadbadjuber/anti-slop`
- **Commit SHA (Full):** `41b85ede0257f39bfcffedf3f58c3c59bcc8530d`
- **Commit SHA (Short):** `41b85ed`
- **Upstream Commit Date:** `2026-11-10 20:35:16 +0700`
- **License:** MIT (`Copyright (c) 2026 Miqdad Badjuber (antislop)`) — see [`LICENSE`](./LICENSE)
- **Audited Date:** `2026-11-11`

## Security & Behavioral Audit Findings

1. **Shallow Clone with Hooks Disabled:**
   - Cloned into an isolated temporary folder outside the workspace using `git -c core.hooksPath=NUL clone --depth 1`.
2. **Executable Scripts Excluded:**
   - Upstream contains executable scripts (`cli/index.mjs`, `.claude-plugin/contrast-mcp-launcher.mjs`, `.cline-plugin/plugin.js`, `skills/antislop-human/contrast-check.py`, `skills/antislop-human/contrast-mcp.py`).
   - All `.mjs`, `.js`, `.py`, and shell files were excluded; only verified `.md` documentation and `LICENSE` were copied into `skills/vendor/anti-slop@41b85ed/`.
3. **Autonomous Office Adaptation (`DIGEST.md`):**
   - Upstream `SKILL.md` (lines 40–62) includes an interactive prompt gate instructing CLI agents to pause before work (`"Do not start UI work until they answer: Which one, 1 or 2?"`), read/write `%APPDATA%\antislop\settings.json`, or run `npx antislop-ai`.
   - In our autonomous multi-agent office, [`apps/server/src/skills.ts`](../../../apps/server/src/skills.ts) injects only [`DIGEST.md`](./DIGEST.md) (`<= 120` lines, `<= 4000` chars), locking execution to **Mode 1 (`DURING` — passive craftsmanship filter applied automatically while coding/designing/writing)** with zero interactive stops, zero `%APPDATA%` reads/writes, and zero external CLI calls.
