import { app, shell, BrowserWindow, ipcMain, dialog, systemPreferences } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import { createHash } from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('electron-store')

interface StoreSchema {
  rootFolder: string
  isSetup: boolean
  pinHash: string
  userName: string
  displayCurrency: string
}

interface Database {
  projects: Project[]
  payments: Payment[]
  credentials: Credential[]
}

interface Project {
  id: string
  clientName: string
  projectName: string
  middleman?: string
  projectCost: number
  currency: string
  status: string
  description?: string
  tags: string[]
  startDate?: string
  endDate?: string
  deadline?: string
  createdAt: string
  updatedAt: string
}

interface Payment {
  id: string
  projectId: string
  amount: number
  date: string
  note?: string
  type: string
  createdAt: string
}

interface Credential {
  id: string
  projectId: string
  label: string
  type: string
  value: string
  username?: string
  url?: string
  notes?: string
  createdAt: string
}

const store = new Store<StoreSchema>({
  defaults: {
    rootFolder: '',
    isSetup: false,
    pinHash: '',
    userName: '',
    displayCurrency: 'USD'
  }
})

function hashPin(pin: string): string {
  return createHash('sha256').update(`fv-salt-2024-${pin}`).digest('hex')
}

function getDbPath(): string {
  const rootFolder = store.get('rootFolder') as string
  return join(rootFolder, 'FreelanceVault', 'data', 'db.json')
}

function readDb(): Database {
  const dbPath = getDbPath()
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8')
      return JSON.parse(content) as Database
    }
  } catch {
    // fallthrough
  }
  return { projects: [], payments: [], credentials: [] }
}

function writeDb(data: Database): void {
  const dbPath = getDbPath()
  const dir = join(dbPath, '..')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8')
}

function createProjectFolders(rootFolder: string, projectId: string): void {
  const base = join(rootFolder, 'FreelanceVault', 'projects', projectId)
  fs.mkdirSync(join(base, 'files'), { recursive: true })
  fs.mkdirSync(join(base, 'docs'), { recursive: true })
  fs.mkdirSync(join(base, 'credentials'), { recursive: true })
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0a0a0f',
    vibrancy: 'under-window',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.freelancevault.app')

  // Set dock icon (macOS)
  if (process.platform === 'darwin') {
    const iconPath = is.dev
      ? join(__dirname, '../../resources/icon.png')
      : join(process.resourcesPath, 'icon.png')
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath)
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ─── App Settings ────────────────────────────────────────────
  ipcMain.handle('app:get-settings', () => ({
    rootFolder: store.get('rootFolder'),
    isSetup: store.get('isSetup'),
    userName: store.get('userName'),
    hasPinSet: !!(store.get('pinHash') as string),
    displayCurrency: (store.get('displayCurrency') as string) || 'USD'
  }))

  ipcMain.handle('app:set-currency', (_event, currency: string) => {
    store.set('displayCurrency', currency)
    return { success: true }
  })

  ipcMain.handle('app:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose FreelanceVault Location'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'app:setup-complete',
    (_event, payload: { rootFolder: string; name: string; pin: string }) => {
      try {
        const vaultRoot = join(payload.rootFolder, 'FreelanceVault')
        fs.mkdirSync(join(vaultRoot, 'data'), { recursive: true })
        fs.mkdirSync(join(vaultRoot, 'projects'), { recursive: true })

        const dbPath = join(vaultRoot, 'data', 'db.json')
        if (!fs.existsSync(dbPath)) {
          fs.writeFileSync(
            dbPath,
            JSON.stringify({ projects: [], payments: [], credentials: [] }, null, 2),
            'utf-8'
          )
        }

        store.set('rootFolder', payload.rootFolder)
        store.set('isSetup', true)
        store.set('pinHash', hashPin(payload.pin))
        store.set('userName', payload.name)

        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── Auth ────────────────────────────────────────────────────
  ipcMain.handle('auth:verify-pin', (_event, pin: string) => {
    const stored = store.get('pinHash') as string
    if (!stored) return { success: false, error: 'No PIN configured' }
    const matches = hashPin(pin) === stored
    if (matches) {
      return { success: true, user: { name: store.get('userName') as string } }
    }
    return { success: false, error: 'Incorrect PIN' }
  })

  ipcMain.handle('auth:touch-id', async () => {
    try {
      if (!systemPreferences.canPromptTouchID()) {
        return { success: false, error: 'Touch ID not available' }
      }
      await systemPreferences.promptTouchID('to access FreelanceVault')
      return {
        success: true,
        user: { name: store.get('userName') as string }
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('auth:check-touch-id', () => {
    try {
      return { available: systemPreferences.canPromptTouchID() }
    } catch {
      return { available: false }
    }
  })

  // ─── Database ────────────────────────────────────────────────
  ipcMain.handle('db:read', () => {
    try {
      return { success: true, data: readDb() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('db:write', (_event, data: Database) => {
    try {
      writeDb(data)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─── Files ───────────────────────────────────────────────────
  ipcMain.handle(
    'files:upload',
    async (_event, payload: { projectId: string; category: 'files' | 'docs' }) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile', 'multiSelections'],
          title: 'Select files to upload'
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false, files: [] }

        const rootFolder = store.get('rootFolder') as string
        const destDir = join(
          rootFolder,
          'FreelanceVault',
          'projects',
          payload.projectId,
          payload.category
        )
        fs.mkdirSync(destDir, { recursive: true })

        const uploaded: string[] = []
        for (const filePath of result.filePaths) {
          const parts = filePath.split(/[/\\]/)
          const fileName = parts[parts.length - 1] || 'file'
          const destPath = join(destDir, fileName)
          fs.copyFileSync(filePath, destPath)
          uploaded.push(fileName)
        }
        return { success: true, files: uploaded }
      } catch (err) {
        return { success: false, error: String(err), files: [] }
      }
    }
  )

  ipcMain.handle(
    'files:list',
    (_event, payload: { projectId: string; category: 'files' | 'docs' }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const dir = join(
          rootFolder,
          'FreelanceVault',
          'projects',
          payload.projectId,
          payload.category
        )
        if (!fs.existsSync(dir)) return { success: true, files: [] }

        const items = fs.readdirSync(dir)
        const files = items
          .filter((f) => fs.statSync(join(dir, f)).isFile())
          .map((f) => {
            const stat = fs.statSync(join(dir, f))
            return { name: f, size: stat.size, modifiedAt: stat.mtime.toISOString(), path: join(dir, f) }
          })
        return { success: true, files }
      } catch (err) {
        return { success: false, error: String(err), files: [] }
      }
    }
  )

  ipcMain.handle('files:open', (_event, filePath: string) => {
    shell.openPath(resolve(filePath))
    return { success: true }
  })

  ipcMain.handle(
    'files:delete',
    (_event, payload: { projectId: string; category: 'files' | 'docs'; fileName: string }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const filePath = join(
          rootFolder,
          'FreelanceVault',
          'projects',
          payload.projectId,
          payload.category,
          payload.fileName
        )
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle('folder:open', (_event, folderPath: string) => {
    shell.openPath(resolve(folderPath))
    return { success: true }
  })

  ipcMain.handle('project:create-folders', (_event, projectId: string) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      createProjectFolders(rootFolder, projectId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('project:get-folder', (_event, projectId: string) => {
    const rootFolder = store.get('rootFolder') as string
    return join(rootFolder, 'FreelanceVault', 'projects', projectId)
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
