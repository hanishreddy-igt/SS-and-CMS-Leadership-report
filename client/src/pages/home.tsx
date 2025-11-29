import { FileText, UserCheck, FolderKanban } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

        <Tabs defaultValue="teams-projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2">
            <TabsTrigger value="teams-projects" data-testid="tab-teams-projects" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Teams & Projects</span>
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

          <TabsContent value="teams-projects">
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
