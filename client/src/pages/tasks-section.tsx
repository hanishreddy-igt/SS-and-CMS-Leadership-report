import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { List, User, FileStack } from 'lucide-react';
import SectionLayout from '@/components/SectionLayout';
import { Card, CardContent } from '@/components/ui/card';

const tabs = [
  { id: 'all', label: 'All Tasks', icon: List },
  { id: 'my', label: 'My Tasks', icon: User },
  { id: 'templates', label: 'Task Templates', icon: FileStack },
];

function PlaceholderContent({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <List className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function TasksSection() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState(params.tab || 'all');

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
      {activeTab === 'all' && (
        <PlaceholderContent
          title="All Tasks"
          description="View and manage all tasks across projects. This feature is coming soon in Phase 3."
        />
      )}
      {activeTab === 'my' && (
        <PlaceholderContent
          title="My Tasks"
          description="View tasks assigned to you. This feature is coming soon in Phase 6."
        />
      )}
      {activeTab === 'templates' && (
        <PlaceholderContent
          title="Task Templates"
          description="Create and manage recurring task templates with EOS formats. This feature is coming soon in Phase 7."
        />
      )}
    </SectionLayout>
  );
}
