# Weekly Leadership Report Tool

## Overview
A comprehensive project management and reporting application for managing teams, projects, and weekly status reports. Built with React, Express, TypeScript, and PostgreSQL database. **Secured with Google authentication restricted to @ignitetech.com and @khoros.com email domains.**

## Recent Changes (November 29, 2025)

### Latest Update: Enhanced UI with Consolidated Controls
1. **Sort & Filter Popover**: Consolidated all project filter/sort controls into single button
   - "Sort & Filter" button opens popover with all options
   - Sort by end date (earliest/latest first)
   - Filter by project name, lead, and team member
   - Badge shows count of active filters
   - "Clear all" button to reset all filters at once

2. **Dropdown Menus for Actions**: Replaced visible edit/delete buttons with three-dot menus
   - Project cards: Three-dot menu with Edit and Delete options
   - Team member tiles: Three-dot menu with Edit and Delete options
   - Project lead tiles: Three-dot menu with Edit and Delete options
   - Cleaner, less cluttered interface

3. **Project Deletion**: Added ability to delete projects
   - Delete option in project card dropdown menu
   - Confirmation dialog before deletion
   - Prevents accidental data loss

### Previous Update: Unified Teams & Projects Tab with Modal Forms
1. **Fully Consolidated Tab Structure**: Merged Dashboard and Team & Projects into single "Teams & Projects" tab
   - Tab count reduced from 5 to 4 tabs (Teams & Projects, Submit, View, Status)
   - Single unified view for all project and team management
   
2. **Modal-Based Add Forms**: All add functionality now uses popup dialogs
   - "Add New Project" button in All Projects section opens modal form
   - "Add Team Member" button in All Team Members section opens modal form
   - "Add Project Lead" button in All Project Leads section opens modal form
   - Forms include validation with inline error messages and toast notifications
   - Forms properly reset when modal closes (via Cancel, clicking outside, or Escape key)

3. **Project Name Filter**: Added search filter for projects
   - Text input to filter projects by name in All Projects section
   - Combines with existing lead and team member filters

4. **Optional Fields Enhancement**: Made start/end dates and challenges optional
   - Project creation no longer requires start/end dates
   - Weekly report submission no longer requires challenges/blockers
   - Red asterisks (*) indicate mandatory fields

### Previous Update: Authentication & Security
1. **Google Authentication**: Implemented Replit Auth with domain restrictions
   - Login required to access the application
   - Domain restricted to @ignitetech.com and @khoros.com email addresses
   - Server-side validation ensures only authorized domains can authenticate
   - Landing page for logged-out users with secure login button
   - All API endpoints protected with authentication middleware
   - Session management using PostgreSQL database
   - User profiles stored with email, name, and profile image

## Previous Changes (November 21, 2025)

### Latest Updates
1. **Jira Integration - Project Import**: Full integration with Jira to auto-populate Dashboard
   - "Import from Jira" button on Dashboard tab
   - Imports epics as projects with all metadata
   - Automatically extracts and adds team leads from epic assignees
   - Automatically finds and adds team members from issue assignees
   - Sets project dates from epic creation and due dates
   - Maps customer info from epic descriptions
   - Prevents duplicate people entries
   - See JIRA_INTEGRATION_GUIDE.md for setup instructions
2. **Dashboard Tab**: Added edit functionality for projects
   - Edit button on each project card
   - Full edit dialog with all project fields
   - Search functionality for team members during editing
   - Updates reflect immediately across the application
3. **Projects Tab**: Added search functionality for team members in "Add New Project" section
4. **View Reports Tab**: Added export functionality (PDF and CSV) and "Delete All Reports" button

### Previous Updates
1. **Projects Tab**: Removed "Existing Projects" section (redundant with Dashboard tab)
2. **Dashboard Tab**: Added sorting by end date and filters by project leads and team members
3. **Database Schema**: Unified people storage - same person can now be both a team lead and team member

