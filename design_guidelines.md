# Design Guidelines: Executive Leadership Dashboard

## Design Approach

**Selected Approach**: Custom Premium Dashboard Design
**References**: Bloomberg Terminal (data density), Salesforce Einstein Analytics (executive polish), Linear (modern restraint)

**Justification**: Executive-level dashboard requiring sophisticated visual treatment that conveys authority while maintaining data clarity. Custom design combining glassmorphism, premium dark aesthetics, and enterprise-grade information architecture.

**Key Principles**:
- Premium visual language with subtle depth
- Data-first hierarchy with executive-level polish
- Trust signals through sophisticated design details
- Performance metrics immediately scannable

---

## Color Palette

**Foundation**:
- Background: Dark navy (#0A1628, #0F1F3D for layers)
- Surface: Navy-800 (#1A2845) with 40% opacity glassmorphism
- Borders: Teal/cyan (#14B8A6) at 20% opacity

**Accents**:
- Primary: Teal-500 (#14B8A6) for CTAs, active states
- Secondary: Cyan-400 (#22D3EE) for highlights
- Success: Emerald-500 (#10B981)
- Warning: Amber-500 (#F59E0B)
- Critical: Rose-500 (#F43F5E)

**Text**:
- Primary: White (#FFFFFF) at 95% opacity
- Secondary: Slate-300 (#CBD5E1) at 80% opacity
- Tertiary: Slate-400 at 60% opacity

---

## Typography

**Font Family**: Inter (premium weight range: 400, 500, 600, 700)

**Hierarchy**:
- Dashboard Title: text-4xl font-bold tracking-tight
- Section Headers: text-2xl font-semibold
- Card Titles: text-lg font-semibold
- Metrics (large numbers): text-5xl font-bold tabular-nums
- Body: text-sm font-medium
- Labels: text-xs font-medium uppercase tracking-wider text-slate-400

---

## Layout System

**Spacing Primitives**: Tailwind units of 3, 4, 6, 8, 12

**Grid Structure**:
- Dashboard wrapper: p-6 md:p-8 lg:p-12
- Card spacing: gap-6 md:gap-8
- Internal padding: p-6 for cards, p-4 for nested elements
- Section gaps: space-y-8

**Container Strategy**:
- Full-width dashboard: No max-width constraint
- Sidebar navigation: w-64 fixed
- Main content: ml-64 with fluid width
- Metric grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-4

---

## Component Library

### Glassmorphism Cards

**Base Card**:
- Background: bg-navy-800/40 backdrop-blur-xl
- Border: border border-teal-500/20
- Shadow: shadow-2xl with colored glow (teal at 10% opacity)
- Rounded: rounded-xl
- Padding: p-6

**Metric Cards**:
- Grid layout with large number (text-5xl), label below
- Trend indicator: Small arrow icon + percentage in green/red
- Subtle gradient overlay from top (teal/cyan at 5%)
- Border-left accent: border-l-4 border-teal-500

### Data Visualization

**Status Grid**:
- Dark cells with border-slate-700/30
- Submitted: bg-emerald-500/20 border-emerald-500/40
- Pending: bg-amber-500/20 border-amber-500/40
- Missing: bg-rose-500/20 border-rose-500/40
- Hover: Subtle glow effect with border brightening

**Tables**:
- Header: bg-slate-800/50 backdrop-blur text-xs uppercase tracking-wider
- Rows: border-b border-slate-700/30
- Hover: bg-teal-500/5
- Cell padding: px-6 py-4
- Zebra striping: Subtle bg-slate-800/20 on alternating rows

### Navigation

**Sidebar**:
- Fixed left, dark navy-900 background
- Active item: bg-teal-500/10 border-l-4 border-teal-500
- Icons: Lucide React, 20px, teal-400 when active
- Hover: bg-slate-800/40 transition

**Top Bar**:
- Glassmorphic: backdrop-blur-lg bg-navy-800/60
- Sticky positioning
- User avatar right-aligned with dropdown

### Interactive Elements

**Buttons**:
- Primary: bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-teal-500/30
- Secondary: bg-slate-700/50 backdrop-blur border border-slate-600/50 px-6 py-3 rounded-lg
- Icon-only: p-2 rounded-lg hover:bg-slate-700/50 transition

**Inputs**:
- bg-slate-800/50 backdrop-blur border border-slate-600/50 rounded-lg px-4 py-3
- Focus: ring-2 ring-teal-500/50 border-teal-500
- Placeholder: text-slate-500

**Badges**:
- Small: px-3 py-1 rounded-full text-xs font-semibold
- Colors match status (emerald, amber, rose with 20% bg, 80% text opacity)

### Project Overview Cards

**Premium Card Structure**:
- Glassmorphic base with subtle gradient
- Top: Project name (text-xl font-bold) + customer logo/name
- Middle: Key metrics in 3-column grid
- Bottom: Team avatars (overlapping circles) + status badge
- Hover: Lift effect (translate-y-1 shadow-2xl transition)

**Report Summary Cards**:
- Collapsible sections with smooth height transitions
- Section dividers: border-t border-slate-700/30
- Date range in teal accent badge at top-right
- Three columns: Progress (emerald), Challenges (amber), Next Week (cyan)

---

## Animations

**Minimal Motion**:
- Card hover: transform transition-transform duration-200
- Button hover: Subtle scale (scale-105) or brightness shift
- Data updates: Subtle fade-in (opacity transition)
- Page transitions: None (maintain performance)
- Status changes: Brief pulse effect on affected cells

**Glassmorphism Transitions**:
- Backdrop-blur smoothly on card hover: backdrop-blur-xl to backdrop-blur-2xl

---

## Icons

**Library**: Lucide React via CDN
**Common Icons**: BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Users, Calendar, FileText, Settings, ChevronDown
**Sizing**: 20px standard, 24px for section headers, 16px for inline
**Colors**: Teal-400 for primary actions, slate-400 for secondary

---

## Key Executive Dashboard Features

**Dashboard Header**:
- Welcome message with user name (text-3xl font-bold)
- Global health indicator: Large circular progress ring (teal/emerald)
- Quick stats bar: 4 metric cards in horizontal scroll/grid

**Critical Metrics Section**:
- 2×2 or 1×4 grid of glassmorphic metric cards
- Each shows: Large number, trend arrow, comparison label, mini sparkline

**Project Health Grid**:
- Sortable table with project rows
- Columns: Name, Customer, Status, Team Size, Last Update, Action
- Color-coded status dots with hover tooltips

**Weekly Compliance Matrix**:
- Heat map style grid: weeks × project leads
- Green (submitted), amber (pending), red (missing), gray (future)
- Click cell to view report details in modal

**Team Performance Panel**:
- List of project leads with submission rates
- Progress bars in teal gradient
- Avatar + name + percentage

---

## Premium Details

- Subtle noise texture overlay on dark backgrounds (3% opacity)
- Consistent 8px border-radius for all interactive elements
- Box-shadow layering for depth perception
- Typography uses tabular-nums for all metrics
- Consistent 200ms transitions across all hover states