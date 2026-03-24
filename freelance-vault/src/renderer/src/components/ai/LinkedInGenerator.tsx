import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Linkedin,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bot,
  Code2,
  MessageSquare,
  Tag,
  ExternalLink,
  Briefcase,
  Save,
  History,
  Trash2,
  Clock
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { SavedLinkedInPost } from '../../types'
import { format, parseISO } from 'date-fns'

interface Props {
  projectId: string
}

interface InterviewQA {
  question: string
  answer: string
}

interface GeneratedContent {
  title: string
  description: string
  technologies: string[]
  interviewQuestions: InterviewQA[]
}

function generateId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function LinkedInGenerator({ projectId }: Props): JSX.Element {
  const { db, saveLinkedInPost, deleteLinkedInPost } = useAppStore()

  const savedPosts = useMemo(
    () => (db.savedLinkedInPosts || []).filter((p) => p.projectId === projectId).sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    ),
    [db.savedLinkedInPosts, projectId]
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [content, setContent] = useState<GeneratedContent | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showQuestions, setShowQuestions] = useState(true)
  const [expandedQ, setExpandedQ] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'generate' | 'saved'>('generate')
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null)
  const [savedExpandedQ, setSavedExpandedQ] = useState<{ postId: string; qi: number } | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setContent(null)
    setExpandedQ(null)

    const result = await window.electron.aiGenerateLinkedin(projectId)

    if (result.success && result.data) {
      setContent(result.data as GeneratedContent)
    } else {
      setError(result.error || 'Generation failed. Please try again.')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!content) return
    const post: SavedLinkedInPost = {
      id: generateId(),
      projectId,
      title: content.title,
      description: content.description,
      technologies: content.technologies,
      interviewQuestions: content.interviewQuestions,
      generatedAt: new Date().toISOString()
    }
    await saveLinkedInPost(post)
    setCopied('saved')
    setTimeout(() => setCopied(null), 2000)
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyProjectEntry = (c: GeneratedContent) => {
    const text = [
      c.title,
      '',
      c.description,
      '',
      `Skills: ${c.technologies.join(' · ')}`
    ].join('\n')
    copyText(text, 'full')
  }

  const copyQA = (qa: InterviewQA, idx: number) => {
    const text = `Q: ${qa.question}\n\nA: ${qa.answer}`
    copyText(text, `qa${idx}`)
  }

  const ContentCard = ({ c, savedId }: { c: GeneratedContent; savedId?: string }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wider">LinkedIn Projects Entry</p>
        <div className="flex gap-2">
          <button onClick={() => copyProjectEntry(c)} className="btn-primary text-sm py-1.5 px-3">
            {copied === 'full' ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Entry</>}
          </button>
          {!savedId && (
            <button onClick={handleSave} className="btn-secondary text-sm py-1.5 px-3">
              {copied === 'saved' ? <><Check size={13} className="text-success" /> Saved!</> : <><Save size={13} /> Save</>}
            </button>
          )}
          <a
            href="https://www.linkedin.com/in/"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-sm py-1.5 px-3"
          >
            <ExternalLink size={13} />
            LinkedIn
          </a>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#0077b5]/5 border border-[#0077b5]/15">
        <Briefcase size={13} className="text-[#0077b5] shrink-0 mt-0.5" />
        <p className="text-[#0077b5] text-xs">
          Paste into LinkedIn profile → <strong>Add profile section → Projects</strong>
        </p>
      </div>

      {/* Title */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-primary" />
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Project Name</p>
          </div>
          <button onClick={() => copyText(c.title, 'title')} className="p-1 rounded text-text-muted hover:text-text transition-colors">
            {copied === 'title' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
        </div>
        <p className="text-text font-bold text-lg">{c.title}</p>
      </div>

      {/* Description */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin size={13} className="text-[#0077b5]" />
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Project Description</p>
          </div>
          <button onClick={() => copyText(c.description, 'desc')} className="p-1 rounded text-text-muted hover:text-text transition-colors">
            {copied === 'desc' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
        </div>
        <p className="text-text text-sm leading-relaxed whitespace-pre-line">{c.description}</p>
      </div>

      {/* Tech Stack */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={13} className="text-accent" />
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Skills / Tech Stack</p>
          </div>
          <button onClick={() => copyText(c.technologies.join(', '), 'tech')} className="p-1 rounded text-text-muted hover:text-text transition-colors">
            {copied === 'tech' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.technologies.map((tech) => (
            <span key={tech} className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Interview Q&A */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowQuestions((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-card/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={13} className="text-warning" />
            <p className="text-text text-sm font-semibold">Interview Prep</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
              {c.interviewQuestions.length} Q&A
            </span>
          </div>
          {showQuestions ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </button>

        <AnimatePresence>
          {showQuestions && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border divide-y divide-border">
                {c.interviewQuestions.map((qa, i) => {
                  const isExpanded = savedId
                    ? savedExpandedQ?.postId === savedId && savedExpandedQ.qi === i
                    : expandedQ === i
                  const toggleExpand = () => {
                    if (savedId) {
                      setSavedExpandedQ(isExpanded ? null : { postId: savedId, qi: i })
                    } else {
                      setExpandedQ(isExpanded ? null : i)
                    }
                  }
                  return (
                    <div key={i} className="group">
                      <button
                        onClick={toggleExpand}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-card/30 transition-colors text-left"
                      >
                        <span className="w-5 h-5 rounded-full bg-warning/10 text-warning text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-text text-sm flex-1 leading-relaxed font-medium">{qa.question}</p>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyQA(qa, i) }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-text transition-all"
                          >
                            {copied === `qa${i}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                          </button>
                          {isExpanded ? <ChevronUp size={13} className="text-text-muted" /> : <ChevronDown size={13} className="text-text-muted" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pl-12">
                              <div className="bg-card/60 border border-border rounded-lg p-3">
                                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Model Answer</p>
                                <p className="text-text-muted text-sm leading-relaxed">{qa.answer}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0077b5]/10 border border-[#0077b5]/20 flex items-center justify-center">
            <Linkedin size={20} className="text-[#0077b5]" />
          </div>
          <div>
            <h2 className="text-text font-bold">LinkedIn Project Section</h2>
            <p className="text-text-muted text-xs">AI reads your code and generates a LinkedIn Projects entry + interview prep</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'generate' ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <Sparkles size={11} />
              Generate
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'saved' ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <History size={11} />
              Saved
              {savedPosts.length > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded-full bg-primary/20 text-primary font-bold">{savedPosts.length}</span>
              )}
            </button>
          </div>

          {activeTab === 'generate' && (
            <button onClick={handleGenerate} disabled={loading} className="btn-primary py-2 px-4 disabled:opacity-50">
              {loading ? (
                <><Loader2 size={15} className="animate-spin" />Analyzing code…</>
              ) : (
                <><Sparkles size={15} />{content ? 'Regenerate' : 'Generate'}</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── GENERATE TAB ── */}
      {activeTab === 'generate' && (
        <>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/20"
            >
              <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-danger text-sm font-medium">{error}</p>
                {error.includes('API key') && (
                  <p className="text-danger/70 text-xs mt-1">
                    Go to <strong>AI Manager</strong> in the sidebar to configure your LLM provider.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {!loading && !content && !error && (
            <div className="text-center py-14 text-text-muted border border-dashed border-border rounded-xl">
              <Bot size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No content generated yet</p>
              <p className="text-xs mt-1 opacity-60 max-w-sm mx-auto">
                Click Generate — AI will scan your project's code and craft a LinkedIn Projects entry with interview Q&A.
              </p>
            </div>
          )}

          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-7 bg-surface rounded-lg w-3/4" />
              <div className="space-y-2">
                <div className="h-4 bg-surface rounded w-full" />
                <div className="h-4 bg-surface rounded w-5/6" />
                <div className="h-4 bg-surface rounded w-4/5" />
              </div>
              <div className="flex gap-2">
                {[1,2,3,4].map(i => <div key={i} className="h-6 w-20 bg-surface rounded-full" />)}
              </div>
            </div>
          )}

          <AnimatePresence>
            {content && !loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ContentCard c={content} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── SAVED TAB ── */}
      {activeTab === 'saved' && (
        <>
          {savedPosts.length === 0 ? (
            <div className="text-center py-14 text-text-muted border border-dashed border-border rounded-xl">
              <History size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No saved posts yet</p>
              <p className="text-xs mt-1 opacity-60">Generate content and click Save to keep a copy here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedPosts.map((post) => (
                <div key={post.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-card/30 transition-colors"
                    onClick={() => setExpandedSaved(expandedSaved === post.id ? null : post.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-text font-semibold text-sm truncate">{post.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} className="text-text-muted" />
                        <p className="text-text-muted text-[11px]">
                          {format(parseISO(post.generatedAt), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteLinkedInPost(post.id) }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                      {expandedSaved === post.id ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedSaved === post.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border p-4">
                          <ContentCard c={post} savedId={post.id} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
