import { useState } from 'react';
import { useLocation } from 'wouter';
import { Briefcase, Users } from 'lucide-react';
import SectionLayout from '@/components/SectionLayout';
import ProjectsDashboard from '@/components/ProjectsDashboard';

const tabs = [
  { id: 'contracts', label: 'Contracts', icon: Briefcase },
  { id: 'team', label: 'Team', icon: Users },
];

export default function DashboardSection() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const initialTab = searchParams.get('tab') || 'contracts';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <SectionLayout
      title="Dashboard"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <ProjectsDashboard />
    </SectionLayout>
  );
}
