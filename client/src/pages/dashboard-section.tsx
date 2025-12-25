import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Briefcase, Users } from 'lucide-react';
import SectionLayout from '@/components/SectionLayout';
import ProjectsDashboard from '@/components/ProjectsDashboard';

const tabs = [
  { id: 'contracts', label: 'Contracts', icon: Briefcase },
  { id: 'team', label: 'Team', icon: Users },
];

export default function DashboardSection() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState(params.tab || 'contracts');

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setLocation(`/dashboard/${tabId}`);
  };

  return (
    <SectionLayout
      title="Dashboard"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <ProjectsDashboard activeTab={activeTab as 'contracts' | 'team'} />
    </SectionLayout>
  );
}
