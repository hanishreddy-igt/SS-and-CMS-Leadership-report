import ProjectManagement from '../ProjectManagement';

export default function ProjectManagementExample() {
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

  return (
    <ProjectManagement
      projects={projects}
      projectLeads={projectLeads}
      teamMembers={teamMembers}
      onAddProject={(project) => console.log('Add project:', project)}
    />
  );
}
