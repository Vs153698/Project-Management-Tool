import { app, shell, BrowserWindow, ipcMain, dialog, systemPreferences, clipboard, nativeImage } from 'electron'
import { join, resolve, relative } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('electron-store')

const execAsync = promisify(exec)

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
  timeEntries?: unknown[]
  envVars?: unknown[]
}

interface Project {
  id: string
  projectType?: 'freelance' | 'personal'
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
  githubUrl?: string
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
  return { projects: [], payments: [], credentials: [], timeEntries: [], envVars: [] }
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

interface FileInfoResult {
  name: string
  relativePath: string
  size: number
  modifiedAt: string
  path: string
}

function listFilesRecursive(dir: string, baseDir: string): FileInfoResult[] {
  const results: FileInfoResult[] = []
  if (!fs.existsSync(dir)) return results
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = fs.statSync(fullPath)
    const relPath = relative(baseDir, fullPath)
    if (stat.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, baseDir))
    } else {
      results.push({ name: item, relativePath: relPath, size: stat.size, modifiedAt: stat.mtime.toISOString(), path: fullPath })
    }
  }
  return results
}

function copyFolderRecursive(src: string, dest: string): string[] {
  const copied: string[] = []
  fs.mkdirSync(dest, { recursive: true })
  const items = fs.readdirSync(src)
  for (const item of items) {
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      copied.push(...copyFolderRecursive(srcPath, destPath))
    } else {
      fs.copyFileSync(srcPath, destPath)
      copied.push(item)
    }
  }
  return copied
}

// Dirs to skip when a user uploads a project folder
const UPLOAD_SKIP_DIRS = new Set([
  'node_modules', '.git', '.pnpm-store',
  '__pycache__', '.venv', 'venv', 'env', '.env',
  'dist', 'build', '.next', '.nuxt', '.turbo', '.vercel',
  'coverage', '.nyc_output',
  '.mypy_cache', '.pytest_cache', '.ruff_cache', '.tox',
  '.idea', '.gradle', 'target',
])

function copyFolderFiltered(src: string, dest: string): string[] {
  const copied: string[] = []
  fs.mkdirSync(dest, { recursive: true })
  const items = fs.readdirSync(src)
  for (const item of items) {
    if (item.endsWith('.egg-info') || item.endsWith('.dist-info')) continue
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    let stat: fs.Stats
    try { stat = fs.statSync(srcPath) } catch { continue }
    if (stat.isDirectory()) {
      if (UPLOAD_SKIP_DIRS.has(item)) continue
      copied.push(...copyFolderFiltered(srcPath, destPath))
    } else {
      fs.copyFileSync(srcPath, destPath)
      copied.push(item)
    }
  }
  return copied
}

// ─── Code Generation Templates ───────────────────────────────────────────────

function getViteHomePage(name: string): string {
  return [
    "import { useState } from 'react'",
    "",
    "export default function App() {",
    "  const [count, setCount] = useState(0)",
    "",
    "  return (",
    "    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>",
    "      <div style={{ textAlign: 'center', maxWidth: '640px', padding: '0 24px' }}>",
    "        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>",
    "          <svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>",
    "            <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/>",
    "            <polyline points='3.27 6.96 12 12.01 20.73 6.96'/>",
    "            <line x1='12' y1='22.08' x2='12' y2='12'/>",
    "          </svg>",
    "        </div>",
    "        <div style={{ backgroundImage: 'linear-gradient(90deg, #a78bfa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '3rem', fontWeight: 900, letterSpacing: '-2px', marginBottom: 8 }}>",
    "          FreelanceVault",
    "        </div>",
    `        <p style={{ color: '#6b7280', fontSize: '1.1rem', marginBottom: 40 }}>${name}</p>`,
    "        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40 }}>",
    "          {[['⚡ Build', '#7c3aed'], ['🚀 Ship', '#06b6d4'], ['💰 Earn', '#10b981']].map(([label, color]) => (",
    "            <div key={label} style={{ background: '#1a1a27', border: '1px solid #252538', borderRadius: 14, padding: '18px 0' }}>",
    "              <span style={{ color, fontWeight: 700 }}>{label}</span>",
    "            </div>",
    "          ))}",
    "        </div>",
    "        <button",
    "          onClick={() => setCount(c => c + 1)}",
    "          style={{ background: 'linear-gradient(90deg, #7c3aed, #0891b2)', border: 'none', borderRadius: 14, color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '14px 36px', transition: 'opacity 0.2s' }}",
    "          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}",
    "          onMouseOut={e => (e.currentTarget.style.opacity = '1')}",
    "        >",
    "          Start building · {count}",
    "        </button>",
    "        <p style={{ color: '#374151', fontSize: '0.8rem', marginTop: 20 }}>Vite + React + TypeScript</p>",
    "      </div>",
    "    </div>",
    "  )",
    "}",
  ].join('\n')
}

