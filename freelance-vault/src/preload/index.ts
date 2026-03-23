import { contextBridge, ipcRenderer } from 'electron'

export interface FileInfo {
  name: string
  size: number
  modifiedAt: string
  path: string
}

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

  // Auth — PIN + Touch ID only
  verifyPin: (pin: string) => Promise<{
    success: boolean
    error?: string
    user?: { name: string }
  }>
  touchIdAuth: () => Promise<{
    success: boolean
    error?: string
    user?: { name: string }
  }>
  checkTouchId: () => Promise<{ available: boolean }>

  // Database
  dbRead: () => Promise<{
    success: boolean
    data?: { projects: unknown[]; payments: unknown[]; credentials: unknown[] }
    error?: string
  }>
  dbWrite: (data: unknown) => Promise<{ success: boolean; error?: string }>

  // Files
  filesUpload: (payload: {
    projectId: string
    category: 'files' | 'docs'
  }) => Promise<{ success: boolean; files: string[]; error?: string }>
  filesList: (payload: {
    projectId: string
    category: 'files' | 'docs'
  }) => Promise<{ success: boolean; files: FileInfo[]; error?: string }>
  filesOpen: (filePath: string) => Promise<{ success: boolean }>
  filesDelete: (payload: {
    projectId: string
    category: 'files' | 'docs'
    fileName: string
  }) => Promise<{ success: boolean; error?: string }>

  // Folders
  folderOpen: (folderPath: string) => Promise<{ success: boolean }>
  projectCreateFolders: (projectId: string) => Promise<{ success: boolean; error?: string }>
  projectGetFolder: (projectId: string) => Promise<string>
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
  filesList: (payload) => ipcRenderer.invoke('files:list', payload),
  filesOpen: (filePath) => ipcRenderer.invoke('files:open', filePath),
  filesDelete: (payload) => ipcRenderer.invoke('files:delete', payload),

  folderOpen: (folderPath) => ipcRenderer.invoke('folder:open', folderPath),
  projectCreateFolders: (projectId) => ipcRenderer.invoke('project:create-folders', projectId),
  projectGetFolder: (projectId) => ipcRenderer.invoke('project:get-folder', projectId)
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
