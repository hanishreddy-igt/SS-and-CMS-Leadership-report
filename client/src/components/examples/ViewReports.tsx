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

  const weeklyReports = [
    {
      id: '1',
      projectId: '1',
      leadId: '1',
      weekStart: '2025-11-18',
      healthStatus: 'on-track',
      progress: 'Completed the homepage redesign and implemented the new navigation structure.',
      challenges: 'Waiting for client feedback on color scheme.',
      nextWeek: 'Start working on the product pages and contact form.',
      teamMemberFeedback: [
        { memberId: '1', feedback: 'Great work on the UI components!' },
        { memberId: '2', feedback: 'Excellent collaboration this week.' },
      ],
      submittedAt: new Date('2025-11-22'),
    },
    {
      id: '2',
      projectId: '2',
      leadId: '2',
      weekStart: '2025-11-18',
      healthStatus: 'at-risk',
      progress: 'Finished user authentication module and integrated with backend API.',
      challenges: 'Performance issues with data loading on older devices.',
      nextWeek: 'Optimize API calls and implement caching strategy.',
      teamMemberFeedback: null,
      submittedAt: new Date('2025-11-21'),
    },
  ];

  return (
    <ViewReports
      weeklyReports={weeklyReports}
      projectLeads={projectLeads}
      teamMembers={teamMembers}
      projects={projects}
      onEditReport={(id, updates) => console.log('Edit report:', id, updates)}
    />
  );
}
