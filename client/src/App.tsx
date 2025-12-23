import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import AdminPanel from "@/pages/admin";
import FeaturePanel from "@/pages/features";
import SubmitReportPage from "@/pages/submit-report";
import ViewCurrentReportPage from "@/pages/view-current-report";
import HistoricalReportPage from "@/pages/historical-report";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/submit-report" component={SubmitReportPage} />
          <Route path="/view-current-report" component={ViewCurrentReportPage} />
          <Route path="/historical-report" component={HistoricalReportPage} />
          <Route path="/admin" component={AdminPanel} />
          <Route path="/features" component={FeaturePanel} />
        </>
      )}
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
