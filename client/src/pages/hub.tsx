import { useLocation } from 'wouter';
import { LayoutDashboard, FileText, ListTodo, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import AppDemo from '@/components/AppDemo';
import { usePermissions } from '@/hooks/usePermissions';

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
const TASKS_ALLOWED_ROLES = ['admin', 'manager']; // Add 'lead', 'member' to open up

export default function Hub() {
  const [, setLocation] = useLocation();
  const { role } = usePermissions();
  
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
      <header className="executive-header border-b border-white/10">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-hub-title">
                <span className="text-foreground">SS & CMA Dashboard</span>
              </h1>
              <p className="text-muted-foreground text-base mt-1">
                Comprehensive tracking system for Strategic Services & Community Managed Services
              </p>
            </div>
            <div className="flex items-center gap-2">
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

      <footer className="border-t border-white/5">
        <div className="px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            SS & CMA Dashboard — <span className="text-primary">IgniteTech</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
