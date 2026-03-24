import { ReactNode, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { FileText, Eye, History, BarChart3, CheckCircle2, AlertTriangle, FolderKanban, Menu, Sun, Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import AppDemo from '@/components/AppDemo';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import type { Project, WeeklyReport } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import logoImage from '@assets/IgniteTech__Khoros_Logos-removebg-preview_1767951034958.png';

interface DashboardLayoutProps {
  children: ReactNode;
  onHealthTileClick?: (status: string) => void;
}

export default function DashboardLayout({ children, onHealthTileClick }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const permissions = usePermissions();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
  });

  const { data: reports = [] } = useQuery<WeeklyReport[]>({
    queryKey: ['/api/weekly-reports'],
    enabled: isAuthenticated,
  });

  const { data: reportingWeek } = useQuery<{ weekStart: string; weekEnd: string }>({
    queryKey: ['/api/reporting-week'],
    enabled: isAuthenticated,
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

  const navItems = [
    { path: '/', label: 'Dashboard', icon: FolderKanban },
    { path: '/submit', label: 'Submit Report', icon: FileText },
    { path: '/view', label: 'View Current', icon: Eye },
    { path: '/historical', label: 'Historical', icon: History },
  ];

  const handleHealthClick = (status: string) => {
    if (onHealthTileClick) {
      onHealthTileClick(status);
    } else {
      setLocation(`/view?health=${status}`);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="executive-header border-b border-border">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <img 
                  src={logoImage} 
                  alt="IgniteTech + Khoros" 
                  className="h-16 object-contain"
                />
              </div>
              <Link href="/">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity" data-testid="text-title">
                  <span className="text-foreground">SS & CMA Dashboard</span>
                </h1>
              </Link>
              <p className="text-muted-foreground text-base mt-1">
                Comprehensive tracking system for Strategic Services & Community Managed Advisory
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" data-testid="theme-toggle-group">
                <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Light</span>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  data-testid="button-theme-toggle"
                />
                <span className="text-xs text-muted-foreground">Dark</span>
                <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <AppDemo onTabChange={() => {}} />
              <UserProfileDropdown />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div 
              className="metric-card metric-card-success fade-in cursor-pointer hover:border-success/30 transition-all" 
              style={{ animationDelay: '0ms' }}
              onClick={() => handleHealthClick('on-track')}
              data-testid="tile-on-track"
            >
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-success">{onTrackCount}</p>
              <p className="text-sm text-muted-foreground mt-1">On Track</p>
            </div>

            <div 
              className="metric-card metric-card-warning fade-in cursor-pointer hover:border-warning/30 transition-all" 
              style={{ animationDelay: '50ms' }}
              onClick={() => handleHealthClick('at-risk')}
              data-testid="tile-needs-attention"
            >
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-warning" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-warning">{atRiskCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Needs Attention</p>
            </div>

            <div 
              className={`metric-card metric-card-danger fade-in cursor-pointer hover:border-destructive/30 transition-all ${criticalCount > 0 ? 'pulse-critical' : ''}`} 
              style={{ animationDelay: '100ms' }}
              onClick={() => handleHealthClick('critical')}
              data-testid="tile-critical"
            >
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-destructive">{criticalCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Critical</p>
            </div>
          </div>

          <div 
            className={`mt-4 px-4 py-3 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-3 ${
              contractsWithReports === activeProjects.length
                ? 'bg-success/10 border border-success/30 hover:bg-success/15 hover:border-success/40'
                : 'bg-warning/10 border border-warning/30 hover:bg-warning/15 hover:border-warning/40'
            }`}
            data-testid="banner-report-completeness"
            onClick={() => setLocation('/submit')}
          >
            {contractsWithReports === activeProjects.length ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            )}
            <p className={`text-sm ${contractsWithReports === activeProjects.length ? 'text-success' : 'text-warning'}`}>
              {contractsWithReports === activeProjects.length ? (
                <span className="font-semibold">ALL reports are submitted this week!</span>
              ) : (
                <>ONLY <span className="font-semibold">{contractsWithReports}</span> out of <span className="font-semibold">{activeProjects.length}</span> reports are submitted this week.</>
              )}
            </p>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="md:hidden flex items-center justify-between py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="gap-2"
            >
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </Button>
          </div>
          
          <div className={cn(
            "grid grid-cols-4 gap-2 py-2",
            mobileMenuOpen ? "grid" : "hidden md:grid"
          )}>
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full gap-2 transition-all justify-center",
                      isActive && "bg-primary text-primary-foreground"
                    )}
                    data-testid={`nav-${item.path.replace('/', '') || 'home'}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
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
