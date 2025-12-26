import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { LayoutGrid, UserCheck, FileStack, List } from 'lucide-react';
import SectionLayout from '@/components/SectionLayout';
import WorkingSpace from '@/components/WorkingSpace';
import AssignedTasks from '@/components/AssignedTasks';
import TaskTemplates from '@/components/TaskTemplates';
import { Card, CardContent } from '@/components/ui/card';

const tabs = [
  { id: 'workspace', label: 'Working Space', icon: LayoutGrid },
  { id: 'assigned', label: 'Tasks Assigned to You', icon: UserCheck },
  { id: 'templates', label: 'Task Templates', icon: FileStack },
];

export default function TasksSection() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState(params.tab || 'workspace');

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setLocation(`/tasks/${tabId}`);
  };

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
