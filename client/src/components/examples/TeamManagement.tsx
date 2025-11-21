import TeamManagement from '../TeamManagement';

export default function TeamManagementExample() {
  const teamMembers = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Williams' },
  ];

  const projectLeads = [
    { id: '1', name: 'David Brown' },
    { id: '2', name: 'Emma Davis' },
  ];

  return (
    <TeamManagement
      teamMembers={teamMembers}
      projectLeads={projectLeads}
      onAddMember={(name) => console.log('Add member:', name)}
      onEditMember={(id, name) => console.log('Edit member:', id, name)}
      onDeleteMember={(id) => console.log('Delete member:', id)}
      onAddLead={(name) => console.log('Add lead:', name)}
      onEditLead={(id, name) => console.log('Edit lead:', id, name)}
      onDeleteLead={(id) => console.log('Delete lead:', id)}
    />
  );
}
