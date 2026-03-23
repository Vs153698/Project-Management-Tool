# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev mode (launches Electron + Vite HMR)
npm run build        # Build for production (outputs to out/)
npm run build:mac    # Build + package as macOS .dmg
npm install --legacy-peer-deps  # Install deps (required due to recharts peer dep conflict)
```

## Architecture

**Electron + Vite + React + TypeScript** — built with `electron-vite`.

```
src/
  main/index.ts         # Electron main process — all IPC handlers, file system ops
  preload/index.ts      # Context bridge — exposes window.electron API to renderer
  renderer/src/
    App.tsx             # Top-level router: SetupWizard → LoginScreen → AppLayout
    types/index.ts      # Shared TypeScript types (Project, Payment, Credential, etc.)
    store/useAppStore.ts # Zustand store — all app state and DB mutations
    components/
      auth/LoginScreen.tsx          # PIN pad + Touch ID login
      onboarding/SetupWizard.tsx    # 4-step first-run wizard (name, PIN, folder)
      layout/{AppLayout, Sidebar}   # Shell layout with navigation
      dashboard/Dashboard.tsx       # Stats, revenue chart, recent projects
      projects/{ProjectList, CreateProjectModal, ProjectDetail}
      payments/PaymentTimeline.tsx  # Payment history + progress tracking
      credentials/CredentialVault.tsx  # PIN/Touch ID locked credential storage
      files/FileManager.tsx         # Upload/browse project files
      analytics/Analytics.tsx       # Revenue charts, project status breakdown
```

## Authentication

- **No backend** — entirely local.
- PIN (4-digit) hashed with SHA-256 + salt in main process (`createHash` from Node crypto).
- Touch ID via `systemPreferences.promptTouchID()` (macOS only).
- IPC: `auth:verify-pin` and `auth:touch-id` → both return `{ success, user? }`.
- **Credential Vault** requires a second PIN/Touch ID unlock to reveal values. Auto-locks after 2 minutes.

## Data Storage

- **Settings** (rootFolder, pinHash, userName, isSetup): `electron-store` in userData.
- **Database** (`projects`, `payments`, `credentials`): JSON file at `{rootFolder}/FreelanceVault/data/db.json`.
- **Project files**: `{rootFolder}/FreelanceVault/projects/{projectId}/files/` and `/docs/`.
- All DB reads/writes go through IPC: `db:read` / `db:write`.

## IPC Contract

All renderer→main calls use `window.electron.*` (defined in `preload/index.ts`):

| Method | IPC channel | Notes |
|---|---|---|
| `verifyPin(pin)` | `auth:verify-pin` | Returns `{success, user?}` |
| `touchIdAuth()` | `auth:touch-id` | Uses `systemPreferences.promptTouchID` |
| `checkTouchId()` | `auth:check-touch-id` | Returns `{available}` |
| `setupComplete({rootFolder, name, pin})` | `app:setup-complete` | Creates folder structure |
| `dbRead()` / `dbWrite(db)` | `db:read` / `db:write` | Full DB replace on write |
| `filesUpload({projectId, category})` | `files:upload` | Opens dialog, copies files |
| `filesList({projectId, category})` | `files:list` | Returns `FileInfo[]` |

## Design System

Tailwind custom colors defined in `tailwind.config.js`:
- `bg-background` (#0a0a0f), `bg-surface` (#12121a), `bg-card` (#1a1a27)
- `border-border` (#252538)
- `text-primary` (#7c3aed violet), `text-accent` (#06b6d4 cyan)
- CSS classes: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.input`, `.label`, `.badge`, `.modal-overlay`

## Key Patterns

- New DB mutations: update via `useAppStore.saveDb(newDb)` — always pass the full DB object.
- Adding a project also calls `window.electron.projectCreateFolders(projectId)` to create the folder structure.
- `window.electron` type is declared via the `ElectronAPI` interface in `src/preload/index.ts`.