### Previous Enhancements
- Added health status tracking (On Track, At Risk, Critical) to weekly reports
- Added team member feedback functionality in report submission
- Redesigned Report Status tab as dashboard with metrics (Total Projects, Reports Submitted, Reports Pending)
- Added comprehensive filtering in View Reports: by project leads, team members, and health status
- Added overview statistics showing projects by health status

## Project Architecture

### Database Schema (PostgreSQL with Drizzle ORM)
- **Users**: Authentication user data (email, name, profile image from Google)
- **Sessions**: Session storage for authentication
- **People**: Unified table for both team members and project leads (supports dual roles)
- **Projects**: Stores project information with customer, lead, team members, and dates
- **Weekly Reports**: Stores weekly progress reports with health status and team feedback

### Key Features

#### 1. Teams & Projects Tab (Unified Dashboard)
- **Overview Statistics**: Total Projects, Team Members, Project Leads
- **All Projects Section**:
  - "Add New Project" button opens modal form for project creation
  - Project cards with lead and team member information
  - Edit button on each project card to modify all project details
  - Filters: By project name, by project lead, by team member
  - Sorting: By end date (ascending/descending)
  - Import from Jira: One-click import of projects from Jira epics
- **All Team Members Section**:
  - "Add Team Member" button opens modal form
  - Grid view of all team members
  - Edit/delete functionality for each member
- **All Project Leads Section**:
  - "Add Project Lead" button opens modal form
  - Grid view of all project leads
  - Edit/delete functionality for each lead
- **Form Features**:
  - Modal dialogs for all add operations
  - Red asterisks (*) indicate mandatory fields
  - Inline validation error messages
  - Forms reset when modal closes

#### 2. Submit Report Tab
- Weekly report submission for project leads
- Health status selection: On Track, At Risk, Critical
- Progress, challenges, and next week plans
- Optional team member feedback for each team member on the project
- Prevents duplicate submissions for the same week

#### 3. View Reports Tab
- **Overview Stats**: Projects On Track, At Risk, Critical
- **Filters**: By project lead, team member, health status
- **Export Options**: Save as PDF or CSV (for archival before deleting)
- **Delete All Reports**: Clear all reports with confirmation dialog (for weekly reset)
- View all weekly reports with full details
- Edit existing reports (progress, challenges, plans, health status)
- Display team member feedback when available

#### 4. Report Status Tab
- **Dashboard Metrics**: Total Projects, Reports Submitted, Reports Pending
- **Filters**: By project lead, by submission status (all/submitted/pending)
- Visual indicators for report submission status
- Grouped by project lead

## Technology Stack
- **Frontend**: React, TypeScript, Wouter (routing), TanStack Query
- **UI**: Shadcn UI components, Tailwind CSS
- **Backend**: Express, TypeScript, Passport.js
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect) with Google login
- **Session Management**: connect-pg-simple (PostgreSQL session store)
- **Development**: Vite, tsx

## User Preferences
- Material Design approach for data-rich enterprise applications
- Color-coded status indicators for quick visual feedback
- Responsive design with mobile-friendly layouts
- **Secure access**: Authentication required with domain restrictions (@ignitetech.com, @khoros.com)
- Jira integration for automatic project data population (see JIRA_INTEGRATION_GUIDE.md)

## Development Notes
- **Database Persistence**: All data persists in PostgreSQL database
- **Authentication**: Replit Auth with domain restriction implemented in server/replitAuth.ts
- **Protected Routes**: All API endpoints require authentication (server/routes.ts)
- **Frontend Protection**: Landing page shown for logged-out users, Home page for logged-in users
- All components are self-contained in client/src/components/
- Storage interface is in server/storage.ts

## Security Features
- Server-side domain validation for @ignitetech.com and @khoros.com
- Session-based authentication with PostgreSQL session store
- All API endpoints protected with isAuthenticated middleware
- Automatic session refresh using refresh tokens
- Secure cookie configuration (httpOnly, secure, 7-day TTL)
