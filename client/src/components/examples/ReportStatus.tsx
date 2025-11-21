import ReportStatus from '../ReportStatus';

export default function ReportStatusExample() {
  const projectLeads = [
    { id: '1', name: 'David Brown' },
    { id: '2', name: 'Emma Davis' },
  ];

  const projects = [
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
    {
      id: '3',
      name: 'API Integration',
      customer: 'Global Solutions',
      leadId: '1',
      teamMemberIds: ['1', '3'],
      startDate: '2025-01-15',
      endDate: '2025-04-15',
    },
  ];

  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const weeklyReports = [
    {
      id: '1',
      projectId: '1',
      leadId: '1',
      weekStart: getCurrentWeekStart(),
      healthStatus: 'on-track',
      progress: 'Completed homepage',
      challenges: 'None',
      nextWeek: 'Start product pages',
      teamMemberFeedback: null,
      submittedAt: new Date(),
    },
  ];

  return (
    <ReportStatus
      projects={projects}
      weeklyReports={weeklyReports}
      projectLeads={projectLeads}
      getCurrentWeekStart={getCurrentWeekStart}
    />
  );
}
