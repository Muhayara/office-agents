# Virtual AI Office — Research Brief (Nov 2026)

## Prior art

- **[a16z-infra/ai-town](https://github.com/a16z-infra/ai-town)** — MIT. Generative-agent *town* (Convex + Pinecone + Clerk + OpenAI). Social simulation, not a workplace: agents chat and remember, they don't hold jobs or tools. Single provider.
- **[Parcha-ai/ai-office](https://github.com/Parcha-ai/ai-office)** — MIT fork of ai-town reskinned as *The Office*. Same stack, same OpenAI-only limitation. Proves the visual, not the org chart.
- **[pixel-agents-hq/pixel-agents](https://github.com/pixel-agents-hq/pixel-agents)** — MIT. **Closest to your target.** Real agent CLI sessions become pixel characters in an office. Ships as VS Code extension *and* standalone `npx pixel-agents` browser app. React 19 + Canvas 2D + Fastify; hook-based event capture. Architecture is explicitly agent-agnostic (`HookProvider`), but Claude Code is the only provider today — Codex/Gemini/Cursor are roadmap.
- **[harishkotra/agent-office](https://github.com/harishkotra/agent-office)** — MIT. Phaser 3 + Colyseus + React + SQLite. Agents think/act/hire each other, execute sandboxed JS, search web, keep memory. Has `OllamaAdapter` + `OpenAICompatibleAdapter` → multi-provider *possible*, but no cross-model handoff.
- **[pixtuoid/pixtuoid](https://github.com/pixtuoid/pixtuoid)** — MIT, Rust. Terminal TUI pixel office; **15+ agent CLIs** (Claude Code, Codex, Antigravity CLI, opencode, Copilot CLI, Cursor CLI, DeepSeek Harness…). Multi-provider *by construction* — one desk per CLI session. Windows support experimental.
- **[TheAgentCompany](https://github.com/ukgovernmentbeis/inspect_evals/tree/main/src/inspect_evals/theagentcompany)** — benchmark, not a product. Useful only for task design.

**Read:** nobody ships "different models as employees who hand off work." All prior art is either (a) NPC simulation, or (b) a *viewer* over CLIs you already launched. The orchestration layer is genuinely unbuilt.

## Connectivity options

- **A2A** ([a2a-protocol.org](https://a2a-protocol.org/latest/)) — Linux Foundation, Apache 2.0, v1.0; joined Agentic AI Foundation Aug 2026. TSC: AWS, Cisco, Google, IBM, Microsoft, Salesforce, SAP, ServiceNow. Partner list is 180+ names with **no OpenAI and no Anthropic**. Enterprise plumbing; overkill single-machine.
- **MCP** — agent↔tool, not agent↔agent. Not a scheduler either.
- **Recommendation:** one orchestrator process owns a **SQLite message bus** (messages + jobs + agent roster tables). Each employee = headless CLI subprocess of a *different* vendor. Wrap the bus as an **MCP server** so any MCP-speaking agent reads/writes the office mailbox with zero custom glue. Skip A2A until you have >1 machine.

## Harness comparison

| Harness | Headless | Multi-provider | Cost to install | Auth |
|---|---|---|---|---|
| **OpenCode** ([CLI](https://opencode.ai/docs/cli/), [providers](https://opencode.ai/docs/cli/providers/)) | `opencode run "…"`, `-m provider/model` | **Best** — 75+ providers, one syntax | Free, MIT | API key, OAuth, or env |
| **Claude Code** ([CLI ref](https://code.claude.com/docs/en/cli-reference)) | `claude -p`, `--output-format json`, `--mcp-config` | Anthropic only | Free binary | **Pro/Max/Ultra required** — not Free |
| **Gemini CLI** ([quota doc](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/quota-and-pricing.md)) | `gemini -p` | Gemini only | Free | Google account login |
| **Codex CLI** | `codex exec` | OpenAI only | Free | ChatGPT OAuth or API key |
| **Crush / Cline** | partial / IDE | BYO key, broad | Free | API key |

**Pick OpenCode as the uniform adapter** — it is the only one where `provider/model` is a first-class CLI argument, so your orchestrator can spawn `opencode run -m google/gemini-3.8-flash`, `-m zhipuai/glm-5.3`, `-m ollama/qwen3` with identical code. Use Claude Code / Gemini CLI / Codex as *additional* employees where their free quota is better.

## Free tier facts (Nov 2026)

- **Gemini API** — Google **stopped publishing a static free-tier table**; [official rate-limits page](https://aistudio.google.com/docs/rate-limits) now says "view your active rate limits in AI Studio." Third-party (Sept 2026, [scriptbyai](https://www.scriptbyai.com/gemini-api-free-tier-limits/)): Flash 3.8/3.6 = 5 RPM / 20 RPD; Flash-Lite = 10 RPM / **500 RPD**. Gemini 4 Argon is paid-only. Free-tier prompts are used for training outside EEA/CH/UK. **20 RPD is unusable for agents — do not build on the API key.**
- **Gemini CLI** — *official*: **1,000 req/day** with a Google account (Code Assist individual), 250/day with a free API key. Best free Gemini path by 50×.
- **OpenRouter** — *official* ([limits](https://openrouter.ai/docs/api_reference/limits)): `:free` models = 20 RPM; **50 RPD** if <10 credits ever purchased, **1,000 RPD** at ≥10 credits. Extra keys don't help — limits are account-global.
- **Groq** — *official*: `gpt-oss-120b` = 30 RPM / 1,000 RPD / 8K TPM / 200K TPD. Good for cheap "junior employee" turns.
- **Cerebras free tier** — UNVERIFIED (docs not machine-readable).
- **Z.ai GLM Coding Plan** — $18/mo Lite (2,000 credits/5h, 10,000/wk), $80 Pro, $168 Max; checked 15 Oct 2026 ([comparison](https://www.morphllm.com/coding-plan), cites [z.ai/subscribe](https://z.ai/subscribe)). Cheap, not free. Explicitly lists Claude Code, Codex, OpenCode as supported.
- **Claude** — **Claude Code is NOT in Claude Free**; Pro/Max/Ultra only ([support article](https://support.claude.com/en/articles/11145838)). Pro $20, Max $100/$200, 5-hour + weekly caps shared with claude.ai.

## Policy risks

- **Anthropic Consumer ToS §3(7)** ([verbatim](https://www.anthropic.com/legal/consumer-terms)): you may not, *"except when you are accessing our Services via an Anthropic API Key…, access the Services through automated or non-human means, whether through a bot, script, or otherwise."* §2 forbids sharing account credentials. Termination: immediate, no refund.
- **OpenAI ToS, eff. 1 Jan 2026** ([link](https://openai.com/policies/terms-of-use/)): no *"automatically or programmatically extract data or Output"*; no circumventing rate limits or bypassing protective measures.
- **Verdict:** browser-automating claude.ai / chatgpt.com, reusing session cookies, or calling reverse-engineered endpoints is a **clear, explicit ToS breach** with ban risk and no appeal. Anthropic actively enforces it — third-party harnesses routing subscription traffic were blocked ([OpenClaw writeup](https://www.mindstudio.ai/blog/anthropic-openclaw-ban-third-party-harnesses)).
- **Subscription OAuth token in a third-party client: not allowed.** `claude setup-token` exists and is legitimate, but it is Claude Code's *own* token for Claude Code in CI — not a licence to power your app.
- **The clean path:** let each CLI authenticate through its *own* official login and orchestrate it as a subprocess. You're using the vendor's own client exactly as shipped. Zero policy risk, zero cost. This is also why OpenCode/pixtuoid/Pixel Agents are safe and cookie-scraping is not.

## Visual stack

- **Canvas 2D is enough** — Pixel Agents renders a 64×64 tile office, pathfinding and per-character state machines in Canvas 2D + React 19 on ordinary laptops. Hard evidence you don't need a GPU.
- **Phaser 3** (MIT) — battery-included: Tiled tilemaps, sprites, tweens, A*. What AgentOffice uses. Adds ~1MB but saves weeks.
- **PixiJS** (MIT) — fastest 2D sprite throughput, no framework (you own the loop). Pick if you want hand-rolled.
- **Three.js / react-three-fiber** (MIT) — 2.5D/3D runs fine on integrated graphics at low poly counts, but adds camera, lighting, asset pipeline. Only if 3D is the *point*.
- **Godot 4** — free, but web export is a heavy wasm bundle and a separate workflow. Skip for a browser office.
- **Free tilesets:** [Kenney](https://kenney.nl/assets/tag:isometric) — **CC0**, verified on asset pages (Isometric Tiles Buildings/City, Isometric Blocks). LPC on OpenGameArt (CC-BY-SA, attribution). Pixel Agents ships MIT furniture/character packs and documents external asset dirs.
- **Recommendation:** Phaser 3 + Kenney CC0, 2D top-down. Ship the office, not the engine.

## Top 5 sources

1. [Anthropic Consumer Terms of Service](https://www.anthropic.com/legal/consumer-terms) — the automation clause that decides your architecture.
2. [OpenCode CLI + providers docs](https://opencode.ai/docs/cli/providers/) — the uniform multi-provider adapter.
3. [Gemini CLI quota & pricing](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/quota-and-pricing.md) — the 1,000/day free path.
4. [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits) — exact free-model caps.
5. [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) — the closest working reference architecture.