function getNextJsHomePage(name: string): string {
  return [
    "export default function Home() {",
    "  return (",
    "    <main style={{ minHeight: '100vh', background: '#0a0a0f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>",
    "      <div style={{ textAlign: 'center', maxWidth: '640px', padding: '0 24px' }}>",
    "        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>",
    "          <svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>",
    "            <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/>",
    "            <polyline points='3.27 6.96 12 12.01 20.73 6.96'/>",
    "            <line x1='12' y1='22.08' x2='12' y2='12'/>",
    "          </svg>",
    "        </div>",
    "        <div style={{ backgroundImage: 'linear-gradient(90deg, #a78bfa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '3rem', fontWeight: 900, letterSpacing: '-2px', marginBottom: 8 }}>",
    "          FreelanceVault",
    "        </div>",
    `        <p style={{ color: '#6b7280', fontSize: '1.1rem', marginBottom: 40 }}>${name}</p>`,
    "        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40 }}>",
    "          {[['⚡ Build', '#7c3aed'], ['🚀 Ship', '#06b6d4'], ['💰 Earn', '#10b981']].map(([label, color]) => (",
    "            <div key={label} style={{ background: '#1a1a27', border: '1px solid #252538', borderRadius: 14, padding: '18px 0' }}>",
    "              <span style={{ color, fontWeight: 700 }}>{label}</span>",
    "            </div>",
    "          ))}",
    "        </div>",
    "        <a",
    "          href='https://nextjs.org/docs'",
    "          style={{ display: 'inline-block', background: 'linear-gradient(90deg, #7c3aed, #0891b2)', borderRadius: 14, color: 'white', textDecoration: 'none', fontSize: '1rem', fontWeight: 700, padding: '14px 36px' }}",
    "        >",
    "          Read the docs",
    "        </a>",
    "        <p style={{ color: '#374151', fontSize: '0.8rem', marginTop: 20 }}>Next.js + TypeScript + Tailwind CSS</p>",
    "      </div>",
    "    </main>",
    "  )",
    "}",
  ].join('\n')
}

function writeNodeBackendFiles(dir: string, name: string): void {
  const pkg = {
    name,
    version: '1.0.0',
    description: `${name} — Node.js REST API`,
    main: 'dist/index.js',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js'
    },
    dependencies: {
      express: 'latest',
      cors: 'latest',
      dotenv: 'latest',
      helmet: 'latest'
    },
    devDependencies: {
      '@types/express': 'latest',
      '@types/cors': 'latest',
      '@types/node': 'latest',
      typescript: 'latest',
      tsx: 'latest'
    }
  }

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      lib: ['ES2022'],
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true
    },
    include: ['src'],
    exclude: ['node_modules', 'dist']
  }

  const indexTs = [
    "import express from 'express'",
    "import cors from 'cors'",
    "import helmet from 'helmet'",
    "import 'dotenv/config'",
    "import { router } from './routes'",
    "",
    "const app = express()",
    "const PORT = process.env.PORT || 3001",
    "",
    "app.use(helmet())",
    "app.use(cors())",
    "app.use(express.json())",
    "",
    "app.get('/health', (_req, res) => {",
    "  res.json({ status: 'ok', service: '" + name + "', timestamp: new Date().toISOString() })",
    "})",
    "",
    "app.use('/api', router)",
    "",
    "app.listen(PORT, () => {",
    "  console.log(`FreelanceVault · ${'" + name + "'} running on http://localhost:${PORT}`)",
    "})",
  ].join('\n')

  const routesTs = [
    "import { Router } from 'express'",
    "",
    "export const router = Router()",
    "",
    "router.get('/', (_req, res) => {",
    "  res.json({ message: 'API is running', version: '1.0.0' })",
    "})",
  ].join('\n')

  const envExample = [
    "PORT=3001",
    "NODE_ENV=development",
    "# Add your environment variables here",
  ].join('\n')

  const gitignore = ['node_modules', 'dist', '.env'].join('\n')

  fs.mkdirSync(join(dir, 'src', 'routes'), { recursive: true })
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  fs.writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
  fs.writeFileSync(join(dir, 'src', 'index.ts'), indexTs)
  fs.writeFileSync(join(dir, 'src', 'routes', 'index.ts'), routesTs)
  fs.writeFileSync(join(dir, '.env.example'), envExample)
  fs.writeFileSync(join(dir, '.gitignore'), gitignore)
}

