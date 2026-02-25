# Claud-ometer — Architecture & Development Guide

Local-first Claude Code analytics dashboard. Reads `~/.claude/` directly — no database, no cloud, no auth.

## Tech Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4** (`@tailwindcss/postcss`) — dark theme default (hardcoded `className="dark"` on `<html>`)
- **shadcn/ui** (New York style, neutral base) — components in `src/components/ui/`
- **Lucide React** for icons
- **SWR** for data fetching (simple `fetch` wrapper, no React Query)
- **Recharts 3** for charts (Area, Bar, Pie)
- **date-fns** for date formatting

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, dark theme, sidebar
│   ├── page.tsx                # Overview dashboard (stats, charts)
│   ├── globals.css             # CSS vars for light/dark themes
│   ├── sessions/page.tsx       # Session list with search (URL ?q= param)
│   ├── sessions/[id]/page.tsx  # Session detail with conversation replay
│   ├── projects/page.tsx       # Project grid
│   ├── projects/[id]/page.tsx  # Project detail + sessions
│   ├── costs/page.tsx          # Cost analytics
│   ├── data/page.tsx           # Export/import ZIP management
│   └── api/                    # All routes are force-dynamic (filesystem reads)
│       ├── stats/route.ts      # GET — DashboardStats
│       ├── projects/route.ts   # GET — ProjectInfo[]
│       ├── sessions/route.ts   # GET — SessionInfo[] (?q=, ?projectId=, ?limit=, ?offset=)
│       ├── sessions/[id]/      # GET — SessionDetail (404 if not found)
│       ├── data-source/        # GET/PUT — toggle live vs imported data
│       ├── export/route.ts     # GET — ZIP download
│       └── import/route.ts     # POST/DELETE — upload/clear imported data
├── components/
│   ├── layout/sidebar.tsx      # Fixed left nav (60px wide)
│   ├── cards/stat-card.tsx     # Reusable stat card
│   ├── charts/                 # Recharts wrappers (usage-over-time, model-breakdown, etc.)
│   └── ui/                     # shadcn components (card, badge, separator, tooltip, tabs, etc.)
├── lib/
│   ├── claude-data/
│   │   ├── types.ts            # All interfaces (SessionInfo, SessionDetail, DashboardStats, etc.)
│   │   ├── reader.ts           # JSONL parsing, stats aggregation, search
│   │   └── data-source.ts      # Live vs imported data toggle
│   ├── hooks.ts                # SWR hooks: useStats, useProjects, useSessions, useSessionDetail
│   ├── format.ts               # formatTokens, formatCost, formatDuration, timeAgo, formatNumber
│   └── utils.ts                # cn() — clsx + tailwind-merge
└── config/
    └── pricing.ts              # Model pricing table + calculateCost + getModelDisplayName/Color
```

## Data Flow

1. Claude Code writes JSONL files to `~/.claude/projects/<projectId>/<sessionId>.jsonl`
2. `reader.ts` parses these files (line-by-line streaming via `readline`)
3. API routes (`force-dynamic`) call reader functions and return JSON
4. Pages use SWR hooks to fetch from API routes (auto-caching, revalidation on focus)
5. All pages are `'use client'` components

## Key Types (src/lib/claude-data/types.ts)

- **SessionInfo** — id, projectId, projectName, timestamp, duration, messageCount, toolCallCount, tokens, estimatedCost, models[], gitBranch, toolsUsed, compaction
- **SessionDetail** extends SessionInfo + messages: SessionMessageDisplay[]
- **SessionMessageDisplay** — role, content, timestamp, model?, usage?, toolCalls?
- **ProjectInfo** — id, name, path, sessionCount, totalMessages, totalTokens, estimatedCost, models[]
- **DashboardStats** — totals, dailyActivity[], dailyModelTokens[], modelUsage, hourCounts, recentSessions[]
- **CompactionInfo** — compactions, microcompactions, totalTokensSaved, compactionTimestamps[]

## Conventions

### Defensive data access
Session data from JSONL can have missing fields at runtime even though types say otherwise. Always guard array/object properties:
```tsx
const models = session.models || [];
const compaction = session.compaction || { compactions: 0, microcompactions: 0, totalTokensSaved: 0, compactionTimestamps: [] };
```

### SWR fetcher throws on non-OK responses
The global fetcher in `hooks.ts` throws on non-2xx so SWR properly surfaces errors instead of setting malformed data.

### URL search params
Use `useSearchParams()` + `router.replace()` to persist filter/search state in the URL. Must wrap in `<Suspense>` for Next.js SSR compatibility.

### Card styling pattern
```tsx
<Card className="border-border/50 shadow-sm">
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-semibold">Title</CardTitle>
  </CardHeader>
  <CardContent className="pt-0">...</CardContent>
</Card>
```

### Stat card grid
Use `grid grid-cols-N gap-3` with `<Card>` children for stat rows.

### Text sizing
- Page titles: `text-xl font-bold tracking-tight`
- Card titles: `text-sm font-semibold`
- Labels: `text-xs text-muted-foreground`
- Tiny text: `text-[10px]` or `text-[9px]`
- Monospace IDs/branches: `font-mono`

### Colors
- Primary (Claude orange): CSS var `--primary`
- Amber for compaction warnings: `text-amber-600`, `border-amber-300/50`, `bg-amber-50/30`
- Green for savings: `text-green-600`

### Icons
Always use Lucide. Typical sizing: `h-3 w-3` (inline), `h-3.5 w-3.5` (card headers), `h-4 w-4` (buttons/nav).

## Commands

```bash
npm run dev       # Dev server (Turbopack)
npm run build     # Production build
npm start         # Production server
npm run lint      # ESLint
```
