import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project, ProjectLead, WeeklyReport } from '@shared/schema';

interface SubmitReportProps {
  projects: Project[];
  projectLeads: ProjectLead[];
  weeklyReports: WeeklyReport[];
  onSubmitReport: (report: Omit<WeeklyReport, 'id' | 'submittedAt'>) => void;
  getCurrentWeekStart: () => string;
}

export default function SubmitReport({
  projects,
  projectLeads,
  weeklyReports,
  onSubmitReport,
  getCurrentWeekStart,
}: SubmitReportProps) {
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [progress, setProgress] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextWeek, setNextWeek] = useState('');

  const currentWeek = getCurrentWeekStart();
  const leadProjects = selectedLead
    ? projects.filter((p) => p.leadId === selectedLead)
    : [];

  const hasSubmittedForProject = (projectId: string) => {
    return weeklyReports.some(
      (r) => r.projectId === projectId && r.weekStart === currentWeek
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && selectedLead && progress && challenges && nextWeek) {
      onSubmitReport({
        projectId: selectedProject,
        leadId: selectedLead,
        weekStart: currentWeek,
        progress,
        challenges,
        nextWeek,
      });
      setSelectedProject('');
      setProgress('');
      setChallenges('');
      setNextWeek('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Submit Weekly Report</CardTitle>
        <p className="text-sm text-muted-foreground">Week starting: {currentWeek}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="lead">Select Project Lead</Label>
            <Select value={selectedLead} onValueChange={setSelectedLead}>
              <SelectTrigger id="lead" data-testid="select-report-lead">
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                {projectLeads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLead && (
            <div className="space-y-2">
              <Label htmlFor="project">Select Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project" data-testid="select-report-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {leadProjects.map((project) => (
                    <SelectItem
                      key={project.id}
                      value={project.id}
                      disabled={hasSubmittedForProject(project.id)}
                    >
                      {project.name}
                      {hasSubmittedForProject(project.id) && ' (Already submitted)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedProject && (
            <>
              <div className="space-y-2">
                <Label htmlFor="progress">Progress This Week</Label>
                <Textarea
                  id="progress"
                  data-testid="textarea-progress"
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                  placeholder="Describe what was accomplished this week..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenges">Challenges & Blockers</Label>
                <Textarea
                  id="challenges"
                  data-testid="textarea-challenges"
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  placeholder="Describe any challenges or blockers..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="next-week">Plans for Next Week</Label>
                <Textarea
                  id="next-week"
                  data-testid="textarea-next-week"
                  value={nextWeek}
                  onChange={(e) => setNextWeek(e.target.value)}
                  placeholder="Outline plans for the upcoming week..."
                  rows={4}
                />
              </div>

              <Button data-testid="button-submit-report" type="submit" className="w-full">
                Submit Report
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