function writePythonBackendFiles(dir: string, name: string): void {
  const mainPy = [
    "from fastapi import FastAPI",
    "from fastapi.middleware.cors import CORSMiddleware",
    "from app.api.routes import router",
    "",
    "app = FastAPI(",
    `    title='${name}',`,
    "    description='FreelanceVault — FastAPI Backend',",
    "    version='1.0.0'",
    ")",
    "",
    "app.add_middleware(",
    "    CORSMiddleware,",
    "    allow_origins=['*'],",
    "    allow_credentials=True,",
    "    allow_methods=['*'],",
    "    allow_headers=['*'],",
    ")",
    "",
    "app.include_router(router, prefix='/api')",
    "",
    "@app.get('/health')",
    "def health():",
    `    return {'status': 'ok', 'service': '${name}'}`,
  ].join('\n')

  const routesPy = [
    "from fastapi import APIRouter",
    "",
    "router = APIRouter()",
    "",
    "@router.get('/')",
    "def index():",
    "    return {'message': 'API is running', 'version': '1.0.0'}",
  ].join('\n')

  const runPy = [
    "import uvicorn",
    "",
    "if __name__ == '__main__':",
    "    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)",
  ].join('\n')

  const requirements = [
    'fastapi>=0.111.0',
    'uvicorn[standard]>=0.29.0',
    'python-dotenv>=1.0.0',
    'pydantic>=2.0.0',
    'pydantic-settings>=2.0.0',
  ].join('\n')

  const envExample = ['PORT=8000', 'DEBUG=true', '# Add your environment variables here'].join('\n')

  fs.mkdirSync(join(dir, 'app', 'api'), { recursive: true })
  fs.writeFileSync(join(dir, 'app', '__init__.py'), '')
  fs.writeFileSync(join(dir, 'app', 'api', '__init__.py'), '')
  fs.writeFileSync(join(dir, 'app', 'api', 'routes.py'), routesPy)
  fs.writeFileSync(join(dir, 'main.py'), mainPy)
  fs.writeFileSync(join(dir, 'run.py'), runPy)
  fs.writeFileSync(join(dir, 'requirements.txt'), requirements)
  fs.writeFileSync(join(dir, '.env.example'), envExample)
  fs.writeFileSync(join(dir, '.gitignore'), ['__pycache__', '*.pyc', '.env', 'venv', '.venv'].join('\n'))
}

function writeAgentAIFiles(dir: string, name: string): void {
  const pkg = {
    name,
    version: '1.0.0',
    description: `${name} — AI Agent with OpenAI`,
    type: 'module',
    scripts: {
      dev: 'tsx src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js'
    },
    dependencies: {
      openai: 'latest',
      dotenv: 'latest',
      zod: 'latest'
    },
    devDependencies: {
      '@types/node': 'latest',
      typescript: 'latest',
      tsx: 'latest'
    }
  }

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true
    },
    include: ['src']
  }

  const toolsTs = [
    "import type OpenAI from 'openai'",
    "",
    "export type Tool = OpenAI.Chat.Completions.ChatCompletionTool",
    "",
    "export const tools: Tool[] = [",
    "  {",
    "    type: 'function',",
    "    function: {",
    "      name: 'get_current_time',",
    "      description: 'Returns the current date and time',",
    "      parameters: { type: 'object', properties: {}, required: [] },",
    "    },",
    "  },",
    "  {",
    "    type: 'function',",
    "    function: {",
    "      name: 'calculate',",
    "      description: 'Performs a basic arithmetic calculation',",
    "      parameters: {",
    "        type: 'object',",
    "        properties: {",
    "          expression: { type: 'string', description: 'Math expression, e.g. 2 + 2' },",
    "        },",
    "        required: ['expression'],",
    "      },",
    "    },",
    "  },",
    "]",
    "",
    "export function executeTool(name: string, args: Record<string, unknown>): string {",
    "  if (name === 'get_current_time') return new Date().toISOString()",
    "  if (name === 'calculate') {",
    "    try {",
    "      // eslint-disable-next-line no-eval",
    "      return String(eval(args.expression as string))",
    "    } catch { return 'Error: invalid expression' }",
    "  }",
    "  return 'Unknown tool'",
    "}",
  ].join('\n')

  const agentTs = [
    "import OpenAI from 'openai'",
    "import { tools, executeTool } from './tools.js'",
    "",
    "const client = new OpenAI()",
    "",
    "export async function runAgent(userMessage: string): Promise<string> {",
    "  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [",
    "    { role: 'system', content: 'You are a helpful AI assistant built with FreelanceVault.' },",
    "    { role: 'user', content: userMessage },",
    "  ]",
    "",
    "  // Agentic loop — keeps running until no more tool calls",
    "  while (true) {",
    "    const response = await client.chat.completions.create({",
    "      model: 'gpt-4o',",
    "      messages,",
    "      tools,",
    "      tool_choice: 'auto',",
    "    })",
    "",
    "    const choice = response.choices[0]",
    "    messages.push(choice.message)",
    "",
    "    if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {",
    "      return choice.message.content ?? '(no response)'",
    "    }",
    "",
    "    // Execute each tool call and feed results back",
    "    for (const call of choice.message.tool_calls) {",
    "      const args = JSON.parse(call.function.arguments) as Record<string, unknown>",
    "      const result = executeTool(call.function.name, args)",
    "      messages.push({ role: 'tool', tool_call_id: call.id, content: result })",
    "    }",
    "  }",
    "}",
  ].join('\n')

  const indexTs = [
    "import 'dotenv/config'",
    "import { runAgent } from './agent.js'",
    "",
    "const question = process.argv[2] ?? 'What time is it right now, and what is 42 * 7?'",
    "console.log('FreelanceVault AI Agent')",
    "console.log('─'.repeat(40))",
    "console.log('Query:', question)",
    "console.log()",
    "",
    "runAgent(question).then((answer) => {",
    "  console.log('Answer:', answer)",
    "}).catch(console.error)",
  ].join('\n')

  const envExample = ['OPENAI_API_KEY=sk-...', '# Get your key at https://platform.openai.com/api-keys'].join('\n')

  fs.mkdirSync(join(dir, 'src'), { recursive: true })
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  fs.writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
  fs.writeFileSync(join(dir, 'src', 'tools.ts'), toolsTs)
  fs.writeFileSync(join(dir, 'src', 'agent.ts'), agentTs)
  fs.writeFileSync(join(dir, 'src', 'index.ts'), indexTs)
  fs.writeFileSync(join(dir, '.env.example'), envExample)
  fs.writeFileSync(join(dir, '.gitignore'), ['node_modules', 'dist', '.env'].join('\n'))
}

