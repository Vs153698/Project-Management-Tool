# FreelanceVault — Setup & Installation Guide

## What is FreelanceVault?

A local-first project management app for freelancers. All data stays on your Mac — no cloud, no accounts, no subscriptions.

---

## Prerequisites

Install these before anything else.

**Node.js (v18 or higher)**

Download from [nodejs.org](https://nodejs.org) — pick the LTS version. After installing, verify:

```bash
node --version   # should show v18.x or higher
npm --version    # should show 9.x or higher
```

**Git** (optional, only needed to clone)

macOS usually has Git pre-installed. Check with:

```bash
git --version
```

---

## Running in Development Mode

Development mode gives you live reload — the app updates instantly when you change code.

### Step 1 — Get the project

If you have the folder already, skip this. Otherwise copy or move `freelance-vault/` anywhere on your Mac.

### Step 2 — Install dependencies

Open Terminal, navigate to the project folder, and run:

```bash
cd "/Users/vaibhavsingh/Project Management/freelance-vault"
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required due to a peer dependency conflict with `recharts`. This is safe to use.

### Step 3 — Start the app

```bash
npm run dev
```

The Electron window will open automatically. You'll see the first-run setup wizard on a fresh install.

---

## Building for Production

A production build bundles and optimises everything. Run this before packaging.

```bash
npm run build
```

Output goes to the `out/` folder.

---

## Installing on Your Mac (as a native .app)

This packages FreelanceVault as a proper macOS `.app` you can keep in your Applications folder.

### Step 1 — Build and package

```bash
npm run build:mac
```

This runs `electron-builder` and creates a `.dmg` installer in the `dist/` folder. It may take 2–3 minutes.

### Step 2 — Install

1. Open Finder and navigate to `freelance-vault/dist/`
2. Double-click the `.dmg` file (e.g. `FreelanceVault-1.0.0.dmg`)
3. Drag **FreelanceVault** into your **Applications** folder
4. Eject the disk image
5. Open **Applications** → double-click **FreelanceVault**

### Step 3 — Handle macOS Gatekeeper (first launch only)

Because the app isn't signed with an Apple Developer certificate, macOS may block it on first open.

**Fix:**
1. Open **System Settings** → **Privacy & Security**
2. Scroll down — you'll see a message about FreelanceVault being blocked
3. Click **Open Anyway**
4. Confirm in the dialog that appears

After this one-time step, the app opens normally every time.

---

## First-Run Setup

When you open FreelanceVault for the first time:

1. **Welcome** — overview of features, click Get Started
2. **Your Name** — enter your name (stored locally only)
3. **Create PIN** — type a 4-digit PIN; enter it twice to confirm. You can type directly with your keyboard or click "Show keypad" for a visual numpad
4. **Choose Location** — pick where FreelanceVault should create its data folder. Default is `~/Documents`. Click Browse to change it.

FreelanceVault creates this folder structure:

```
[your chosen location]/
  FreelanceVault/
    data/
      db.json          ← all your projects, payments, credentials
    projects/
      [project-id]/
        files/         ← uploaded project files
        docs/          ← uploaded documents
        credentials/   ← credential folder (data is in db.json)
```

---

## Signing In

After setup, the login screen shows a 4-dot PIN entry:

- **Keyboard** — just start typing your 4 digits
- **Virtual keypad** — click "Show keypad" to get a visual numpad
- **Touch ID** — if your Mac supports it, a "Sign in with Touch ID" button appears

---

## Credential Vault

When you open the Credentials tab inside a project, the vault is **locked by default**.

Click **Unlock** and enter your PIN (or use Touch ID) to reveal credential values. The vault auto-locks after **2 minutes** of inactivity.

---

## Changing Display Currency

In the sidebar (bottom-left), click the currency selector to choose from 16 currencies. The selected currency is used everywhere — project cards, payment timeline, dashboard stats, and analytics. Individual project data is preserved; only the display format changes.

---

## Updating the App

If you're running from source:

```bash
cd "/Users/vaibhavsingh/Project Management/freelance-vault"
git pull                         # if using git
npm install --legacy-peer-deps   # pick up any new dependencies
npm run dev                      # run updated version
```

To re-install as a `.app` after updates:

```bash
npm run build:mac
```

Then replace the old app in Applications with the new `.dmg`.

---

## Useful Commands Reference

| Command | What it does |
|---|---|
| `npm install --legacy-peer-deps` | Install all dependencies |
| `npm run dev` | Start in development mode (live reload) |
| `npm run build` | Build for production (outputs to `out/`) |
| `npm run build:mac` | Build + package as macOS `.dmg` installer |

---

## Data Backup

Your entire vault lives in one folder:

```
[chosen location]/FreelanceVault/data/db.json
```

To back up everything, copy the entire `FreelanceVault/` folder to an external drive or cloud storage. To restore, copy it back and point the app to the same root location.

---

## Troubleshooting

**App shows a blank/black screen**
- Quit the app completely
- Run `npm run dev` from Terminal to see any error messages in the console

**"npm install" fails**
- Make sure you're using `--legacy-peer-deps`
- Try deleting `node_modules/` and `package-lock.json`, then reinstalling

**Touch ID button doesn't appear**
- Touch ID is only available on Macs with a Touch Bar or Touch ID sensor
- On unsupported hardware the button is hidden automatically — use your PIN instead

**macOS says the app is damaged or can't be opened**
- Run this in Terminal to clear the quarantine flag:
  ```bash
  xattr -cr /Applications/FreelanceVault.app
  ```
- Then try opening it again

**Forgot PIN**
- There is no PIN recovery. Delete the app's settings and start fresh:
  ```bash
  rm ~/Library/Application\ Support/freelance-vault/config.json
  ```
  This resets setup. Your vault data in the FreelanceVault folder is untouched — you just need to re-run setup and point it back to the same root folder.
