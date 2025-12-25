import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { FileText, Eye, History } from 'lucide-react';
import SectionLayout from '@/components/SectionLayout';
import SubmitReport from '@/components/SubmitReport';
import ViewReports from '@/components/ViewReports';
import HistoricalReports from '@/components/HistoricalReports';

const tabs = [
  { id: 'submit', label: 'Submit Report', icon: FileText },
  { id: 'view', label: 'View Current', icon: Eye },
  { id: 'historical', label: 'Historical', icon: History },
];

export default function ReportsSection() {
  const [location, setLocation] = useLocation();
  
  const getInitialState = () => {
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const tabParam = searchParams.get('tab');
    const healthParam = searchParams.get('health');
    
    let tab = tabParam || 'submit';
    if (healthParam && !tabParam) {
      tab = 'view';
    }
    
    return {
      tab,
      healthFilter: healthParam || null,
    };
  };

  const initialState = getInitialState();
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [healthFilter, setHealthFilter] = useState<string | null>(initialState.healthFilter);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const healthParam = searchParams.get('health');
    if (healthParam) {
      setActiveTab('view');
      setHealthFilter(healthParam);
    }
  }, [location]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setHealthFilter(null);
    const basePath = location.split('?')[0];
    setLocation(`${basePath}?tab=${tabId}`);
  };

  const handleHealthTileClick = (status: string) => {
    setActiveTab('view');
    setHealthFilter(status);
    const basePath = location.split('?')[0];
    setLocation(`${basePath}?tab=view&health=${status}`);
  };

  return (
    <SectionLayout
      title="Reports & Feedback"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      showHealthMetrics={true}
      onHealthTileClick={handleHealthTileClick}
    >
      {activeTab === 'submit' && <SubmitReport />}
      {activeTab === 'view' && (
        <ViewReports 
          externalHealthFilter={healthFilter || undefined} 
          onClearExternalFilter={() => setHealthFilter(null)}
        />
      )}
      {activeTab === 'historical' && <HistoricalReports />}
    </SectionLayout>
  );
}
