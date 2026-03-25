"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const child_process = require("child_process");
const util = require("util");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const Store = require("electron-store");
const execAsync = util.promisify(child_process.exec);
const store = new Store({
  defaults: {
    rootFolder: "",
    isSetup: false,
    pinHash: "",
    userName: "",
    displayCurrency: "USD"
  }
});
function hashPin(pin) {
  return crypto.createHash("sha256").update(`fv-salt-2024-${pin}`).digest("hex");
}
function getDbPath() {
  const rootFolder = store.get("rootFolder");
  return path.join(rootFolder, "DevVault", "data", "db.json");
}
function readDb() {
  const dbPath = getDbPath();
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
  }
  return { projects: [], payments: [], credentials: [], timeEntries: [], envVars: [] };
}
function writeDb(data) {
  const dbPath = getDbPath();
  const dir = path.join(dbPath, "..");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}
function createProjectFolders(rootFolder, projectId) {
  const base = path.join(rootFolder, "DevVault", "projects", projectId);
  fs.mkdirSync(path.join(base, "files"), { recursive: true });
  fs.mkdirSync(path.join(base, "docs"), { recursive: true });
  fs.mkdirSync(path.join(base, "credentials"), { recursive: true });
}
function listFilesRecursive(dir, baseDir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    const relPath = path.relative(baseDir, fullPath);
    if (stat.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      results.push({ name: item, relativePath: relPath, size: stat.size, modifiedAt: stat.mtime.toISOString(), path: fullPath });
    }
  }
  return results;
}
const UPLOAD_SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".pnpm-store",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".env",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".vercel",
  "coverage",
  ".nyc_output",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".idea",
  ".gradle",
  "target"
]);
function copyFolderFiltered(src, dest) {
  const copied = [];
  fs.mkdirSync(dest, { recursive: true });
  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item.endsWith(".egg-info") || item.endsWith(".dist-info")) continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    let stat;
    try {
      stat = fs.statSync(srcPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (UPLOAD_SKIP_DIRS.has(item)) continue;
      copied.push(...copyFolderFiltered(srcPath, destPath));
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied.push(item);
    }
  }
  return copied;
}
function getViteHomePage(name) {
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
    "          DevVault",
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
    "}"
  ].join("\n");
}
function getNextJsHomePage(name) {
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
    "          DevVault",
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
    "}"
  ].join("\n");
}
function writeNodeBackendFiles(dir, name) {
  const pkg = {
    name,
    version: "1.0.0",
    description: `${name} — Node.js REST API`,
    main: "dist/index.js",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js"
    },
    dependencies: {
      express: "latest",
      cors: "latest",
      dotenv: "latest",
      helmet: "latest"
    },
    devDependencies: {
      "@types/express": "latest",
      "@types/cors": "latest",
      "@types/node": "latest",
      typescript: "latest",
      tsx: "latest"
    }
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      outDir: "dist",
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true
    },
    include: ["src"],
    exclude: ["node_modules", "dist"]
  };
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
    "  console.log(`DevVault · ${'" + name + "'} running on http://localhost:${PORT}`)",
    "})"
  ].join("\n");
  const routesTs = [
    "import { Router } from 'express'",
    "",
    "export const router = Router()",
    "",
    "router.get('/', (_req, res) => {",
    "  res.json({ message: 'API is running', version: '1.0.0' })",
    "})"
  ].join("\n");
  const envExample = [
    "PORT=3001",
    "NODE_ENV=development",
    "# Add your environment variables here"
  ].join("\n");
  const gitignore = ["node_modules", "dist", ".env"].join("\n");
  fs.mkdirSync(path.join(dir, "src", "routes"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(path.join(dir, "src", "index.ts"), indexTs);
  fs.writeFileSync(path.join(dir, "src", "routes", "index.ts"), routesTs);
  fs.writeFileSync(path.join(dir, ".env.example"), envExample);
  fs.writeFileSync(path.join(dir, ".gitignore"), gitignore);
}
function writePythonBackendFiles(dir, name) {
  const mainPy = [
    "from fastapi import FastAPI",
    "from fastapi.middleware.cors import CORSMiddleware",
    "from app.api.routes import router",
    "",
    "app = FastAPI(",
    `    title='${name}',`,
    "    description='DevVault — FastAPI Backend',",
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
    `    return {'status': 'ok', 'service': '${name}'}`
  ].join("\n");
  const routesPy = [
    "from fastapi import APIRouter",
    "",
    "router = APIRouter()",
    "",
    "@router.get('/')",
    "def index():",
    "    return {'message': 'API is running', 'version': '1.0.0'}"
  ].join("\n");
  const runPy = [
    "import uvicorn",
    "",
    "if __name__ == '__main__':",
    "    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)"
  ].join("\n");
  const requirements = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "python-dotenv>=1.0.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0"
  ].join("\n");
  const envExample = ["PORT=8000", "DEBUG=true", "# Add your environment variables here"].join("\n");
  fs.mkdirSync(path.join(dir, "app", "api"), { recursive: true });
  fs.writeFileSync(path.join(dir, "app", "__init__.py"), "");
  fs.writeFileSync(path.join(dir, "app", "api", "__init__.py"), "");
  fs.writeFileSync(path.join(dir, "app", "api", "routes.py"), routesPy);
  fs.writeFileSync(path.join(dir, "main.py"), mainPy);
  fs.writeFileSync(path.join(dir, "run.py"), runPy);
  fs.writeFileSync(path.join(dir, "requirements.txt"), requirements);
  fs.writeFileSync(path.join(dir, ".env.example"), envExample);
  fs.writeFileSync(path.join(dir, ".gitignore"), ["__pycache__", "*.pyc", ".env", "venv", ".venv"].join("\n"));
}
function writeAgentAIFiles(dir, name) {
  const pkg = {
    name,
    version: "1.0.0",
    description: `${name} — AI Agent with OpenAI`,
    type: "module",
    scripts: {
      dev: "tsx src/index.ts",
      build: "tsc",
      start: "node dist/index.js"
    },
    dependencies: {
      openai: "latest",
      dotenv: "latest",
      zod: "latest"
    },
    devDependencies: {
      "@types/node": "latest",
      typescript: "latest",
      tsx: "latest"
    }
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      outDir: "dist",
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true
    },
    include: ["src"]
  };
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
    "}"
  ].join("\n");
  const agentTs = [
    "import OpenAI from 'openai'",
    "import { tools, executeTool } from './tools.js'",
    "",
    "const client = new OpenAI()",
    "",
    "export async function runAgent(userMessage: string): Promise<string> {",
    "  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [",
    "    { role: 'system', content: 'You are a helpful AI assistant built with DevVault.' },",
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
    "}"
  ].join("\n");
  const indexTs = [
    "import 'dotenv/config'",
    "import { runAgent } from './agent.js'",
    "",
    "const question = process.argv[2] ?? 'What time is it right now, and what is 42 * 7?'",
    "console.log('DevVault AI Agent')",
    "console.log('─'.repeat(40))",
    "console.log('Query:', question)",
    "console.log()",
    "",
    "runAgent(question).then((answer) => {",
    "  console.log('Answer:', answer)",
    "}).catch(console.error)"
  ].join("\n");
  const envExample = ["OPENAI_API_KEY=sk-...", "# Get your key at https://platform.openai.com/api-keys"].join("\n");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(path.join(dir, "src", "tools.ts"), toolsTs);
  fs.writeFileSync(path.join(dir, "src", "agent.ts"), agentTs);
  fs.writeFileSync(path.join(dir, "src", "index.ts"), indexTs);
  fs.writeFileSync(path.join(dir, ".env.example"), envExample);
  fs.writeFileSync(path.join(dir, ".gitignore"), ["node_modules", "dist", ".env"].join("\n"));
}
function writeAgentOrchestrationFiles(dir, name) {
  const pkg = {
    name,
    version: "1.0.0",
    description: `${name} — Multi-Agent Orchestration with OpenAI`,
    type: "module",
    scripts: {
      dev: "tsx src/index.ts",
      build: "tsc",
      start: "node dist/index.js"
    },
    dependencies: {
      openai: "latest",
      dotenv: "latest",
      zod: "latest",
      chalk: "latest"
    },
    devDependencies: {
      "@types/node": "latest",
      typescript: "latest",
      tsx: "latest"
    }
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      outDir: "dist",
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true
    },
    include: ["src"]
  };
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
    "}"
  ].join("\n");
  const researchAgentTs = [
    "import { BaseAgent } from './BaseAgent.js'",
    "",
    "export class ResearchAgent extends BaseAgent {",
    "  name = 'Researcher'",
    "  systemPrompt = 'You are a thorough research agent. Given a topic, provide comprehensive, well-structured findings with key facts and context. Format as structured notes.'",
    "}"
  ].join("\n");
  const writerAgentTs = [
    "import { BaseAgent } from './BaseAgent.js'",
    "",
    "export class WriterAgent extends BaseAgent {",
    "  name = 'Writer'",
    "  systemPrompt = 'You are an expert content writer. Given research notes and a topic, produce clear, engaging, well-written content that is concise and valuable.'",
    "}"
  ].join("\n");
  const reviewerAgentTs = [
    "import { BaseAgent } from './BaseAgent.js'",
    "",
    "export class ReviewerAgent extends BaseAgent {",
    "  name = 'Reviewer'",
    "  systemPrompt = 'You are a critical reviewer and editor. Analyze content for accuracy, clarity, and quality. Give specific improvement suggestions and a quality score (1-10).'",
    "}"
  ].join("\n");
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
    "}"
  ].join("\n");
  const indexTs = [
    "import 'dotenv/config'",
    "import { Orchestrator } from './orchestrator.js'",
    "",
    "const topic = process.argv[2] ?? 'The future of AI-assisted freelance development'",
    "",
    "console.log('DevVault · Agent Orchestration')",
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
    "}).catch(console.error)"
  ].join("\n");
  const envExample = ["OPENAI_API_KEY=sk-...", "# Get your key at https://platform.openai.com/api-keys"].join("\n");
  fs.mkdirSync(path.join(dir, "src", "agents"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(path.join(dir, "src", "agents", "BaseAgent.ts"), baseAgentTs);
  fs.writeFileSync(path.join(dir, "src", "agents", "ResearchAgent.ts"), researchAgentTs);
  fs.writeFileSync(path.join(dir, "src", "agents", "WriterAgent.ts"), writerAgentTs);
  fs.writeFileSync(path.join(dir, "src", "agents", "ReviewerAgent.ts"), reviewerAgentTs);
  fs.writeFileSync(path.join(dir, "src", "orchestrator.ts"), orchestratorTs);
  fs.writeFileSync(path.join(dir, "src", "index.ts"), indexTs);
  fs.writeFileSync(path.join(dir, ".env.example"), envExample);
  fs.writeFileSync(path.join(dir, ".gitignore"), ["node_modules", "dist", ".env"].join("\n"));
}
function createMainWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#F0F4FF",
    vibrancy: "under-window",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.freelancevault.app");
  if (process.platform === "darwin") {
    const iconPath = is.dev ? path.join(__dirname, "../../resources/icon.png") : path.join(process.resourcesPath, "icon.png");
    if (fs.existsSync(iconPath)) {
      electron.app.dock.setIcon(iconPath);
    }
  }
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("app:get-settings", () => ({
    rootFolder: store.get("rootFolder"),
    isSetup: store.get("isSetup"),
    userName: store.get("userName"),
    hasPinSet: !!store.get("pinHash"),
    displayCurrency: store.get("displayCurrency") || "USD"
  }));
  electron.ipcMain.handle("app:set-currency", (_event, currency) => {
    store.set("displayCurrency", currency);
    return { success: true };
  });
  electron.ipcMain.handle("app:select-folder", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose DevVault Location"
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  electron.ipcMain.handle(
    "app:setup-complete",
    (_event, payload) => {
      try {
        const vaultRoot = path.join(payload.rootFolder, "DevVault");
        fs.mkdirSync(path.join(vaultRoot, "data"), { recursive: true });
        fs.mkdirSync(path.join(vaultRoot, "projects"), { recursive: true });
        const dbPath = path.join(vaultRoot, "data", "db.json");
        if (!fs.existsSync(dbPath)) {
          fs.writeFileSync(
            dbPath,
            JSON.stringify({ projects: [], payments: [], credentials: [] }, null, 2),
            "utf-8"
          );
        }
        store.set("rootFolder", payload.rootFolder);
        store.set("isSetup", true);
        store.set("pinHash", hashPin(payload.pin));
        store.set("userName", payload.name);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle("auth:verify-pin", (_event, pin) => {
    const stored = store.get("pinHash");
    if (!stored) return { success: false, error: "No PIN configured" };
    const matches = hashPin(pin) === stored;
    if (matches) {
      return { success: true, user: { name: store.get("userName") } };
    }
    return { success: false, error: "Incorrect PIN" };
  });
  electron.ipcMain.handle("auth:touch-id", async () => {
    try {
      if (!electron.systemPreferences.canPromptTouchID()) {
        return { success: false, error: "Touch ID not available" };
      }
      await electron.systemPreferences.promptTouchID("to access DevVault");
      return { success: true, user: { name: store.get("userName") } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("auth:check-touch-id", () => {
    try {
      return { available: electron.systemPreferences.canPromptTouchID() };
    } catch {
      return { available: false };
    }
  });
  electron.ipcMain.handle("db:read", () => {
    try {
      return { success: true, data: readDb() };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("db:write", (_event, data) => {
    try {
      writeDb(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle(
    "files:upload",
    async (_event, payload) => {
      try {
        const result = await electron.dialog.showOpenDialog({
          properties: ["openFile", "multiSelections"],
          title: "Select files to upload"
        });
        if (result.canceled || result.filePaths.length === 0) return { success: false, files: [] };
        const rootFolder = store.get("rootFolder");
        const destDir = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.category);
        fs.mkdirSync(destDir, { recursive: true });
        const uploaded = [];
        for (const filePath of result.filePaths) {
          const parts = filePath.split(/[/\\]/);
          const fileName = parts[parts.length - 1] || "file";
          const destPath = path.join(destDir, fileName);
          fs.copyFileSync(filePath, destPath);
          uploaded.push(fileName);
        }
        return { success: true, files: uploaded };
      } catch (err) {
        return { success: false, error: String(err), files: [] };
      }
    }
  );
  electron.ipcMain.handle(
    "files:upload-folder",
    async (_event, payload) => {
      try {
        const result = await electron.dialog.showOpenDialog({
          properties: ["openDirectory"],
          title: "Select folder to upload"
        });
        if (result.canceled || result.filePaths.length === 0) return { success: false, files: [], folderName: "" };
        const rootFolder = store.get("rootFolder");
        const destDir = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.category);
        fs.mkdirSync(destDir, { recursive: true });
        const srcFolder = result.filePaths[0];
        const parts = srcFolder.split(/[/\\]/);
        const folderName = parts[parts.length - 1] || "folder";
        const destFolder = path.join(destDir, folderName);
        const copied = copyFolderFiltered(srcFolder, destFolder);
        return { success: true, files: copied, folderName };
      } catch (err) {
        return { success: false, error: String(err), files: [], folderName: "" };
      }
    }
  );
  electron.ipcMain.handle(
    "files:list",
    (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const dir = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.category);
        const files = listFilesRecursive(dir, dir);
        return { success: true, files };
      } catch (err) {
        return { success: false, error: String(err), files: [] };
      }
    }
  );
  electron.ipcMain.handle("files:open", (_event, filePath) => {
    electron.shell.openPath(path.resolve(filePath));
    return { success: true };
  });
  electron.ipcMain.handle(
    "files:delete",
    (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const filePath = path.join(
          rootFolder,
          "DevVault",
          "projects",
          payload.projectId,
          payload.category,
          payload.relativePath
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle("folder:open", (_event, folderPath) => {
    electron.shell.openPath(path.resolve(folderPath));
    return { success: true };
  });
  electron.ipcMain.handle("project:create-folders", (_event, projectId) => {
    try {
      const rootFolder = store.get("rootFolder");
      createProjectFolders(rootFolder, projectId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("project:get-folder", (_event, projectId) => {
    const rootFolder = store.get("rootFolder");
    return path.join(rootFolder, "DevVault", "projects", projectId);
  });
  electron.ipcMain.handle("bank:get", () => {
    try {
      const details = store.get("bankDetails") || [];
      return { success: true, data: details };
    } catch (err) {
      return { success: false, error: String(err), data: [] };
    }
  });
  electron.ipcMain.handle("bank:save", (_event, details) => {
    try {
      store.set("bankDetails", details);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("bank:copy-image", (_event, dataUrl) => {
    try {
      const image = electron.nativeImage.createFromDataURL(dataUrl);
      electron.clipboard.writeImage(image);
      const tmpPath = path.join(electron.app.getPath("temp"), "fv-bank-card.png");
      fs.writeFileSync(tmpPath, image.toPNG());
      return { success: true, tmpPath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("bank:save-image", async (_event, dataUrl) => {
    try {
      const result = await electron.dialog.showSaveDialog({
        title: "Save Bank Details Card",
        defaultPath: path.join(electron.app.getPath("desktop"), "bank-details.png"),
        filters: [{ name: "PNG Image", extensions: ["png"] }]
      });
      if (result.canceled || !result.filePath) return { success: false };
      const image = electron.nativeImage.createFromDataURL(dataUrl);
      fs.writeFileSync(result.filePath, image.toPNG());
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle(
    "code:generate",
    async (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const projectFolder = path.join(rootFolder, "DevVault", "projects", payload.projectId);
        const targetDir = path.join(projectFolder, payload.folderName);
        if (fs.existsSync(targetDir)) {
          return { success: false, error: `Folder "${payload.folderName}" already exists in this project` };
        }
        fs.mkdirSync(projectFolder, { recursive: true });
        const env = {
          ...process.env,
          PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ""}`
        };
        const execOpts = { cwd: projectFolder, env, timeout: 3e5, shell: "/bin/zsh" };
        switch (payload.framework) {
          case "vite": {
            await execAsync(
              `npm create vite@latest "${payload.folderName}" -- --template react-ts`,
              execOpts
            );
            await execAsync("npm install", { ...execOpts, cwd: targetDir });
            fs.writeFileSync(path.join(targetDir, "src", "App.tsx"), getViteHomePage(payload.folderName));
            fs.writeFileSync(path.join(targetDir, "src", "App.css"), "");
            if (payload.initShadcn) {
              await execAsync(
                "npm install -D tailwindcss @tailwindcss/vite @types/node",
                { ...execOpts, cwd: targetDir }
              );
              for (const name of ["tsconfig.json", "tsconfig.app.json"]) {
                const p = path.join(targetDir, name);
                if (fs.existsSync(p)) {
                  try {
                    const tc = JSON.parse(fs.readFileSync(p, "utf-8"));
                    tc.compilerOptions = { ...tc.compilerOptions, baseUrl: ".", paths: { "@/*": ["./src/*"] } };
                    fs.writeFileSync(p, JSON.stringify(tc, null, 2));
                  } catch {
                  }
                }
              }
              fs.writeFileSync(
                path.join(targetDir, "vite.config.ts"),
                `import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
`
              );
              fs.writeFileSync(path.join(targetDir, "src", "index.css"), `@import "tailwindcss";
`);
              await execAsync("npx shadcn@latest init -d", { ...execOpts, cwd: targetDir });
            }
            break;
          }
          case "nextjs": {
            await execAsync(
              `npx create-next-app@latest "${payload.folderName}" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --use-npm --yes`,
              execOpts
            );
            fs.mkdirSync(targetDir, { recursive: true });
            const homePath = path.join(targetDir, "src", "app", "page.tsx");
            if (fs.existsSync(homePath)) {
              fs.writeFileSync(homePath, getNextJsHomePage(payload.folderName));
            }
            if (payload.initShadcn) {
              await execAsync("npx shadcn@latest init -d", { ...execOpts, cwd: targetDir });
            }
            break;
          }
          case "node-backend": {
            fs.mkdirSync(targetDir, { recursive: true });
            writeNodeBackendFiles(targetDir, payload.folderName);
            break;
          }
          case "python-backend": {
            fs.mkdirSync(targetDir, { recursive: true });
            writePythonBackendFiles(targetDir, payload.folderName);
            break;
          }
          case "agent-ai": {
            writeAgentAIFiles(targetDir, payload.folderName);
            break;
          }
          case "agent-orchestration": {
            writeAgentOrchestrationFiles(targetDir, payload.folderName);
            break;
          }
        }
        return { success: true, path: targetDir };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  const SIZE_SKIP_DIRS = /* @__PURE__ */ new Set([".git", "node_modules", "__pycache__", ".venv", "venv", ".next", "dist", "build", ".cache"]);
  const CLEANUP_DEP_DIRS = [
    "node_modules",
    // JS / TS
    ".venv",
    // Python virtualenv
    "venv",
    // Python virtualenv
    "__pycache__",
    // Python bytecode cache
    "target",
    // Rust / Maven
    ".gradle",
    // Gradle cache
    "vendor",
    // Go / PHP / Ruby
    ".dart_tool",
    // Dart / Flutter
    "Pods",
    // iOS CocoaPods
    ".next",
    // Next.js build cache
    "dist",
    // generic build output
    "build"
    // generic build output
  ];
  function getDirSizeSync(dirPath, depth = 0) {
    if (depth > 8) return 0;
    let total = 0;
    try {
      for (const item of fs.readdirSync(dirPath)) {
        if (SIZE_SKIP_DIRS.has(item)) continue;
        const itemPath = path.join(dirPath, item);
        try {
          const s = fs.statSync(itemPath);
          total += s.isDirectory() ? getDirSizeSync(itemPath, depth + 1) : s.size;
        } catch {
        }
      }
    } catch {
    }
    return total;
  }
  function calcDepDirSize(dirPath, depth = 0) {
    if (depth > 12) return 0;
    let total = 0;
    try {
      for (const item of fs.readdirSync(dirPath)) {
        const p = path.join(dirPath, item);
        try {
          const s = fs.statSync(p);
          total += s.isDirectory() ? calcDepDirSize(p, depth + 1) : s.size;
        } catch {
        }
      }
    } catch {
    }
    return total;
  }
  electron.ipcMain.handle("code:list-folders", (_event, projectId) => {
    try {
      const rootFolder = store.get("rootFolder");
      const projectFolder = path.join(rootFolder, "DevVault", "projects", projectId);
      const excluded = /* @__PURE__ */ new Set(["files", "docs", "credentials"]);
      const folders = [];
      if (fs.existsSync(projectFolder)) {
        for (const item of fs.readdirSync(projectFolder)) {
          if (excluded.has(item)) continue;
          const fullPath = path.join(projectFolder, item);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              const depDirs = [];
              for (const dep of CLEANUP_DEP_DIRS) {
                const depPath = path.join(fullPath, dep);
                if (fs.existsSync(depPath)) {
                  depDirs.push({ name: dep, size: calcDepDirSize(depPath) });
                }
              }
              folders.push({
                name: item,
                path: fullPath,
                size: getDirSizeSync(fullPath),
                isGitRepo: fs.existsSync(path.join(fullPath, ".git")),
                depDirs,
                createdAt: stat.birthtime.toISOString(),
                modifiedAt: stat.mtime.toISOString()
              });
            }
          } catch {
          }
        }
      }
      return { success: true, folders };
    } catch (err) {
      return { success: false, folders: [], error: String(err) };
    }
  });
  electron.ipcMain.handle(
    "code:delete-folder",
    (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const folderPath = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
        if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle(
    "code:delete-dep-dir",
    (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const depPath = path.join(
          rootFolder,
          "DevVault",
          "projects",
          payload.projectId,
          payload.folderName,
          payload.depDirName
        );
        if (fs.existsSync(depPath)) fs.rmSync(depPath, { recursive: true, force: true });
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle(
    "git:clone",
    async (_event, payload) => {
      try {
        const rootFolder = store.get("rootFolder");
        const projectFolder = path.join(rootFolder, "DevVault", "projects", payload.projectId);
        const env = {
          ...process.env,
          PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
        };
        fs.mkdirSync(projectFolder, { recursive: true });
        await execAsync(`git clone "${payload.url}" "${payload.folderName}"`, {
          cwd: projectFolder,
          env,
          timeout: 12e4,
          shell: "/bin/zsh"
        });
        return { success: true, path: path.join(projectFolder, payload.folderName) };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );
  electron.ipcMain.handle("git:pull", async (_event, payload) => {
    try {
      const rootFolder = store.get("rootFolder");
      const folderPath = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
      };
      const { stdout } = await execAsync("git pull", {
        cwd: folderPath,
        env,
        timeout: 6e4,
        shell: "/bin/zsh"
      });
      return { success: true, output: stdout.trim() };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("project:get-folder-path", (_event, projectId) => {
    const rootFolder = store.get("rootFolder");
    return path.join(rootFolder, "DevVault", "projects", projectId);
  });
  electron.ipcMain.handle("project:open-in-vscode", async (_event, projectId) => {
    try {
      const rootFolder = store.get("rootFolder");
      const projectFolder = path.join(rootFolder, "DevVault", "projects", projectId);
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
      };
      await execAsync(`code "${projectFolder}"`, { env, shell: "/bin/zsh" });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("project:open-in-antigravity", async (_event, projectId) => {
    try {
      const rootFolder = store.get("rootFolder");
      const projectFolder = path.join(rootFolder, "DevVault", "projects", projectId);
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
      };
      try {
        await execAsync(`antigravity "${projectFolder}"`, { env, shell: "/bin/zsh" });
      } catch {
        await execAsync(`open -a "Antigravity" "${projectFolder}"`, { env, shell: "/bin/zsh" });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("code:open-in-vscode", async (_event, payload) => {
    try {
      const rootFolder = store.get("rootFolder");
      const folderPath = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
      };
      await execAsync(`code "${folderPath}"`, { env, shell: "/bin/zsh" });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("code:open-in-antigravity", async (_event, payload) => {
    try {
      const rootFolder = store.get("rootFolder");
      const folderPath = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
      };
      try {
        await execAsync(`antigravity "${folderPath}"`, { env, shell: "/bin/zsh" });
      } catch {
        await execAsync(`open -a "Antigravity" "${folderPath}"`, { env, shell: "/bin/zsh" });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("editors:detect", async () => {
    const candidates = [
      { name: "VS Code", appName: "Visual Studio Code", cli: "code" },
      { name: "Cursor", appName: "Cursor", cli: "cursor" },
      { name: "Zed", appName: "Zed", cli: "zed" },
      { name: "Antigravity", appName: "Antigravity", cli: "antigravity" },
      { name: "Windsurf", appName: "Windsurf", cli: "windsurf" },
      { name: "Sublime Text", appName: "Sublime Text", cli: "subl" },
      { name: "WebStorm", appName: "WebStorm", cli: null },
      { name: "Nova", appName: "Nova", cli: "nova" }
    ];
    const available = [];
    for (const ed of candidates) {
      const appPath = `/Applications/${ed.appName}.app`;
      if (fs.existsSync(appPath)) {
        available.push({ name: ed.name, appName: ed.appName, cli: ed.cli });
      }
    }
    return available;
  });
  electron.ipcMain.handle("editors:open", async (_event, payload) => {
    try {
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH || "/usr/bin:/bin"}`
      };
      if (payload.cli) {
        try {
          await execAsync(`${payload.cli} "${payload.folderPath}"`, { env, shell: "/bin/zsh" });
          return { success: true };
        } catch {
        }
      }
      await execAsync(`open -a "${payload.appName}" "${payload.folderPath}"`, { env, shell: "/bin/zsh" });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("code:get-folder-path", (_event, payload) => {
    const rootFolder = store.get("rootFolder");
    return path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
  });
  electron.ipcMain.handle("backup:export", async (_event, pin) => {
    try {
      const db = readDb();
      const plaintext = JSON.stringify(db);
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(pin, salt, 32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const magic = Buffer.from("FVB1");
      const payload = Buffer.concat([magic, salt, iv, tag, enc]);
      const { filePath } = await electron.dialog.showSaveDialog({
        title: "Save Backup",
        defaultPath: `devvault-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.fvb`,
        filters: [{ name: "DevVault Backup", extensions: ["fvb"] }]
      });
      if (!filePath) return { success: false, error: "cancelled" };
      fs.writeFileSync(filePath, payload);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("backup:import", async (_event, pin) => {
    try {
      const { filePaths } = await electron.dialog.showOpenDialog({
        title: "Open Backup",
        filters: [{ name: "DevVault Backup", extensions: ["fvb"] }],
        properties: ["openFile"]
      });
      if (!filePaths.length) return { success: false, error: "cancelled" };
      const buf = fs.readFileSync(filePaths[0]);
      const magic = buf.slice(0, 4).toString();
      if (magic !== "FVB1") return { success: false, error: "Invalid backup file" };
      const salt = buf.slice(4, 20);
      const iv = buf.slice(20, 32);
      const tag = buf.slice(32, 48);
      const enc = buf.slice(48);
      const key = crypto.scryptSync(pin, salt, 32);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
      const data = JSON.parse(plain);
      writeDb(data);
      return { success: true, data };
    } catch {
      return { success: false, error: "Wrong PIN or corrupted backup" };
    }
  });
  electron.ipcMain.handle("script:list", async (_event, payload) => {
    try {
      const rootFolder = store.get("rootFolder");
      const folderPath = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
      const pkgPath = path.join(folderPath, "package.json");
      if (!fs.existsSync(pkgPath)) {
        const hasPyproject = fs.existsSync(path.join(folderPath, "pyproject.toml"));
        const hasSetupPy = fs.existsSync(path.join(folderPath, "setup.py"));
        const hasRequirements = fs.existsSync(path.join(folderPath, "requirements.txt"));
        if (hasPyproject || hasSetupPy || hasRequirements) {
          return { success: true, type: "python", scripts: { "run": "python main.py", "install": "pip install -r requirements.txt" } };
        }
        return { success: true, type: "none", scripts: {} };
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return { success: true, type: "node", scripts: pkg.scripts || {} };
    } catch (err) {
      return { success: false, error: String(err), scripts: {} };
    }
  });
  const runningScripts = /* @__PURE__ */ new Map();
  electron.ipcMain.handle(
    "script:run",
    (_event, payload) => {
      const rootFolder = store.get("rootFolder");
      const folderPath = path.join(rootFolder, "DevVault", "projects", payload.projectId, payload.folderName);
      const env = {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:${process.env.PATH || ""}`,
        FORCE_COLOR: "1"
      };
      const key = `${payload.projectId}:${payload.scriptName}`;
      const child = child_process.spawn("/bin/zsh", ["-c", payload.command], { cwd: folderPath, env });
      runningScripts.set(key, child);
      const win = electron.BrowserWindow.getAllWindows()[0];
      child.stdout.on("data", (data) => {
        win?.webContents.send("script:output", { key, data: data.toString() });
      });
      child.stderr.on("data", (data) => {
        win?.webContents.send("script:output", { key, data: data.toString() });
      });
      child.on("close", (code) => {
        runningScripts.delete(key);
        win?.webContents.send("script:done", { key, code });
      });
      return { success: true, key };
    }
  );
  electron.ipcMain.handle("script:stop", (_event, key) => {
    const child = runningScripts.get(key);
    if (child) {
      child.kill("SIGTERM");
      runningScripts.delete(key);
      return { success: true };
    }
    return { success: false, error: "Process not found" };
  });
  electron.ipcMain.handle("invoice:generate", async (_event, payload) => {
    try {
      const rootFolder = store.get("rootFolder");
      const outDir = path.join(rootFolder, "DevVault", "invoices");
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, payload.filename);
      const win = new electron.BrowserWindow({ show: false, webPreferences: { offscreen: true } });
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);
      const pdfBuf = await win.webContents.printToPDF({ pageSize: "A4", printBackground: true });
      win.close();
      fs.writeFileSync(outPath, pdfBuf);
      const { filePath } = await electron.dialog.showSaveDialog({
        title: "Save Invoice",
        defaultPath: outPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (filePath && filePath !== outPath) fs.copyFileSync(outPath, filePath);
      electron.shell.openPath(filePath || outPath);
      return { success: true, path: filePath || outPath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("ai:get-config", () => {
    return store.get("aiConfig") || { selectedProvider: "openai", openaiKey: "", geminiKey: "", deepseekKey: "" };
  });
  electron.ipcMain.handle("ai:save-config", (_event, config) => {
    store.set("aiConfig", config);
    return { success: true };
  });
  electron.ipcMain.handle("ai:generate-linkedin", async (_event, projectId) => {
    try {
      let readCodeFiles = function(dir) {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (excluded.has(item) || item.startsWith(".")) continue;
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            readCodeFiles(fullPath);
          } else {
            const ext = item.split(".").pop()?.toLowerCase() || "";
            const codeExts = /* @__PURE__ */ new Set(["ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "cs", "cpp", "c", "swift", "kt", "rb", "php", "vue", "svelte", "json", "yaml", "yml", "toml", "md"]);
            if (!codeExts.has(ext)) continue;
            if (stat.size > 5e4) continue;
            if (codeContext.length >= MAX_CHARS) continue;
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const relPath = fullPath.replace(projectFolder + "/", "");
              codeContext += `

--- ${relPath} ---
${content.slice(0, 3e3)}`;
            } catch {
            }
          }
        }
      };
      const aiConfig = store.get("aiConfig") || {};
      const provider = aiConfig.selectedProvider || "openai";
      const apiKey = provider === "openai" ? aiConfig.openaiKey : provider === "gemini" ? aiConfig.geminiKey : aiConfig.deepseekKey;
      if (!apiKey) return { success: false, error: "No API key configured. Go to AI Manager to add your key." };
      const rootFolder = store.get("rootFolder");
      const projectFolder = path.join(rootFolder, "DevVault", "projects", projectId);
      const excluded = /* @__PURE__ */ new Set(["files", "docs", "credentials", "node_modules", ".git", "__pycache__", ".next", "dist", "build", ".venv", "venv"]);
      let codeContext = "";
      const MAX_CHARS = 6e4;
      readCodeFiles(projectFolder);
      if (!codeContext.trim()) {
        return { success: false, error: "No code files found in this project. Generate or add code first." };
      }
      const prompt = `You are a professional technical writer helping a developer craft their LinkedIn Projects section entry.

Analyze the following project code and generate LinkedIn Projects section content. Be specific about what this project actually does based on the code.

PROJECT CODE:
${codeContext.slice(0, MAX_CHARS)}

Generate a JSON response with exactly this structure:
{
  "title": "A compelling project title (max 80 chars)",
  "description": "A concise 2-3 sentence description optimized for LinkedIn's Projects section. Describe what the project does, key technical decisions, and impact. Write in third person or as a noun phrase. No hashtags. No emoji. Keep it professional and recruitier-friendly.",
  "technologies": ["list", "of", "specific", "technologies", "used"],
  "interviewQuestions": [
    {
      "question": "A specific technical interview question a hiring manager might ask about this project's architecture, design decisions, or implementation challenges",
      "answer": "A strong, detailed model answer (3-5 sentences) that demonstrates technical depth and problem-solving skills. Reference actual patterns or decisions visible in the code."
    }
  ]
}

Generate exactly 5 interview Q&A pairs. Return ONLY valid JSON, no markdown, no explanation.`;
      let result;
      if (provider === "gemini") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
            })
          }
        );
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(clean);
      } else {
        const baseUrl = provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
        const model = provider === "deepseek" ? "deepseek-chat" : "gpt-4o";
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 4096
          })
        });
        const data = await response.json();
        if (data?.error) return { success: false, error: data.error.message };
        const text = data?.choices?.[0]?.message?.content || "";
        const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(clean);
      }
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("master:get-breakdown", async () => {
    try {
      const home = os.homedir();
      const dfTarget = fs.existsSync("/System/Volumes/Data") ? "/System/Volumes/Data" : "/";
      const { stdout: dfOut } = await execAsync(`df -k "${dfTarget}"`, { timeout: 5e3 });
      const dfParts = dfOut.trim().split("\n")[1].trim().split(/\s+/);
      const diskTotal = parseInt(dfParts[1]) * 1024;
      const diskFree = parseInt(dfParts[3]) * 1024;
      const sizeOf = async (p) => {
        if (!fs.existsSync(p)) return 0;
        try {
          const { stdout } = await execAsync(`du -sk "${p}" 2>/dev/null`, { timeout: 2e4 });
          return parseInt(stdout.split("	")[0] || "0") * 1024;
        } catch {
          return 0;
        }
      };
      const [
        appsSize,
        downloadsSize,
        documentsSize,
        desktopSize,
        moviesSize,
        musicSize,
        picturesSize,
        icloudSize,
        mailSize,
        trashSize,
        logsSize,
        appCachesSize,
        appSupportSize,
        derivedDataSize,
        simulatorsSize,
        xcodeArchivesSize,
        xcodeDevSize,
        npmSize,
        yarnSize,
        pnpmSize,
        brewSize,
        pipSize,
        gradleSize,
        mavenSize,
        cocoapodsSize,
        pubCacheSize,
        cargoSize
      ] = await Promise.all([
        sizeOf("/Applications"),
        sizeOf(path.join(home, "Downloads")),
        sizeOf(path.join(home, "Documents")),
        sizeOf(path.join(home, "Desktop")),
        sizeOf(path.join(home, "Movies")),
        sizeOf(path.join(home, "Music")),
        sizeOf(path.join(home, "Pictures")),
        sizeOf(path.join(home, "Library/Mobile Documents")),
        sizeOf(path.join(home, "Library/Mail")),
        sizeOf(path.join(home, ".Trash")),
        sizeOf(path.join(home, "Library/Logs")),
        sizeOf(path.join(home, "Library/Caches")),
        sizeOf(path.join(home, "Library/Application Support")),
        sizeOf(path.join(home, "Library/Developer/Xcode/DerivedData")),
        sizeOf(path.join(home, "Library/Developer/CoreSimulator/Devices")),
        sizeOf(path.join(home, "Library/Developer/Xcode/Archives")),
        sizeOf(path.join(home, "Library/Developer/Xcode/iOS DeviceSupport")),
        sizeOf(path.join(home, ".npm")),
        sizeOf(path.join(home, ".yarn/cache")),
        sizeOf(path.join(home, ".pnpm-store")),
        sizeOf(path.join(home, "Library/Caches/Homebrew")),
        sizeOf(path.join(home, "Library/Caches/pip")),
        sizeOf(path.join(home, ".gradle/caches")),
        sizeOf(path.join(home, ".m2/repository")),
        sizeOf(path.join(home, ".cocoapods")),
        sizeOf(path.join(home, ".pub-cache")),
        sizeOf(path.join(home, ".cargo/registry"))
      ]);
      const devSize = derivedDataSize + simulatorsSize + xcodeArchivesSize + xcodeDevSize;
      const pkgSize = npmSize + yarnSize + pnpmSize + brewSize + pipSize + gradleSize + mavenSize + cocoapodsSize + pubCacheSize + cargoSize;
      const buckets = [
        {
          id: "applications",
          name: "Applications",
          color: "#3b82f6",
          size: appsSize,
          status: "system",
          note: "Installed macOS apps. Use Launchpad or drag to Trash to remove.",
          mainPath: "/Applications",
          subItems: []
        },
        {
          id: "downloads",
          name: "Downloads",
          color: "#f59e0b",
          size: downloadsSize,
          status: "user-files",
          note: "Your downloaded files. Review and delete what you no longer need.",
          mainPath: path.join(home, "Downloads"),
          subItems: []
        },
        {
          id: "documents",
          name: "Documents",
          color: "#10b981",
          size: documentsSize,
          status: "user-files",
          note: "Your documents and files. Review manually.",
          mainPath: path.join(home, "Documents"),
          subItems: []
        },
        {
          id: "desktop",
          name: "Desktop",
          color: "#06b6d4",
          size: desktopSize,
          status: "user-files",
          note: "Files on your Desktop.",
          mainPath: path.join(home, "Desktop"),
          subItems: []
        },
        {
          id: "movies",
          name: "Movies & Videos",
          color: "#ef4444",
          size: moviesSize,
          status: "user-files",
          note: "Video files. Large videos you no longer need can be deleted.",
          mainPath: path.join(home, "Movies"),
          subItems: []
        },
        {
          id: "music",
          name: "Music",
          color: "#ec4899",
          size: musicSize,
          status: "user-files",
          note: "Music files and your library.",
          mainPath: path.join(home, "Music"),
          subItems: []
        },
        {
          id: "pictures",
          name: "Photos & Images",
          color: "#f97316",
          size: picturesSize,
          status: "user-files",
          note: "Photos library and image files.",
          mainPath: path.join(home, "Pictures"),
          subItems: []
        },
        {
          id: "icloud",
          name: "iCloud Drive",
          color: "#60a5fa",
          size: icloudSize,
          status: "user-files",
          note: "iCloud synced files. Manage via System Settings → iCloud.",
          mainPath: path.join(home, "Library/Mobile Documents"),
          subItems: []
        },
        {
          id: "mail",
          name: "Mail",
          color: "#a78bfa",
          size: mailSize,
          status: "user-files",
          note: "Downloaded email attachments and mailboxes. Clean up via Mail app.",
          mainPath: path.join(home, "Library/Mail"),
          subItems: []
        },
        {
          id: "app-support",
          name: "App Data",
          color: "#6366f1",
          size: appSupportSize,
          status: "system",
          note: "Application settings, databases, saved state. Deleting may break apps.",
          mainPath: path.join(home, "Library/Application Support"),
          subItems: []
        },
        {
          id: "caches",
          name: "App Caches",
          color: "#22d3ee",
          size: appCachesSize,
          status: "cleanable",
          note: "macOS & app caches — rebuild automatically after deletion.",
          mainPath: path.join(home, "Library/Caches"),
          subItems: [
            { name: "All App Caches", path: path.join(home, "Library/Caches"), size: appCachesSize, canDelete: true }
          ]
        },
        {
          id: "developer",
          name: "Developer Tools",
          color: "#8b5cf6",
          size: devSize,
          status: devSize > 0 ? "cleanable" : "system",
          note: "Xcode build artifacts and iOS simulators — safe to delete, they rebuild.",
          mainPath: path.join(home, "Library/Developer"),
          subItems: [
            { name: "Xcode Derived Data", path: path.join(home, "Library/Developer/Xcode/DerivedData"), size: derivedDataSize, canDelete: true },
            { name: "iOS Simulators", path: path.join(home, "Library/Developer/CoreSimulator/Devices"), size: simulatorsSize, canDelete: true },
            { name: "Xcode Archives", path: path.join(home, "Library/Developer/Xcode/Archives"), size: xcodeArchivesSize, canDelete: true },
            { name: "iOS Device Support", path: path.join(home, "Library/Developer/Xcode/iOS DeviceSupport"), size: xcodeDevSize, canDelete: true }
          ].filter((s) => s.size > 0)
        },
        {
          id: "pkg-caches",
          name: "Package Caches",
          color: "#34d399",
          size: pkgSize,
          status: pkgSize > 0 ? "cleanable" : "system",
          note: "Dependency caches for npm, pip, Homebrew, etc. Safe to delete.",
          mainPath: home,
          subItems: [
            { name: "npm", path: path.join(home, ".npm"), size: npmSize, canDelete: true },
            { name: "Yarn", path: path.join(home, ".yarn/cache"), size: yarnSize, canDelete: true },
            { name: "pnpm", path: path.join(home, ".pnpm-store"), size: pnpmSize, canDelete: true },
            { name: "Homebrew", path: path.join(home, "Library/Caches/Homebrew"), size: brewSize, canDelete: true },
            { name: "pip", path: path.join(home, "Library/Caches/pip"), size: pipSize, canDelete: true },
            { name: "Gradle", path: path.join(home, ".gradle/caches"), size: gradleSize, canDelete: true },
            { name: "Maven", path: path.join(home, ".m2/repository"), size: mavenSize, canDelete: true },
            { name: "CocoaPods", path: path.join(home, ".cocoapods"), size: cocoapodsSize, canDelete: true },
            { name: "Flutter", path: path.join(home, ".pub-cache"), size: pubCacheSize, canDelete: true },
            { name: "Cargo", path: path.join(home, ".cargo/registry"), size: cargoSize, canDelete: true }
          ].filter((s) => s.size > 0)
        },
        {
          id: "logs",
          name: "System Logs",
          color: "#94a3b8",
          size: logsSize,
          status: "cleanable",
          note: "Application log files. Safe to delete.",
          mainPath: path.join(home, "Library/Logs"),
          subItems: [
            { name: "All Logs", path: path.join(home, "Library/Logs"), size: logsSize, canDelete: true }
          ]
        },
        {
          id: "trash",
          name: "Trash",
          color: "#6b7280",
          size: trashSize,
          status: "cleanable",
          note: "Files in Trash waiting to be permanently deleted.",
          mainPath: path.join(home, ".Trash"),
          subItems: [
            { name: "Empty Trash", path: path.join(home, ".Trash"), size: trashSize, canDelete: true }
          ]
        }
      ].filter((b) => b.size > 0);
      buckets.sort((a, b) => b.size - a.size);
      const measuredTotal = buckets.reduce((s, b) => s + b.size, 0);
      const systemSize = Math.max(0, diskTotal - diskFree - measuredTotal);
      return { success: true, diskTotal, diskFree, systemSize, buckets };
    } catch (err) {
      return { success: false, error: String(err), diskTotal: 0, diskFree: 0, systemSize: 0, buckets: [] };
    }
  });
  electron.ipcMain.handle("scanner:get-storage-info", async () => {
    try {
      const dfTarget = fs.existsSync("/System/Volumes/Data") ? "/System/Volumes/Data" : "/";
      const { stdout } = await execAsync(`df -k "${dfTarget}"`, { timeout: 5e3 });
      const parts = stdout.trim().split("\n")[1].trim().split(/\s+/);
      const total = parseInt(parts[1]) * 1024;
      const available = parseInt(parts[3]) * 1024;
      const used = total - available;
      return { success: true, total, used, free: available };
    } catch (err) {
      return { success: false, error: String(err), total: 0, used: 0, free: 0 };
    }
  });
  electron.ipcMain.handle("scanner:scan-files", async (_event, sizeFilter) => {
    try {
      const home = os.homedir();
      const scanRoots = [
        home,
        "/Applications",
        "/private/var/folders"
        // user temp / sandboxed app caches
      ].filter((p) => fs.existsSync(p));
      const args = [...scanRoots, "-type", "f"];
      if (sizeFilter === "large") {
        args.push("-size", "+102400k");
      } else if (sizeFilter === "medium") {
        args.push("-size", "+10240k", "-not", "-size", "+102400k");
      } else {
        args.push("-size", "+1024k", "-not", "-size", "+10240k");
      }
      args.push(
        "-not",
        "-path",
        "*/node_modules/*",
        "-not",
        "-path",
        "*/.git/*",
        "-not",
        "-path",
        "*/Library/Caches/*",
        "-not",
        "-path",
        "*/Library/Mail/V*",
        "-not",
        "-path",
        "*/private/var/folders/*/C/*",
        // sandboxed caches
        "-not",
        "-path",
        "*/.Trash/*",
        "-not",
        "-path",
        "*/System/*",
        "-not",
        "-path",
        "*/private/var/vm/*"
        // swap files
      );
      const stdout = await new Promise((resolve2) => {
        let output = "";
        const child = child_process.spawn("find", args);
        child.stdout.on("data", (data) => {
          output += data.toString();
        });
        child.on("close", () => resolve2(output));
        child.on("error", () => resolve2(output));
        setTimeout(() => {
          child.kill();
          resolve2(output);
        }, 45e3);
      });
      const paths = stdout.trim().split("\n").filter(Boolean).slice(0, 1e3);
      const files = paths.map((p) => {
        try {
          const stat = fs.statSync(p);
          const nameParts = p.split("/");
          return {
            name: nameParts[nameParts.length - 1] || p,
            path: p,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString()
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
      return { success: true, files };
    } catch (err) {
      return { success: false, files: [], error: String(err) };
    }
  });
  electron.ipcMain.handle("scanner:get-caches", async () => {
    try {
      const home = os.homedir();
      const cacheDirs = [
        // macOS system caches
        { name: "App Caches", path: path.join(home, "Library/Caches"), description: "macOS application caches" },
        { name: "App Logs", path: path.join(home, "Library/Logs"), description: "Application log files" },
        { name: "Trash", path: path.join(home, ".Trash"), description: "Files waiting to be deleted" },
        // Node / JS
        { name: "npm Cache", path: path.join(home, ".npm"), description: "Node package manager cache" },
        { name: "Yarn Cache", path: path.join(home, ".yarn/cache"), description: "Yarn package manager cache" },
        { name: "pnpm Store", path: path.join(home, "Library/pnpm"), description: "pnpm package store" },
        { name: "pnpm Cache", path: path.join(home, ".pnpm-store"), description: "pnpm content-addressable store" },
        { name: "Bun Cache", path: path.join(home, "Library/Caches/bun"), description: "Bun runtime cache" },
        // Apple dev tools
        { name: "Xcode Derived Data", path: path.join(home, "Library/Developer/Xcode/DerivedData"), description: "Xcode build artifacts" },
        { name: "Xcode Archives", path: path.join(home, "Library/Developer/Xcode/Archives"), description: "Xcode app archives" },
        { name: "Xcode Device Support", path: path.join(home, "Library/Developer/Xcode/iOS DeviceSupport"), description: "Xcode iOS device symbols" },
        { name: "iOS Simulators", path: path.join(home, "Library/Developer/CoreSimulator/Devices"), description: "iOS simulator device data" },
        // Package managers
        { name: "Homebrew Cache", path: path.join(home, "Library/Caches/Homebrew"), description: "Homebrew package downloads" },
        { name: "pip Cache", path: path.join(home, "Library/Caches/pip"), description: "Python pip cache" },
        { name: "Gradle Cache", path: path.join(home, ".gradle/caches"), description: "Gradle build cache" },
        { name: "Maven Repository", path: path.join(home, ".m2/repository"), description: "Maven dependency cache" },
        { name: "CocoaPods", path: path.join(home, ".cocoapods"), description: "iOS CocoaPods cache" },
        { name: "Flutter/Dart", path: path.join(home, ".pub-cache"), description: "Flutter & Dart packages" },
        { name: "Composer Cache", path: path.join(home, ".composer/cache"), description: "PHP Composer cache" },
        { name: "RubyGems Cache", path: path.join(home, ".gem"), description: "Ruby gems cache" },
        { name: "Cargo Registry", path: path.join(home, ".cargo/registry"), description: "Rust Cargo package registry" },
        // Containers
        { name: "Docker Data", path: path.join(home, "Library/Containers/com.docker.docker/Data"), description: "Docker container & image data" },
        { name: "Docker Desktop Cache", path: path.join(home, "Library/Caches/com.docker.docker"), description: "Docker Desktop cache" },
        // Apps
        { name: "VS Code Extensions", path: path.join(home, ".vscode/extensions"), description: "VS Code installed extensions" },
        { name: "Cursor Extensions", path: path.join(home, ".cursor/extensions"), description: "Cursor editor extensions" },
        { name: "Slack Cache", path: path.join(home, "Library/Application Support/Slack/Cache"), description: "Slack message cache" },
        { name: "Chrome Cache", path: path.join(home, "Library/Caches/Google/Chrome/Default/Cache"), description: "Google Chrome cache" },
        { name: "Firefox Cache", path: path.join(home, "Library/Caches/Firefox/Profiles"), description: "Firefox browser cache" },
        { name: "Spotify Cache", path: path.join(home, "Library/Caches/com.spotify.client"), description: "Spotify media cache" },
        { name: "Zoom Cache", path: path.join(home, "Library/Caches/us.zoom.xos"), description: "Zoom meeting cache" }
      ];
      const results = await Promise.all(cacheDirs.map(async (c) => {
        try {
          if (!fs.existsSync(c.path)) return null;
          const { stdout } = await execAsync(`du -sk "${c.path}" 2>/dev/null`, { timeout: 15e3 });
          const size = parseInt(stdout.split("	")[0] || "0") * 1024;
          if (size === 0) return null;
          return { ...c, size };
        } catch {
          return null;
        }
      }));
      return { success: true, caches: results.filter(Boolean) };
    } catch (err) {
      return { success: false, caches: [], error: String(err) };
    }
  });
  electron.ipcMain.handle("scanner:clear-cache", async (_event, cachePath) => {
    try {
      const home = os.homedir();
      if (!cachePath.startsWith(home)) {
        return { success: false, error: "Can only clear caches within home directory" };
      }
      if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true, force: true });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("scanner:get-projects", async () => {
    try {
      let detectLang = function(projectPath, files) {
        if (files.includes("package.json")) {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, "package.json"), "utf-8"));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            const isTs = files.includes("tsconfig.json") || !!deps["typescript"];
            const lang = isTs ? "TypeScript" : "JavaScript";
            if (deps["next"]) return { language: lang, framework: "Next.js" };
            if (deps["react"] || deps["react-dom"]) return { language: lang, framework: deps["vite"] ? "Vite + React" : "React" };
            if (deps["vue"]) return { language: lang, framework: "Vue" };
            if (deps["@angular/core"]) return { language: lang, framework: "Angular" };
            if (deps["svelte"]) return { language: lang, framework: "Svelte" };
            if (deps["electron"]) return { language: lang, framework: "Electron" };
            if (deps["express"]) return { language: lang, framework: "Express" };
            if (deps["fastify"]) return { language: lang, framework: "Fastify" };
            if (deps["@nestjs/core"]) return { language: lang, framework: "NestJS" };
            return { language: lang, framework: "Node.js" };
          } catch {
            return { language: "JavaScript", framework: "Node.js" };
          }
        }
        if (files.includes("requirements.txt") || files.includes("pyproject.toml") || files.includes("setup.py")) {
          try {
            const req = files.includes("requirements.txt") ? fs.readFileSync(path.join(projectPath, "requirements.txt"), "utf-8").toLowerCase() : "";
            if (req.includes("django")) return { language: "Python", framework: "Django" };
            if (req.includes("flask")) return { language: "Python", framework: "Flask" };
            if (req.includes("fastapi")) return { language: "Python", framework: "FastAPI" };
            if (req.includes("torch") || req.includes("pytorch")) return { language: "Python", framework: "PyTorch" };
            if (req.includes("tensorflow")) return { language: "Python", framework: "TensorFlow" };
          } catch {
          }
          return { language: "Python", framework: "Python" };
        }
        if (files.includes("Cargo.toml")) return { language: "Rust", framework: "Rust" };
        if (files.includes("go.mod")) return { language: "Go", framework: "Go" };
        if (files.includes("pubspec.yaml")) return { language: "Dart", framework: "Flutter" };
        if (files.includes("pom.xml")) return { language: "Java", framework: "Maven" };
        if (files.includes("build.gradle")) return { language: "Java/Kotlin", framework: "Gradle" };
        if (files.includes("Gemfile")) return { language: "Ruby", framework: "Ruby" };
        if (files.includes("composer.json")) return { language: "PHP", framework: "PHP" };
        if (files.includes("CMakeLists.txt")) return { language: "C/C++", framework: "CMake" };
        return { language: "Unknown", framework: "Project" };
      };
      const home = os.homedir();
      const rootFolder = store.get("rootFolder") || "";
      const excludePaths = [];
      if (rootFolder) excludePaths.push(path.join(rootFolder, "DevVault"));
      const appRoot = electron.app.getAppPath();
      excludePaths.push(appRoot);
      excludePaths.push(path.join(appRoot, ".."));
      const shouldExclude = (p) => excludePaths.some((ex) => p === ex || p.startsWith(ex + "/"));
      const skipDirs = /* @__PURE__ */ new Set([
        "node_modules",
        ".git",
        "__pycache__",
        ".next",
        "dist",
        "build",
        "out",
        ".venv",
        "venv",
        "env",
        "Library",
        "Applications",
        "Movies",
        "Music",
        "Pictures",
        "Public",
        ".Trash",
        ".cache",
        "vendor",
        "target",
        ".build"
      ]);
      const containerDirs = /* @__PURE__ */ new Set([
        "Downloads",
        "Desktop",
        "Documents",
        "code",
        "projects",
        "dev",
        "workspace",
        "repos",
        "src",
        "work",
        "Sites"
      ]);
      const projectMarkers = [
        "package.json",
        "requirements.txt",
        "pyproject.toml",
        "setup.py",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "pubspec.yaml",
        "composer.json",
        "Gemfile",
        "mix.exs",
        "CMakeLists.txt"
      ];
      const projects = [];
      const scanDir = async (dir, depth) => {
        if (depth > 4) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || skipDirs.has(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);
          if (shouldExclude(fullPath)) continue;
          let dirFiles;
          try {
            dirFiles = fs.readdirSync(fullPath);
          } catch {
            continue;
          }
          const isProject = projectMarkers.some((m) => dirFiles.includes(m)) && !containerDirs.has(entry.name);
          if (isProject) {
            try {
              const { stdout } = await execAsync(`du -sk "${fullPath}" 2>/dev/null`, { timeout: 15e3 });
              const size = parseInt(stdout.split("	")[0] || "0") * 1024;
              const stat = fs.statSync(fullPath);
              projects.push({
                name: entry.name,
                path: fullPath,
                size,
                ...detectLang(fullPath, dirFiles),
                modifiedAt: stat.mtime.toISOString()
              });
            } catch {
            }
          } else {
            await scanDir(fullPath, depth + 1);
          }
        }
      };
      await scanDir(home, 1);
      projects.sort((a, b) => b.size - a.size);
      return { success: true, projects };
    } catch (err) {
      return { success: false, projects: [], error: String(err) };
    }
  });
  electron.ipcMain.handle("scanner:get-project-contents", async (_event, projectPath) => {
    try {
      const home = os.homedir();
      if (!projectPath.startsWith(home)) return { success: false, error: "Outside home directory", entries: [] };
      const cleanableDirs = /* @__PURE__ */ new Set([
        "node_modules",
        ".next",
        "dist",
        "build",
        "out",
        ".turbo",
        "__pycache__",
        ".venv",
        "venv",
        "env",
        ".cache",
        "coverage",
        "target",
        "vendor",
        ".gradle",
        ".parcel-cache",
        ".nuxt",
        ".output",
        "storybook-static",
        ".docusaurus",
        ".svelte-kit"
      ]);
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      const results = [];
      await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(projectPath, entry.name);
        try {
          if (entry.isDirectory()) {
            const { stdout } = await execAsync(`du -sk "${fullPath}" 2>/dev/null`, { timeout: 1e4 });
            const size = parseInt(stdout.split("	")[0] || "0") * 1024;
            results.push({ name: entry.name, path: fullPath, size, isDir: true, isCleanable: cleanableDirs.has(entry.name) });
          } else {
            const ext = entry.name.split(".").pop()?.toLowerCase() || "";
            const skipExts = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "mp4", "mov", "mp3", "wav", "otf", "ttf", "woff", "woff2"]);
            if (skipExts.has(ext)) return;
            const stat = fs.statSync(fullPath);
            if (stat.size > 100 * 1024) {
              results.push({ name: entry.name, path: fullPath, size: stat.size, isDir: false, isCleanable: false });
            }
          }
        } catch {
        }
      }));
      results.sort((a, b) => {
        if (a.isCleanable !== b.isCleanable) return a.isCleanable ? -1 : 1;
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return b.size - a.size;
      });
      return { success: true, entries: results };
    } catch (err) {
      return { success: false, error: String(err), entries: [] };
    }
  });
  electron.ipcMain.handle("scanner:delete-files", async (_event, filePaths) => {
    const home = os.homedir();
    const results = [];
    for (const filePath of filePaths) {
      try {
        if (!filePath.startsWith(home)) {
          results.push({ path: filePath, success: false, error: "Outside home directory" });
          continue;
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        results.push({ path: filePath, success: true });
      } catch (err) {
        results.push({ path: filePath, success: false, error: String(err) });
      }
    }
    return { success: true, results };
  });
  createMainWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
