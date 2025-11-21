import ProjectsDashboard from '../ProjectsDashboard';

export default function ProjectsDashboardExample() {
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

  return (
    <ProjectsDashboard
      projects={projects}
      projectLeads={projectLeads}
      teamMembers={teamMembers}
    />
  );
}
