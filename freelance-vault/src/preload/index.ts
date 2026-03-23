import { contextBridge, ipcRenderer } from 'electron'

export interface FileInfo {
  name: string
  relativePath: string
  size: number
  modifiedAt: string
  path: string
}

export type Framework =
  | 'vite'
  | 'nextjs'
  | 'node-backend'
  | 'python-backend'
  | 'agent-ai'
  | 'agent-orchestration'

export interface ElectronAPI {
  // Settings
  getSettings: () => Promise<{
    rootFolder: string
    isSetup: boolean
    userName: string
    hasPinSet: boolean
    displayCurrency: string
  }>
  setCurrency: (currency: string) => Promise<{ success: boolean }>
  selectFolder: () => Promise<string | null>
  setupComplete: (payload: {
    rootFolder: string
    name: string
    pin: string
  }) => Promise<{ success: boolean; error?: string }>

  // Auth
  verifyPin: (pin: string) => Promise<{ success: boolean; error?: string; user?: { name: string } }>
  touchIdAuth: () => Promise<{ success: boolean; error?: string; user?: { name: string } }>
  checkTouchId: () => Promise<{ available: boolean }>

  // Database
  dbRead: () => Promise<{
    success: boolean
    data?: { projects: unknown[]; payments: unknown[]; credentials: unknown[] }
    error?: string
  }>
  dbWrite: (data: unknown) => Promise<{ success: boolean; error?: string }>

  // Files (individual)
  filesUpload: (payload: {
    projectId: string
    category: 'files' | 'docs'
  }) => Promise<{ success: boolean; files: string[]; error?: string }>

  // Folder upload
  filesUploadFolder: (payload: {
    projectId: string
    category: 'files' | 'docs'
  }) => Promise<{ success: boolean; files: string[]; folderName: string; error?: string }>

  filesList: (payload: {
    projectId: string
    category: 'files' | 'docs'
  }) => Promise<{ success: boolean; files: FileInfo[]; error?: string }>
  filesOpen: (filePath: string) => Promise<{ success: boolean }>
  filesDelete: (payload: {
    projectId: string
    category: 'files' | 'docs'
    relativePath: string
  }) => Promise<{ success: boolean; error?: string }>

  // Folders
  folderOpen: (folderPath: string) => Promise<{ success: boolean }>
  projectCreateFolders: (projectId: string) => Promise<{ success: boolean; error?: string }>
  projectGetFolder: (projectId: string) => Promise<string>

  // Bank details
  bankGet: () => Promise<{ success: boolean; data: unknown[]; error?: string }>
  bankSave: (details: unknown[]) => Promise<{ success: boolean; error?: string }>
  bankCopyImage: (dataUrl: string) => Promise<{ success: boolean; tmpPath?: string; error?: string }>
  bankSaveImage: (dataUrl: string) => Promise<{ success: boolean; path?: string; error?: string }>

  // Code generation
  codeGenerate: (payload: {
    projectId: string
    folderName: string
    framework: Framework
    initShadcn: boolean
  }) => Promise<{ success: boolean; path?: string; error?: string }>

  // Code folders
  codeListFolders: (projectId: string) => Promise<{
    success: boolean
    folders: { name: string; path: string; createdAt: string; modifiedAt: string }[]
    error?: string
  }>
  codeDeleteFolder: (payload: { projectId: string; folderName: string }) => Promise<{ success: boolean; error?: string }>
  codeDeleteDepDir: (payload: { projectId: string; folderName: string; depDirName: string }) => Promise<{ success: boolean; error?: string }>

  // Git
  gitClone: (payload: {
    projectId: string
    url: string
    folderName: string
  }) => Promise<{ success: boolean; path?: string; error?: string }>
  gitPull: (payload: { projectId: string; folderName: string }) => Promise<{ success: boolean; output?: string; error?: string }>

  // Open in editor
  openInVscode: (projectId: string) => Promise<{ success: boolean; error?: string }>
  openInAntigravity: (projectId: string) => Promise<{ success: boolean; error?: string }>

  // Backup
  backupExport: (pin: string) => Promise<{ success: boolean; error?: string }>
  backupImport: (pin: string) => Promise<{ success: boolean; data?: unknown; error?: string }>

