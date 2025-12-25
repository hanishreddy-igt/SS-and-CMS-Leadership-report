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
    const leadParam = searchParams.get('lead');
    const summaryParam = searchParams.get('summary');
    
    let tab = params.tab || 'submit';
    if ((healthParam || summaryParam) && !params.tab) {
      tab = 'view';
    }
    
    return {
      tab,
      healthFilter: healthParam || null,
      leadFilter: leadParam || null,
      summaryFilter: summaryParam || null,
    };
  };

  const initialState = getInitialState();
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [healthFilter, setHealthFilter] = useState<string | null>(initialState.healthFilter);
  const [leadFilter, setLeadFilter] = useState<string | null>(initialState.leadFilter);
  const [summaryFilter, setSummaryFilter] = useState<string | null>(initialState.summaryFilter);

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const healthParam = searchParams.get('health');
    const leadParam = searchParams.get('lead');
    const summaryParam = searchParams.get('summary');
    
    if (healthParam) {
      setActiveTab('view');
      setHealthFilter(healthParam);
    }
    if (summaryParam) {
      setActiveTab('view');
      setSummaryFilter(summaryParam);
    }
    if (leadParam) {
      setLeadFilter(leadParam);
    }
  }, [location, params.tab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setHealthFilter(null);
    setLeadFilter(null);
    setSummaryFilter(null);
    setLocation(`/reports/${tabId}`);
  };

  const handleLeadFilterChange = (leadName: string | null) => {
    setLeadFilter(leadName);
    if (leadName) {
      setLocation(`/reports/submit?lead=${encodeURIComponent(leadName)}`);
    } else {
      setLocation('/reports/submit');
    }
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
      {activeTab === 'submit' && (
        <SubmitReport 
          initialLeadFilter={leadFilter}
          onLeadFilterChange={handleLeadFilterChange}
        />
      )}
      {activeTab === 'view' && (
        <ViewReports 
          externalHealthFilter={healthFilter || undefined} 
          onClearExternalFilter={() => setHealthFilter(null)}
          initialSummaryView={summaryFilter as 'leadership' | 'feedback' | null}
        />
      )}
      {activeTab === 'historical' && <HistoricalReports />}
    </SectionLayout>
  );
}
