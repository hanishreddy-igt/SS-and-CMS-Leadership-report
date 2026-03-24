import { ReactNode, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { ArrowLeft, LayoutDashboard, FileText, ListTodo, Menu, BarChart3, CheckCircle2, AlertTriangle, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import AppDemo from '@/components/AppDemo';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import type { Project, WeeklyReport } from '@shared/schema';
import logoImage from '@assets/IgniteTech__Khoros_Logos-removebg-preview_1767951034958.png';

interface Tab {
  id: string;
  label: string;
  icon?: typeof LayoutDashboard;
}

interface SectionLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  showHealthMetrics?: boolean;
  onHealthTileClick?: (status: string) => void;
}

const sectionNav = [
  { path: '/dashboard/contracts', label: 'Dashboard', icon: LayoutDashboard, basePath: '/dashboard' },
  { path: '/reports/submit', label: 'Reports', icon: FileText, basePath: '/reports' },
  { path: '/tasks/workspace', label: 'Tasks', icon: ListTodo, basePath: '/tasks' },
];

export default function SectionLayout({
  children,
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  showHealthMetrics = false,
  onHealthTileClick,
}: SectionLayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated && showHealthMetrics,
  });

  const { data: reports = [] } = useQuery<WeeklyReport[]>({
    queryKey: ['/api/weekly-reports'],
    enabled: isAuthenticated && showHealthMetrics,
  });

  const { data: reportingWeek } = useQuery<{ weekStart: string; weekEnd: string }>({
    queryKey: ['/api/reporting-week'],
    enabled: isAuthenticated && showHealthMetrics,
  });

  const getProjectStatus = (endDate: string | null) => {
    if (!endDate) return 'active-renewal';
    const end = new Date(endDate);
    const now = new Date();
    const daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilEnd < 0) return 'ended';
    if (daysUntilEnd <= 60) return 'active-renewal';
    return 'active';
  };

  const activeProjects = projects.filter(p => getProjectStatus(p.endDate) !== 'ended');
  const reportingWeekStart = reportingWeek?.weekStart || '';
  const currentWeekReports = reports.filter((r) => r.weekStart === reportingWeekStart);
  const submittedReports = currentWeekReports.filter((r) => r.status === 'submitted');
  const onTrackCount = submittedReports.filter((r) => r.healthStatus === 'on-track').length;
  const atRiskCount = submittedReports.filter((r) => r.healthStatus === 'at-risk').length;
  const criticalCount = submittedReports.filter((r) => r.healthStatus === 'critical').length;
  const contractsWithReports = new Set(submittedReports.map(r => r.projectId)).size;

  const handleHealthClick = (status: string) => {
    if (onHealthTileClick) {
      onHealthTileClick(status);
    }
  };

  const currentSection = sectionNav.find(s => location.startsWith(s.basePath));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="executive-header border-b border-border">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/')}
                className="shrink-0"
                data-testid="button-back-to-hub"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Link href="/" className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity">
                <img 
                  src={logoImage} 
                  alt="IgniteTech + Khoros" 
                  className="h-10 object-contain"
                />
                <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{title}</span>
              </Link>
            </div>
            
            <div className="hidden md:flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              {sectionNav.map((item) => {
                const isActive = location.startsWith(item.basePath);
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLocation(item.path)}
                    className={cn(
                      "gap-2 transition-all",
                      isActive && "bg-primary text-primary-foreground"
                    )}
                    data-testid={`nav-section-${item.basePath.replace('/', '')}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                data-testid="button-theme-toggle-section"
                className="gap-1.5"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="text-xs">{theme === "dark" ? "Light" : "Dark"}</span>
              </Button>
              <AppDemo onTabChange={() => {}} />
              <UserProfileDropdown />
            </div>
          </div>

          {showHealthMetrics && (
            <>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div 
                  className="metric-card metric-card-success fade-in cursor-pointer hover:border-success/30 transition-all" 
                  style={{ animationDelay: '0ms' }}
                  onClick={() => handleHealthClick('on-track')}
                  data-testid="tile-on-track"
                >
                  <div className="flex items-center justify-between mb-2">
                    <BarChart3 className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-3xl font-bold tabular-nums text-success">{onTrackCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">On Track</p>
                </div>

                <div 
                  className="metric-card metric-card-warning fade-in cursor-pointer hover:border-warning/30 transition-all" 
                  style={{ animationDelay: '50ms' }}
                  onClick={() => handleHealthClick('at-risk')}
                  data-testid="tile-needs-attention"
                >
                  <div className="flex items-center justify-between mb-2">
                    <BarChart3 className="h-4 w-4 text-warning" />
                  </div>
                  <p className="text-3xl font-bold tabular-nums text-warning">{atRiskCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Needs Attention</p>
                </div>

                <div 
                  className={`metric-card metric-card-danger fade-in cursor-pointer hover:border-destructive/30 transition-all ${criticalCount > 0 ? 'pulse-critical' : ''}`} 
                  style={{ animationDelay: '100ms' }}
                  onClick={() => handleHealthClick('critical')}
                  data-testid="tile-critical"
                >
                  <div className="flex items-center justify-between mb-2">
                    <BarChart3 className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-3xl font-bold tabular-nums text-destructive">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Critical</p>
                </div>
              </div>

              <div 
                className={`mt-3 px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  contractsWithReports === activeProjects.length
                    ? 'bg-success/10 border border-success/30 hover:bg-success/15 hover:border-success/40'
                    : 'bg-warning/10 border border-warning/30 hover:bg-warning/15 hover:border-warning/40'
                }`}
                data-testid="banner-report-completeness"
                onClick={() => contractsWithReports === activeProjects.length ? onTabChange('view') : onTabChange('submit')}
              >
                {contractsWithReports === activeProjects.length ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                )}
                <p className={`text-xs ${contractsWithReports === activeProjects.length ? 'text-success' : 'text-warning'}`}>
                  {contractsWithReports === activeProjects.length ? (
                    <span className="font-semibold">ALL reports submitted!</span>
                  ) : (
                    <>
                      <span className="font-semibold">{contractsWithReports}</span> of <span className="font-semibold">{activeProjects.length}</span> reports submitted
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </header>

      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="md:hidden flex items-center justify-between py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="gap-2"
            >
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </Button>
            
            <div className="flex gap-1">
              {sectionNav.map((item) => {
                const isActive = location.startsWith(item.basePath);
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setLocation(item.path)}
                    className="h-8 w-8"
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div className={cn(
            "grid gap-1 py-2",
            mobileMenuOpen ? "grid" : "hidden md:grid",
            tabs.length === 2 && "grid-cols-2",
            tabs.length === 3 && "grid-cols-3",
            tabs.length === 4 && "grid-cols-4"
          )}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    onTabChange(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "gap-2 transition-all whitespace-nowrap justify-center",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  data-testid={`tab-${tab.id}`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="border-t border-border mt-8">
        <div className="px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            SS & CMA Dashboard — <span className="text-primary">IgniteTech</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
