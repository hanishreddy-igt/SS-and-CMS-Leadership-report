import SubmitReport from '../SubmitReport';

export default function SubmitReportExample() {
  const projectLeads = [
    { id: '1', name: 'David Brown' },
    { id: '2', name: 'Emma Davis' },
  ];

  const teamMembers = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Williams' },
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
  ];

  const weeklyReports: any[] = [];

  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  return (
    <SubmitReport
      projects={projects}
      projectLeads={projectLeads}
      teamMembers={teamMembers}
      weeklyReports={weeklyReports}
      onSubmitReport={(report) => console.log('Submit report:', report)}
      getCurrentWeekStart={getCurrentWeekStart}
    />
  );
}