function writeAgentOrchestrationFiles(dir: string, name: string): void {
  const pkg = {
    name,
    version: '1.0.0',
    description: `${name} — Multi-Agent Orchestration with OpenAI`,
    type: 'module',
    scripts: {
      dev: 'tsx src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js'
    },
    dependencies: {
      openai: 'latest',
      dotenv: 'latest',
      zod: 'latest',
      chalk: 'latest'
    },
    devDependencies: {
      '@types/node': 'latest',
      typescript: 'latest',
      tsx: 'latest'
    }
  }

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true
    },
    include: ['src']
  }

  const baseAgentTs = [
    "import OpenAI from 'openai'",
    "",
    "const client = new OpenAI()",
    "",
    "export interface AgentResult {",
    "  agentName: string",
    "  output: string",
    "  tokensUsed: number",
    "}",
    "",
    "export abstract class BaseAgent {",
    "  abstract name: string",
    "  abstract systemPrompt: string",
    "",
    "  async run(input: string): Promise<AgentResult> {",
    "    const response = await client.chat.completions.create({",
    "      model: 'gpt-4o',",
    "      messages: [",
    "        { role: 'system', content: this.systemPrompt },",
    "        { role: 'user', content: input },",
    "      ],",
    "      max_tokens: 2048,",
    "    })",
    "    return {",
    "      agentName: this.name,",
    "      output: response.choices[0]?.message?.content ?? '',",
    "      tokensUsed: response.usage?.total_tokens ?? 0,",
    "    }",
    "  }",
    "}",
  ].join('\n')

  const researchAgentTs = [
    "import { BaseAgent } from './BaseAgent.js'",
    "",
    "export class ResearchAgent extends BaseAgent {",
    "  name = 'Researcher'",
    "  systemPrompt = 'You are a thorough research agent. Given a topic, provide comprehensive, well-structured findings with key facts and context. Format as structured notes.'",
    "}",
  ].join('\n')

  const writerAgentTs = [
    "import { BaseAgent } from './BaseAgent.js'",
    "",
    "export class WriterAgent extends BaseAgent {",
    "  name = 'Writer'",
    "  systemPrompt = 'You are an expert content writer. Given research notes and a topic, produce clear, engaging, well-written content that is concise and valuable.'",
    "}",
  ].join('\n')

  const reviewerAgentTs = [
    "import { BaseAgent } from './BaseAgent.js'",
    "",
    "export class ReviewerAgent extends BaseAgent {",
    "  name = 'Reviewer'",
    "  systemPrompt = 'You are a critical reviewer and editor. Analyze content for accuracy, clarity, and quality. Give specific improvement suggestions and a quality score (1-10).'",
    "}",
  ].join('\n')

  const orchestratorTs = [
    "import { ResearchAgent } from './agents/ResearchAgent.js'",
    "import { WriterAgent } from './agents/WriterAgent.js'",
    "import { ReviewerAgent } from './agents/ReviewerAgent.js'",
    "import type { AgentResult } from './agents/BaseAgent.js'",
    "",
    "export interface OrchestrationResult {",
    "  topic: string",
    "  stages: AgentResult[]",
    "  finalContent: string",
    "  totalTokens: number",
    "  durationMs: number",
    "}",
    "",
    "export class Orchestrator {",
    "  private researcher = new ResearchAgent()",
    "  private writer    = new WriterAgent()",
    "  private reviewer  = new ReviewerAgent()",
    "",
    "  async run(topic: string, onProgress?: (stage: string) => void): Promise<OrchestrationResult> {",
    "    const start = Date.now()",
    "    const stages: AgentResult[] = []",
    "",
    "    onProgress?.('Researching...')",
    "    const research = await this.researcher.run(`Research this topic thoroughly: ${topic}`)",
    "    stages.push(research)",
    "",
    "    onProgress?.('Writing...')",
    "    const writing = await this.writer.run(`Topic: ${topic}\\n\\nResearch:\\n${research.output}\\n\\nWrite the final content.`)",
    "    stages.push(writing)",
    "",
    "    onProgress?.('Reviewing...')",
    "    const review = await this.reviewer.run(`Topic: ${topic}\\n\\nContent:\\n${writing.output}`)",
    "    stages.push(review)",
    "",
    "    return {",
    "      topic,",
    "      stages,",
    "      finalContent: writing.output,",
    "      totalTokens: stages.reduce((sum, s) => sum + s.tokensUsed, 0),",
    "      durationMs: Date.now() - start,",
    "    }",
    "  }",
    "}",
  ].join('\n')

  const indexTs = [
    "import 'dotenv/config'",
    "import { Orchestrator } from './orchestrator.js'",
    "",
    "const topic = process.argv[2] ?? 'The future of AI-assisted freelance development'",
    "",
    "console.log('FreelanceVault · Agent Orchestration')",
    "console.log('Topic:', topic)",
    "console.log('─'.repeat(50))",
    "",
    "const orchestrator = new Orchestrator()",
    "",
    "orchestrator.run(topic, (stage) => {",
    "  process.stdout.write(`[${new Date().toLocaleTimeString()}] ${stage}\\r`)",
    "}).then((result) => {",
    "  console.log('\\n\\n── Final Content ──')",
    "  console.log(result.finalContent)",
    "  console.log('\\n── Stats ──')",
    "  console.log(`Total tokens : ${result.totalTokens}`)",
    "  console.log(`Duration     : ${(result.durationMs / 1000).toFixed(1)}s`)",
    "  result.stages.forEach(s => console.log(`  ${s.agentName.padEnd(12)}: ${s.tokensUsed} tokens`))",
    "}).catch(console.error)",
  ].join('\n')

  const envExample = ['OPENAI_API_KEY=sk-...', '# Get your key at https://platform.openai.com/api-keys'].join('\n')

  fs.mkdirSync(join(dir, 'src', 'agents'), { recursive: true })
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  fs.writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
  fs.writeFileSync(join(dir, 'src', 'agents', 'BaseAgent.ts'), baseAgentTs)
  fs.writeFileSync(join(dir, 'src', 'agents', 'ResearchAgent.ts'), researchAgentTs)
  fs.writeFileSync(join(dir, 'src', 'agents', 'WriterAgent.ts'), writerAgentTs)
  fs.writeFileSync(join(dir, 'src', 'agents', 'ReviewerAgent.ts'), reviewerAgentTs)
  fs.writeFileSync(join(dir, 'src', 'orchestrator.ts'), orchestratorTs)
  fs.writeFileSync(join(dir, 'src', 'index.ts'), indexTs)
  fs.writeFileSync(join(dir, '.env.example'), envExample)
  fs.writeFileSync(join(dir, '.gitignore'), ['node_modules', 'dist', '.env'].join('\n'))
}

