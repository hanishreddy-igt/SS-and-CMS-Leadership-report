# Weekly Leadership Report Tool

## Overview
A comprehensive project management and reporting application for managing teams, projects, and weekly status reports. Built with React, Express, TypeScript, and in-memory storage.

## Recent Changes (November 21, 2025)

### Latest Updates
1. **View Reports Tab**: Added export functionality (PDF and CSV) to save reports before deleting
2. **View Reports Tab**: Added "Delete All Reports" button to reset for next week (with confirmation dialog)
3. **Week Starting Date**: Automatically updates each week - calculates Monday of current week dynamically

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

### Database Schema
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
- Existing projects view removed (see Dashboard instead)

#### 3. Dashboard Tab
- Overview statistics: Total Projects, Team Members, Project Leads
- Project cards with lead and team member information
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
- **Backend**: Express, TypeScript
- **Storage**: In-memory storage (MemStorage)
- **Development**: Vite, tsx

## User Preferences
- Material Design approach for data-rich enterprise applications
- Color-coded status indicators for quick visual feedback
- Responsive design with mobile-friendly layouts
- Mock data included with //todo: remove mock functionality comments for easy cleanup

## Development Notes
- Application uses in-memory storage - data resets on server restart
- Mock data is initialized in client/src/pages/home.tsx
- All components are self-contained in client/src/components/
- Backend routes are defined in server/routes.ts
- Storage interface is in server/storage.ts
