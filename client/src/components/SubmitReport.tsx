import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Project, ProjectLead, WeeklyReport, TeamMember, TeamMemberFeedback } from '@shared/schema';

interface SubmitReportProps {
  projects: Project[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
  weeklyReports: WeeklyReport[];
  onSubmitReport: (report: Omit<WeeklyReport, 'id' | 'submittedAt'>) => void;
  getCurrentWeekStart: () => string;
}

const healthStatusOptions = [
  { value: 'on-track', label: 'On Track', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'at-risk', label: 'At Risk', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'critical', label: 'Critical', icon: AlertCircle, color: 'text-red-600' },
];

export default function SubmitReport({
  projects,
  projectLeads,
  teamMembers,
  weeklyReports,
  onSubmitReport,
  getCurrentWeekStart,
}: SubmitReportProps) {
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [healthStatus, setHealthStatus] = useState('');
  const [progress, setProgress] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextWeek, setNextWeek] = useState('');
  const [memberFeedback, setMemberFeedback] = useState<Record<string, string>>({});

  const currentWeek = getCurrentWeekStart();
  const leadProjects = selectedLead
    ? projects.filter((p) => p.leadId === selectedLead)
    : [];

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const projectTeamMembers = selectedProjectData
    ? teamMembers.filter((m) => selectedProjectData.teamMemberIds.includes(m.id))
    : [];

  const hasSubmittedForProject = (projectId: string) => {
    return weeklyReports.some(
      (r) => r.projectId === projectId && r.weekStart === currentWeek
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && selectedLead && healthStatus && progress && challenges && nextWeek) {
      const feedback: TeamMemberFeedback[] = Object.entries(memberFeedback)
        .filter(([_, feedback]) => feedback.trim())
        .map(([memberId, feedback]) => ({ memberId, feedback }));

      onSubmitReport({
        projectId: selectedProject,
        leadId: selectedLead,
        weekStart: currentWeek,
        healthStatus,
        progress,
        challenges,
        nextWeek,
        teamMemberFeedback: feedback.length > 0 ? feedback : null,
      });
      setSelectedProject('');
      setHealthStatus('');
      setProgress('');
      setChallenges('');
      setNextWeek('');
      setMemberFeedback({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Submit Weekly Report</CardTitle>
        <p className="text-sm text-muted-foreground">Week starting: {currentWeek}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
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
                <Label htmlFor="health-status">Project Health Status</Label>
                <Select value={healthStatus} onValueChange={setHealthStatus}>
                  <SelectTrigger id="health-status" data-testid="select-health-status">
                    <SelectValue placeholder="Select health status" />
                  </SelectTrigger>
                  <SelectContent>
                    {healthStatusOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${option.color}`} />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

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

              {projectTeamMembers.length > 0 && (
                <div className="space-y-3">
                  <Label>Team Member Feedback (Optional)</Label>
                  <div className="space-y-3 border rounded-md p-4">
                    {projectTeamMembers.map((member) => (
                      <div key={member.id} className="space-y-2">
                        <Label htmlFor={`feedback-${member.id}`} className="text-sm font-medium">
                          {member.name}
                        </Label>
                        <Textarea
                          id={`feedback-${member.id}`}
                          data-testid={`textarea-feedback-${member.id}`}
                          value={memberFeedback[member.id] || ''}
                          onChange={(e) =>
                            setMemberFeedback({ ...memberFeedback, [member.id]: e.target.value })
                          }
                          placeholder={`Feedback for ${member.name}...`}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
