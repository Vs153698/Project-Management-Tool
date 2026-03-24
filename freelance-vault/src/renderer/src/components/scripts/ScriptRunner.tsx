import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, Terminal, RefreshCw, ChevronDown, ChevronUp, FolderOpen, Code2 } from 'lucide-react'
import { useEditors } from '../../hooks/useEditors'

interface ScriptInfo {
  name: string
  command: string
}

interface CodeFolder {
  name: string
  path: string
}

interface OutputLine {
  text: string
  ts: number
}

export default function ScriptRunner({ projectId }: { projectId: string }): JSX.Element {
  const { editors, openInEditor } = useEditors()
  const [folders, setFolders] = useState<CodeFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [scripts, setScripts] = useState<ScriptInfo[]>([])
  const [scriptType, setScriptType] = useState<'node' | 'python' | 'none'>('none')
  const [customCmd, setCustomCmd] = useState('')
  const [running, setRunning] = useState<string | null>(null) // key of running process
  const [output, setOutput] = useState<OutputLine[]>([])
  const [expanded, setExpanded] = useState(true)
  const [loadingScripts, setLoadingScripts] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef<string | null>(null)

  const loadFolders = useCallback(async () => {
    const result = await window.electron.codeListFolders(projectId)
    if (result.success) {
      setFolders(result.folders)
      setSelectedFolder((prev) => {
        if (prev) return prev
        return result.folders.length === 1 ? result.folders[0].name : null
      })
    }
  }, [projectId])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    if (!selectedFolder) return
    setLoadingScripts(true)
    window.electron.scriptList({ projectId, folderName: selectedFolder }).then((result) => {
      setLoadingScripts(false)
      if (result.success) {
        const type = result.type as 'node' | 'python' | 'none'
        setScriptType(type)
        const list: ScriptInfo[] = Object.entries(result.scripts || {}).map(([name, command]) => ({
          name,
          command: type === 'node' ? `npm run ${name}` : command
        }))
        setScripts(list)
      }
    })
  }, [selectedFolder, projectId])

  useEffect(() => {
    // Register output/done listeners once — use ref to check current running key
    const offOutput = window.electron.onScriptOutput(({ key, data }) => {
      if (key === runningRef.current) {
        setOutput((prev) => [...prev, { text: data, ts: Date.now() }])
        setTimeout(() => {
          outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
        }, 50)
      }
    })
    const offDone = window.electron.onScriptDone(({ key, code }) => {
      if (key === runningRef.current) {
        setOutput((prev) => [
          ...prev,
          { text: `\n[Process exited with code ${code}]\n`, ts: Date.now() }
        ])
        runningRef.current = null
        setRunning(null)
      }
    })
    return () => {
      offOutput()
      offDone()
    }
  }, [])

  const runScript = async (cmd: string, name: string) => {
    if (!selectedFolder) return
    setOutput([])
    setExpanded(true)
    const result = await window.electron.scriptRun({
      projectId,
      folderName: selectedFolder,
      scriptName: name,
      command: cmd
    })
    if (result.success && result.key) {
      runningRef.current = result.key
      setRunning(result.key)
    }
  }

  const stopScript = async () => {
    if (!running) return
    await window.electron.scriptStop(running)
    runningRef.current = null
    setRunning(null)
    setOutput((prev) => [...prev, { text: '\n[Process stopped by user]\n', ts: Date.now() }])
  }

  const handleCustomRun = () => {
    if (!customCmd.trim()) return
    runScript(customCmd.trim(), 'custom')
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Terminal size={16} className="text-success" />
        <span className="text-text font-semibold">Script Runner</span>
      </div>

      {/* Folder selector */}
      {folders.length > 0 && (
        <div className="space-y-2">
          {folders.length > 1 && (
            <>
              <label className="label">Code Folder</label>
              <div className="flex gap-2 flex-wrap">
                {folders.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setSelectedFolder(f.name)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selectedFolder === f.name
                        ? 'bg-success/15 text-success border-success/30'
                        : 'bg-surface text-text-muted border-border hover:border-border/60'
                    }`}
                  >
                    <FolderOpen size={13} className="inline mr-1.5 -mt-0.5" />
                    {f.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Open selected folder shortcuts */}
          {selectedFolder && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={async () => {
                  const path = await window.electron.codeGetFolderPath({ projectId, folderName: selectedFolder })
                  window.electron.folderOpen(path)
                }}
                className="btn-secondary text-xs py-1 px-2.5"
                title="Open code folder in Finder"
              >
                <FolderOpen size={12} />
                Open in Finder
              </button>
              {editors.map((ed) => (
                <button
                  key={ed.appName}
                  onClick={async () => {
                    const path = await window.electron.codeGetFolderPath({ projectId, folderName: selectedFolder })
                    openInEditor(path, ed)
                  }}
                  className="btn-secondary text-xs py-1 px-2.5"
                  title={`Open in ${ed.name}`}
                >
                  <Code2 size={12} />
                  {ed.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {folders.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          <Terminal size={28} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No code folders yet.</p>
          <p className="text-xs mt-1 opacity-60">Generate or clone a repo in the Files tab first.</p>
        </div>
      )}

      {selectedFolder && (
        <>
          {/* Scripts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">
                {scriptType === 'node' ? 'npm scripts' : scriptType === 'python' ? 'Python scripts' : 'Scripts'}
                {loadingScripts && <RefreshCw size={12} className="inline ml-1.5 animate-spin text-text-muted" />}
              </label>
            </div>
            {scripts.length === 0 && !loadingScripts ? (
              <p className="text-text-muted text-xs">No scripts found in this folder.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {scripts.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => runScript(
                      scriptType === 'node' ? `npm run ${s.name}` : s.command,
                      s.name
                    )}
                    disabled={!!running}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/25 text-sm font-medium hover:bg-success/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play size={12} />
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom command */}
          <div>
            <label className="label">Custom Command</label>
            <div className="flex gap-2">
              <input
                className="input flex-1 font-mono text-sm"
                placeholder="npm install / python app.py / any command..."
                value={customCmd}
                onChange={(e) => setCustomCmd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !running && handleCustomRun()}
                disabled={!!running}
              />
              {running ? (
                <button onClick={stopScript} className="btn-danger py-2 px-3 shrink-0">
                  <Square size={14} />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleCustomRun}
                  disabled={!customCmd.trim()}
                  className="btn-primary py-2 px-3 shrink-0 disabled:opacity-40"
                >
                  <Play size={14} />
                  Run
                </button>
              )}
            </div>
          </div>

          {/* Output terminal */}
          {(output.length > 0 || running) && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div
                className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${running ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
                  <span className="text-text-muted text-xs font-mono">
                    {running ? 'Running...' : 'Output'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOutput([]) }}
                    className="text-text-muted hover:text-text text-xs transition-colors"
                  >
                    Clear
                  </button>
                  {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                </div>
              </div>
              {expanded && (
                <div
                  ref={outputRef}
                  className="bg-[#0d0d12] p-3 max-h-72 overflow-y-auto font-mono text-xs leading-relaxed"
                >
                  {output.map((line, i) => (
                    <pre
                      key={i}
                      className="text-[#c8e6c9] whitespace-pre-wrap break-all"
                      style={{ margin: 0 }}
                    >
                      {line.text}
                    </pre>
                  ))}
                  {running && (
                    <span className="inline-block w-2 h-3 bg-green-400 animate-pulse ml-0.5" />
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
