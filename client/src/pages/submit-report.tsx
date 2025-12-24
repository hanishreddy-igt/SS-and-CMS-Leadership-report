import { useLocation, useSearch } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import SubmitReport from '@/components/SubmitReport';

export default function SubmitReportPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const leadParam = params.get('lead');

  const handleLeadFilterChange = (leadName: string | null) => {
    const newParams = new URLSearchParams(searchString);
    if (leadName) {
      newParams.set('lead', leadName);
    } else {
      newParams.delete('lead');
    }
    const newSearch = newParams.toString();
    setLocation(newSearch ? `/submit?${newSearch}` : '/submit', { replace: true });
  };

  return (
    <DashboardLayout>
      <SubmitReport 
        initialLeadFilter={leadParam}
        onLeadFilterChange={handleLeadFilterChange}
      />
    </DashboardLayout>
  );
}