  // Scripts
  scriptList: (payload: { projectId: string; folderName: string }) => Promise<{
    success: boolean
    type: 'node' | 'python' | 'none'
    scripts: Record<string, string>
    error?: string
  }>
  scriptRun: (payload: { projectId: string; folderName: string; scriptName: string; command: string }) => Promise<{
    success: boolean
    key?: string
    error?: string
  }>
  scriptStop: (key: string) => Promise<{ success: boolean; error?: string }>
  onScriptOutput: (callback: (payload: { key: string; data: string }) => void) => () => void
  onScriptDone: (callback: (payload: { key: string; code: number | null }) => void) => () => void

  // Invoice
  invoiceGenerate: (payload: { html: string; filename: string }) => Promise<{ success: boolean; path?: string; error?: string }>
}

const api: ElectronAPI = {
  getSettings: () => ipcRenderer.invoke('app:get-settings'),
  setCurrency: (currency) => ipcRenderer.invoke('app:set-currency', currency),
  selectFolder: () => ipcRenderer.invoke('app:select-folder'),
  setupComplete: (payload) => ipcRenderer.invoke('app:setup-complete', payload),

  verifyPin: (pin) => ipcRenderer.invoke('auth:verify-pin', pin),
  touchIdAuth: () => ipcRenderer.invoke('auth:touch-id'),
  checkTouchId: () => ipcRenderer.invoke('auth:check-touch-id'),

  dbRead: () => ipcRenderer.invoke('db:read'),
  dbWrite: (data) => ipcRenderer.invoke('db:write', data),

  filesUpload: (payload) => ipcRenderer.invoke('files:upload', payload),
  filesUploadFolder: (payload) => ipcRenderer.invoke('files:upload-folder', payload),
  filesList: (payload) => ipcRenderer.invoke('files:list', payload),
  filesOpen: (filePath) => ipcRenderer.invoke('files:open', filePath),
  filesDelete: (payload) => ipcRenderer.invoke('files:delete', payload),

  folderOpen: (folderPath) => ipcRenderer.invoke('folder:open', folderPath),
  projectCreateFolders: (projectId) => ipcRenderer.invoke('project:create-folders', projectId),
  projectGetFolder: (projectId) => ipcRenderer.invoke('project:get-folder', projectId),

  bankGet: () => ipcRenderer.invoke('bank:get'),
  bankSave: (details) => ipcRenderer.invoke('bank:save', details),
  bankCopyImage: (dataUrl) => ipcRenderer.invoke('bank:copy-image', dataUrl),
  bankSaveImage: (dataUrl) => ipcRenderer.invoke('bank:save-image', dataUrl),

  codeGenerate: (payload) => ipcRenderer.invoke('code:generate', payload),

  codeListFolders: (projectId) => ipcRenderer.invoke('code:list-folders', projectId),
  codeDeleteFolder: (payload) => ipcRenderer.invoke('code:delete-folder', payload),
  codeDeleteDepDir: (payload) => ipcRenderer.invoke('code:delete-dep-dir', payload),

  gitClone: (payload) => ipcRenderer.invoke('git:clone', payload),
  gitPull: (payload) => ipcRenderer.invoke('git:pull', payload),
  openInVscode: (projectId) => ipcRenderer.invoke('project:open-in-vscode', projectId),
  openInAntigravity: (projectId) => ipcRenderer.invoke('project:open-in-antigravity', projectId),

  backupExport: (pin) => ipcRenderer.invoke('backup:export', pin),
  backupImport: (pin) => ipcRenderer.invoke('backup:import', pin),

  scriptList: (payload) => ipcRenderer.invoke('script:list', payload),
  scriptRun: (payload) => ipcRenderer.invoke('script:run', payload),
  scriptStop: (key) => ipcRenderer.invoke('script:stop', key),
  onScriptOutput: (callback) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (_: any, payload: { key: string; data: string }) => callback(payload)
    ipcRenderer.on('script:output', handler)
    return () => ipcRenderer.off('script:output', handler)
  },
  onScriptDone: (callback) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (_: any, payload: { key: string; code: number | null }) => callback(payload)
    ipcRenderer.on('script:done', handler)
    return () => ipcRenderer.off('script:done', handler)
  },

  invoiceGenerate: (payload) => ipcRenderer.invoke('invoice:generate', payload),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = api
}
