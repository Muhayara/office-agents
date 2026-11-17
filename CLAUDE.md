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
│       │   │   ├── rooms/                  # Layer builders: mainWorkspace, mainCorridor (Jalan Utama/bus), meetingFoyer, boardroom, walls (procedural walls/doors), assets (GLB/placeholder)
│       │   │   ├── camera/                 # cameraRig (Isometric ↔ Free Cam 3D), wallFade (Sims-style auto-fade)
│       │   │   └── officeDialogues.ts      # Template-based Indonesian dialogue lines (Zero API keys needed)
│       │   ├── isometric/      # 2.5D coordinates and zone definitions
│       │   ├── panels/         # Inspector panel: live status, approvals, work history (/api/runs)
│       │   ├── state/liveOffice.ts # Session helpers, server-event reducer, stage events (say/visit/meeting)
│       │   └── App.tsx         # UI shell: demo / login / live modes, WebSocket with reconnect
│       ├── docs/
│       │   ├── blueprint-lantai-1-v6.2.html     # Floor 1 master plan (38 × 18.4 m, 16 zones, build stages 1–6)
│       │   ├── tahap-1-bus-architecture.md      # Stage 1 spec + §6 corrections, final coordinates, verification
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
  - **Coffee Routine & Multi-Agent Queue** (temporary pantry in the SW corner of the workspace until Stage 2 Pantry / Café):
    - Slot 0: Brewing at espresso machine (`X: -5.8, Z: 3.6`, facing south to the bar at `(-5.8, 4.33)`).
    - Slot 1, 2, 3: Orderly queue line spaced 0.9m north of Slot 0. When Slot 0 leaves with cup, the line automatically steps forward.
    - Cup lifecycle: brewed at bar -> held in hand -> sipped at desk -> disposed at trash bin (`X: -2.4, Z: 4.46`, east of the SW door) -> return to desk.
  - **Collision-Free Pathfinding:** NavMesh corridor graph (North Aisle Z=-3.4, Central Avenue X=0.0, South Promenade Z=0.8-1.2). Back-row agents never clip through front-row desks. Dynamic avoidance steers walking agents around each other. The building router tries every door route between rooms and takes the shortest total walk (the workspace has 2 doors onto the bus).
  - **Speech Bubbles:** Projected 3D head coordinates to 2D HTML glassmorphism overlays in Indonesian (zero API keys).
  - **Live Binding (mode live):** avatar poses follow real `AgentStatus` (typing / raised hand for `waiting_approval` / head-scratch for `error` / empty chair for `offline` / relaxed for `idle`); `agent.say` shows as bubbles; agent→agent messages make the sender walk to the recipient's desk (carrying a document for review/handoff). Coffee & chit-chat only for idle agents. Demo mode keeps the full template simulation.
  - **Floor 1 bus topology (Stage 1 of `blueprint-lantai-1-v6.2.html`, details in `tahap-1-bus-architecture.md` §6):** `BuildingRoot → Floor_1_Group → Room_MainWorkspace (0,0) / Corridor_MainBus (12, 6.2) / Room_MeetingFoyer (11, 4) / Room_Boardroom_10p (11, -1)`. World = blueprint metres − (7, 5); site spans X -7..31, Z -5..13.4. The workspace has a south wall with 2 doors (X -3.5 and +3.5) onto the 38 × 2.4 m Jalan Utama; the boardroom sits right next to the workspace (shared wall at X 7) and is entered through the open foyer (center door X 11). Room coordinates are local; read world positions through the scene graph. Every boardroom asset shows a procedural placeholder until its GLB exists in `public/models/`.
  - **Building out later stages:** unbuilt bus frontage is closed by temporary dark-framed glass walls per room segment (`BUS_FRONTAGE_SOUTH/NORTH` in `layout.ts`). When a Stage 2–6 room is built, set its segment `built: true` and give the room its own doored wall (`rooms/walls.ts` → `buildSolidWallX`).
  - **Boardroom meetings:** `/rapat` or messages to `all` → agents leave in staggered order (0.9 s, nearest to the door first), walk out the nearest workspace south door, along the bus, straight through the foyer, pass the door mutex at `(11.0, 3.4 / 1.35)`, pull out their assigned chair (5+5 seat table in `layout.ts`), sit, then the 24 s session starts only after everyone is seated (chairs swivel to the TV for 13 s; the TV and the foyer status sign show the meeting topic). Full gathering takes about 26 s. The round table `(0.2, 2.2)` is now a huddle prop.
  - **Cameras:** Isometric (default, auto-framed to the core cluster via `setHomeBox`) ↔ Free Cam 3D (WASD, Q up, E down, Shift, drag to look; starts hovering above the walls); HUD focus buttons for workspace/boardroom (`focusRoom` also accepts `foyer`/`bus`); auto-pan on meetings unless the CEO moved the camera in the last 8 s.
  - **Wall Auto-Fade:** dollhouse view (isometric, or Free Cam above 3.2 m / outside the site): perimeter walls fade when the camera is behind them, interior walls between two rooms (`interior: true`, e.g. the shared TV wall and all south walls facing the bus) always fade. Free Cam inside the site below 3.2 m = walk mode, every wall stays solid.
  - **Dev-only debug hooks:** `window.__officeStage()` and `window.__officeStageDebug` (`meeting()`, `fastForward(s)`, `camera()`, `focus()`, `look()`, `zoom()`, `orbit()`, `path()`, `roomAt()`, `freeAt(pos, lookAt)`, `meetingState()`, `scene`, `sun`).

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
# On this PC esbuild may fail with "remove ...\Temp\esbuild-...: Access is denied" (chunks > 1 MB go
# through a temp file that something locks, likely the antivirus). Point TEMP/TMP to drive P: first:
#   New-Item -ItemType Directory -Force .esbuild-tmp; $env:TEMP = "$PWD\.esbuild-tmp"; $env:TMP = $env:TEMP

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
1. **Floor 1 Stage 2** (`blueprint-lantai-1-v6.2.html`): Pantry / Café (blueprint x 11–16 m → world X 4..9, south of the bus) taking over the coffee bar, water dispenser and trash bin from the workspace, plus Ruang Manajer (world X -7..-1). Analyse the stage plan against code/GLB measurements before coding (see the corrections in `tahap-1-bus-architecture.md` §6). Place the new coffee bar on a north or west wall so the brewing agent stays visible from the SE camera.
2. Remaining GLB: `Office_Meeting_Table_Round.glb` (huddle table; auto-loads over its placeholder once placed in `public/models/`). `Office_Glass_Corridor.glb` is no longer used by the scene since Stage 1.
3. Hosting Phase 1: static demo on Cloudflare Pages (`npm run build:next:demo`, output `workspace/office-next/dist`). Phase 2: Tailscale for live CEO access. See `deployment-and-hosting-guide.md`.
