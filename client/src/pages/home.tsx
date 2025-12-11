import { useState, useRef, useEffect } from 'react';
import { FileText, FolderKanban, Eye, Shield, BarChart3, TrendingUp, History, CheckCircle2, AlertTriangle } from 'lucide-react';
import AppDemo from '@/components/AppDemo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import SubmitReport from '@/components/SubmitReport';
import ViewReports from '@/components/ViewReports';
import HistoricalReports from '@/components/HistoricalReports';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import { useQuery } from '@tanstack/react-query';
import type { Project, WeeklyReport } from '@shared/schema';

export default function Home() {
  const [activeTab, setActiveTab] = useState('teams-projects');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [shouldScrollToProjects, setShouldScrollToProjects] = useState(false);
  const [shouldClearFilters, setShouldClearFilters] = useState(false);

  const handleActiveProjectsClick = () => {
    setActiveTab('teams-projects');
    setShouldScrollToProjects(true);
    setShouldClearFilters(true);
  };

  const handleHealthTileClick = (healthStatus: string) => {
    setHealthFilter(healthStatus);
    setActiveTab('view');
  };

  useEffect(() => {
    if (shouldScrollToProjects && activeTab === 'teams-projects') {
      const timer = setTimeout(() => {
        const projectsSection = document.getElementById('all-projects-section');
        if (projectsSection) {
          projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setShouldScrollToProjects(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldScrollToProjects, activeTab]);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: reports = [] } = useQuery<WeeklyReport[]>({
    queryKey: ['/api/weekly-reports'],
  });

  // Fetch the reporting week from the API
  const { data: reportingWeek } = useQuery<{ weekStart: string; weekEnd: string }>({
    queryKey: ['/api/reporting-week'],
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
  
  // Use the reporting week from API
  const reportingWeekStart = reportingWeek?.weekStart || '';
  
  // Filter reports for the reporting week - compare string dates
  const currentWeekReports = reports.filter((r) => r.weekStart === reportingWeekStart);
  
  // Only count submitted reports for health status tiles
  const submittedReports = currentWeekReports.filter((r) => r.status === 'submitted');
  const onTrackCount = submittedReports.filter((r) => r.healthStatus === 'on-track').length;
  const atRiskCount = submittedReports.filter((r) => r.healthStatus === 'at-risk').length;
  const criticalCount = submittedReports.filter((r) => r.healthStatus === 'critical').length;
  
  // Count unique contracts with submitted reports this week
  const contractsWithReports = new Set(submittedReports.map(r => r.projectId)).size;

  return (
    <div className="min-h-screen">
      <header className="executive-header border-b border-white/10">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="section-label">Executive Dashboard</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-title">
                <span className="text-foreground">CMS & SS Leadership Report</span>
              </h1>
              <p className="text-muted-foreground text-base mt-1">
                Comprehensive delivery status tracking for Community Managed & Strategic Services
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AppDemo onTabChange={setActiveTab} />
              <UserProfileDropdown />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div 
              className="metric-card metric-card-success fade-in cursor-pointer hover:border-success/30 transition-all" 
              style={{ animationDelay: '0ms' }}
              onClick={() => handleHealthTileClick('on-track')}
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
              onClick={() => handleHealthTileClick('at-risk')}
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
              onClick={() => handleHealthTileClick('critical')}
              data-testid="tile-critical"
            >
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-4xl font-bold tabular-nums text-destructive">{criticalCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Critical</p>
            </div>
          </div>

          {/* Report submission completeness banner */}
          <div 
            className={`mt-4 px-4 py-3 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-3 ${
              contractsWithReports === activeProjects.length
                ? 'bg-success/10 border border-success/30 hover:bg-success/15 hover:border-success/40'
                : 'bg-warning/10 border border-warning/30 hover:bg-warning/15 hover:border-warning/40'
            }`}
            data-testid="banner-report-completeness"
            onClick={() => setActiveTab('submit')}
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

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="premium-tabs grid w-full grid-cols-4 h-auto">
            <TabsTrigger 
              value="teams-projects" 
              data-testid="tab-teams-projects" 
              className="premium-tab gap-2 py-4"
            >
              <FolderKanban className="h-5 w-5" />
              <span className="hidden sm:inline font-semibold">Teams & Contracts</span>
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
              <span className="hidden sm:inline font-semibold">View Current Report</span>
            </TabsTrigger>
            <TabsTrigger 
              value="historical" 
              data-testid="tab-historical" 
              className="premium-tab gap-2 py-4"
            >
              <History className="h-5 w-5" />
              <span className="hidden sm:inline font-semibold">Historical Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams-projects" className="fade-in">
            <ProjectsDashboard 
              shouldClearFilters={shouldClearFilters} 
              onFiltersClear={() => setShouldClearFilters(false)} 
            />
          </TabsContent>

          <TabsContent value="submit" className="fade-in">
            <SubmitReport />
          </TabsContent>

          <TabsContent value="view" className="fade-in">
            <ViewReports externalHealthFilter={healthFilter} onClearExternalFilter={() => setHealthFilter('all')} />
          </TabsContent>

          <TabsContent value="historical" className="fade-in">
            <HistoricalReports />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-white/5 mt-8">
        <div className="px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            CMS & SS Leadership Report — <span className="text-primary">IgniteTech</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
