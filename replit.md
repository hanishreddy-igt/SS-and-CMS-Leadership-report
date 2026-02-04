# SS & CMA Dashboard

## Overview
This project provides a comprehensive tracking system for Strategic Services (SS) and Community Managed Advisory (CMA) accounts. It offers a complete overview of project health, progress, and team contributions, aiming to enhance strategic decision-making and operational efficiency. The system is secured with Google authentication, restricted to specific corporate email domains.

## User Preferences
- Material Design approach for data-rich enterprise applications
- Color-coded status indicators for quick visual feedback
- Responsive design with mobile-friendly layouts
- Secure access: Authentication required with domain restriction (@ignitetech.com only)
- Jira integration for automatic project data population

## System Architecture

### UI/UX Decisions
- **Hub Navigation**: Landing page with 3 large clickable icons (Dashboard, Reports & Feedback, Work Management) replacing horizontal tab navigation.
- **Section-Based Layout**: Each section opens full-screen with its own sub-tabs. Back arrow returns to Hub, mini-nav bar allows quick section switching.
- **Routes Structure**:
  - `/` - Hub landing page with 3 icons
  - `/dashboard/:tab` - Dashboard section (contracts, team)
  - `/reports/:tab` - Reports section (submit, view, historical)
  - `/tasks/:tab` - Work Management section (workspace, assigned, templates)
  - Legacy routes (`/submit`, `/view`, `/historical`) redirect to new structure
- **Premium Executive Dashboard UI**: Features a dark navy color palette with layered depth, glassmorphism cards using `backdrop-blur` effects, and premium transparency.
- **Unified Theme Tokens**: Utilizes consistent health status colors (text-success, text-warning, text-destructive), spacing, and the Inter font family.
- **Component Redesign**: Homepage with gradient mesh header, premium metric cards, and glass styling across various dashboards and report forms.
- **User Experience**: Renamed "At Risk" to "Needs Attention", introduced visible and stylized scrollbars, standardized filter list heights, and consolidated filter/save actions into unified buttons and dropdowns.
- **Selection Mode**: Implemented a cleaner selection mode for bulk operations with visual indicators and specific action buttons.
- **Consolidated Tabs & Modals**: Reduced the number of main tabs and introduced modal-based forms for all add functionalities (Projects, Team Members, Project Leads) with inline validation.

### Technical Implementations
- **Core Technologies**: Built with React, Express, TypeScript, and PostgreSQL.
- **Database Schema (PostgreSQL with Drizzle ORM)**:
    - **Users**: Authentication data.
    - **Sessions**: Session storage.
    - **People**: Unified table for team members and project leads. Each person has a `roles` array that can contain `['team-member']`, `['project-lead']`, or both. Includes optional `hoursPerWeek` field (stored as decimal string, displayed as "X.X hours/week"). API endpoints automatically detect existing people by email to prevent duplicates.
    - **Projects**: Project details including customer, lead, team member assignments with roles, dates, and external links (jiraEpic, googleDriveLink, workflowyLink). Team members are stored as JSONB array: `[{memberId: string, role: string}]`.
    - **Weekly Reports**: Stores progress, health status, and team feedback.
    - **Saved Reports**: Archived weekly report snapshots with PDF/CSV data, AI summary, and health counts.
    - **Task Activity**: Audit trail for all task changes, enabling EOS updates and activity tracking. Each record captures:
      - `taskId`: Links to the task (one-to-many relationship)
      - `changedBy`: Email of who made the change
      - `changedAt`: Timestamp of the change
      - `changeType`: Type of change (created, status_change, note_added, assignee_added, assignee_removed, priority_change, due_date_change, title_edit)
      - `previousValue` / `newValue`: JSONB storing the before/after state
- **Unified Person Management**:
    - People can have multiple roles (team-member, project-lead) simultaneously
    - When adding a team member or project lead, the system checks if a person with that email already exists
    - If exists, the new role is added to the existing person instead of creating a duplicate
    - UI shows "Also Lead" / "Also Member" badges to indicate people with multiple roles
    - Delete operations remove only the specific role; person is only fully deleted when no roles remain
    - Admin-only `/api/people/merge-duplicates` endpoint available to consolidate existing duplicate entries
