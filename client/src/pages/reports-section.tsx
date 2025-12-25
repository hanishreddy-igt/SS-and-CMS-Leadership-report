import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
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
  const params = useParams<{ tab?: string }>();
  
  const getInitialState = () => {
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const healthParam = searchParams.get('health');
    
    let tab = params.tab || 'submit';
    if (healthParam && !params.tab) {
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
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const healthParam = searchParams.get('health');
    if (healthParam) {
      setActiveTab('view');
      setHealthFilter(healthParam);
    }
  }, [location, params.tab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setHealthFilter(null);
    setLocation(`/reports/${tabId}`);
  };

  const handleHealthTileClick = (status: string) => {
    setActiveTab('view');
    setHealthFilter(status);
    setLocation(`/reports/view?health=${status}`);
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
