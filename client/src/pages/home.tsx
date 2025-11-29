import { FileText, FolderKanban, Eye, LogOut } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import SubmitReport from '@/components/SubmitReport';
import ViewReports from '@/components/ViewReports';

export default function Home() {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-title">
              Community Managed services & Strategic services Leadership Report
            </h1>
            <p className="text-muted-foreground mt-1">
              A tool for the leadership to help understand the status of all CMS and SS account delivery status
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout" className="shrink-0">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="teams-projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-2">
            <TabsTrigger value="teams-projects" data-testid="tab-teams-projects" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Teams & Projects</span>
            </TabsTrigger>
            <TabsTrigger value="submit" data-testid="tab-submit" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Submit Report</span>
            </TabsTrigger>
            <TabsTrigger value="view" data-testid="tab-view" className="gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">View Reports</span>
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
        </Tabs>
      </div>
    </div>
  );
}
