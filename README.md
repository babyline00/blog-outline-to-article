# AI Blog Outline to Article Generator

Outline-first article writer. Type your outline, the agent researches each
section via `zai.functions.invoke('web_search', ...)` + `page_reader`, drafts
with inline `[^c1]` citations, lets you regenerate any section, and exports to
Markdown or MDX (Hashnode front-matter).

This is Project #51 in the 110-project portfolio — rebuilt fresh after a
sandbox recycle.

---

## Features

- **Outline editor** — vertical list of section headings. Add / remove /
  reorder (up/down arrows) / rename sections. The first heading is the article
  title. Each section has an optional one-line "angle" note (`Heading | angle`).
- **Per-section research** — for each section, the agent calls
  `zai.functions.invoke('web_search', { query, num: 5 })` to fetch 5 web
  results, and optionally `zai.functions.invoke('page_reader', { url })` on the
  top 1-2 URLs to enrich the snippet. Results persist to the `Research` table.
- **Per-section drafting with citations** — the LLM is prompted with the
  outline + the section's research results and is told to draft the section
  with inline `[^c1]`, `[^c2]` markers (markdown footnote references). Citations
  are persisted to `SectionVersion.citations` as a JSON array of
  `{ researchId, title, url, snippet, publishedTime? }`.
- **Section-level regenerate** — "Regenerate" re-drafts using existing
  research; "Re-research + draft" re-runs `web_search` then re-drafts. Each
  draft is a new `SectionVersion` (kept as history); `Section.currentDraftId`
  points at the latest.
- **Export to Markdown** — `compileToMarkdown(article, sections, drafts)`
  returns a single Markdown string with `# Title`, `## Heading` per section,
  inline `[^cN]` markers **renumbered globally**, and a footnotes block at the
  end.
- **Export to MDX (Hashnode front-matter)** — `compileToMdx` prepends
  `---\ntitle: ...\npublishedAt: ...\ntags: [...]\n---\n` front-matter.
- **3-column layout** — left: article list (filter by status), center:
  outline editor + drafts + export, right: per-section research panel.

---

## Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons
- **Database**: Prisma 6 + SQLite (local file at `db/custom.db`)
- **AI**: `z-ai-web-dev-sdk` (web_search + page_reader + chat completions)
- **Tests**: `bun test` + `bun:test` (35+ unit tests across 7 files)
- **Linting**: ESLint + `eslint-config-next`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         /  (single-page app)                              │
│  ┌─────────────┐  ┌──────────────────────────┐  ┌────────────────────┐   │
│  │ Article     │  │ Outline editor            │  │ Research panel     │   │
│  │ list        │  │  - title/topic/tone/tags  │  │  - 5 web results   │   │
│  │  - filter   │  │  - sections w/ angle      │  │  - per result:     │   │
│  │  - status   │  │  - up/down/remove        │  │    title · url ·   │   │
│  │  - new      │  │  - per-section draft     │  │    snippet · date  │   │
│  │  - delete   │  │  - Research / Draft /     │  │  - Re-research     │   │
│  │             │  │    Regenerate buttons    │  │    button          │   │
│  │             │  │  - Generate all          │  │                    │   │
│  │             │  │  - Export (md / mdx)     │  │                    │   │
│  └─────────────┘  └──────────────────────────┘  └────────────────────┘   │
└────────┬───────────────────┬─────────────────────────┬──────────────────┘
         │                   │                         │
         ▼                   ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Next.js API routes (App Router)                       │
│  POST/GET /api/articles              PATCH/DELETE /api/sections/[id]       │
│  GET/PATCH/DELETE /api/articles/[id] POST       /api/sections/[id]/research│
│  POST /api/articles/[id]/sections    POST       /api/sections/[id]/draft  │
│  POST /api/articles/[id]/export       GET        /api/stats                │
└────────┬─────────────────────────────┬────────────────────────────────────┘
         │                             │
         ▼                             ▼
