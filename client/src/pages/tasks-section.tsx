import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { LayoutGrid, UserCheck, FileStack, ShieldAlert } from 'lucide-react';
import SectionLayout from '@/components/SectionLayout';
import WorkingSpace from '@/components/WorkingSpace';
import AssignedTasks from '@/components/AssignedTasks';
import TaskTemplates from '@/components/TaskTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';

const tabs = [
  { id: 'workspace', label: 'Working Space', icon: LayoutGrid },
  { id: 'assigned', label: 'Tasks Assigned to You', icon: UserCheck },
  { id: 'templates', label: 'Task Templates', icon: FileStack },
];

export default function TasksSection() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState(params.tab || 'workspace');
  const { canManageTasks, role } = usePermissions();

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setLocation(`/tasks/${tabId}`);
  };

  if (!canManageTasks) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              The Work Management section is only available to administrators and managers.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Your current role: <span className="font-medium capitalize">{role}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SectionLayout
      title="Work Management"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {activeTab === 'workspace' && <WorkingSpace />}
      {activeTab === 'assigned' && <AssignedTasks />}
      {activeTab === 'templates' && <TaskTemplates />}
    </SectionLayout>
  );
}
