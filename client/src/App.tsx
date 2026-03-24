import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import Hub from "@/pages/hub";
import Landing from "@/pages/landing";
import AdminPanel from "@/pages/admin";
import FeaturePanel from "@/pages/features";
import DashboardSection from "@/pages/dashboard-section";
import ReportsSection from "@/pages/reports-section";
import TasksSection from "@/pages/tasks-section";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";
import AiChatPanel from "@/components/AiChatPanel";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Hub} />
      <Route path="/dashboard/:tab" component={DashboardSection} />
      <Route path="/dashboard">{() => <Redirect to="/dashboard/contracts" />}</Route>
      <Route path="/reports/:tab" component={ReportsSection} />
      <Route path="/reports">{() => <Redirect to="/reports/submit" />}</Route>
      <Route path="/tasks/:tab" component={TasksSection} />
      <Route path="/tasks">{() => <Redirect to="/tasks/workspace" />}</Route>
      <Route path="/admin" component={AdminPanel} />
      <Route path="/features" component={FeaturePanel} />
      <Route path="/submit">{() => <Redirect to="/reports/submit" />}</Route>
      <Route path="/view">{() => <Redirect to="/reports/view" />}</Route>
      <Route path="/historical">{() => <Redirect to="/reports/historical" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedExtras() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <AiChatPanel />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <AuthenticatedExtras />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
