# SS & CMA Dashboard

## Overview
This project delivers a comprehensive dashboard for tracking Strategic Services (SS) and Community Managed Advisory (CMA) accounts. It provides a centralized view of project health, progress, and team contributions to facilitate strategic decision-making and enhance operational efficiency. The system ensures secure access via Google authentication, restricted to authorized corporate email domains. Key capabilities include project and team management, detailed reporting, and a robust task management system.

## User Preferences
- Material Design approach for data-rich enterprise applications
- Color-coded status indicators for quick visual feedback
- Responsive design with mobile-friendly layouts
- Secure access: Authentication required with domain restriction (@ignitetech.com and @khoros.com)
- Jira integration for automatic project data population

## System Architecture

### UI/UX Decisions
The dashboard features a Hub navigation with three main sections: Dashboard, Reports & Feedback, and Work Management. Each section operates in a full-screen mode with dedicated sub-tabs. The design embraces a premium executive dashboard aesthetic with glassmorphism cards using `backdrop-blur` effects and a unified theme with consistent color tokens, spacing, and the Inter font family. A dark/light mode toggle (Sun/Moon icon) is available in all authenticated page headers (Hub, Dashboard, Section layouts), powered by a ThemeProvider context that persists the preference in localStorage. The CSS uses `:root` for light theme variables and `.dark` class for dark theme variables, with Tailwind's `darkMode: ["class"]` configuration. All custom CSS classes (`glass-card`, `executive-header`, `metric-card`, `premium-tab`, etc.) are theme-aware. Components use semantic Tailwind tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`) instead of hardcoded colors. User experience enhancements include clearer terminology ("Needs Attention"), visible scrollbars, standardized filter heights, and consolidated action buttons. A clean selection mode for bulk operations and modal-based forms for all add functionalities (Projects, Team Members, Project Leads) with inline validation are implemented.

### Technical Implementations
The system is built using React, Express, TypeScript, and PostgreSQL. The database schema, managed with Drizzle ORM, includes tables for Users, Sessions, People (unified for team members/leads with role-based access), Projects, Weekly Reports, Saved Reports, and Task Activity (for audit trails). A unified person management system allows individuals to hold multiple roles simultaneously, preventing duplicate entries.

Key features include:
- **Dashboard Section**: Unified view for project and team management with filtering and sorting capabilities.
- **Reports Section**: Allows submission of weekly reports with health statuses, progress, challenges, and next steps, including draft functionality. Users can view current project health statistics, filter reports, export data, and manage historical archives with AI summaries.
- **Work Management Section**: A Workflowy-style task management system with features for creating and managing personal tasks ("Your Workspace"), viewing all tasks across projects ("All Tasks"), tasks assigned to the current user ("Tasks for You"), and creating recurring tasks from templates. Recurring task templates support hierarchical sub-tasks, various recurrence patterns (daily, weekly, monthly, quarterly), flexible work schedules with start/due times, and timezone awareness. Tasks can be manually or automatically triggered based on pre-calculated dates. Tasks support hierarchical nesting, project linking, multiple assignees, priorities, tags, and notes, along with due dates supporting specific times and timezones.
- **AI Natural Language Q&A Chat**: A floating, stateless AI chat panel powered by OpenAI for natural language queries about dashboard data. It uses an intent-based routing system with configurable system prompts, streaming responses via SSE, and supports 7 default intents (e.g., EOD report, project status, task query).

### System Design Choices
Authentication is handled via Google authentication (Replit Auth) restricted to specified corporate email domains, with server-side validation and PostgreSQL for session management. All API endpoints are protected by authentication middleware, except for scheduler endpoints which are intentionally unauthenticated for external automation, with optional API key protection. The development environment leverages Vite for the frontend, `tsx` for backend development, and `connect-pg-simple` for session management.

## External Dependencies
- **PostgreSQL**: Primary database (Neon serverless).
- **Shadcn UI**: UI component library.
- **Tailwind CSS**: Styling framework.
- **Wouter**: Routing library.
- **TanStack Query**: Data fetching library.
- **Passport.js**: Authentication middleware.
- **Replit Auth (OpenID Connect)**: Google authentication provider.
- **Jira API**: For project and user data import.
- **OpenAI**: For AI Natural Language Q&A Chat functionality (via Replit AI Integrations).