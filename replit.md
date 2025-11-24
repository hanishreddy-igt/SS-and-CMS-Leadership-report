# Weekly Leadership Report Tool

## Overview
A comprehensive project management and reporting application for managing teams, projects, and weekly status reports. Built with React, Express, TypeScript, and PostgreSQL database. **Secured with Google authentication restricted to @ignitetech.com and @khoros.com email domains.**

## Recent Changes (November 24, 2025)

### Latest Update: Authentication & Security
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

#### 1. Team Management Tab
- Add/edit/delete team members
- Add/edit/delete project leads
- Same person can be both a team member and project lead

#### 2. Project Management Tab
- Create new projects with customer, lead, team members, and date range
- **Search functionality** for team members with real-time filtering
- **Selected count badge** showing number of team members selected
- Optimized for large teams (50+ members)
- Existing projects view removed (see Dashboard instead)

#### 3. Dashboard Tab
- Overview statistics: Total Projects, Team Members, Project Leads
- **Import from Jira**: One-click import of projects from Jira epics
  - Automatically populates projects with team leads and members
  - Fetches data directly from Jira REST API
  - Requires Jira credentials in Replit Secrets (see JIRA_INTEGRATION_GUIDE.md)
- Project cards with lead and team member information
- **Edit Functionality**: Click edit button on any project card to modify all project details
- **Filters**: By project lead, by team member
- **Sorting**: By end date (ascending/descending)

#### 4. Submit Report Tab
- Weekly report submission for project leads
- Health status selection: On Track, At Risk, Critical
- Progress, challenges, and next week plans
- Optional team member feedback for each team member on the project
- Prevents duplicate submissions for the same week

#### 5. View Reports Tab
- **Overview Stats**: Projects On Track, At Risk, Critical
- **Filters**: By project lead, team member, health status
- **Export Options**: Save as PDF or CSV (for archival before deleting)
- **Delete All Reports**: Clear all reports with confirmation dialog (for weekly reset)
- View all weekly reports with full details
- Edit existing reports (progress, challenges, plans, health status)
- Display team member feedback when available

#### 6. Report Status Tab
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
