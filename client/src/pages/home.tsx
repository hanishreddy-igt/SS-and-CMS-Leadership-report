import { FileText, FolderKanban, Eye, LogOut, Shield, BarChart3, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import SubmitReport from '@/components/SubmitReport';
import ViewReports from '@/components/ViewReports';
import { useQuery } from '@tanstack/react-query';
import type { Project, WeeklyReport } from '@shared/schema';

export default function Home() {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: reports = [] } = useQuery<WeeklyReport[]>({
    queryKey: ['/api/weekly-reports'],
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
  const onTrackCount = reports.filter((r) => r.healthStatus === 'on-track').length;
  const atRiskCount = reports.filter((r) => r.healthStatus === 'at-risk').length;
  const criticalCount = reports.filter((r) => r.healthStatus === 'critical').length;

  return (
    <div className="min-h-screen">
      <header className="executive-header border-b border-white/10">
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="section-label">Executive Dashboard</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-title">
                <span className="text-foreground">CMS & SS Leadership Report</span>
              </h1>
              <p className="text-muted-foreground text-lg mt-2 max-w-2xl">
                Comprehensive delivery status tracking for Community Managed & Strategic Services
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout} 
              data-testid="button-logout" 
              className="shrink-0 glass-card border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="metric-card fade-in" style={{ animationDelay: '0ms' }}>
              <div className="flex items-center justify-between mb-3">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-4xl font-bold tabular-nums platinum-text">{activeProjects.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Active Projects</p>
            </div>

            <div className="metric-card metric-card-success fade-in" style={{ animationDelay: '50ms' }}>
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-success">{onTrackCount}</p>
              <p className="text-sm text-muted-foreground mt-1">On Track</p>
            </div>

            <div className="metric-card metric-card-warning fade-in" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-warning" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-warning">{atRiskCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Needs Attention</p>
            </div>

            <div className={`metric-card metric-card-danger fade-in ${criticalCount > 0 ? 'pulse-critical' : ''}`} style={{ animationDelay: '150ms' }}>
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-destructive">{criticalCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Critical</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="teams-projects" className="space-y-8">
          <TabsList className="premium-tabs grid w-full grid-cols-3 h-auto">
            <TabsTrigger 
              value="teams-projects" 
              data-testid="tab-teams-projects" 
              className="premium-tab gap-2 py-4"
            >
              <FolderKanban className="h-5 w-5" />
              <span className="hidden sm:inline font-semibold">Teams & Projects</span>
            </TabsTrigger>
            <TabsTrigger 
              value="submit" 
              data-testid="tab-submit" 
              className="premium-tab gap-2 py-4"
            >
              <FileText className="h-5 w-5" />
              <span className="hidden sm:inline font-semibold">Submit Report</span>
            </TabsTrigger>
            <TabsTrigger 
              value="view" 
              data-testid="tab-view" 
              className="premium-tab gap-2 py-4"
            >
              <Eye className="h-5 w-5" />
              <span className="hidden sm:inline font-semibold">View Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams-projects" className="fade-in">
            <ProjectsDashboard />
          </TabsContent>

          <TabsContent value="submit" className="fade-in">
            <SubmitReport />
          </TabsContent>

          <TabsContent value="view" className="fade-in">
            <ViewReports />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            CMS & SS Leadership Report — <span className="text-primary">IgniteTech</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
