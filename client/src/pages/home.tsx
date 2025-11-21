import { useState } from 'react';
import { Users, FileText, Edit2, UserCheck, LayoutDashboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';
import ProjectManagement from '@/components/ProjectManagement';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import SubmitReport from '@/components/SubmitReport';
import ViewReports from '@/components/ViewReports';
import ReportStatus from '@/components/ReportStatus';
import type { TeamMember, ProjectLead, Project, WeeklyReport } from '@shared/schema';

export default function Home() {
  const { toast } = useToast();

  //todo: remove mock functionality
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Williams' },
  ]);

  //todo: remove mock functionality
  const [projectLeads, setProjectLeads] = useState<ProjectLead[]>([
    { id: '1', name: 'David Brown' },
    { id: '2', name: 'Emma Davis' },
  ]);

  //todo: remove mock functionality
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign',
      customer: 'Acme Corp',
      leadId: '1',
      teamMemberIds: ['1', '2'],
      startDate: '2025-01-01',
      endDate: '2025-03-31',
    },
    {
      id: '2',
      name: 'Mobile App Development',
      customer: 'TechStart Inc',
      leadId: '2',
      teamMemberIds: ['2', '3'],
      startDate: '2025-02-01',
      endDate: '2025-06-30',
    },
  ]);

  //todo: remove mock functionality
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([
    {
      id: '1',
      projectId: '1',
      leadId: '1',
      weekStart: '2025-11-18',
      progress: 'Completed the homepage redesign and implemented the new navigation structure.',
      challenges: 'Waiting for client feedback on color scheme.',
      nextWeek: 'Start working on the product pages and contact form.',
      submittedAt: new Date('2025-11-22'),
    },
  ]);

  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const handleAddMember = (name: string) => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name,
    };
    setTeamMembers([...teamMembers, newMember]);
    toast({ title: 'Success', description: 'Team member added' });
  };

  const handleEditMember = (id: string, name: string) => {
    setTeamMembers(teamMembers.map((m) => (m.id === id ? { ...m, name } : m)));
    toast({ title: 'Success', description: 'Team member updated' });
  };

  const handleDeleteMember = (id: string) => {
    setTeamMembers(teamMembers.filter((m) => m.id !== id));
    toast({ title: 'Success', description: 'Team member deleted' });
  };

  const handleAddLead = (name: string) => {
    const newLead: ProjectLead = {
      id: Date.now().toString(),
      name,
    };
    setProjectLeads([...projectLeads, newLead]);
    toast({ title: 'Success', description: 'Project lead added' });
  };

  const handleEditLead = (id: string, name: string) => {
    setProjectLeads(projectLeads.map((l) => (l.id === id ? { ...l, name } : l)));
    toast({ title: 'Success', description: 'Project lead updated' });
  };

  const handleDeleteLead = (id: string) => {
    setProjectLeads(projectLeads.filter((l) => l.id !== id));
    toast({ title: 'Success', description: 'Project lead deleted' });
  };

  const handleAddProject = (project: Omit<Project, 'id'>) => {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
    };
    setProjects([...projects, newProject]);
    toast({ title: 'Success', description: 'Project added' });
  };

  const handleSubmitReport = (report: Omit<WeeklyReport, 'id' | 'submittedAt'>) => {
    const newReport: WeeklyReport = {
      ...report,
      id: Date.now().toString(),
      submittedAt: new Date(),
    };
    setWeeklyReports([...weeklyReports, newReport]);
    toast({ title: 'Success', description: 'Weekly report submitted' });
  };

  const handleEditReport = (id: string, updates: Partial<WeeklyReport>) => {
    setWeeklyReports(
      weeklyReports.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    toast({ title: 'Success', description: 'Report updated' });
  };

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
            <TeamManagement
              teamMembers={teamMembers}
              projectLeads={projectLeads}
              onAddMember={handleAddMember}
              onEditMember={handleEditMember}
              onDeleteMember={handleDeleteMember}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
              onDeleteLead={handleDeleteLead}
            />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectManagement
              projects={projects}
              projectLeads={projectLeads}
              teamMembers={teamMembers}
              onAddProject={handleAddProject}
            />
          </TabsContent>

          <TabsContent value="dashboard">
            <ProjectsDashboard
              projects={projects}
              projectLeads={projectLeads}
              teamMembers={teamMembers}
            />
          </TabsContent>

          <TabsContent value="submit">
            <SubmitReport
              projects={projects}
              projectLeads={projectLeads}
              weeklyReports={weeklyReports}
              onSubmitReport={handleSubmitReport}
              getCurrentWeekStart={getCurrentWeekStart}
            />
          </TabsContent>

          <TabsContent value="view">
            <ViewReports
              weeklyReports={weeklyReports}
              projectLeads={projectLeads}
              teamMembers={teamMembers}
              onEditReport={handleEditReport}
            />
          </TabsContent>

          <TabsContent value="status">
            <ReportStatus
              projects={projects}
              weeklyReports={weeklyReports}
              projectLeads={projectLeads}
              getCurrentWeekStart={getCurrentWeekStart}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
