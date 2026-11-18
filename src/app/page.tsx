'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'

import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ArticleSummary {
  id: string
  title: string
  topic: string | null
  tone: string
  tags: string
  status: string
  createdAt: string
  updatedAt: string
  _count: { sections: number }
}

interface Research {
  id: string
  query: string
  title: string
  url: string
  snippet: string
  publishedTime: string | null
  favicon: string | null
  createdAt: string
}

interface SectionVersion {
  id: string
  content: string
  citations: string
  createdAt: string
}

interface Section {
  id: string
  articleId: string
  ordinal: number
  heading: string
  angle: string | null
  currentDraftId: string | null
  currentDraft: SectionVersion | null
  research: Research[]
  _count: { versions: number }
}

interface ArticleFull {
  id: string
  title: string
  topic: string | null
  tone: string
  tags: string
  status: string
  createdAt: string
  updatedAt: string
  sections: Section[]
}

interface Stats {
  articles: number
  sections: number
  drafts: number
  research: number
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string })?.error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function parseCiteCount(citations: string): number {
  try {
    const arr = JSON.parse(citations || '[]')
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Page() {
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [article, setArticle] = useState<ArticleFull | null>(null)
  const [articleLoading, setArticleLoading] = useState(false)

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [stats, setStats] = useState<Stats>({ articles: 0, sections: 0, drafts: 0, research: 0 })

  // New article dialog
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [newTone, setNewTone] = useState('informative')
  const [newTags, setNewTags] = useState('')
  const [newOutline, setNewOutline] = useState('')

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'markdown' | 'mdx'>('markdown')
  const [exportContent, setExportContent] = useState('')
  const [exportLoading, setExportLoading] = useState(false)

  const [generatingAll, setGeneratingAll] = useState(false)
  const [generateProgress, setGenerateProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  // ---- data loaders ----
  const loadArticles = useCallback(async () => {
    setArticlesLoading(true)
    try {
      const data = await api<{ articles: ArticleSummary[] }>(`/api/articles?status=${statusFilter}`)
      setArticles(data.articles)
    } catch (e) {
      toast({ title: 'Failed to load articles', description: (e as Error).message })
    } finally {
      setArticlesLoading(false)
    }
  }, [statusFilter])

  const loadStats = useCallback(async () => {
    try {
      const s = await api<Stats>('/api/stats')
      setStats(s)
    } catch {
      // silent
    }
  }, [])

  const loadArticle = useCallback(async (id: string) => {
    setArticleLoading(true)
    try {
      const data = await api<{ article: ArticleFull }>(`/api/articles/${id}`)
      setArticle(data.article)
      // Auto-select first section if none selected
      if (data.article.sections.length > 0) {
        setSelectedSectionId((prev) => prev && data.article.sections.some((s) => s.id === prev) ? prev : data.article.sections[0].id)
      } else {
        setSelectedSectionId(null)
      }
    } catch (e) {
      toast({ title: 'Failed to load article', description: (e as Error).message })
      setArticle(null)
    } finally {
      setArticleLoading(false)
    }
  }, [])

  useEffect(() => {
    loadArticles()
    loadStats()
  }, [loadArticles, loadStats])

  useEffect(() => {
    if (selectedId) loadArticle(selectedId)
    else setArticle(null)
  }, [selectedId, loadArticle])

  const selectedSection = useMemo(() => {
    if (!article || !selectedSectionId) return null
    return article.sections.find((s) => s.id === selectedSectionId) ?? null
  }, [article, selectedSectionId])

  // ---- mutations ----
  const refreshArticlesAndStats = useCallback(async () => {
    await Promise.all([loadArticles(), loadStats()])
  }, [loadArticles, loadStats])

  const refreshArticle = useCallback(async () => {
    if (selectedId) await loadArticle(selectedId)
    await loadStats()
  }, [loadArticle, loadStats, selectedId])

  const setBusyFor = useCallback((key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleCreateArticle = useCallback(async () => {
    try {
      const data = await api<{ article: ArticleFull }>(`/api/articles`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim() || undefined,
          outline: newOutline,
          topic: newTopic.trim() || undefined,
          tone: newTone,
          tags: newTags,
        }),
      })
      toast({ title: 'Article created', description: data.article.title })
      setNewOpen(false)
      setNewTitle('')
      setNewTopic('')
      setNewTone('informative')
      setNewTags('')
      setNewOutline('')
      await refreshArticlesAndStats()
      setSelectedId(data.article.id)
    } catch (e) {
      toast({ title: 'Failed to create article', description: (e as Error).message })
    }
  }, [newTitle, newOutline, newTopic, newTone, newTags, refreshArticlesAndStats])

  const handleDeleteArticle = useCallback(async (id: string) => {
    if (!confirm('Delete this article and all its sections/drafts/research?')) return
    try {
      await api(`/api/articles/${id}`, { method: 'DELETE' })
      toast({ title: 'Article deleted' })
      if (selectedId === id) {
        setSelectedId(null)
        setArticle(null)
      }
      await refreshArticlesAndStats()
    } catch (e) {
      toast({ title: 'Failed to delete', description: (e as Error).message })
    }
  }, [selectedId, refreshArticlesAndStats])

  const handleUpdateArticle = useCallback(async (patch: Partial<Pick<ArticleFull, 'title' | 'topic' | 'tone' | 'tags' | 'status'>>) => {
    if (!selectedId) return
    try {
      await api(`/api/articles/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      await refreshArticle()
    } catch (e) {
      toast({ title: 'Failed to update article', description: (e as Error).message })
    }
  }, [selectedId, refreshArticle])

  const handleAddSection = useCallback(async () => {
    if (!selectedId) return
    try {
      const data = await api<{ section: Section }>(`/api/articles/${selectedId}/sections`, {
        method: 'POST',
        body: JSON.stringify({ heading: 'New section' }),
      })
      await refreshArticle()
      setSelectedSectionId(data.section.id)
      toast({ title: 'Section added' })
    } catch (e) {
      toast({ title: 'Failed to add section', description: (e as Error).message })
    }
  }, [selectedId, refreshArticle])

  const handleUpdateSection = useCallback(async (sectionId: string, patch: { heading?: string; angle?: string | null; ordinal?: number }) => {
    try {
      await api(`/api/sections/${sectionId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      await refreshArticle()
    } catch (e) {
      toast({ title: 'Failed to update section', description: (e as Error).message })
    }
  }, [refreshArticle])

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    if (!confirm('Delete this section and its drafts/research?')) return
    try {
      await api(`/api/sections/${sectionId}`, { method: 'DELETE' })
      if (selectedSectionId === sectionId) setSelectedSectionId(null)
      await refreshArticle()
      toast({ title: 'Section deleted' })
    } catch (e) {
      toast({ title: 'Failed to delete section', description: (e as Error).message })
    }
  }, [selectedSectionId, refreshArticle])

  const handleResearch = useCallback(async (sectionId: string, fetchPages = false) => {
    setBusyFor(`research-${sectionId}`, true)
    try {
      const data = await api<{ research: Research[]; query: string }>(`/api/sections/${sectionId}/research`, {
        method: 'POST',
        body: JSON.stringify({ num: 5, fetchPages }),
      })
      toast({ title: 'Research fetched', description: `5 results for "${data.query}"` })
      await refreshArticle()
    } catch (e) {
      toast({ title: 'Research failed', description: (e as Error).message })
    } finally {
      setBusyFor(`research-${sectionId}`, false)
    }
  }, [refreshArticle, setBusyFor])

  const handleDraft = useCallback(async (sectionId: string, regenerateResearch = false) => {
    if (regenerateResearch) {
      setBusyFor(`research-${sectionId}`, true)
      try {
        await api(`/api/sections/${sectionId}/research`, {
          method: 'POST',
          body: JSON.stringify({ num: 5 }),
        })
      } catch (e) {
        toast({ title: 'Research failed', description: (e as Error).message })
        setBusyFor(`research-${sectionId}`, false)
        return
      } finally {
        setBusyFor(`research-${sectionId}`, false)
      }
    }
    setBusyFor(`draft-${sectionId}`, true)
    try {
      await api(`/api/sections/${sectionId}/draft`, {
        method: 'POST',
        body: JSON.stringify({ useExistingResearch: !regenerateResearch }),
      })
      toast({ title: 'Draft generated' })
      await refreshArticle()
    } catch (e) {
      toast({ title: 'Draft failed', description: (e as Error).message })
    } finally {
      setBusyFor(`draft-${sectionId}`, false)
    }
  }, [refreshArticle, setBusyFor])

  const handleGenerateAll = useCallback(async () => {
    if (!article || article.sections.length === 0) return
    setGeneratingAll(true)
    setGenerateProgress({ done: 0, total: article.sections.length })
    for (let i = 0; i < article.sections.length; i++) {
      const s = article.sections[i]
      setBusyFor(`research-${s.id}`, true)
      try {
        await api(`/api/sections/${s.id}/research`, {
          method: 'POST',
          body: JSON.stringify({ num: 5 }),
        })
      } catch (e) {
        toast({ title: `Research failed for "${s.heading}"`, description: (e as Error).message })
      } finally {
        setBusyFor(`research-${s.id}`, false)
      }
      setBusyFor(`draft-${s.id}`, true)
      try {
        await api(`/api/sections/${s.id}/draft`, {
          method: 'POST',
          body: JSON.stringify({ useExistingResearch: true }),
        })
      } catch (e) {
        toast({ title: `Draft failed for "${s.heading}"`, description: (e as Error).message })
      } finally {
        setBusyFor(`draft-${s.id}`, false)
      }
      setGenerateProgress({ done: i + 1, total: article.sections.length })
    }
    setGeneratingAll(false)
    await refreshArticle()
    toast({ title: 'Generated all sections' })
  }, [article, refreshArticle, setBusyFor])

  const handleExport = useCallback(async (format: 'markdown' | 'mdx') => {
    if (!selectedId) return
    setExportFormat(format)
    setExportLoading(true)
    setExportOpen(true)
    try {
      const data = await api<{ format: string; content: string }>(`/api/articles/${selectedId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      })
      setExportContent(data.content)
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message })
      setExportContent('')
    } finally {
      setExportLoading(false)
    }
  }, [selectedId])

  const copyExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportContent)
      toast({ title: 'Copied to clipboard' })
    } catch {
      toast({ title: 'Copy failed', description: 'Select the text and copy manually.' })
    }
  }, [exportContent])

  // ---- render ----
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="size-5" />
            <h1 className="text-base font-semibold leading-none">
              AI Blog Outline to Article Generator
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground ml-2">
            <Badge variant="secondary">{stats.articles} articles</Badge>
            <Badge variant="secondary">{stats.sections} sections</Badge>
            <Badge variant="secondary">{stats.drafts} drafts</Badge>
            <Badge variant="secondary">{stats.research} research</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" />
              New article
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px] gap-4 p-4">
        {/* LEFT: Article list */}
        <aside className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'draft' | 'published')}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft only</SelectItem>
                <SelectItem value="published">Published only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 max-h-[calc(100vh-180px)] rounded-md border bg-card">
            <div className="p-2 space-y-1">
              {articlesLoading ? (
                <div className="p-2 space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : articles.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No articles yet. Click <span className="font-medium">New article</span> to start.
                </div>
              ) : (
                articles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`w-full text-left rounded-md border p-3 transition-colors ${
                      selectedId === a.id
                        ? 'border-primary bg-accent'
                        : 'border-transparent hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm leading-tight line-clamp-2">{a.title}</div>
                      <Badge variant={a.status === 'published' ? 'default' : 'secondary'} className="shrink-0">
                        {a.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{a._count.sections} sections</span>
                      <span>·</span>
                      <span>{a.tone}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{fmtDate(a.updatedAt)}</div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteArticle(a.id)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* CENTER: Outline editor + drafts + export */}
        <section className="flex flex-col gap-3 min-h-0">
          {!article && !articleLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>No article selected</CardTitle>
                <CardDescription>
                  Pick an article on the left or create a new one to start outlining.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : articleLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : article ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Article metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="art-title">Title</Label>
                      <Input
                        id="art-title"
                        defaultValue={article.title}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== article.title) {
                            handleUpdateArticle({ title: e.target.value })
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="art-topic">Topic (one line)</Label>
                      <Input
                        id="art-topic"
                        defaultValue={article.topic ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== (article.topic ?? '')) {
                            handleUpdateArticle({ topic: e.target.value })
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="art-tone">Tone</Label>
                      <Select
                        value={article.tone}
                        onValueChange={(v) => handleUpdateArticle({ tone: v })}
                      >
                        <SelectTrigger id="art-tone" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="informative">Informative</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="thought-leadership">Thought Leadership</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="art-tags">Tags (comma-separated)</Label>
                      <Input
                        id="art-tags"
                        defaultValue={article.tags}
                        onBlur={(e) => {
                          if (e.target.value !== article.tags) {
                            handleUpdateArticle({ tags: e.target.value })
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="art-status">Status</Label>
                      <Select
                        value={article.status}
                        onValueChange={(v) => handleUpdateArticle({ status: v })}
                      >
                        <SelectTrigger id="art-status" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 min-h-0">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Outline</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateAll}
                      disabled={generatingAll || article.sections.length === 0}
                    >
                      {generatingAll ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Generate all
                      {generatingAll && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {generateProgress.done}/{generateProgress.total}
                        </span>
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="default">
                          <Download className="size-4" />
                          Export
                          <ChevronDown className="size-3 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport('markdown')}>
                          <FileText className="size-4" /> Markdown (.md)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('mdx')}>
                          <FileCode className="size-4" /> MDX (Hashnode)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {article.sections.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-6">
                        No sections yet. Click <span className="font-medium">Add section</span> below.
                      </div>
                    ) : (
                      article.sections.map((s, i) => {
                        const isSel = selectedSectionId === s.id
                        const citeCount = s.currentDraft ? parseCiteCount(s.currentDraft.citations) : 0
                        return (
                          <div
                            key={s.id}
                            className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                              isSel ? 'border-primary bg-accent/50' : 'border-border hover:bg-accent/30'
                            }`}
                            onClick={() => setSelectedSectionId(s.id)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col gap-1 pt-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-6"
                                  disabled={i === 0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdateSection(s.id, { ordinal: i - 1 })
                                  }}
                                >
                                  <ArrowUp className="size-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-6"
                                  disabled={i === article.sections.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdateSection(s.id, { ordinal: i + 1 })
                                  }}
                                >
                                  <ArrowDown className="size-3" />
                                </Button>
                              </div>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={s.heading}
                                  placeholder="Section heading"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    setArticle((prev) => {
                                      if (!prev) return prev
                                      return {
                                        ...prev,
                                        sections: prev.sections.map((x) =>
                                          x.id === s.id ? { ...x, heading: e.target.value } : x,
                                        ),
                                      }
                                    })
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value.trim() && e.target.value !== s.heading) {
                                      handleUpdateSection(s.id, { heading: e.target.value })
                                    } else if (!e.target.value.trim()) {
                                      // restore on blur if empty
                                      setArticle((prev) => {
                                        if (!prev) return prev
                                        return {
                                          ...prev,
                                          sections: prev.sections.map((x) =>
                                            x.id === s.id ? { ...x, heading: s.heading } : x,
                                          ),
                                        }
                                      })
                                    }
                                  }}
                                />
                                <Input
                                  value={s.angle ?? ''}
                                  placeholder="Optional angle (one line)"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    setArticle((prev) => {
                                      if (!prev) return prev
                                      return {
                                        ...prev,
                                        sections: prev.sections.map((x) =>
                                          x.id === s.id ? { ...x, angle: e.target.value } : x,
                                        ),
                                      }
                                    })
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value !== (s.angle ?? '')) {
                                      handleUpdateSection(s.id, { angle: e.target.value || null })
                                    }
                                  }}
                                />
                                <div className="flex items-center gap-2 text-xs">
                                  <Badge variant="outline" className="text-[10px]">
                                    {s.research.length} research
                                  </Badge>
                                  {s.currentDraft ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      drafted · {citeCount} citations · v{s._count.versions}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">no draft</Badge>
                                  )}
                                </div>
                                {s.currentDraft && (
                                  <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {s.currentDraft.content.slice(0, 500)}
                                    {s.currentDraft.content.length > 500 ? '...' : ''}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleResearch(s.id, false)
                                    }}
                                    disabled={busy[`research-${s.id}`]}
                                  >
                                    {busy[`research-${s.id}`] ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Globe className="size-3.5" />
                                    )}
                                    Research
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDraft(s.id, false)
                                    }}
                                    disabled={busy[`draft-${s.id}`] || s.research.length === 0}
                                  >
                                    {busy[`draft-${s.id}`] ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="size-3.5" />
                                    )}
                                    {s.currentDraft ? 'Regenerate' : 'Draft'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDraft(s.id, true)
                                    }}
                                    disabled={busy[`draft-${s.id}`] || busy[`research-${s.id}`]}
                                    title="Re-research then re-draft"
                                  >
                                    <RefreshCw className="size-3.5" />
                                    Re-research + draft
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-auto"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSection(s.id)
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="pt-3">
                    <Button size="sm" variant="outline" onClick={handleAddSection} className="w-full">
                      <Plus className="size-4" />
                      Add section
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </section>

        {/* RIGHT: Research panel */}
        <aside className="flex flex-col gap-3 min-h-0">
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="size-4" />
                Research
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedSection
                  ? `For: ${selectedSection.heading}`
                  : 'Select a section to view its research.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-[calc(100vh-260px)] rounded-md">
                {!selectedSection ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Pick a section in the center column.
                  </div>
                ) : selectedSection.research.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6 space-y-3">
                    <div>No research yet for this section.</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResearch(selectedSection.id, false)}
                      disabled={busy[`research-${selectedSection.id}`]}
                    >
                      {busy[`research-${selectedSection.id}`] ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Globe className="size-3.5" />
                      )}
                      Research this section
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedSection.research.map((r, i) => (
                      <div key={r.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Badge variant="outline" className="text-[10px]">c{i + 1}</Badge>
                          <span>{domainOf(r.url)}</span>
                          {r.publishedTime && <span>· {fmtDate(r.publishedTime)}</span>}
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium leading-snug hover:underline inline-flex items-start gap-1"
                        >
                          {r.title}
                          <ExternalLink className="size-3 shrink-0 mt-0.5" />
                        </a>
                        {r.snippet && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-3">
                            {r.snippet}
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleResearch(selectedSection.id, false)}
                      disabled={busy[`research-${selectedSection.id}`]}
                    >
                      {busy[`research-${selectedSection.id}`] ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Re-research
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="border-t bg-card mt-auto">
        <div className="px-4 py-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Outline-first article writer.</span>
          <span>Research via <code className="font-mono">zai.functions.invoke(&apos;web_search&apos;)</code> + <code className="font-mono">page_reader</code>.</span>
          <span>Citations <code className="font-mono">[^c1]</code> tracked per-section, renumbered globally on export.</span>
        </div>
      </footer>

      {/* New Article Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New article</DialogTitle>
            <DialogDescription>
              Type the article title as the first line and one section heading per line below.
              Use <code className="font-mono">|</code> or <code className="font-mono">//</code> to add an optional angle note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="new-title">Title (optional — first outline line is used if blank)</Label>
                <Input
                  id="new-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Vector Databases 101"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-topic">Topic (optional)</Label>
                <Input
                  id="new-topic"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="A practical introduction to vector databases"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="new-tone">Tone</Label>
                <Select value={newTone} onValueChange={setNewTone}>
                  <SelectTrigger id="new-tone" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="informative">Informative</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="thought-leadership">Thought Leadership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-tags">Tags (comma-separated)</Label>
                <Input
                  id="new-tags"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="ai, vector-db, retrieval"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-outline">Outline</Label>
              <Textarea
                id="new-outline"
                value={newOutline}
                onChange={(e) => setNewOutline(e.target.value)}
                rows={10}
                placeholder={`Vector Databases 101\nIntroduction | why this matters now\nHNSW Trade-offs | memory vs recall\npgvector vs Pinecone // practical considerations\nConclusion`}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateArticle}>
              <Plus className="size-4" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Export {exportFormat === 'mdx' ? 'MDX (Hashnode)' : 'Markdown'}
            </DialogTitle>
            <DialogDescription>
              {exportLoading
                ? 'Compiling...'
                : 'Copy the compiled output below into your CMS or save as a file.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 max-h-[60vh] overflow-y-auto">
            {exportLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <pre className="text-xs whitespace-pre-wrap font-mono break-words">{exportContent}</pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Close
            </Button>
            <Button onClick={copyExport} disabled={exportLoading || !exportContent}>
              Copy to clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
