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
│       │   │   ├── rooms/                  # Layer builders: mainWorkspace, mainCorridor (Jalan Utama/bus), meetingFoyer, boardroom, managerOffice, pantryCafe, lobbyReception, loungeRelax, serverRoom, collabCommons, digitalGarden, workshopTraining, infoWall, collabPods, studioContent, focusPods, accessHub, southWing / northWing (shells for rooms south / north of the bus + the second north tier), doors (motion-sensor sliding / swing doors), walls (procedural walls/doors), assets (GLB/placeholder)
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
│       │   ├── tahap-3-3d-prompts.md            # Stage 3 GLB prompts + §5 scene contracts & generator status
│       │   ├── tahap-3-prompts-tambahan.md      # Extra Stage 3 prompts (side table, areca palm, magazine rack) + corrections & contracts
│       │   ├── tahap-4-commons-garden.md        # Stage 4 spec + §5 corrections, final coordinates, new GLB slot contracts, Stage 5 notes
│       │   ├── tahap-4-3d-prompts.md            # Stage 4 GLB prompts + §4 generator status & verified contracts
│       │   ├── tahap-5-workshop-infowall-pods.md # Stage 5 spec + §8 corrections, final coordinates, GLB slot contracts, Stage 6 notes
│       │   ├── tahap-5-3d-prompts.md            # Stage 5 GLB prompts + §4 generator status & verified contracts
│       │   ├── tahap-6-studio-focus-access.md   # Stage 6 spec + §8 corrections, final coordinates, GLB verification (Floor 1 complete)
│       │   ├── tahap-6-3d-prompts.md            # Stage 6 GLB prompts (7 models) + §4 GLB status & scene placement changes
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
  - **Floor 1 Stage 4 (`tahap-4-commons-garden.md` §5):** `Room_CollabCommons` (20, 2), the first room NORTH of the bus east of the foyer, built with `buildNorthRoomShell` (`rooms/northWing.ts`: glass south wall with an open 1.6 m door at `Z 4.76..5.0`, solid north wall, full sub-slab), and `Room_DigitalGarden` (24.5, 10.4) south of the bus (`sides: { west: false }`, reuses the Server east wall). Frontage `commons` / `garden` are `built: true`.
    - **Commons:** the boardroom & foyer have no east wall (only curbs), so the Commons builds its own acoustic west wall (`X 15.0..15.24`, `interior`, always fades: a solid wall there hides the east 4.4 m of the boardroom). Glass east wall (future Workshop, interior). North wall with doors to the Studio (X 18, still CLOSED + "Segera" sign) and the Information Wall (X 23, opened in Stage 5, see below), wall title, mobile whiteboard, acoustic booth (NW, opens to the SE camera), 3.2 × 1.2 m collab table with 6 task chairs (`COMMONS.seats`, north row faces the camera), linear pendant. Ring lane `ringLane(COMMONS.ring)` picks the shorter way around.
    - **Garden:** gravel + synthetic lawn + slate stepping stones (`GARDEN.lane`), green wall only on the NORTH half of the west face (`Z 7.9..10.9`, keeps the Server racks visible), zen fountain with animated water overlay (south half, ≤ 1 m), teak bench facing south (3 seats), fiddle leaf fig (NE), monstera, snake plant, panorama window on the south wall, automatic sliding door.
    - **Behaviours (errands `commons` / `garden`):** every 90–150 s 3–4 relaxed agents from ≥ 2 groups (west pod / east pod / exec / manager) discuss at the Commons table for 25–35 s (pose `discuss`); Garden rest 15–25 s on the bench: demo every 60–100 s, live when an agent's status goes `working/thinking/messaging → idle`. Both are interruptible like coffee.
    - **New GLB slots (procedural placeholders, contracts in §5.E):** `Office_Commons_Collab_Table`, `Office_Commons_Acoustic_Booth`, `Office_Garden_Living_Wall`, `Office_Garden_Zen_Fountain`, `Office_Garden_Teak_Bench`, `Office_Plant_Fiddle_Leaf_Fig`.
  - **Floor 1 Stage 5 (`tahap-5-workshop-infowall-pods.md` §8):** `Room_WorkshopTraining` (28, 2) north of the bus (`buildNorthRoomShell`, `sides: { west: false }`, north wall `interior` with an open door to the Pods), plus the SECOND NORTH TIER (world Z -5..-1, `buildNorthTierShell`: exterior north wall, no south wall): `Room_InfoWall` (23.5, -3) entered through the Commons north door at X 23, and `Room_CollabPods` (28.5, -3) entered through the Workshop north door at X 28.5. Frontage `workshop` is `built: true`.
    - **Commons north wall** is split at X 21 (`northSegments`, fader ids `commons_north_west` / `commons_north_east`). Since Stage 6 both segments are `interior` (always fade) with open doors + thresholds (Studio at X 18, Information Wall at X 23); the wall title stays on the west segment (`fadeHide`).
    - **Workshop:** stage on the WEST side facing east (walnut slat backdrop, 85" display at scale 0.88 with a slide canvas, podium), 2 training tables at rotY **+π/2** (chair side +Z faces east) with 6 chairs facing west; `ringWithBranch` lane (ring + presenter branch round the south of the podium).
    - **Information Wall:** command display on the solid north wall with a live 3-column canvas (live = real agent data only; sample build stats only in demo, labelled SIMULASI), kanban board on the west wall (slot `InfoWall_Kanban_Board`, child of `walls.west`; the wall is `interior` since Stage 6 so wall + kanban always fade), 3 observer spots.
    - **Collaboration Pods:** 2 diner pods open to +Z, seats facing each other (`sitY 0.35`), scene-owned occupancy lamps (green / amber).
    - **Behaviours:** Workshop session every 120–180 s (presenter from Raka/Bima/Gita/Tari/Sari, pose `inspect`, + 2–4 seated attendees), Information Wall check every 85–135 s (1–2 agents, Laras/Fajar/Satria/Bima/Raka first), pair huddle in a free pod every 95–145 s, and in live mode a pair that just messaged each other (visit event, remembered 90 s) goes to a pod once both are idle. CEO decision: no cap on how many agents are away on routines.
    - **New GLB slots (procedural placeholders, contracts in §8.E):** `Office_Workshop_Lectern_Podium`, `Office_Workshop_Training_Table`, `Office_InfoWall_Command_Display` (screen mesh `InfoWall_Main_Screen`, `Command_Screen_Active` also accepted), `Office_InfoWall_Kanban_Board`, `Office_Collab_Diner_Pod` (optional LED mesh `Pod_Occupancy_LED` is recoloured by the scene, otherwise a scene lamp is used).
  - **Floor 1 Stage 6 — Floor 1 complete, 16/16 zones (`tahap-6-studio-focus-access.md` §8):** `Room_StudioContent` (18, -3) in the second north tier (`buildNorthTierShell` + new `sideMats`; own west wall in boardroom style, `interior`; east = InfoWall west wall), entered through the Commons north door at X 18; `Room_FocusPods` (16, 10.4) between Lounge and Server (`sides` none, smoked glass + privacy band, auto sliding door); `Room_AccessHub` (29, 10.4) east of the Garden (exterior east/south walls, auto double sliding door). Every `BUS_FRONTAGE_*` segment is `built: true` (no temporary glass, no "Segera" door left on Floor 1).
    - **Studio:** green-screen cyclorama on the solid north wall (talent mark ✕ at world (16.75, -3.72)), cinema camera + softbox rig facing north (operator at (16.75, -1.65)), production / colour-grading desk + ergonomic chair (editor seat 0.32 m from the desk edge), "ON AIR" lamp on the north wall (lit while a talent stands on the mark), one polyline lane `(-1.25,1.45)→(0.42,1.45)→(0.42,-0.72)→(-1.25,-0.72)`.
    - **Focus Pods:** 2 solo pods on the west side rotated **45°** (mouth facing the SE camera; at +90° / 0° the seated agent is hidden by the front fins), status LED `Focus_Status_LED` green ↔ coral red (`#f43f5e`) while an agent sits, "QUIET ZONE" sign attached to the Lounge east wall (`attachSign` before `lounge.bindWalls()`).
    - **Access Hub:** lift portal flush on the west wall (north half), low floor-map totem (≤ 1.25 m, south half, live 16-zone canvas over `Access_Map_Screen`), floating staircase moved to the **north-east** quadrant with rotY π (at the planned SE spot its landing hid the totem reader), ring ceiling light.
    - **Behaviours:** Studio session every 110–165 s (Wulan/Tari/Dimas/Gita/Fajar first; 2 agents = camera operator `inspect` + talent with the new standing pose `present`, 1 agent = editor `type`), deep focus every 85–130 s (Bima/Gita/Satria/Sari/Fajar/Laras, 22–32 s, `sitY 0.35`), Access Hub visit every 130–190 s (Raka/Sari/Fajar 75%: totem 9–13 s then lift 5–8 s, call button lights up).
    - **Commons whiteboard** moved to local (-4.35, 1.65, rotY π/2) = world (15.65, 3.65) facing the collab table (it used to hide the Studio); snake plant to (-4.4, 0.2).
    - **Adding Floor 2 later:** new rooms get their own shell (`rooms/southWing.ts` / `rooms/northWing.ts` / `rooms/walls.ts`), a `NavRoom` + connector, a walk zone and a `StageRoom` entry in `IsometricOfficeStage.tsx`. Keep tall furniture off walls facing the SE camera's line of sight to agent spots (check with the iso ray: per 1 m of height a point shifts ΔX -1.39, ΔZ -1.544).
  - **Boardroom meetings:** `/rapat` or messages to `all` → agents leave in staggered order (0.9 s, nearest to the door first), walk out the nearest workspace south door, along the bus, straight through the foyer, pass the door mutex at `(11.0, 3.4 / 1.35)`, pull out their assigned chair (5+5 seat table in `layout.ts`), sit, then the 24 s session starts only after everyone is seated (chairs swivel to the TV for 13 s; the TV and the foyer status sign show the meeting topic). Full gathering takes about 26 s. The round table `(0.2, 2.2)` is now a huddle prop.
  - **Cameras:** Isometric (default, auto-framed via `setHomeBox` to workspace + boardroom + foyer + Manager + Pantry + Lobby + Lounge) ↔ Free Cam 3D (WASD, Q up, E down, Shift, drag to look; starts hovering above the walls); HUD dropdown "Fokus: ruangan" with 17 entries (Jalan Utama + all 16 Floor 1 rooms) (`focusRoom(StageRoom)`; the home frame stays X -7..15, Server and every room east of the foyer are reached through the dropdown); auto-pan on meetings unless the CEO moved the camera in the last 8 s.
  - **Wall Auto-Fade:** dollhouse view (isometric, or Free Cam above 3.2 m / outside the site): perimeter walls fade when the camera is behind them, interior walls between two rooms (`interior: true`, e.g. the shared TV wall and all south walls facing the bus) always fade. Free Cam inside the site below 3.2 m = walk mode, every wall stays solid. The fader clones wall materials on register (change colours through the mesh's current material); meshes with `userData.fadeHide = true` (wall titles / signs) vanish completely when their wall is fully faded.
  - **Dev-only debug hooks:** `window.__officeStage()` (incl. `room`, `stool`) and `window.__officeStageDebug` (`meeting()`, `fastForward(s)`, `camera()`, `focus()`, `look()`, `zoom()`, `orbit()`, `path()`, `roomAt()`, `freeAt(pos, lookAt)`, `meetingState()`, `pantryState()`, `coffee(id)`, `visit(from, to)`, `errandState()`, `lounge(id)`, `inspect(id)`, `commons(ids?)`, `garden(id)`, `workshop(presenter?, attendees?)`, `infowall(ids?)`, `pod(a?, b?, podIndex?)`, `studio(ids?)`, `focusPod(id?, podIdx?)`, `access(id?)`, `leave(id)`, `arrive(id)`, `scene`, `sun`).

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
1. **Floor 1 is complete (Stage 6 done, 16/16 zones).** All 7 Stage 6 GLBs are in `public/models/` (along with their 7 HTML generators in `tools/3d-generator/`) and verified in the scene (`tahap-6-studio-focus-access.md` §8.C). *(Only `Office_Meeting_Table_Round` in the main workspace still uses a placeholder, with its older 16 Nov HTML generator in `tools/3d-generator/`.)*
2. **Next stage plans** (e.g. Floor 2, or `docs/rencana-optimasi-performa-3d.md`): analyse against code/GLB measurements before coding, as in every previous stage.
3. Hosting Phase 1: static demo on Cloudflare Pages (`npm run build:next:demo`, output `workspace/office-next/dist`). Phase 2: Tailscale for live CEO access. See `deployment-and-hosting-guide.md`.
