import { useState, useEffect } from 'react';
import { useSearch, useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import ViewReports from '@/components/ViewReports';

export default function ViewCurrentReportPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(search);
  const initialHealth = urlParams.get('health') || 'all';
  
  const [healthFilter, setHealthFilter] = useState<string>(initialHealth);
  
  useEffect(() => {
    const params = new URLSearchParams(search);
    const health = params.get('health');
    if (health && health !== healthFilter) {
      setHealthFilter(health);
    }
  }, [search]);

  const handleHealthTileClick = (status: string) => {
    setHealthFilter(status);
    setLocation(`/view-current-report?health=${status}`);
  };

  const handleClearFilter = () => {
    setHealthFilter('all');
    setLocation('/view-current-report');
  };

  return (
    <DashboardLayout 
      onHealthTileClick={handleHealthTileClick}
    >
      <ViewReports 
        externalHealthFilter={healthFilter} 
        onClearExternalFilter={handleClearFilter} 
      />
    </DashboardLayout>
  );
}
