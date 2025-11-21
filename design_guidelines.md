# Design Guidelines: Weekly Leadership Report Tool

## Design Approach

**Selected System**: Material Design (data-rich applications)
**Justification**: Enterprise productivity tool requiring clear information hierarchy, robust form patterns, and efficient data displays. Material Design provides excellent components for tables, cards, and status indicators while maintaining professional credibility.

**Key Principles**:
- Data clarity over decoration
- Efficient workflows with minimal friction
- Professional, trustworthy appearance
- Scannable information architecture

---

## Typography

**Font Family**: Inter (via Google Fonts CDN)
- Excellent readability for data-heavy interfaces
- Professional appearance for enterprise context

**Hierarchy**:
- Page Titles: text-3xl, font-bold (Team Management, Submit Report)
- Section Headers: text-2xl, font-bold (Team Members, Project Leads)
- Card Titles: text-xl, font-semibold
- Body Text: text-base, font-normal
- Labels/Meta: text-sm, font-medium
- Status Indicators: text-sm, font-semibold

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8
- Component padding: p-6, p-8
- Section spacing: space-y-6, space-y-8
- Element gaps: gap-4, gap-6
- Inline spacing: space-x-2, space-x-4

**Container Strategy**:
- Max width: max-w-7xl mx-auto (main container)
- Content cards: Full width within container
- Forms: max-w-4xl for optimal readability

**Grid Patterns**:
- Statistics cards: grid-cols-1 md:grid-cols-3 lg:grid-cols-4
- Project cards: grid-cols-1 md:grid-cols-2 gap-6
- Forms: Single column with logical grouping

---

## Component Library

### Navigation
**Tab System**:
- Horizontal tabs with icons (Lucide React icons)
- Active state: White background with colored top border
- Inactive state: Subtle gray background
- Responsive: Stack vertically on mobile (flex-col sm:flex-row)

### Data Display

**Tables**:
- Full-width responsive tables with alternating row backgrounds
- Header: bg-gray-50, font-semibold, sticky positioning for long lists
- Cell padding: px-4 py-3
- Borders: border-b for row separation
- Mobile: Stack table cells vertically or use horizontal scroll

**Cards**:
- White background with shadow (shadow-md)
- Rounded corners: rounded-lg
- Padding: p-6
- Hover state: subtle shadow increase (hover:shadow-lg)

**Status Badges**:
- Small rounded badges (rounded-full px-3 py-1)
- Use semantic states: green (submitted), yellow (pending), red (overdue)
- Font: text-sm font-medium

**Statistics Cards**:
- Prominent numbers: text-3xl font-bold
- Label below: text-sm text-gray-600
- Icon in top corner
- Background: subtle gradient or solid white

### Forms

**Input Fields**:
- Full width within form context
- Border: border border-gray-300 rounded
- Padding: px-4 py-2
- Focus state: ring-2 ring-blue-500
- Labels: text-sm font-medium mb-2 block

**Buttons**:
- Primary: bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700
- Secondary: bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300
- Danger: bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700
- Icon buttons: p-2 rounded hover:bg-gray-100

**Select Dropdowns**:
- Match input field styling
- Multi-select: Checkbox list with search filter
- Use native select enhanced with clear visual hierarchy

**Date Pickers**:
- Native input type="date" with consistent border styling
- Consider date range pickers for report filtering

### Interactive Elements

**List Items** (Team Members, Project Leads):
- Background: bg-gray-50 on gray-100 page
- Padding: p-3 rounded
- Actions aligned right: Edit (blue), Delete (red) icons
- Edit mode: Inline input with Save/Cancel icons

**Action Buttons**:
- Icon-only: 18-20px icon size, p-2
- Icon + text: space-x-2 between icon and label
- Group related actions: flex space-x-2

**Notifications/Alerts**:
- Top of page, full width
- Success: bg-green-100 text-green-800
- Error: bg-red-100 text-red-800
- Padding: p-4 rounded-lg
- Auto-dismiss with subtle fade transition

### Dashboard Components

**Project Overview Cards**:
- Display: Project name (large), customer (subtitle), dates
- Team composition: Avatar stack or count badge
- Status indicator: Colored dot or badge
- Lead name: with small icon

**Weekly Report Summary**:
- Expandable/collapsible sections
- Date range prominent at top
- Three-section layout: Progress, Challenges, Next Week
- Edit button only for report owner

**Status Grid**:
- Week columns × Project Lead rows
- Cell states: Submitted (check icon), Missing (warning), Future (disabled)
- Color coding for quick scanning

---

## Images

**No hero images required** - This is a data-driven productivity application.

**Icon Library**: Lucide React (already in use)
- Users, FileText, Edit2, Trash2, Check, X, UserCheck
- Maintain consistent 18-20px sizing
- Use semantic colors (blue for edit, red for delete, green for confirm)

**Optional**: User avatars for team members/leads
- Small circular avatars: w-8 h-8 rounded-full
- Fallback to initials in colored circle

---

## Key Differentiators

- **Data density balanced with whitespace**: Don't overcrowd but show meaningful information
- **Actionable interface**: Every view should have clear next actions
- **Status-first design**: Make report compliance immediately visible
- **Responsive data tables**: Graceful degradation on mobile devices
- **Consistent interaction patterns**: Edit/delete always in same position, same visual treatment