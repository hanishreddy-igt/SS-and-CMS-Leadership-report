# Community Managed services & Strategic services Leadership Report

## Overview
A tool for the leadership to help understand the status of all CMS and SS account delivery status. Built with React, Express, TypeScript, and PostgreSQL database. **Secured with Google authentication restricted to @ignitetech.com email domain only.**

## Recent Changes (November 29, 2025)

### Latest Update: Draft Report Feature
1. **Save as Draft Functionality**:
   - New "Save as Draft" button in Submit Report form
   - Allows partial report completion before final submission
   - Drafts persist and can be edited later
   - Auto-loads draft data when selecting a project with existing draft

2. **Report Status Tracking**:
   - Reports now have "draft" or "submitted" status
   - Drafted reports show as "Drafted" (blue) in Report Status by Lead
   - Submitted reports show as "Submitted" (green)
   - Pending projects (no report) show as "Pending" (amber)

3. **Metrics Count Only Submitted Reports**:
   - "Reports Submitted" counts only fully submitted reports
   - "Reports Pending" includes both drafts and projects without any report
   - Draft reports don't count toward completion until submitted

4. **Submit Button Validation**:
   - Submit button only enabled when all required fields are filled
   - Required fields: Health Status, Progress, Plans for Next Week
   - Save Draft button enabled once project is selected

5. **Filter Enhancement**:
   - New "Drafted" option in Report Status by Lead filter
   - Filter by: All, Submitted, Drafted, or Pending

### Previous Update: UI Improvements
1. **Renamed "At Risk" to "Needs Attention"**:
   - Updated health status label across entire application
   - More professional and less alarming terminology
   - Applies to metric cards, filters, dropdowns, and reports

2. **Visible Scrollbars in Filters**:
   - All filter containers now have clearly visible scrollbars
   - Custom scrollbar styling with gray track and thumb
   - Hover effect on scrollbar for better usability

3. **Filter List Height Standardization**:
   - Filter by Lead and Filter by Member lists show ~5 items at a time
   - Consistent height across all filter popovers
   - Improved scrolling experience in dense lists

### Previous Update: Enhanced Filter & Export UX
1. **Smart Lead Selection in Submit Report**:
   - Leads who have submitted all their project reports are automatically disabled
   - Shows "(Submitted all reports)" label next to disabled leads
   - Prevents unnecessary form interactions when no reports are pending

2. **Unified Filter Button in View Reports**:
   - Replaced 3 separate filter dropdowns with single "Filter" button
   - Popover contains: Lead filter with search, Member filter with search, Status filter
   - All filters use multi-select checkboxes
   - Badge shows active filter count
   - "Clear all" button resets all filters

3. **Consolidated Save Button in View Reports**:
   - Merged "Save as PDF" and "Save as CSV" into single "Save" dropdown button
   - Dropdown menu shows both export options
   - Cleaner, less cluttered interface

4. **Renamed Reset Action**:
   - Changed "Delete All Reports" to "Reset reports for next week"
   - Updated dialog messaging to reflect weekly workflow
   - Better reflects the intended use case of weekly reporting cycles

### Previous Update: Consolidated Submit Report Tab
1. **Tab Consolidation**: Reduced from 4 tabs to 3 tabs
   - Renamed "Submit" to "Submit Report"
   - Renamed "View" to "View Reports"
   - Merged Status tab into Submit Report tab
   
2. **Submit Report Tab Layout**:
   - **Top Section**: Two metric cards showing "Reports Submitted X/total" and "Reports Pending X/total"
   - **Middle Section**: Submit Weekly Report form (unchanged)
   - **Bottom Section**: Report Status by Lead (renamed from "Report Status by Project")
   
3. **Report Status by Lead Filter**: Single "Filter" button with popover
   - Filter by Lead with search and multi-select checkboxes
   - Filter by Status (All, Submitted, Pending)
   - Badge shows active filter count
   - "Clear all" button to reset filters

### Previous Update: Improved Selection Mode & Filter UX
1. **Selection Mode for Bulk Operations**: Cleaner UI without checkboxes on tiles
   - "Select" button activates selection mode for each section (Projects, Members, Leads)
   - Click tiles to select/deselect when in selection mode
   - Visual indicators: ring highlight and subtle background color for selected items
   - "Select All" / "Deselect All" toggle button
   - "Delete" button appears when items are selected
   - "Cancel" button exits selection mode and clears selections
   - Checkmarks appear only during selection mode

2. **Enhanced Filter UI**: Scrollable filters with search
   - Filter by Lead now has search functionality (same as Filter by Member)
   - Both lead and member filter lists are scrollable (5 items visible at a time)
   - Search helps find leads/members quickly in large lists

### Previous Update: Enhanced UI with Consolidated Controls
1. **Sort & Filter Popover**: Consolidated all project filter/sort controls into single button
   - "Sort & Filter" button opens popover with all options
   - Sort by start date or end date (earliest/latest first)
   - Filter by project name, lead, and team member (multi-select with checkboxes)
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

4. **Missing End Date Warning**: Visual indicator on project cards
   - Red text with AlertCircle icon appears when end date is missing

### Previous Update: Unified Teams & Projects Tab with Modal Forms
1. **Fully Consolidated Tab Structure**: Merged Dashboard and Team & Projects into single "Teams & Projects" tab
   - Tab count previously reduced from 5 to 4 tabs (now further reduced to 3 tabs)
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

#### 2. Submit Report Tab (Consolidated)
- **Overview Metrics**: Reports Submitted (X/total), Reports Pending (X/total)
- **Submit Weekly Report Form**:
  - Weekly report submission for project leads
  - Health status selection: On Track, At Risk, Critical
  - Progress, challenges, and next week plans
  - Optional team member feedback for each team member on the project
  - Prevents duplicate submissions for the same week
- **Report Status by Lead**:
  - Visual indicators for report submission status per project
  - Grouped by project lead
  - Filter button with popover for lead and status filtering

#### 3. View Reports Tab
- **Overview Stats**: Projects On Track, At Risk, Critical
- **Filters**: By project lead, team member, health status
- **Export Options**: Save as PDF or CSV (for archival before deleting)
- **Delete All Reports**: Clear all reports with confirmation dialog (for weekly reset)
- View all weekly reports with full details
- Edit existing reports (progress, challenges, plans, health status)
- Display team member feedback when available

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
- **Secure access**: Authentication required with domain restriction (@ignitetech.com only)
- Jira integration for automatic project data population (see JIRA_INTEGRATION_GUIDE.md)

## Development Notes
- **Database Persistence**: All data persists in PostgreSQL database
- **Authentication**: Replit Auth with domain restriction implemented in server/replitAuth.ts
- **Protected Routes**: All API endpoints require authentication (server/routes.ts)
- **Frontend Protection**: Landing page shown for logged-out users, Home page for logged-in users
- All components are self-contained in client/src/components/
- Storage interface is in server/storage.ts

## Security Features
- Server-side domain validation for @ignitetech.com only
- Session-based authentication with PostgreSQL session store
- All API endpoints protected with isAuthenticated middleware
- Automatic session refresh using refresh tokens
- Secure cookie configuration (httpOnly, secure, 7-day TTL)
