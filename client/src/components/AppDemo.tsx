import { useState } from 'react';
import { HelpCircle, ChevronLeft, ChevronRight, X, FolderKanban, FileText, Eye, History, Users, UserCog, BarChart3, Download, Archive, Sparkles, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface DemoStep {
  title: string;
  icon: React.ReactNode;
  description: string;
  features: string[];
}

const demoSteps: DemoStep[] = [
  {
    title: "Dashboard Overview",
    icon: <BarChart3 className="h-6 w-6" />,
    description: "The header displays real-time metrics for your portfolio health at a glance.",
    features: [
      "Active Projects count shows all non-ended projects",
      "On Track - Projects with healthy status (green)",
      "Needs Attention - Projects requiring monitoring (amber)",
      "Critical - Projects needing immediate action (red)",
      "Click any tile to filter and view relevant reports"
    ]
  },
  {
    title: "Teams & Projects Tab",
    icon: <FolderKanban className="h-6 w-6" />,
    description: "Manage your entire portfolio of projects, team members, and project leads.",
    features: [
      "Add, edit, and delete projects with customer details",
      "Assign team members with specific roles to each project",
      "Support for co-lead projects (two leads per project)",
      "Filter projects by lead, team member, or project type (CMS/SS)",
      "Search projects by customer name",
      "Sort by end date to see upcoming deadlines",
      "Caution indicators for missing data (no end date or unfilled roles)"
    ]
  },
  {
    title: "Team Members Section",
    icon: <Users className="h-6 w-6" />,
    description: "View and manage all team members assigned to projects.",
    features: [
      "Add new team members with name and email",
      "Click any team member to see their project assignments",
      "Filter team members by their assigned roles",
      "Bulk selection and deletion for cleanup",
      "Email visibility toggle for quick contact"
    ]
  },
  {
    title: "Project Leads Section",
    icon: <UserCog className="h-6 w-6" />,
    description: "Manage project leads who oversee project delivery.",
    features: [
      "Add new project leads with name and email",
      "Click any lead to see all their assigned projects",
      "View project count and status breakdown per lead",
      "Bulk selection and deletion capabilities"
    ]
  },
  {
    title: "Submit Report Tab",
    icon: <FileText className="h-6 w-6" />,
    description: "Project leads submit weekly status reports for their projects.",
    features: [
      "Select project and week for the report",
      "Choose health status: On Track, Needs Attention, or Critical",
      "Document progress, challenges, and next steps",
      "Optional team member feedback section",
      "Save as draft to complete later",
      "View report submission status by project lead"
    ]
  },
  {
    title: "View Current Report Tab",
    icon: <Eye className="h-6 w-6" />,
    description: "Review all submitted reports for the current week.",
    features: [
      "Portfolio health breakdown with counts and percentages",
      "Filter by project lead, team member, or health status",
      "Detailed report cards with progress and challenges",
      "AI-powered insights for strategic analysis",
      "Export to PDF (color-coded landscape format)",
      "Export to CSV for spreadsheet analysis",
      "Archive current week's reports for historical reference"
    ]
  },
  {
    title: "AI Insights",
    icon: <Sparkles className="h-6 w-6" />,
    description: "Get AI-generated strategic analysis of your portfolio.",
    features: [
      "Executive Summary - High-level portfolio overview",
      "Comprehensive Analysis - Deep-dive insights",
      "Key trends and patterns across projects",
      "Risk identification and mitigation suggestions",
      "Team performance observations",
      "Insights are saved with archived reports"
    ]
  },
  {
    title: "Historical Reports Tab",
    icon: <History className="h-6 w-6" />,
    description: "Access archived reports from previous weeks.",
    features: [
      "Calendar navigation to select past weeks",
      "View archived snapshots exactly as they were",
      "See historical AI summaries and insights",
      "Download archived PDFs and CSVs",
      "Track portfolio health trends over time"
    ]
  },
  {
    title: "Caution Indicators",
    icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    description: "Visual warnings help identify projects needing attention.",
    features: [
      "Amber triangle on projects missing end dates",
      "Warning for team members with unfilled role assignments",
      "Hover over indicators for detailed explanations",
      "Helps maintain data quality across the portfolio"
    ]
  },
  {
    title: "Export & Archiving",
    icon: <Download className="h-6 w-6" />,
    description: "Generate professional reports and maintain historical records.",
    features: [
      "PDF exports with color-coded health status",
      "Landscape format for easy reading",
      "Includes AI summaries in exports",
      "CSV exports for data analysis",
      "One-click archiving preserves complete weekly snapshots",
      "Archived reports accessible anytime"
    ]
  }
];

export default function AppDemo() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleOpen = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const step = demoSteps[currentStep];

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handleOpen}
        data-testid="button-app-demo"
        className="shrink-0 glass-card border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-200"
        title="App Tour & Help"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-app-demo">
          <DialogHeader className="pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div>
                  <DialogTitle className="text-xl">{step.title}</DialogTitle>
                  <DialogDescription className="text-sm mt-1">
                    Step {currentStep + 1} of {demoSteps.length}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                Feature Guide
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {step.description}
            </p>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground">Key Features:</h4>
              <ul className="space-y-2">
                {step.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t shrink-0">
            <div className="flex gap-1">
              {demoSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep 
                      ? 'w-6 bg-primary' 
                      : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  data-testid={`demo-step-indicator-${index}`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                data-testid="button-demo-prev"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              {currentStep === demoSteps.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-demo-finish"
                >
                  Got it!
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleNext}
                  data-testid="button-demo-next"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
