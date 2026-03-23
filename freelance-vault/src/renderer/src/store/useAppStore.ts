import { create } from 'zustand'
import type { User, Project, Payment, Credential, Database, AppView } from '../types'

interface AppStore {
  user: User | null
  isAuthenticated: boolean
  isSetup: boolean
  rootFolder: string
  userName: string
  displayCurrency: string
  db: Database
  currentView: AppView
  selectedProjectId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  loginWithPin: (pin: string) => Promise<boolean>
  loginWithTouchId: () => Promise<boolean>
  logout: () => void
  setView: (view: AppView, projectId?: string) => void
  setCurrency: (currency: string) => Promise<void>
  loadDb: () => Promise<void>
  saveDb: (db: Database) => Promise<void>

  addProject: (project: Project) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  addPayment: (payment: Payment) => Promise<void>
  deletePayment: (id: string) => Promise<void>

  addCredential: (credential: Credential) => Promise<void>
  deleteCredential: (id: string) => Promise<void>

  clearError: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isSetup: false,
  rootFolder: '',
  userName: '',
  displayCurrency: 'USD',
  db: { projects: [], payments: [], credentials: [] },
  currentView: 'dashboard',
  selectedProjectId: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const settings = await window.electron.getSettings()
      set({
        isSetup: !!settings.isSetup,
        rootFolder: settings.rootFolder || '',
        userName: settings.userName || '',
        displayCurrency: settings.displayCurrency || 'USD',
        isLoading: false
      })
      if (settings.isSetup && settings.rootFolder) {
        await get().loadDb()
      }
    } catch (err) {
      set({ isLoading: false, error: String(err) })
    }
  },

  loginWithPin: async (pin: string) => {
    try {
      const result = await window.electron.verifyPin(pin)
      if (result.success && result.user) {
        set({ isAuthenticated: true, user: result.user })
        await get().loadDb()
        return true
      }
      return false
    } catch (err) {
      set({ error: String(err) })
      return false
    }
  },

  loginWithTouchId: async () => {
    try {
      const result = await window.electron.touchIdAuth()
      if (result.success && result.user) {
        set({ isAuthenticated: true, user: result.user })
        await get().loadDb()
        return true
      }
      return false
    } catch (err) {
      set({ error: String(err) })
      return false
    }
  },

  logout: () => {
    set({ isAuthenticated: false, user: null, currentView: 'dashboard', selectedProjectId: null })
  },

  setCurrency: async (currency: string) => {
    set({ displayCurrency: currency })
    await window.electron.setCurrency(currency)
  },

  setView: (view: AppView, projectId?: string) => {
    set({ currentView: view, selectedProjectId: projectId ?? null })
  },

  loadDb: async () => {
    try {
      const result = await window.electron.dbRead()
      if (result.success && result.data) {
        set({ db: result.data as Database })
      }
    } catch (err) {
      set({ error: String(err) })
    }
  },

  saveDb: async (db: Database) => {
    try {
      set({ db })
      await window.electron.dbWrite(db)
    } catch (err) {
      set({ error: String(err) })
    }
  },

  addProject: async (project: Project) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, projects: [...db.projects, project] })
    await window.electron.projectCreateFolders(project.id)
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    const { db, saveDb } = get()
    const projects = db.projects.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    )
    await saveDb({ ...db, projects })
  },

  deleteProject: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({
      ...db,
      projects: db.projects.filter((p) => p.id !== id),
      payments: db.payments.filter((p) => p.projectId !== id),
      credentials: db.credentials.filter((c) => c.projectId !== id)
    })
  },

  addPayment: async (payment: Payment) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, payments: [...db.payments, payment] })
  },

  deletePayment: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, payments: db.payments.filter((p) => p.id !== id) })
  },

  addCredential: async (credential: Credential) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, credentials: [...db.credentials, credential] })
  },

  deleteCredential: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, credentials: db.credentials.filter((c) => c.id !== id) })
  },

  clearError: () => set({ error: null })
}))
