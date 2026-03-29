import { create } from 'zustand'
import type { User, Project, Payment, Credential, Database, AppView, BankDetail, TimeEntry, EnvVar, EnvProfile, SavedLinkedInPost, Requirement, ProjectTodo, Improvement, FutureTask } from '../types'

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
  quickSwitcherOpen: boolean

  // Actions
  initialize: () => Promise<void>
  loginWithPin: (pin: string) => Promise<boolean>
  loginWithTouchId: () => Promise<boolean>
  logout: () => void
  setView: (view: AppView, projectId?: string) => void
  setCurrency: (currency: string) => Promise<void>
  loadDb: () => Promise<void>
  saveDb: (db: Database) => Promise<void>
  setQuickSwitcherOpen: (open: boolean) => void

  addProject: (project: Project) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  addPayment: (payment: Payment) => Promise<void>
  deletePayment: (id: string) => Promise<void>

  addCredential: (credential: Credential) => Promise<void>
  deleteCredential: (id: string) => Promise<void>

  addTimeEntry: (entry: TimeEntry) => Promise<void>
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>
  deleteTimeEntry: (id: string) => Promise<void>

  addEnvVar: (envVar: EnvVar) => Promise<void>
  updateEnvVar: (id: string, updates: Partial<EnvVar>) => Promise<void>
  deleteEnvVar: (id: string) => Promise<void>

  addEnvProfile: (profile: EnvProfile) => Promise<void>
  deleteEnvProfile: (id: string) => Promise<void>

  saveLinkedInPost: (post: SavedLinkedInPost) => Promise<void>
  deleteLinkedInPost: (id: string) => Promise<void>

  addRequirement: (req: Requirement) => Promise<void>
  updateRequirement: (id: string, updates: Partial<Requirement>) => Promise<void>
  deleteRequirement: (id: string) => Promise<void>

  addProjectTodo: (todo: ProjectTodo) => Promise<void>
  updateProjectTodo: (id: string, updates: Partial<ProjectTodo>) => Promise<void>
  deleteProjectTodo: (id: string) => Promise<void>

  addImprovement: (imp: Improvement) => Promise<void>
  updateImprovement: (id: string, updates: Partial<Improvement>) => Promise<void>
  deleteImprovement: (id: string) => Promise<void>

  addFutureTask: (task: FutureTask) => Promise<void>
  updateFutureTask: (id: string, updates: Partial<FutureTask>) => Promise<void>
  deleteFutureTask: (id: string) => Promise<void>

  bankDetails: BankDetail[]
  loadBankDetails: () => Promise<void>
  saveBankDetail: (detail: BankDetail) => Promise<void>
  updateBankDetail: (id: string, updates: Partial<BankDetail>) => Promise<void>
  deleteBankDetail: (id: string) => Promise<void>

  clearError: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isSetup: false,
  rootFolder: '',
  userName: '',
  displayCurrency: 'USD',
  db: { projects: [], payments: [], credentials: [], timeEntries: [], envVars: [] },
  currentView: 'dashboard',
  selectedProjectId: null,
  isLoading: true,
  error: null,
  bankDetails: [],
  quickSwitcherOpen: false,

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
        await get().loadBankDetails()
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
        await get().loadBankDetails()
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

  setQuickSwitcherOpen: (open: boolean) => set({ quickSwitcherOpen: open }),

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
    // Auto-sync to Google Sheets if enabled for this project
    const sheetsConfig = (db.googleSheetsConfigs || []).find((c) => c.projectId === id)
    if (sheetsConfig?.autoSync) {
      window.electron.googleSheetsSync(id).catch(() => { /* silent fail */ })
    }
  },

  deleteProject: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({
      ...db,
      projects: db.projects.filter((p) => p.id !== id),
      payments: db.payments.filter((p) => p.projectId !== id),
      credentials: db.credentials.filter((c) => c.projectId !== id),
      timeEntries: (db.timeEntries || []).filter((t) => t.projectId !== id),
      envVars: (db.envVars || []).filter((e) => e.projectId !== id),
      envProfiles: (db.envProfiles || []).filter((e) => e.projectId !== id),
      savedLinkedInPosts: (db.savedLinkedInPosts || []).filter((p) => p.projectId !== id),
      requirements: (db.requirements || []).filter((r) => r.projectId !== id),
      projectTodos: (db.projectTodos || []).filter((t) => t.projectId !== id),
      improvements: (db.improvements || []).filter((i) => i.projectId !== id),
      futureTasks: (db.futureTasks || []).filter((t) => t.projectId !== id)
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

  addTimeEntry: async (entry: TimeEntry) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, timeEntries: [...(db.timeEntries || []), entry] })
  },

  updateTimeEntry: async (id: string, updates: Partial<TimeEntry>) => {
    const { db, saveDb } = get()
    await saveDb({
      ...db,
      timeEntries: (db.timeEntries || []).map((t) => (t.id === id ? { ...t, ...updates } : t))
    })
  },

  deleteTimeEntry: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, timeEntries: (db.timeEntries || []).filter((t) => t.id !== id) })
  },

  addEnvVar: async (envVar: EnvVar) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, envVars: [...(db.envVars || []), envVar] })
  },

  updateEnvVar: async (id: string, updates: Partial<EnvVar>) => {
    const { db, saveDb } = get()
    await saveDb({
      ...db,
      envVars: (db.envVars || []).map((e) => (e.id === id ? { ...e, ...updates } : e))
    })
  },

  deleteEnvVar: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, envVars: (db.envVars || []).filter((e) => e.id !== id) })
  },

  addEnvProfile: async (profile: EnvProfile) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, envProfiles: [...(db.envProfiles || []), profile] })
  },

  deleteEnvProfile: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, envProfiles: (db.envProfiles || []).filter((p) => p.id !== id) })
  },

  saveLinkedInPost: async (post: SavedLinkedInPost) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, savedLinkedInPosts: [...(db.savedLinkedInPosts || []), post] })
  },

  deleteLinkedInPost: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, savedLinkedInPosts: (db.savedLinkedInPosts || []).filter((p) => p.id !== id) })
  },

  addRequirement: async (req: Requirement) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, requirements: [...(db.requirements || []), req] })
  },
  updateRequirement: async (id: string, updates: Partial<Requirement>) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, requirements: (db.requirements || []).map((r) => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r) })
  },
  deleteRequirement: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, requirements: (db.requirements || []).filter((r) => r.id !== id) })
  },

  addProjectTodo: async (todo: ProjectTodo) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, projectTodos: [...(db.projectTodos || []), todo] })
  },
  updateProjectTodo: async (id: string, updates: Partial<ProjectTodo>) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, projectTodos: (db.projectTodos || []).map((t) => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) })
  },
  deleteProjectTodo: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, projectTodos: (db.projectTodos || []).filter((t) => t.id !== id) })
  },

  addImprovement: async (imp: Improvement) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, improvements: [...(db.improvements || []), imp] })
  },
  updateImprovement: async (id: string, updates: Partial<Improvement>) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, improvements: (db.improvements || []).map((i) => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i) })
  },
  deleteImprovement: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, improvements: (db.improvements || []).filter((i) => i.id !== id) })
  },

  addFutureTask: async (task: FutureTask) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, futureTasks: [...(db.futureTasks || []), task] })
  },
  updateFutureTask: async (id: string, updates: Partial<FutureTask>) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, futureTasks: (db.futureTasks || []).map((t) => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) })
  },
  deleteFutureTask: async (id: string) => {
    const { db, saveDb } = get()
    await saveDb({ ...db, futureTasks: (db.futureTasks || []).filter((t) => t.id !== id) })
  },

  loadBankDetails: async () => {
    try {
      const result = await window.electron.bankGet()
      if (result.success) set({ bankDetails: (result.data as BankDetail[]) || [] })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  saveBankDetail: async (detail: BankDetail) => {
    const { bankDetails } = get()
    const existing = bankDetails.find((b) => b.id === detail.id)
    let updated: BankDetail[]
    if (existing) {
      updated = bankDetails.map((b) => (b.id === detail.id ? detail : b))
    } else {
      // If new detail is default, clear others
      updated = detail.isDefault
        ? [...bankDetails.map((b) => ({ ...b, isDefault: false })), detail]
        : [...bankDetails, detail]
    }
    set({ bankDetails: updated })
    await window.electron.bankSave(updated)
  },

  updateBankDetail: async (id: string, updates: Partial<BankDetail>) => {
    const { bankDetails } = get()
    let updated = bankDetails.map((b) => (b.id === id ? { ...b, ...updates } : b))
    if (updates.isDefault) updated = updated.map((b) => (b.id === id ? b : { ...b, isDefault: false }))
    set({ bankDetails: updated })
    await window.electron.bankSave(updated)
  },

  deleteBankDetail: async (id: string) => {
    const { bankDetails } = get()
    const updated = bankDetails.filter((b) => b.id !== id)
    set({ bankDetails: updated })
    await window.electron.bankSave(updated)
  },

  clearError: () => set({ error: null })
}))