// ─── Main Window ─────────────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#F0F4FF',
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
      return { success: true, user: { name: store.get('userName') as string } }
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
        const destDir = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.category)
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
    'files:upload-folder',
    async (_event, payload: { projectId: string; category: 'files' | 'docs' }) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select folder to upload'
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false, files: [], folderName: '' }

        const rootFolder = store.get('rootFolder') as string
        const destDir = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.category)
        fs.mkdirSync(destDir, { recursive: true })

        const srcFolder = result.filePaths[0]
        const parts = srcFolder.split(/[/\\]/)
        const folderName = parts[parts.length - 1] || 'folder'
        const destFolder = join(destDir, folderName)

        const copied = copyFolderFiltered(srcFolder, destFolder)
        return { success: true, files: copied, folderName }
      } catch (err) {
        return { success: false, error: String(err), files: [], folderName: '' }
      }
    }
  )

  ipcMain.handle(
    'files:list',
    (_event, payload: { projectId: string; category: 'files' | 'docs' }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const dir = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.category)
        const files = listFilesRecursive(dir, dir)
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
    (_event, payload: { projectId: string; category: 'files' | 'docs'; relativePath: string }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const filePath = join(
          rootFolder, 'FreelanceVault', 'projects',
          payload.projectId, payload.category, payload.relativePath
        )
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── Folders ─────────────────────────────────────────────────
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

  // ─── Bank Details ────────────────────────────────────────────
  ipcMain.handle('bank:get', () => {
    try {
      const details = (store.get('bankDetails') as unknown[]) || []
      return { success: true, data: details }
    } catch (err) {
      return { success: false, error: String(err), data: [] }
    }
  })

  ipcMain.handle('bank:save', (_event, details: unknown[]) => {
    try {
      store.set('bankDetails', details)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('bank:copy-image', (_event, dataUrl: string) => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl)
      clipboard.writeImage(image)
      // Also save to temp for optional file sharing
      const tmpPath = join(app.getPath('temp'), 'fv-bank-card.png')
      fs.writeFileSync(tmpPath, image.toPNG())
      return { success: true, tmpPath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('bank:save-image', async (_event, dataUrl: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save Bank Details Card',
        defaultPath: join(app.getPath('desktop'), 'bank-details.png'),
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      })
      if (result.canceled || !result.filePath) return { success: false }
      const image = nativeImage.createFromDataURL(dataUrl)
      fs.writeFileSync(result.filePath, image.toPNG())
      return { success: true, path: result.filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─── Code Generation ─────────────────────────────────────────
  ipcMain.handle(
    'code:generate',
    async (
      _event,
      payload: {
        projectId: string
        folderName: string
        framework: 'vite' | 'nextjs' | 'node-backend' | 'python-backend' | 'agent-ai' | 'agent-orchestration'
        initShadcn: boolean
      }
    ) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const projectFolder = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId)
        const targetDir = join(projectFolder, payload.folderName)

        if (fs.existsSync(targetDir)) {
          return { success: false, error: `Folder "${payload.folderName}" already exists in this project` }
        }

        // Ensure the project folder exists before using it as cwd
        fs.mkdirSync(projectFolder, { recursive: true })

        // Extended PATH so npm/npx/git can be found in all common macOS locations
        const env = {
          ...process.env,
          PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`,
        }
        const execOpts = { cwd: projectFolder, env, timeout: 300_000, shell: '/bin/zsh' as const }

        switch (payload.framework) {
          case 'vite': {
            await execAsync(
              `npm create vite@latest "${payload.folderName}" -- --template react-ts`,
              execOpts
            )
            await execAsync('npm install', { ...execOpts, cwd: targetDir })
            fs.writeFileSync(join(targetDir, 'src', 'App.tsx'), getViteHomePage(payload.folderName))
            fs.writeFileSync(join(targetDir, 'src', 'App.css'), '')
            if (payload.initShadcn) {
              // shadcn@latest requires Tailwind v4 which uses the @tailwindcss/vite plugin
              // (no tailwind.config.js, no postcss.config.js, no tailwindcss init command)

              // 1. Install Tailwind v4 vite plugin + @types/node for path alias
              await execAsync(
                'npm install -D tailwindcss @tailwindcss/vite @types/node',
                { ...execOpts, cwd: targetDir }
              )
              // 2. Add @/* path alias to tsconfig.json and tsconfig.app.json
              for (const name of ['tsconfig.json', 'tsconfig.app.json']) {
                const p = join(targetDir, name)
                if (fs.existsSync(p)) {
                  try {
                    const tc = JSON.parse(fs.readFileSync(p, 'utf-8'))
                    tc.compilerOptions = { ...tc.compilerOptions, baseUrl: '.', paths: { '@/*': ['./src/*'] } }
                    fs.writeFileSync(p, JSON.stringify(tc, null, 2))
                  } catch { /* skip unparseable files */ }
                }
              }
              // 3. Write vite.config.ts with @tailwindcss/vite plugin + @/* alias
              fs.writeFileSync(join(targetDir, 'vite.config.ts'),
                `import path from "path"\nimport { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\nimport tailwindcss from "@tailwindcss/vite"\n\nexport default defineConfig({\n  plugins: [react(), tailwindcss()],\n  resolve: {\n    alias: { "@": path.resolve(__dirname, "./src") },\n  },\n})\n`
              )
              // 4. Tailwind v4 CSS entry — just @import "tailwindcss" (no directives, no config file)
              fs.writeFileSync(join(targetDir, 'src', 'index.css'), `@import "tailwindcss";\n`)
              // 5. All prerequisites satisfied — run shadcn init
              await execAsync('npx shadcn@latest init -d', { ...execOpts, cwd: targetDir })
            }
            break
          }

          case 'nextjs': {
            // --yes skips all interactive prompts (including turbopack prompt in Next.js 15+)
            // --use-npm avoids pnpm/yarn ENOENT issues in restricted shell envs
            await execAsync(
              `npx create-next-app@latest "${payload.folderName}" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --use-npm --yes`,
              execOpts
            )
            // Ensure targetDir was actually created before continuing
            fs.mkdirSync(targetDir, { recursive: true })
            const homePath = join(targetDir, 'src', 'app', 'page.tsx')
            if (fs.existsSync(homePath)) {
              fs.writeFileSync(homePath, getNextJsHomePage(payload.folderName))
            }
            if (payload.initShadcn) {
              await execAsync('npx shadcn@latest init -d', { ...execOpts, cwd: targetDir })
            }
            break
          }

          case 'node-backend': {
            fs.mkdirSync(targetDir, { recursive: true })
            writeNodeBackendFiles(targetDir, payload.folderName)
            break
          }

          case 'python-backend': {
            fs.mkdirSync(targetDir, { recursive: true })
            writePythonBackendFiles(targetDir, payload.folderName)
            break
          }

          case 'agent-ai': {
            writeAgentAIFiles(targetDir, payload.folderName)
            break
          }

          case 'agent-orchestration': {
            writeAgentOrchestrationFiles(targetDir, payload.folderName)
            break
          }
        }

        return { success: true, path: targetDir }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── Code Folders ────────────────────────────────────────────
  // Skip heavy dirs when computing folder size — node_modules alone can be 500MB+
  const SIZE_SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', '.next', 'dist', 'build', '.cache'])

  // Known dependency / cache dirs that are safe to delete to free space
  const CLEANUP_DEP_DIRS = [
    'node_modules',   // JS / TS
    '.venv',          // Python virtualenv
    'venv',           // Python virtualenv
    '__pycache__',    // Python bytecode cache
    'target',         // Rust / Maven
    '.gradle',        // Gradle cache
    'vendor',         // Go / PHP / Ruby
    '.dart_tool',     // Dart / Flutter
    'Pods',           // iOS CocoaPods
    '.next',          // Next.js build cache
    'dist',           // generic build output
    'build',          // generic build output
  ]

  function getDirSizeSync(dirPath: string, depth = 0): number {
    if (depth > 8) return 0
    let total = 0
    try {
      for (const item of fs.readdirSync(dirPath)) {
        if (SIZE_SKIP_DIRS.has(item)) continue
        const itemPath = join(dirPath, item)
        try {
          const s = fs.statSync(itemPath)
          total += s.isDirectory() ? getDirSizeSync(itemPath, depth + 1) : s.size
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return total
  }

  // Full recursive size with no skip list — used only on known dep dirs
  function calcDepDirSize(dirPath: string, depth = 0): number {
    if (depth > 12) return 0
    let total = 0
    try {
      for (const item of fs.readdirSync(dirPath)) {
        const p = join(dirPath, item)
        try {
          const s = fs.statSync(p)
          total += s.isDirectory() ? calcDepDirSize(p, depth + 1) : s.size
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return total
  }

  ipcMain.handle('code:list-folders', (_event, projectId: string) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      const projectFolder = join(rootFolder, 'FreelanceVault', 'projects', projectId)
      const excluded = new Set(['files', 'docs', 'credentials'])
      const folders: {
        name: string; path: string; size: number; isGitRepo: boolean
        depDirs: { name: string; size: number }[]
        createdAt: string; modifiedAt: string
      }[] = []
      if (fs.existsSync(projectFolder)) {
        for (const item of fs.readdirSync(projectFolder)) {
          if (excluded.has(item)) continue
          const fullPath = join(projectFolder, item)
          try {
            const stat = fs.statSync(fullPath)
            if (stat.isDirectory()) {
              // Detect which cleanup dirs exist and calculate their sizes
              const depDirs: { name: string; size: number }[] = []
              for (const dep of CLEANUP_DEP_DIRS) {
                const depPath = join(fullPath, dep)
                if (fs.existsSync(depPath)) {
                  depDirs.push({ name: dep, size: calcDepDirSize(depPath) })
                }
              }
              folders.push({
                name: item,
                path: fullPath,
                size: getDirSizeSync(fullPath),
                isGitRepo: fs.existsSync(join(fullPath, '.git')),
                depDirs,
                createdAt: stat.birthtime.toISOString(),
                modifiedAt: stat.mtime.toISOString(),
              })
            }
          } catch { /* skip unreadable entries */ }
        }
      }
      return { success: true, folders }
    } catch (err) {
      return { success: false, folders: [], error: String(err) }
    }
  })

  ipcMain.handle(
    'code:delete-folder',
    (_event, payload: { projectId: string; folderName: string }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const folderPath = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.folderName)
        if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true })
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // Delete a specific dep dir inside a code folder (no trash — permanent)
  ipcMain.handle(
    'code:delete-dep-dir',
    (_event, payload: { projectId: string; folderName: string; depDirName: string }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const depPath = join(
          rootFolder, 'FreelanceVault', 'projects',
          payload.projectId, payload.folderName, payload.depDirName
        )
        if (fs.existsSync(depPath)) fs.rmSync(depPath, { recursive: true, force: true })
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── Git ─────────────────────────────────────────────────────
  ipcMain.handle(
    'git:clone',
    async (_event, payload: { projectId: string; url: string; folderName: string }) => {
      try {
        const rootFolder = store.get('rootFolder') as string
        const projectFolder = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId)
        const env = {
          ...process.env,
          PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || '/usr/bin:/bin'}`,
        }
        fs.mkdirSync(projectFolder, { recursive: true })
        await execAsync(`git clone "${payload.url}" "${payload.folderName}"`, {
          cwd: projectFolder,
          env,
          timeout: 120_000,
          shell: '/bin/zsh',
        })
        return { success: true, path: join(projectFolder, payload.folderName) }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── Git Pull ────────────────────────────────────────────────
  ipcMain.handle('git:pull', async (_event, payload: { projectId: string; folderName: string }) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      const folderPath = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.folderName)
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || '/usr/bin:/bin'}`,
      }
      const { stdout } = await execAsync('git pull', {
        cwd: folderPath,
        env,
        timeout: 60_000,
        shell: '/bin/zsh' as const,
      })
      return { success: true, output: stdout.trim() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─── Open in Editor ──────────────────────────────────────────
  ipcMain.handle('project:open-in-vscode', async (_event, projectId: string) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      const projectFolder = join(rootFolder, 'FreelanceVault', 'projects', projectId)
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || '/usr/bin:/bin'}`,
      }
      await execAsync(`code "${projectFolder}"`, { env, shell: '/bin/zsh' })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('project:open-in-antigravity', async (_event, projectId: string) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      const projectFolder = join(rootFolder, 'FreelanceVault', 'projects', projectId)
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || '/usr/bin:/bin'}`,
      }
      await execAsync(`antigravity "${projectFolder}"`, { env, shell: '/bin/zsh' })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─── Backup Export ────────────────────────────────────────────
  ipcMain.handle('backup:export', async (_event, pin: string) => {
    try {
      const db = readDb()
      const plaintext = JSON.stringify(db)
      const salt = randomBytes(16)
      const key = scryptSync(pin, salt, 32)
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      // Layout: 4-byte magic + salt(16) + iv(12) + tag(16) + ciphertext
      const magic = Buffer.from('FVB1')
      const payload = Buffer.concat([magic, salt, iv, tag, enc])
      const { filePath } = await dialog.showSaveDialog({
        title: 'Save Backup',
        defaultPath: `freelancevault-backup-${new Date().toISOString().slice(0, 10)}.fvb`,
        filters: [{ name: 'FreelanceVault Backup', extensions: ['fvb'] }]
      })
      if (!filePath) return { success: false, error: 'cancelled' }
      fs.writeFileSync(filePath, payload)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─── Backup Import ────────────────────────────────────────────
  ipcMain.handle('backup:import', async (_event, pin: string) => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Open Backup',
        filters: [{ name: 'FreelanceVault Backup', extensions: ['fvb'] }],
        properties: ['openFile']
      })
      if (!filePaths.length) return { success: false, error: 'cancelled' }
      const buf = fs.readFileSync(filePaths[0])
      const magic = buf.slice(0, 4).toString()
      if (magic !== 'FVB1') return { success: false, error: 'Invalid backup file' }
      const salt = buf.slice(4, 20)
      const iv = buf.slice(20, 32)
      const tag = buf.slice(32, 48)
      const enc = buf.slice(48)
      const key = scryptSync(pin, salt, 32)
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
      const data = JSON.parse(plain)
      writeDb(data)
      return { success: true, data }
    } catch {
      return { success: false, error: 'Wrong PIN or corrupted backup' }
    }
  })

  // ─── Script: List ─────────────────────────────────────────────
  ipcMain.handle('script:list', async (_event, payload: { projectId: string; folderName: string }) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      const folderPath = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.folderName)
      const pkgPath = join(folderPath, 'package.json')
      if (!fs.existsSync(pkgPath)) {
        // Check for pyproject.toml or setup.py for Python
        const hasPyproject = fs.existsSync(join(folderPath, 'pyproject.toml'))
        const hasSetupPy = fs.existsSync(join(folderPath, 'setup.py'))
        const hasRequirements = fs.existsSync(join(folderPath, 'requirements.txt'))
        if (hasPyproject || hasSetupPy || hasRequirements) {
          return { success: true, type: 'python', scripts: { 'run': 'python main.py', 'install': 'pip install -r requirements.txt' } }
        }
        return { success: true, type: 'none', scripts: {} }
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return { success: true, type: 'node', scripts: pkg.scripts || {} }
    } catch (err) {
      return { success: false, error: String(err), scripts: {} }
    }
  })

  // ─── Script: Run (streaming) ──────────────────────────────────
  const runningScripts = new Map<string, ReturnType<typeof spawn>>()

  ipcMain.handle(
    'script:run',
    (_event, payload: { projectId: string; folderName: string; scriptName: string; command: string }) => {
      const rootFolder = store.get('rootFolder') as string
      const folderPath = join(rootFolder, 'FreelanceVault', 'projects', payload.projectId, payload.folderName)
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:${process.env.PATH || ''}`,
        FORCE_COLOR: '1'
      }
      const key = `${payload.projectId}:${payload.scriptName}`
      const child = spawn('/bin/zsh', ['-c', payload.command], { cwd: folderPath, env })
      runningScripts.set(key, child)

      const win = BrowserWindow.getAllWindows()[0]
      child.stdout.on('data', (data: Buffer) => {
        win?.webContents.send('script:output', { key, data: data.toString() })
      })
      child.stderr.on('data', (data: Buffer) => {
        win?.webContents.send('script:output', { key, data: data.toString() })
      })
      child.on('close', (code) => {
        runningScripts.delete(key)
        win?.webContents.send('script:done', { key, code })
      })
      return { success: true, key }
    }
  )

  ipcMain.handle('script:stop', (_event, key: string) => {
    const child = runningScripts.get(key)
    if (child) {
      child.kill('SIGTERM')
      runningScripts.delete(key)
      return { success: true }
    }
    return { success: false, error: 'Process not found' }
  })

  // ─── Invoice PDF ──────────────────────────────────────────────
  ipcMain.handle('invoice:generate', async (_event, payload: { html: string; filename: string }) => {
    try {
      const rootFolder = store.get('rootFolder') as string
      const outDir = join(rootFolder, 'FreelanceVault', 'invoices')
      fs.mkdirSync(outDir, { recursive: true })
      const outPath = join(outDir, payload.filename)

      const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`)
      const pdfBuf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true })
      win.close()
      fs.writeFileSync(outPath, pdfBuf)

      const { filePath } = await dialog.showSaveDialog({
        title: 'Save Invoice',
        defaultPath: outPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (filePath && filePath !== outPath) fs.copyFileSync(outPath, filePath)
      shell.openPath(filePath || outPath)
      return { success: true, path: filePath || outPath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
