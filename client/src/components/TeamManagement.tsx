import { useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeamMember, ProjectLead } from '@shared/schema';

interface TeamManagementProps {
  teamMembers: TeamMember[];
  projectLeads: ProjectLead[];
  onAddMember: (name: string) => void;
  onEditMember: (id: string, name: string) => void;
  onDeleteMember: (id: string) => void;
  onAddLead: (name: string) => void;
  onEditLead: (id: string, name: string) => void;
  onDeleteLead: (id: string) => void;
}

export default function TeamManagement({
  teamMembers,
  projectLeads,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onAddLead,
  onEditLead,
  onDeleteLead,
}: TeamManagementProps) {
  const [newMember, setNewMember] = useState('');
  const [newLead, setNewLead] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAddMember = () => {
    if (newMember.trim()) {
      onAddMember(newMember.trim());
      setNewMember('');
    }
  };

  const handleAddLead = () => {
    if (newLead.trim()) {
      onAddLead(newLead.trim());
      setNewLead('');
    }
  };

  const startEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditValue(member.name);
  };

  const startEditLead = (lead: ProjectLead) => {
    setEditingLeadId(lead.id);
    setEditValue(lead.name);
  };

  const saveEditMember = (id: string) => {
    if (editValue.trim()) {
      onEditMember(id, editValue.trim());
      setEditingMemberId(null);
    }
  };

  const saveEditLead = (id: string) => {
    if (editValue.trim()) {
      onEditLead(id, editValue.trim());
      setEditingLeadId(null);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Team Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="input-member-name"
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
              placeholder="Enter team member name"
              className="flex-1"
            />
            <Button
              data-testid="button-add-member"
              onClick={handleAddMember}
            >
              Add Member
            </Button>
          </div>
          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-muted/50 p-3 rounded-md"
              >
                {editingMemberId === member.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      data-testid={`input-edit-member-${member.id}`}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      data-testid={`button-save-member-${member.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => saveEditMember(member.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      data-testid={`button-cancel-member-${member.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingMemberId(null)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span data-testid={`text-member-${member.id}`} className="font-medium">
                      {member.name}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-edit-member-${member.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditMember(member)}
                        className="text-primary hover:text-primary"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`button-delete-member-${member.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeleteMember(member.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Project Leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="input-lead-name"
              type="text"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddLead()}
              placeholder="Enter project lead name"
              className="flex-1"
            />
            <Button
              data-testid="button-add-lead"
              onClick={handleAddLead}
            >
              Add Lead
            </Button>
          </div>
          <div className="space-y-2">
            {projectLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between bg-muted/50 p-3 rounded-md"
              >
                {editingLeadId === lead.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      data-testid={`input-edit-lead-${lead.id}`}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      data-testid={`button-save-lead-${lead.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => saveEditLead(lead.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      data-testid={`button-cancel-lead-${lead.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingLeadId(null)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span data-testid={`text-lead-${lead.id}`} className="font-medium">
                      {lead.name}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-edit-lead-${lead.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditLead(lead)}
                        className="text-primary hover:text-primary"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`button-delete-lead-${lead.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeleteLead(lead.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
