import { useLocation } from 'wouter';
import { LayoutDashboard, FileText, ListTodo, Sun, Moon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import AppDemo from '@/components/AppDemo';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import logoImage from '@assets/IgniteTech__Khoros_Logos-removebg-preview_1767951034958.png';

interface HubCardProps {
  icon: typeof LayoutDashboard;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
}

function HubCard({ icon: Icon, title, description, onClick, testId }: HubCardProps) {
  return (
    <Card
      className="group cursor-pointer p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:border-primary/30 hover:bg-card/80 min-h-[280px]"
      onClick={onClick}
      data-testid={testId}
    >
      <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 mb-6 transition-all duration-300 group-hover:bg-primary/20 group-hover:border-primary/30 group-hover:scale-110">
        <Icon className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-[200px]">{description}</p>
    </Card>
  );
}

// ============================================================
// TASK ACCESS CONTROL - Must match tasks-section.tsx
// ============================================================
const TASKS_ALLOWED_ROLES = ['admin', 'manager', 'lead', 'member'];

export default function Hub() {
  const [, setLocation] = useLocation();
  const { role } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  
  // Simple role check - easy to modify
  const canAccessTasks = TASKS_ALLOWED_ROLES.includes(role);

  const sections = [
    {
      icon: LayoutDashboard,
      title: 'Dashboard',
      description: 'View contracts, team members, and project leads',
      path: '/dashboard/contracts',
      testId: 'hub-dashboard',
      visible: true,
    },
    {
      icon: FileText,
      title: 'Reports & Feedback',
      description: 'Submit, view, and analyze weekly reports',
      path: '/reports/submit',
      testId: 'hub-reports',
      visible: true,
    },
    {
      icon: ListTodo,
      title: 'Work Management',
      description: 'Manage tasks, templates, and daily work',
      path: '/tasks/workspace',
      testId: 'hub-tasks',
      visible: canAccessTasks,
    },
  ].filter(section => section.visible);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="executive-header border-b border-border">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-4 mb-2">
                <img 
                  src={logoImage} 
                  alt="IgniteTech + Khoros" 
                  className="h-16 object-contain"
                />
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-hub-title">
                  <span className="text-foreground">SS & CMA Dashboard</span>
                </h1>
              </div>
              <p className="text-muted-foreground text-base mt-1">
                Comprehensive tracking system for Strategic Services & Community Managed Advisory
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                data-testid="button-theme-toggle-hub"
                className="gap-1.5"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="text-xs">{theme === "dark" ? "Light" : "Dark"}</span>
              </Button>
              <AppDemo onTabChange={() => {}} />
              <UserProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-xl text-muted-foreground">Select a workspace to get started</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sections.map((section) => (
              <HubCard
                key={section.path}
                icon={section.icon}
                title={section.title}
                description={section.description}
                onClick={() => setLocation(section.path)}
                testId={section.testId}
              />
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            SS & CMA Dashboard — <span className="text-primary">IgniteTech</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
