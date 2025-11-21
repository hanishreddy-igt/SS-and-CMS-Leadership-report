import ViewReports from '../ViewReports';

export default function ViewReportsExample() {
  const projectLeads = [
    { id: '1', name: 'David Brown' },
    { id: '2', name: 'Emma Davis' },
  ];

  const teamMembers = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
  ];

  const weeklyReports = [
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
    {
      id: '2',
      projectId: '2',
      leadId: '2',
      weekStart: '2025-11-18',
      progress: 'Finished user authentication module and integrated with backend API.',
      challenges: 'Performance issues with data loading on older devices.',
      nextWeek: 'Optimize API calls and implement caching strategy.',
      submittedAt: new Date('2025-11-21'),
    },
  ];

  return (
    <ViewReports
      weeklyReports={weeklyReports}
      projectLeads={projectLeads}
      teamMembers={teamMembers}
      onEditReport={(id, updates) => console.log('Edit report:', id, updates)}
    />
  );
}