┌──────────────────┐         ┌──────────────────────────────────────────┐
│ Prisma 6 + SQLite │         │ z-ai-web-dev-sdk (server-only)            │
│  Article          │         │  - zai.functions.invoke('web_search', …) │
│   Section         │         │  - zai.functions.invoke('page_reader', …)│
│    SectionVersion │         │  - zai.chat.completions.create(...)        │
│    Research       │         │                                            │
└──────────────────┘         └──────────────────────────────────────────┘
```

### Pure functions (the differentiator)

- `src/lib/outline-parser.ts` — `parseOutline(text) → { title, sections }`
- `src/lib/research.ts` — `buildSearchQuery({ heading, angle, articleTopic }) → string`
- `src/lib/ai.ts` — `buildSectionDraftPrompt({ heading, angle, articleTitle, articleTopic, tone, research }) → { systemPrompt, userPrompt }`
- `src/lib/citation-extractor.ts` — `extractCitationMarkers(text) → [{ marker, ordinal }]`
- `src/lib/export.ts` — `compileToMarkdown(input) → string`, `compileToMdx(input) → string`
- `src/lib/tone-presets.ts` — 4 presets: informative, casual, technical, thought-leadership

---

## Setup

```bash
# 1. install deps (bun preferred)
bun install

# 2. create the SQLite db + tables (uses inline DATABASE_URL)
bun run db:push

# 3. (optional) regenerate the Prisma client
bun run db:generate

# 4. run the dev server (port 3000)
bun run dev
```

Open the Preview Panel to view the app (the sandbox is not addressable via
`http://localhost:3000` directly).

### Tests

```bash
bun test
```

35+ tests across 7 files:

| File                          | Tests |
| ----------------------------- | ----- |
| `tokenizer.test.ts`           | 9     |
| `outline-parser.test.ts`      | 17    |
| `citation-extractor.test.ts`  | 11    |
| `tone-presets.test.ts`        | 14    |
| `export.test.ts`              | 16    |
| `ai.test.ts`                  | 18    |
| `research.test.ts`            | 13    |

When `PKC_DISABLE_LLM=1` (or no `z-ai-web-dev-sdk` config), the AI/research
providers fall back to deterministic mocks so the tests run fully offline.

---

## Environment variables

```bash
# Required — Prisma SQLite database (absolute path recommended for sub-projects)
DATABASE_URL=file:/home/z/my-project/apps/51-blog-outline-to-article/db/custom.db

# Optional — disable live LLM/research calls (use mock providers)
# PKC_DISABLE_LLM=1

# Optional — ZAI web-dev-sdk config (read by the SDK at runtime)
# ZAI_API_KEY=...
```

`.env.example` ships a copy. The `db:push` and `db:generate` scripts inline
`DATABASE_URL="$(pwd)/db/custom.db"` so they work regardless of the `.env` file.

---

## Project structure

```
51-blog-outline-to-article/
├── prisma/schema.prisma              # Article / Section / SectionVersion / Research
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout + Toaster
│   │   ├── page.tsx                  # 3-column client page (only route)
│   │   ├── globals.css               # Tailwind 4 + shadcn theme tokens
│   │   └── api/
│   │       ├── articles/route.ts                     # GET / POST
│   │       ├── articles/[id]/route.ts                # GET / PATCH / DELETE
│   │       ├── articles/[id]/sections/route.ts       # POST (add section)
│   │       ├── articles/[id]/export/route.ts         # POST (md / mdx)
│   │       ├── sections/[id]/route.ts                # PATCH / DELETE
│   │       ├── sections/[id]/research/route.ts        # POST (web_search)
│   │       ├── sections/[id]/draft/route.ts          # POST (LLM draft)
│   │       └── stats/route.ts                        # GET counts
│   ├── components/ui/                # shadcn/ui subset (16 files)
│   ├── hooks/use-toast.ts           # shadcn toast hook
│   └── lib/
│       ├── db.ts                     # Prisma client singleton
│       ├── utils.ts                  # cn()
│       ├── tokenizer.ts              # keyword extraction for queries
│       ├── outline-parser.ts         # parseOutline / renderOutline
│       ├── citation-extractor.ts     # extract [^cN] markers
│       ├── tone-presets.ts           # 4 tone presets
│       ├── research.ts               # web_search + page_reader wrapper
│       ├── ai.ts                     # buildSectionDraftPrompt + DraftProvider
│       ├── export.ts                 # compileToMarkdown / compileToMdx
│       └── __tests__/                # 7 test files
├── package.json                     # bun scripts (dev / build / lint / test / db:*)
├── tsconfig.json                    # @/* → ./src/*
├── next.config.ts                   # output: standalone, ignoreBuildErrors
├── tailwind.config.ts               # Tailwind 4 + animate plugin
├── postcss.config.mjs               # @tailwindcss/postcss
├── components.json                  # shadcn config (new-york)
├── eslint.config.mjs                # next core-web-vitals + typescript
├── .env / .env.example              # DATABASE_URL (absolute path)
├── .gitignore                       # node_modules / .next / db / logs
├── LICENSE                          # MIT
└── README.md
```

