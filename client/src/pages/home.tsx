import { Users, FileText, Edit2, UserCheck, LayoutDashboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeamManagement from '@/components/TeamManagement';
import ProjectManagement from '@/components/ProjectManagement';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import SubmitReport from '@/components/SubmitReport';
import ViewReports from '@/components/ViewReports';
import ReportStatus from '@/components/ReportStatus';

export default function Home() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-title">
            Weekly Leadership Report Tool
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage teams, projects, and weekly progress reports
          </p>
        </div>

        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 gap-2">
            <TabsTrigger value="team" data-testid="tab-team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects" className="gap-2">
              <Edit2 className="h-4 w-4" />
              <span className="hidden sm:inline">Projects</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="submit" data-testid="tab-submit" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Submit</span>
            </TabsTrigger>
            <TabsTrigger value="view" data-testid="tab-view" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">View</span>
            </TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-status" className="gap-2">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Status</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectManagement />
          </TabsContent>

          <TabsContent value="dashboard">
            <ProjectsDashboard />
          </TabsContent>

          <TabsContent value="submit">
            <SubmitReport />
          </TabsContent>

          <TabsContent value="view">
            <ViewReports />
          </TabsContent>

          <TabsContent value="status">
            <ReportStatus />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
