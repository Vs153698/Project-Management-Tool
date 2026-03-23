export interface User {
  name: string
}

export interface Project {
  id: string
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

export interface Database {
  projects: Project[]
  payments: Payment[]
  credentials: Credential[]
}

export type AppView = 'dashboard' | 'projects' | 'project-detail' | 'analytics'

export interface FileInfo {
  name: string
  size: number
  modifiedAt: string
  path: string
}
