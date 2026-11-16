# CLAUDE.md — Project Briefing & Instructions for Claude Code
> **Project:** Office Agents 2.5D (Virtual AI Office & Meja Dispatch)  
> **Workspace Root:** `P:\gemini-lab\office`  
> **Author:** `Muhayara <hafizhajah777@gmail.com>`  
> **Primary Language:** Indonesian (Bahasa Indonesia) for UI text, agent dialogs, and commit messages.

---

## 1. What Is This Project?
**Office Agents 2.5D** is an interactive, browser-based virtual office simulation and AI workforce dispatch command center.
- The user acts as the **CEO** managing **10 specialized AI agents** (Raka, Sari, Dimas, Tari, Wulan, Bima, Gita, Satria, Laras, Fajar).
- **Core Visual Feature:** A **3D WebGL Isometric Diorama** built with **Three.js 0.187** (the standalone GLB generators in `tools/3d-generator/` use r128 via CDN), featuring real-time PBR studio lighting, animated monitors with scrolling syntax code, interactive typing avatars, a complete coffee break & queue routine, and floating glassmorphism speech bubbles in Indonesian.

---

## 2. Monorepo Architecture

```text
P:\gemini-lab\office\
├── packages/
│   └── shared/                 # @office/shared — Shared TypeScript types, Zod schemas, MCP tools, permissions
├── apps/
│   ├── server/                 # @office/server — node:http + ws (:7420) + MCP (:7421) + node:sqlite WAL, run with tsx
│   │   └── src/                # Core engine, git service, scheduler, prompt builders
│   │       ├── http-server.ts  # HTTP/WS routes, session login, Host/Origin checks, body limits
│   │       └── security/       # auth.ts (tokens, HMAC cookies), command-policy.ts (run_command), scanner.ts
│   └── web/                    # @office/web — React 19 + Vite classic dispatch dashboard (:5173)
├── workspace/
│   └── office-next/            # Next-Gen 3D Three.js Diorama Studio (:5174)
│       ├── public/models/      # Production 3D GLB Models (room shell, desk, chair, coffee bar, server racks, plants)
│       ├── src/
│       │   ├── stage/
│       │   │   ├── IsometricOfficeStage.tsx # Scene, lights, avatar rigs, agent & meeting state machines
│       │   │   ├── layout.ts               # All coordinates: desks, pantry, room layers, boardroom seat table
│       │   │   ├── navigation.ts           # Room-local nav + building router via door portals (door mutex gates)
│       │   │   ├── rooms/                  # Layer builders: mainWorkspace, corridorEast, boardroom, assets (GLB/placeholder)
│       │   │   ├── camera/                 # cameraRig (Isometric ↔ Free Cam 3D), wallFade (Sims-style auto-fade)
│       │   │   └── officeDialogues.ts      # Template-based Indonesian dialogue lines (Zero API keys needed)
│       │   ├── isometric/      # 2.5D coordinates and zone definitions
│       │   ├── panels/         # Inspector panel: live status, approvals, work history (/api/runs)
│       │   ├── state/liveOffice.ts # Session helpers, server-event reducer, stage events (say/visit/meeting)
│       │   └── App.tsx         # UI shell: demo / login / live modes, WebSocket with reconnect
│       ├── docs/
│       │   ├── office-density-expansion-plan.md # 3D prompts for Claude Sonnet 3.5/5.5 (AC, Bookshelf, etc.)
│       │   └── deployment-and-hosting-guide.md  # Phased hosting plan (free static demo, Tailscale, later VPS)
│       └── tools/3d-generator/ # Standalone HTML generators used to produce .glb files
├── docs/                       # Monorepo architecture and seat matrix documentation
├── package.json                # Root package.json scripts (typecheck, test, dev:next, dev:server)
└── start.bat / stop.bat        # Windows launcher scripts
```

---

