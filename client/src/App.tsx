import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Hub from "@/pages/hub";
import Landing from "@/pages/landing";
import AdminPanel from "@/pages/admin";
import FeaturePanel from "@/pages/features";
import DashboardSection from "@/pages/dashboard-section";
import ReportsSection from "@/pages/reports-section";
import TasksSection from "@/pages/tasks-section";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show landing page for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Authenticated routes
  return (
    <Switch>
      <Route path="/" component={Hub} />
      <Route path="/dashboard" component={DashboardSection} />
      <Route path="/reports" component={ReportsSection} />
      <Route path="/tasks" component={TasksSection} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/features" component={FeaturePanel} />
      <Route path="/submit">{() => <Redirect to="/reports?tab=submit" />}</Route>
      <Route path="/view">{() => <Redirect to="/reports?tab=view" />}</Route>
      <Route path="/historical">{() => <Redirect to="/reports?tab=historical" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
