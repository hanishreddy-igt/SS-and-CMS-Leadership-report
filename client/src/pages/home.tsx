import DashboardLayout from '@/components/DashboardLayout';
import ProjectsDashboard from '@/components/ProjectsDashboard';

export default function Home() {
  return (
    <DashboardLayout>
      <ProjectsDashboard />
    </DashboardLayout>
  );
}
