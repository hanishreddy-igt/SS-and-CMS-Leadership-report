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
      - **Task Templates**: Recurring task templates with support for daily/weekly/monthly patterns, EOS update formats (Rocks, Issues, To-dos, Scorecard), and hierarchical task structure creation.
      - Tasks support hierarchical nesting via parentTaskId, project linking, multiple assignees, priority levels, tags, and timestamped notes.
    - **Regenerate AI Summary**: For archived reports missing AI summaries, admins can trigger regeneration by parsing the archived CSV data and generating new AI insights via OpenAI.
    - **Jira Integration**: Functionality to import projects, leads, and team members directly from Jira epics.
    - **Weekly Archiving System**:
      - **Auto-Archive**: Client-side trigger that runs when ViewReports page is opened on Wednesday or later. Archives previous week's reports if they exist.
      - **Force Archive**: Manual admin action to archive current reports immediately.
      - **Week Progression Logic**: The reporting week only advances when the previous week has been archived. If archive is missed, the system stays on the unarchived week until it's archived (prevents week skipping).
      - **Gap Detection**: The `/api/reporting-week` endpoint detects gaps between latest archive and current calendar week, returning the next unarchived week instead of jumping to current week.

### System Design Choices
- **Authentication**: Secured with Google authentication via Replit Auth, restricted to `@ignitetech.com` email domains. Server-side validation and session management using PostgreSQL.
- **API Protection**: All API endpoints are protected with authentication middleware.
- **Development Environment**: Utilizes Vite for frontend, `tsx` for backend development, and `connect-pg-simple` for session management.

## External Dependencies
- **PostgreSQL (Neon serverless)**: Primary database.
- **Shadcn UI**: UI component library.
- **Tailwind CSS**: Styling framework.
- **Wouter**: Routing library.
- **TanStack Query**: Data fetching library.
- **Passport.js**: Authentication middleware.
- **Replit Auth (OpenID Connect)**: Google authentication provider.
- **Jira API**: For project and user data import.