## 3. Current State & What Was Just Built
- **3D Diorama Stage (`workspace/office-next/src/stage/IsometricOfficeStage.tsx`):**
  - **PBR Studio Lighting:** `RoomEnvironment` via `PMREMGenerator` (no gloomy fog), sun keylight (3.2 intensity), soft fill light, and 4 departmental zone downlights.
  - **Professional Benching Pod Layout:** Symmetrical 4-desk islands (2x2 facing desks across monitors) + North wall executive desks (Raka & Fajar) with a wide 2.5m central corridor.
  - **Monitor Screen Fix:** 6-sided `BoxGeometry` material array: only front face (+Z) has animated glowing code; back and sides are dark matte plastic casing.
  - **Avatar Rig & Typing:** Seated avatars face directly towards desks (`sitRotY = posInfo.rotY + Math.PI`). Arms articulate and tap keys on keyboards.
  - **Coffee Routine & Multi-Agent Queue:**
    - Slot 0: Brewing at espresso machine (`X: -3.8, Z: 3.4`).
    - Slot 1, 2, 3: Orderly queue line spaced 0.9m behind Slot 0. When Slot 0 leaves with cup, the line automatically steps forward.
    - Cup lifecycle: brewed at bar -> held in hand -> sipped at desk -> disposed at trash bin (`X: -5.0, Z: 4.1`) -> return to desk.
  - **Collision-Free Pathfinding:** NavMesh corridor graph (North Aisle Z=-3.4, Central Avenue X=0.0, South Promenade Z=0.8-1.2). Back-row agents never clip through front-row desks. Dynamic avoidance steers walking agents around each other.
  - **Speech Bubbles:** Projected 3D head coordinates to 2D HTML glassmorphism overlays in Indonesian (zero API keys).
  - **Live Binding (mode live):** avatar poses follow real `AgentStatus` (typing / raised hand for `waiting_approval` / head-scratch for `error` / empty chair for `offline` / relaxed for `idle`); `agent.say` shows as bubbles; agent→agent messages make the sender walk to the recipient's desk (carrying a document for review/handoff). Coffee & chit-chat only for idle agents. Demo mode keeps the full template simulation.
  - **Modular building (plan: `workspace/office-next/docs/modular_office_layers_plan.md`):** `BuildingRoot → Floor_1_Group → Room_MainWorkspace (0,0) / Corridor_East_Connector (8.10, 2.35) / Room_Boardroom_10p (13.5, 0)`. Room coordinates are local; read world positions through the scene graph. Every boardroom asset shows a procedural placeholder until its GLB exists in `public/models/`.
  - **Boardroom meetings:** `/rapat` or messages to `all` → agents leave in staggered order (0.9 s, nearest to the door first), pass the door mutex at `(8.80 / 10.20, 2.35)`, pull out their assigned chair (5+5 seat table in `layout.ts`), sit, then the 24 s session starts only after everyone is seated (chairs swivel to the TV for 13 s; the TV shows the meeting topic). The round table `(0.2, 2.2)` is now a huddle prop.
  - **Cameras:** Isometric (default) ↔ Free Cam 3D (WASD, Q up, E down, Shift, drag to look); HUD focus buttons for workspace/boardroom; auto-pan on meetings unless the CEO moved the camera in the last 8 s. Walls facing away from the camera fade (Sims-style).
  - **Dev-only debug hooks:** `window.__officeStage()` and `window.__officeStageDebug` (`meeting()`, `fastForward(s)`, `camera()`, `focus()`, `look()`, `zoom()`, `orbit()`, `path()`, `meetingState()`).

- **Security model (server):**
  - CEO token: `OFFICE_TOKEN` in `.env` (≥24 chars) or auto-generated in `data/.office-token`. Optional view-only `OFFICE_VIEWER_TOKEN`.
  - Browser login via `POST /api/session` → HttpOnly + SameSite=Strict HMAC cookie. Non-browser clients (MCP) use `Authorization: Bearer`.
  - Host/Origin allowlists (`OFFICE_ALLOWED_HOSTS`, `OFFICE_ALLOWED_ORIGINS`), no CORS, JSON-only POST, body limits.
  - Tool guards are deny-by-default (unknown/disabled agent IDs get nothing). Task ownership enforced; tasks with files are `done` only via reviewer ACC; REJECT is never committed.
  - `run_command`: always needs CEO approval in Semi mode, safe-charset args, no inline code (`node -e`, `python -c`), git read-only, `npx --no`, secrets stripped from child env.

---

## 4. Key Developer Commands

```powershell
# Typecheck entire monorepo (shared, server, web, office-next)
npm run typecheck

# Run Vitest test suites (64 tests, incl. HTTP/WS/MCP attack simulations)
npm test

# Run 3D Office Next dev server (port 5174)
npm run dev:next

# Build office-next (live) / static demo without backend (for free hosting)
npm run build:next
npm run build:next:demo

# Run backend server (port 7420, MCP 7421)
npm run dev:server
```

---

## 5. Strict Project Rules & Conventions

1. **Git Commits & Authorship:**
   - **Author:** Strictly `Muhayara <hafizhajah777@gmail.com>`
   - **Message Format:** `<type>(2.5d): <ringkasan> [by <Nama> — <Jabatan>]`
     - Example: `feat(2.5d): navigasi koridor bebas tabrakan prompt 3d sonnet dan panduan hosting [by Gita — Game Dev 2.5D]`
   - **No `Co-authored-by` trailers.**
2. **Language:**
   - User communication, documentation, and agent speech bubbles are in **Bahasa Indonesia**.
   - 3D generation prompts for Claude are in **English** (see `workspace/office-next/docs/office-density-expansion-plan.md`).
3. **Zero API Key Requirement for Dialogues:**
   - The 3D stage never calls an LLM. Ambient bubbles are template-driven (`workspace/office-next/src/stage/officeDialogues.ts`); in live mode it only displays `agent.say` text already produced by the server.
4. **Privacy:**
   - Never expose raw credentials, tokens, or private proxy tools in code, commits, or documentation.

---

## 6. Immediate Next Tasks
1. Remaining GLBs (all auto-load over their placeholders once placed in `public/models/`): `Office_Boardroom_Credenza.glb`, `Office_Conference_Table.glb`, `Office_Conference_Chair.glb` (must contain a `Chair_Swivel` node), `Office_Meeting_Table_Round.glb`. Prompts: `modular_office_layers_plan.md` §11 and `boardroom_audit_v2_solutions.md` §8–9.
2. Shrink large GLBs before hosting (e.g. `Office_Bookshelf_Cabinet.glb` 5 MB, `Office_Boardroom_Shell.glb` 5.2 MB).
3. Hosting Phase 1: static demo on Cloudflare Pages (`npm run build:next:demo`, output `workspace/office-next/dist`). Phase 2: Tailscale for live CEO access. See `deployment-and-hosting-guide.md`.