---

## Case study: per-section research + citation tracking

The heart of this project is the **outline-first** workflow: rather than
asking the LLM to draft an entire article in one shot, we decompose the work
into per-section research + per-section draft steps. This buys us three
things:

1. **Citation provenance.** Each section's draft cites only that section's
   research, so the citation-to-claim mapping is local and unambiguous
   (`[^c1]` = the 1st web result for THIS section). The draft route persists
   the cited research metadata (`{ researchId, title, url, snippet,
   publishedTime? }`) into `SectionVersion.citations` as JSON, so the export
   step can re-hydrate footnotes even if the underlying `Research` rows are
   later regenerated or deleted.

2. **Localized regeneration.** When a section feels off, "Regenerate"
   re-runs only THAT section's draft (fast, cheap, targeted). The old draft
   is preserved as a `SectionVersion` (history), and `Section.currentDraftId`
   is repointed. "Re-research + draft" additionally refreshes the web_search
   results first — useful when the section's angle changed and the old
   research no longer matches.

3. **Globally-renumbered footnotes on export.** Each section uses local
   `[^c1]`, `[^c2]` markers referring to its own research. If we kept those
   numbers, footnotes from different sections would collide in the exported
   article. So `compileToMarkdown` walks sections in order, assigns each
   unique cited `researchId` the next global ordinal (1, 2, 3, ...), and
   rewrites the inline markers accordingly. The output is a single
   self-contained Markdown/MDX document with one footnotes block.

The whole citation pipeline is exercised end-to-end by the offline
`MockProvider` in `bun test`, which produces drafts with real `[^cN]` markers
that flow through extraction → JSON persistence → global renumbering →
footnote rendering.

### What I'd do differently

- **SEO score per section.** Right now, "drafted" is a binary status. A
  per-section SEO score (keyword coverage vs. the article topic, heading
  length, internal-link density) would let the writer triage which sections
  to regenerate first. Could be a pure function on `(section, draft,
  articleTopic) → { score, suggestions[] }`.
- **Multi-author tone learning.** The 4 tone presets are hand-written. A
  real product would let an author paste 2-3 of their existing posts; we'd
  derive a tone profile (avg sentence length, vocabulary tier, emoji policy)
  and use it as a custom `TonePreset`. The `tone-presets.ts` interface
  already supports this — only the preset list is hard-coded.
- **Auto-publish to Hashnode.** The MDX export already includes Hashnode
  front-matter. A next step is wiring the Hashnode GraphQL API so "Export
  to MDX" becomes "Publish to Hashnode". Would need an OAuth flow + a
  `publicationId` per article.
- **Streaming drafts.** Section drafts today are non-streaming (the SDK
  call is `stream: false`). For longer sections, a streaming draft would
  let the writer watch the section form in real time. The parent project
  (`apps/11-personal-notes-rag`) shows the streaming pattern.
- **Outline import from URL.** "Paste a URL → the agent extracts an
  outline via `page_reader` + LLM" would cut the cold-start time. The
  `page_reader` wrapper is already there.

### Resume bullet

> Built an outline-first AI article generator (Next.js 16 / TypeScript /
> Prisma / `z-ai-web-dev-sdk`) that decomposes long-form drafting into
> per-section research + draft steps with `[^c1]`-style inline citations,
> versioned drafts, and a global-renumbering Markdown/MDX exporter; 35+
> unit tests cover the pure outline-parser, citation-extractor,
> tone-preset, export, and prompt-builder functions end-to-end with offline
> mock providers.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Push to GitHub

```bash
# from the project root:
gh repo create blog-outline-to-article --public --source=. --remote=origin --push
```
