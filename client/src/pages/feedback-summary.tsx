import DashboardLayout from '@/components/DashboardLayout';
import FeedbackSummary from '@/components/FeedbackSummary';
import { usePermissions } from '@/hooks/usePermissions';
import { ShieldX } from 'lucide-react';

export default function FeedbackSummaryPage() {
  const permissions = usePermissions();
  
  if (!permissions.canViewTeamFeedbackSummary) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground max-w-md">
            The Team Feedback Summary is only available to managers and administrators. 
            Please contact your manager if you need access to this information.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <FeedbackSummary />
    </DashboardLayout>
  );
}
