# CLAUDE.md — Project Briefing & Instructions for Claude Code
> **Project:** Office Agents 2.5D (Virtual AI Office & Meja Dispatch)  
> **Workspace Root:** `P:\gemini-lab\office`  
> **Author:** `Muhayara <hafizhajah777@gmail.com>`  
> **Primary Language:** Indonesian (Bahasa Indonesia) for UI text, agent dialogs, and commit messages.

---

## 1. What Is This Project?
**Office Agents 2.5D** is an interactive, browser-based virtual office simulation and AI workforce dispatch command center.
- The user acts as the **CEO** managing **10 specialized AI agents** (Raka, Sari, Dimas, Tari, Wulan, Bima, Gita, Satria, Laras, Fajar).
- **Core Visual Feature:** A **3D WebGL Isometric Diorama** built with **Three.js (r128)**, featuring real-time PBR studio lighting, animated monitors with scrolling syntax code, interactive typing avatars, a complete coffee break & queue routine, and floating glassmorphism speech bubbles in Indonesian.

---

## 2. Monorepo Architecture

```text
P:\gemini-lab\office\
├── packages/
│   └── shared/                 # @office/shared — Shared TypeScript types, Zod schemas, MCP tools, permissions
├── apps/
│   ├── server/                 # @office/server — Fastify/Express + WebSocket (:7420) + MCP (:7421) + SQLite WAL
│   │   └── src/                # Core engine, git service, security scanner, scheduler, prompt builders
│   └── web/                    # @office/web — React 18 + Vite classic dispatch dashboard (:5173)
├── workspace/
│   └── office-next/            # Next-Gen 3D Three.js Diorama Studio (:5174)
│       ├── public/models/      # Production 3D GLB Models (room shell, desk, chair, coffee bar, server racks, plants)
│       ├── src/
│       │   ├── stage/
│       │   │   ├── IsometricOfficeStage.tsx # Main 3D WebGL Canvas, Scene, Lights, Avatar Rigs, Nav Graph
│       │   │   └── officeDialogues.ts      # Template-based Indonesian dialogue lines (Zero API keys needed)
│       │   ├── isometric/      # 2.5D coordinates and zone definitions
│       │   ├── panels/         # Inspector panel and telemetry
│       │   └── App.tsx         # Main UI shell and WebSocket connection
│       ├── docs/
│       │   ├── office-density-expansion-plan.md # 3D prompts for Claude Sonnet 3.5/5.5 (AC, Bookshelf, etc.)
│       │   └── deployment-and-hosting-guide.md  # Production hosting guide (Docker, Railway, VPS, Caddy)
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

---

## 4. Key Developer Commands

```powershell
# Typecheck entire monorepo (shared, server, web, office-next)
npm run typecheck

# Run Vitest test suites (26 unit tests)
npm test

# Run 3D Office Next dev server (port 5174)
npm run dev:next

# Run backend server (port 7420 / 3000)
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
   - Speech bubbles are 100% template-driven (`workspace/office-next/src/stage/officeDialogues.ts`), requiring no external LLM API keys for stage interactions.
4. **Privacy:**
   - Never expose raw credentials, tokens, or private proxy tools in code, commits, or documentation.

---

## 6. Immediate Next Tasks
1. Generate the 5 remaining 3D density props using the prompts in `workspace/office-next/docs/office-density-expansion-plan.md`:
   - `Office_Wall_AC_Unit.glb`
   - `Office_Bookshelf_Cabinet.glb`
   - `Office_Whiteboard_Scrum.glb`
   - `Office_Water_Dispenser.glb`
   - `Office_Meeting_Table_Round.glb`
2. Integrate these `.glb` models into `decorGroup` in `IsometricOfficeStage.tsx`.
3. Prepare production deployment (Railway / Docker VPS) following `deployment-and-hosting-guide.md`.