- **Key Features**:
    - **Dashboard Section**: Unified dashboard for project and team management, including project cards, team member/lead grids, and modal forms for adding new entities. Features project name filtering, lead/member filtering, and sorting by end date.
    - **Reports Section**: 
      - Submit Report: Consolidated view with metrics for submitted/pending reports, a weekly report submission form with health status, progress, challenges, next steps, and optional team member feedback. Draft report functionality allows saving partial reports.
      - View Current: Displays overall project health statistics (On Track, Needs Attention, Critical), offers comprehensive filtering by lead, member, and health status, provides export options (PDF/CSV), and includes archive functionality.
      - Historical: View and manage archived weekly reports with AI summaries.
    - **Work Management Section**: Workflowy-style task management system with three tabs:
      - **Working Space**: Primary task creation area with "Your Workspace" section (create and manage your own tasks) and "All Tasks" section (team-wide view grouped by project with collapsible groups).
      - **Tasks Assigned to You**: Filtered view showing tasks assigned to the current user, grouped by status (To Do, In Progress, Blocked, Done) with quick status updates.
      - **Recurring Deliverables (Task Templates)**: Recurring task templates with support for daily/weekly/biweekly/monthly/quarterly patterns. Features include:
        - **Sub-tasks**: Define hierarchical sub-tasks that are created as child tasks when deliverable is triggered
        - **Assignment Mode**: Choose between "One task" (all assignees on same task) or "Separate tasks" (individual task per assignee)
        - **Priority inheritance**: Sub-tasks can have their own priority (normal/medium/high) or inherit from parent
        - **Work Schedule**: Configure when work starts and is due:
          - **Daily Recurrence**: Select which days of the week tasks occur (Mon-Sun checkboxes)
          - **Weekly/Biweekly Recurrence**: Set start day and due day (e.g., work starts Monday, due Friday)
          - **Monthly/Quarterly Recurrence**: Set start date and due date of month (1-28, or 0 for last day)
          - **Start/Due Times**: Configure work start time and due time independently (e.g., start at 09:00, due by 17:00)
          - **Timezone**: Manual GMT offset entry (+5:30, -8, +0) for timezone-aware scheduling
          - **Next Scheduled Display**: Template cards show pre-calculated next start/due date-times stored in database
          - Tasks created from templates use the calculated due date/time based on schedule
        - **Simplified Trigger System (Pre-calculated Dates)**:
          - `nextTriggerAt`: ISO 8601 string with embedded timezone (e.g., "2026-02-05T09:00+05:30") - when to create tasks
          - `nextDueAt`: ISO 8601 string with embedded timezone - when created tasks are due
          - Fields are calculated and stored when: template created, template edited (schedule fields), template triggered
          - Scheduler uses simple comparison: `new Date(nextTriggerAt) <= now` to determine if trigger is due
          - After trigger, `calculateNextOccurrence()` recalculates for next period
          - Migration script: `scripts/migrate-template-next-dates.ts` populates existing templates (idempotent)
        - **Triggering Modes**:
          - **Manual Triggering**: User clicks "Create" button to generate tasks from templates
          - **Auto-Trigger (Scheduled)**: Enable "Auto-trigger" toggle on templates to allow scheduled automation
      - Tasks support hierarchical nesting via parentTaskId, project linking, multiple assignees, priority levels, tags, and timestamped notes.
      - **Due Date with Time & Timezone**: Tasks can have due dates with specific times and timezone offsets:
        - Click the calendar icon on any task to open the due date picker
        - Set date, time (hour:minute), and timezone offset (GMT±HH:MM)
        - Defaults: current day, 11:59 PM, browser's local timezone
        - Display: shows "Jan 29" if time is 11:59 PM (default), or "Jan 29, 2:30 PM" if custom time
        - Storage format: `YYYY-MM-DDTHH:MM±HH:MM` (e.g., `2024-01-29T14:30+05:30`)
        - Overdue calculation uses full datetime with timezone for accuracy
    - **Regenerate AI Summary**: For archived reports missing AI summaries, admins can trigger regeneration by parsing the archived CSV data and generating new AI insights via OpenAI.
    - **Jira Integration**: Functionality to import projects, leads, and team members directly from Jira epics.
    - **Weekly Archiving System**:
      - **Auto-Archive**: Client-side trigger that runs when ViewReports page is opened on Wednesday or later. Archives previous week's reports if they exist.
      - **Force Archive**: Manual admin action to archive current reports immediately.
      - **Week Progression Logic**: The reporting week only advances when the previous week has been archived. If archive is missed, the system stays on the unarchived week until it's archived (prevents week skipping).
      - **Gap Detection**: The `/api/reporting-week` endpoint detects gaps between latest archive and current calendar week, returning the next unarchived week instead of jumping to current week.

### System Design Choices
- **Authentication**: Secured with Google authentication via Replit Auth, restricted to `@ignitetech.com` email domains. Server-side validation and session management using PostgreSQL.
- **API Protection**: All API endpoints are protected with authentication middleware, except scheduler endpoints (`/api/scheduler/*`) which are intentionally unauthenticated for external automation access with optional API key authentication via `SCHEDULER_API_KEY`.
- **Development Environment**: Utilizes Vite for frontend, `tsx` for backend development, and `connect-pg-simple` for session management.

## Scheduler API (Platform-Agnostic Automation)

The application provides scheduler endpoints that can be called by any automation system to trigger recurring deliverables and check archive status. These are platform-agnostic and work with:
- Replit Scheduled Deployments
- Linux cron
- Cloud schedulers (AWS CloudWatch, Google Cloud Scheduler)
- GitHub Actions scheduled workflows

### Scheduler Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scheduler/trigger-deliverables` | POST | Creates tasks from due auto-trigger templates |
| `/api/scheduler/auto-archive` | POST | Checks if weekly reports need archiving (returns `needsArchive: true` if archiving is pending - actual archiving requires opening the Reports page due to PDF generation complexity) |
| `/api/scheduler/status` | GET | Returns status of all auto-trigger templates |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `APP_URL` | Base URL for API calls (default: http://localhost:5000) |
| `SCHEDULER_API_KEY` | Optional API key for authentication |

### Standalone Scripts

Run these scripts manually or configure them in your scheduler:

```bash
# Trigger recurring deliverables
npx tsx scripts/trigger-deliverables.ts

# Check auto-archive status
npx tsx scripts/auto-archive.ts
```

### Template Auto-Trigger Configuration

1. Create or edit a recurring deliverable template
2. Set a recurrence pattern (daily, weekly, biweekly, monthly, quarterly)
3. Configure the work schedule (start time, due time, timezone)
4. Enable the "Auto-trigger (scheduled)" toggle
5. Configure your external scheduler to call `/api/scheduler/trigger-deliverables` periodically

## External Dependencies
- **PostgreSQL (Neon serverless)**: Primary database.
- **Shadcn UI**: UI component library.
- **Tailwind CSS**: Styling framework.
- **Wouter**: Routing library.
- **TanStack Query**: Data fetching library.
- **Passport.js**: Authentication middleware.
- **Replit Auth (OpenID Connect)**: Google authentication provider.
- **Jira API**: For project and user data import.