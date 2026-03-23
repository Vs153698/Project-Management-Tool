export interface User {
  name: string
}

export interface Project {
  id: string
  projectType?: 'freelance' | 'personal'
  clientName: string
  projectName: string
  middleman?: string
  projectCost: number
  currency: string
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  description?: string
  tags: string[]
  startDate?: string
  endDate?: string
  deadline?: string
  githubUrl?: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  projectId: string
  amount: number
  date: string
  note?: string
  type: 'advance' | 'milestone' | 'final' | 'other'
  createdAt: string
}

export interface Credential {
  id: string
  projectId: string
  label: string
  type: 'api_key' | 'password' | 'url' | 'ssh_key' | 'other'
  value: string
  username?: string
  url?: string
  notes?: string
  createdAt: string
}

export interface TimeEntry {
  id: string
  projectId: string
  description: string
  durationMinutes: number
  date: string
  createdAt: string
}

export interface EnvVar {
  id: string
  projectId: string
  key: string
  value: string
  group?: string
  createdAt: string
}

export interface Database {
  projects: Project[]
  payments: Payment[]
  credentials: Credential[]
  timeEntries: TimeEntry[]
  envVars: EnvVar[]
}

export type AppView = 'dashboard' | 'projects' | 'project-detail' | 'analytics' | 'bank-details' | 'backup'

export interface BankDetail {
  id: string
  label: string
  accountHolder: string
  bankName: string
  accountNumber: string
  accountType: 'savings' | 'current' | 'checking'
  ifsc?: string
  swift?: string
  routingNumber?: string
  branchName?: string
  upiId?: string
  paypalEmail?: string
  notes?: string
  isDefault: boolean
  createdAt: string
}

export type Framework =
  | 'vite'
  | 'nextjs'
  | 'node-backend'
  | 'python-backend'
  | 'agent-ai'
  | 'agent-orchestration'

export interface FileInfo {
  name: string
  relativePath: string
  size: number
  modifiedAt: string
  path: string
}
