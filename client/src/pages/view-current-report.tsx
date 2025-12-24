import { useState, useEffect } from 'react';
import { useSearch, useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import ViewReports from '@/components/ViewReports';

export default function ViewCurrentReportPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(search);
  const initialHealth = urlParams.get('health') || 'all';
  const initialSummary = urlParams.get('summary') as 'leadership' | 'feedback' | null;
  
  const [healthFilter, setHealthFilter] = useState<string>(initialHealth);
  const [summaryModal, setSummaryModal] = useState<'leadership' | 'feedback' | null>(initialSummary);
  
  useEffect(() => {
    const params = new URLSearchParams(search);
    const health = params.get('health');
    const summary = params.get('summary') as 'leadership' | 'feedback' | null;
    
    if (health && health !== healthFilter) {
      setHealthFilter(health);
    }
    if (summary !== summaryModal) {
      setSummaryModal(summary);
    }
  }, [search]);

  const handleHealthTileClick = (status: string) => {
    setHealthFilter(status);
    setLocation(`/view?health=${status}`);
  };

  const handleClearFilter = () => {
    setHealthFilter('all');
    setLocation('/view');
  };

  const handleOpenSummaryModal = (type: 'leadership' | 'feedback') => {
    setSummaryModal(type);
    const params = new URLSearchParams(search);
    params.set('summary', type);
    const newSearch = params.toString();
    setLocation(`/view?${newSearch}`);
  };

  const handleCloseSummaryModal = () => {
    setSummaryModal(null);
    const params = new URLSearchParams(search);
    params.delete('summary');
    const newSearch = params.toString();
    setLocation(`/view${newSearch ? `?${newSearch}` : ''}`);
  };

  return (
    <DashboardLayout 
      onHealthTileClick={handleHealthTileClick}
    >
      <ViewReports 
        externalHealthFilter={healthFilter} 
        onClearExternalFilter={handleClearFilter}
        openSummaryModal={summaryModal}
        onOpenSummaryModal={handleOpenSummaryModal}
        onCloseSummaryModal={handleCloseSummaryModal}
      />
    </DashboardLayout>
  );
}
