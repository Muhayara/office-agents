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
│       │   │   ├── rooms/                  # Layer builders: mainWorkspace, mainCorridor (Jalan Utama/bus), meetingFoyer, boardroom, managerOffice, pantryCafe, lobbyReception, loungeRelax, serverRoom, southWing (shell for rooms south of the bus), doors (motion-sensor sliding / swing doors), walls (procedural walls/doors), assets (GLB/placeholder)
│       │   │   ├── camera/                 # cameraRig (Isometric ↔ Free Cam 3D), wallFade (Sims-style auto-fade)
│       │   │   └── officeDialogues.ts      # Template-based Indonesian dialogue lines (Zero API keys needed)
│       │   ├── isometric/      # 2.5D coordinates and zone definitions
│       │   ├── panels/         # Inspector panel: live status, approvals, work history (/api/runs)
│       │   ├── state/liveOffice.ts # Session helpers, server-event reducer, stage events (say/visit/meeting)
│       │   └── App.tsx         # UI shell: demo / login / live modes, WebSocket with reconnect
│       ├── docs/
│       │   ├── blueprint-lantai-1-v6.2.html     # Floor 1 master plan (38 × 18.4 m, 16 zones, build stages 1–6)
│       │   ├── tahap-1-bus-architecture.md      # Stage 1 spec + §6 corrections, final coordinates, verification
│       │   ├── tahap-2-pantry-manager.md        # Stage 2 spec + §7 corrections, final coordinates, new GLB slots, Stage 3 notes
│       │   ├── tahap-2-3d-prompts.md            # Stage 2 GLB prompts + §5 scene contracts (names, sizes, pivots) & generator status
│       │   ├── tahap-3-lobby-lounge-server.md   # Stage 3 spec + §5 corrections, final coordinates, provisional GLB slots, Stage 4 notes
│       │   ├── tahap-3-3d-prompts.md            # Stage 3 GLB prompts (not yet aligned with the scene slots)
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
  - **Professional Benching Pod Layout:** Symmetrical 4-desk islands (2x2 facing desks across monitors) + North wall executive desk (Fajar; Raka's old spot now holds the scrum whiteboard) with a wide 2.5m central corridor. Desk spots in `layout.ts` are room-local and carry `room` (`main` / `manager`).
  - **Monitor Screen Fix:** 6-sided `BoxGeometry` material array: only front face (+Z) has animated glowing code; back and sides are dark matte plastic casing.
  - **Avatar Rig & Typing:** Seated avatars face directly towards desks (`sitRotY = posInfo.rotY + Math.PI`). Arms articulate and tap keys on keyboards.
  - **Coffee Routine & Multi-Agent Queue** (in the Pantry / Café since Stage 2; all pantry spots are pantry-local in `PANTRY` and converted to world through the scene graph):
    - Slot 0: Brewing at the espresso machine of the Coffee Bar on the pantry WEST wall (world `(5.35, 11.37)`, facing west).
    - Slot 1, 2, 3: queue along the bar front toward the door (`X 5.35`, `Z 10.47 / 9.57 / 8.67`, facing the head of the queue). `moveToQueueSlot` steps agents forward in line, or re-routes them through doors if they are still on the way.
    - Cup lifecycle: brewed -> sit on a free bar-island stool (4 stools, `walk_to_stool` / `sipping_at_bar`) -> dispose at the recycle bin next to the pantry door (`(7.55, 7.86)`) -> return to desk. If all stools are taken: carry the cup to the desk (old flow) and dispose in the pantry later.
  - **Collision-Free Pathfinding:** NavMesh corridor graph (North Aisle Z=-3.4, Central Avenue X=0.0, South Promenade Z=0.8-1.2). Back-row agents never clip through front-row desks. Dynamic avoidance steers walking agents around each other. The building router tries every door route between rooms and takes the shortest total walk (the workspace has 2 doors onto the bus). Single-lane rooms use `laneX` / `laneZ` (bus, foyer, Manager lane `Z 8.6`, Pantry spine `X 6.5`).
  - **Speech Bubbles:** Projected 3D head coordinates to 2D HTML glassmorphism overlays in Indonesian (zero API keys).
  - **Live Binding (mode live):** avatar poses follow real `AgentStatus` (typing / raised hand for `waiting_approval` / head-scratch for `error` / relaxed for `idle`); going `offline` = the agent walks out to the Lobby and disappears (state `away`), coming back online = it appears on the Lobby welcome rug and walks to its desk; `agent.say` shows as bubbles; agent→agent messages make the sender walk to the recipient's desk visit spot (carrying a document for review/handoff; reviews for Raka go to the Manager office). Coffee & chit-chat only for idle agents. Demo mode keeps the full template simulation and starts with every agent arriving from the Lobby (1.2 s apart).
  - **Floor 1 bus topology (Stage 1 of `blueprint-lantai-1-v6.2.html`, details in `tahap-1-bus-architecture.md` §6):** `BuildingRoot → Floor_1_Group → Room_MainWorkspace (0,0) / Corridor_MainBus (12, 6.2) / Room_MeetingFoyer (11, 4) / Room_Boardroom_10p (11, -1)`. World = blueprint metres − (7, 5); site spans X -7..31, Z -5..13.4. The workspace has a south wall with 2 doors (X -3.5 and +3.5) onto the 38 × 2.4 m Jalan Utama; the boardroom sits right next to the workspace (shared wall at X 7) and is entered through the open foyer (center door X 11). Room coordinates are local; read world positions through the scene graph. Every boardroom asset shows a procedural placeholder until its GLB exists in `public/models/`.
  - **Floor 1 Stage 2 (`tahap-2-pantry-manager.md` §7):** `Room_ManagerOffice` (-4, 10.4) and `Room_PantryCafe` (6.5, 10.4) south of the bus, built with `buildSouthRoomShell` (glass north wall with door at `Z 7.40..7.64` + threshold, solid S/W/E walls). Manager: Raka's walnut L-desk facing east, credenza + 55" KPI TV (canvas, live counts) + bookshelf on the west wall (the only wall that stays solid from the SE camera), 2 guest lounge chairs, smoked glass with privacy band, city-view window + walnut slats. Pantry: Coffee Bar / dispenser / tall utility cabinet on the west wall, counter + sink + subway tiles on the south wall, bar island with 4 stools, mosaic tile floor. North walls and walls facing future rooms (Manager east, Pantry west/east) are `interior` (always fade in dollhouse view).
  - **Floor 1 Stage 3 (`tahap-3-lobby-lounge-server.md` §5):** `Room_LobbyReception` (1.5, 10.4), `Room_LoungeRelax` (11.5, 10.4), `Room_ServerIT` (20, 10.4), all via `buildSouthRoomShell` (`sides` skips walls that a neighbour already owns; the Server room uses `north: 'solid'`). Feature items sit on the WEST walls facing the SE camera.
    - **Lobby:** marble floor, black-marble logo wall "OFFICE AGENTS" behind a curved reception desk facing east, live directory kiosk canvas (attendance per room), teal accent chairs, spawn rug, and an automatic double sliding glass door (`rooms/doors.ts`).
    - **Lounge:** sage paint, L-sofa with 3 seats (`LOUNGE.seats`), coffee table, arc lamp, palm, magazine rack, canvas art.
    - **Server / IT:** the 2 racks moved out of the workspace (fronts face south, U-shaped `polylineLane` around them), CRAC on the west wall, animated NOC screen, IT console, and a steel swing door with an RFID keypad (red/green LED).
    - **Agent errands (`walk_to_errand` / `errand_stay`, interruptible like coffee):** after a meeting 2–3 attendees sit on the Lounge sofa for 16–24 s; every 70–120 s an idle Satria or Bima inspects the racks, then sits at the IT console.
    - **Home frame:** the Server room is left out of the home frame on purpose (including it costs ±16% zoom); it stays visible bottom-right.
  - **Building out later stages:** unbuilt bus frontage is closed by temporary dark-framed glass walls per room segment (`BUS_FRONTAGE_SOUTH/NORTH` in `layout.ts`). When a Stage 4–6 room is built, set its segment `built: true` and give the room its own doored wall (south side: `rooms/southWing.ts`; others: `rooms/walls.ts` → `buildSolidWallX` / `buildGlassWallX` with `doors`). Also add its `NavRoom` + bus connector, walk zone, and home-frame box in `IsometricOfficeStage.tsx`. Keep tall furniture off the bus-side wall (it hides the bus from the SE camera).
  - **Boardroom meetings:** `/rapat` or messages to `all` → agents leave in staggered order (0.9 s, nearest to the door first), walk out the nearest workspace south door, along the bus, straight through the foyer, pass the door mutex at `(11.0, 3.4 / 1.35)`, pull out their assigned chair (5+5 seat table in `layout.ts`), sit, then the 24 s session starts only after everyone is seated (chairs swivel to the TV for 13 s; the TV and the foyer status sign show the meeting topic). Full gathering takes about 26 s. The round table `(0.2, 2.2)` is now a huddle prop.
  - **Cameras:** Isometric (default, auto-framed via `setHomeBox` to workspace + boardroom + foyer + Manager + Pantry + Lobby + Lounge) ↔ Free Cam 3D (WASD, Q up, E down, Shift, drag to look; starts hovering above the walls); HUD dropdown "Fokus: ruangan" covering all 9 Floor 1 rooms (`focusRoom(StageRoom)`); auto-pan on meetings unless the CEO moved the camera in the last 8 s.
  - **Wall Auto-Fade:** dollhouse view (isometric, or Free Cam above 3.2 m / outside the site): perimeter walls fade when the camera is behind them, interior walls between two rooms (`interior: true`, e.g. the shared TV wall and all south walls facing the bus) always fade. Free Cam inside the site below 3.2 m = walk mode, every wall stays solid.
  - **Dev-only debug hooks:** `window.__officeStage()` (incl. `room`, `stool`) and `window.__officeStageDebug` (`meeting()`, `fastForward(s)`, `camera()`, `focus()`, `look()`, `zoom()`, `orbit()`, `path()`, `roomAt()`, `freeAt(pos, lookAt)`, `meetingState()`, `pantryState()`, `coffee(id)`, `visit(from, to)`, `errandState()`, `lounge(id)`, `inspect(id)`, `leave(id)`, `arrive(id)`, `scene`, `sun`).

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
1. **Export the Stage 3 GLBs:** the 8 generators are ready in `tools/3d-generator/` (gitignored, local only): `Office_Lobby_Reception_Desk`, `Office_Lobby_Directory_Kiosk`, `Office_Lobby_Accent_Armchair`, `Office_Lounge_Sectional_Sofa`, `Office_Lounge_Coffee_Table`, `Office_Lounge_Arc_Floor_Lamp`, `Office_Server_CRAC_Unit`, `Office_Server_Admin_Console` (contracts in `tahap-3-3d-prompts.md` §5; the scene is already aligned and was verified with the in-memory GLBs). Open the HTML, click Export GLB, copy to `public/models/`. Still without a generator: `Office_Lobby_Side_Table`, `Office_Plant_Areca_Palm`, `Office_Lounge_Magazine_Rack`, `Office_Meeting_Table_Round` (huddle table). `Office_Glass_Corridor.glb` is no longer used by the scene since Stage 1.
2. **Floor 1 Stage 4** (`blueprint-lantai-1-v6.2.html`): Collaboration Commons (X 15..25, north of the bus; needs a north-side shell builder) and Digital Garden (X 22..27, south; reuses the Server east wall). See `tahap-3-lobby-lounge-server.md` §5.G. Analyse the stage plan against code/GLB measurements before coding.
3. Hosting Phase 1: static demo on Cloudflare Pages (`npm run build:next:demo`, output `workspace/office-next/dist`). Phase 2: Tailscale for live CEO access. See `deployment-and-hosting-guide.md`.
