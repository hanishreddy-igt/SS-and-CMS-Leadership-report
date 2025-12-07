import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, ChevronLeft, ChevronRight, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  action?: 'scroll' | 'click' | 'highlight' | 'tab-change';
  tabValue?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  delay?: number;
}

const inputTourSteps: TourStep[] = [
  // Project Leads Section
  {
    id: 'intro-leads',
    title: 'Project Leads Section',
    description: 'This section shows all your Project Leads - the people who oversee project delivery and submit weekly reports. Each lead can manage one or multiple projects.',
    targetSelector: '[data-testid="section-project-leads"]',
    action: 'scroll',
    position: 'top'
  },
  {
    id: 'lead-click',
    title: 'View Lead Details',
    description: 'Click on any project lead\'s name to see a popup with their details - including their email and all the projects they manage. Try clicking on a lead name!',
    targetSelector: '[data-testid^="lead-item-"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'add-lead',
    title: 'Add New Project Lead',
    description: 'Click "Add Project Lead" to add a new lead. You\'ll need to enter their name and email address. The email is used for contact purposes.',
    targetSelector: '[data-testid="button-add-lead"]',
    action: 'highlight',
    position: 'bottom'
  },
  // Team Members Section
  {
    id: 'intro-members',
    title: 'Team Members Section',
    description: 'This section displays all team members who work on projects. Team members are assigned to specific projects with designated roles (e.g., Developer, QA, Designer).',
    targetSelector: '[data-testid="section-team-members"]',
    action: 'scroll',
    position: 'top'
  },
  {
    id: 'member-click',
    title: 'View Member Details',
    description: 'Click on any team member\'s name to see their project assignments and roles. The popup shows all active/renewal projects they\'re working on with their specific role highlighted.',
    targetSelector: '[data-testid^="member-item-"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'member-filter',
    title: 'Filter by Role',
    description: 'Use the "Filter by Role" button to filter team members by their assigned roles. This helps you quickly find all developers, QA engineers, or other specific roles across projects.',
    targetSelector: '[data-testid="button-filter-member-role"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'add-member',
    title: 'Add New Team Member',
    description: 'Click "Add Team Member" to add someone new. Enter their name and email. Once added, they can be assigned to projects with specific roles.',
    targetSelector: '[data-testid="button-add-member"]',
    action: 'highlight',
    position: 'bottom'
  },
  // All Projects Section
  {
    id: 'intro-projects',
    title: 'All Projects Section',
    description: 'This is your complete project portfolio. Projects are sorted by end date (soonest first) to help you focus on upcoming deadlines. Projects with no end date appear at the bottom.',
    targetSelector: '#all-projects-section',
    action: 'scroll',
    position: 'top'
  },
  {
    id: 'project-card',
    title: 'Project Cards',
    description: 'Each card shows the project customer name, project type (CMS/SS), assigned lead(s), and end date. The colored indicator on the left shows status: Green (active), Amber (ending within 60 days), Gray (ended). Click any card to see full details.',
    targetSelector: '[data-testid^="project-card-"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'project-filters',
    title: 'Project Filters',
    description: 'Use these filters to narrow down projects: Filter by Project Lead to see a specific lead\'s projects, by Team Member to find projects someone works on, and by Project Type (CMS or SS) for service type filtering.',
    targetSelector: '[data-testid="button-filter-lead"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'add-project',
    title: 'Add New Project',
    description: 'Click "Add New Project" to create a project. Let me explain each field...',
    targetSelector: '[data-testid="button-add-project"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'project-fields',
    title: 'Project Form Fields',
    description: `When adding a project, you'll fill in these fields:

• **Project Customer** - The customer/client name for this project
• **Contact Person Name** - The customer's contact person
• **Project Lead(s)** - Select 1 or 2 leads. If you select 2, they become "co-leads" sharing responsibility. The first selected is the primary lead.
• **Team Members & Roles** - Assign team members and specify each person's role (e.g., "Developer", "QA Lead"). Leave role blank if TBD - this will show a caution warning.
• **Project Type** - Choose CMS (Community Managed) or SS (Strategic Services)
• **Start Date & End Date** - Project timeline. Projects without an end date show a caution indicator.`,
    position: 'center'
  },
  // Submit Report Tab
  {
    id: 'submit-tab',
    title: 'Submit Report Tab',
    description: 'Now let\'s go to the Submit Report tab where project leads submit their weekly status updates.',
    action: 'tab-change',
    tabValue: 'submit',
    position: 'center'
  },
  {
    id: 'progress-bars',
    title: 'Progress Overview',
    description: 'At the top, you see two progress bars showing submission status for the current week. The first shows how many reports are submitted vs pending. Click on these bars to automatically filter and see which projects still need reports!',
    targetSelector: '[data-testid="progress-submitted"]',
    action: 'highlight',
    position: 'bottom'
  },
  {
    id: 'weekly-report-section',
    title: 'Submit Weekly Report Form',
    description: 'This is where project leads submit their weekly status. Select the project and reporting week, then fill in the health status, progress updates, challenges, and next steps.',
    targetSelector: '[data-testid="card-submit-report"]',
    action: 'scroll',
    position: 'top'
  },
  {
    id: 'auto-archive',
    title: 'Auto-Archiving',
    description: 'Reports are automatically archived at the end of each week. When a new week starts, the previous week\'s reports move to Historical Reports, and the current week starts fresh.',
    position: 'center'
  },
  {
    id: 'report-status',
    title: 'Report Status by Lead',
    description: 'Below the form, you can see report status organized by project lead. Find your name (or any lead) and click on their entry to see all their projects and submission status.',
    targetSelector: '[data-testid="section-report-status"]',
    action: 'scroll',
    position: 'top'
  },
  {
    id: 'lead-report-popup',
    title: 'Lead Report Details',
    description: 'When you click on a lead\'s name, a popup shows all their assigned projects with submission status. From here, you can quickly see which reports are pending and click to submit them directly.',
    position: 'center'
  },
  {
    id: 'report-fields',
    title: 'Report Form Fields',
    description: `Each report includes:

• **Health Status** - On Track (green), Needs Attention (amber), or Critical (red)
• **Progress This Week** - What was accomplished
• **Current Challenges** - Issues or blockers
• **Next Steps** - Plans for the upcoming week
• **Team Member Feedback** (optional) - Individual feedback for team members

You have two submission options:
• **Save as Draft** - Save your work and come back later
• **Submit Report** - Finalize and submit the report`,
    position: 'center'
  },
  {
    id: 'report-filters',
    title: 'Filtering Reports',
    description: 'Use the Filter button to find specific leads or filter by status. You can filter by lead name or see only pending/submitted/drafted reports. These filters help you quickly find what you need.',
    targetSelector: '[data-testid="button-status-filter"]',
    action: 'highlight',
    position: 'bottom'
  },
  // View Current Report Tab
  {
    id: 'view-tab',
    title: 'View Current Report Tab',
    description: 'Finally, let\'s check the View Current Report tab.',
    action: 'tab-change',
    tabValue: 'view',
    position: 'center'
  },
  {
    id: 'view-reports',
    title: 'View Submitted Reports',
    description: 'This tab shows all submitted weekly reports for the current period. After submitting your report in the Submit tab, come here to verify it appears correctly. You\'ll see your report with the health status, progress, and other details you entered.',
    position: 'center'
  },
  {
    id: 'input-complete',
    title: 'Input Workflow Complete!',
    description: 'You now know how to:\n\n✓ Manage Project Leads and Team Members\n✓ Create and configure Projects with roles\n✓ Submit Weekly Reports with health status\n✓ Use filters to find what you need\n✓ Verify your submissions in View Reports\n\nThe Review workflow (coming soon) will show you how to analyze reports, generate AI insights, and export data.',
    position: 'center'
  }
];

interface AppDemoProps {
  onTabChange?: (tab: string) => void;
}

export default function AppDemo({ onTabChange }: AppDemoProps) {
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const steps = inputTourSteps;
  const step = steps[currentStep];

  const scrollToElement = useCallback((selector: string) => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return element;
    }
    return null;
  }, []);

  const highlightElement = useCallback((selector: string) => {
    const element = document.querySelector(selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
      
      setHighlightStyle({
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        border: '3px solid hsl(var(--primary))',
        borderRadius: '12px',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5), 0 0 20px hsl(var(--primary))',
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'all 0.3s ease'
      });

      // Position tooltip
      const tooltipTop = rect.bottom + 16;
      const tooltipLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 420));
      
      setTooltipStyle({
        position: 'fixed',
        top: tooltipTop > window.innerHeight - 300 ? rect.top - 200 : tooltipTop,
        left: tooltipLeft,
        zIndex: 9999,
        maxWidth: '400px'
      });

      return true;
    }
    return false;
  }, []);

  const executeStep = useCallback(async () => {
    if (!step) return;

    // Handle tab changes
    if (step.action === 'tab-change' && step.tabValue && onTabChange) {
      onTabChange(step.tabValue);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Handle scroll action
    if (step.action === 'scroll' && step.targetSelector) {
      scrollToElement(step.targetSelector);
      await new Promise(resolve => setTimeout(resolve, 500));
      if (step.targetSelector) {
        highlightElement(step.targetSelector);
      }
    }

    // Handle highlight action
    if (step.action === 'highlight' && step.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        highlightElement(step.targetSelector);
      }
    }

    // No target - center position (info only)
    if (!step.targetSelector || step.position === 'center') {
      setHighlightStyle({});
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        maxWidth: '500px'
      });
    }
  }, [step, onTabChange, scrollToElement, highlightElement]);

  useEffect(() => {
    if (isTouring && step) {
      executeStep();
    }
  }, [isTouring, currentStep, executeStep, step]);

  const startTour = (mode: 'input' | 'review') => {
    setShowModeSelect(false);
    setCurrentStep(0);
    setIsTouring(true);
    // Navigate to Teams & Projects tab first
    if (onTabChange) {
      onTabChange('teams-projects');
    }
  };

  const endTour = () => {
    setIsTouring(false);
    setCurrentStep(0);
    setHighlightStyle({});
    setTooltipStyle({});
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowModeSelect(true)}
        data-testid="button-app-demo"
        className="shrink-0 glass-card border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-200"
        title="App Tour & Help"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {/* Mode Selection Dialog */}
      <Dialog open={showModeSelect} onOpenChange={setShowModeSelect}>
        <DialogContent className="max-w-md" data-testid="dialog-demo-mode-select">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              App Guided Tour
            </DialogTitle>
            <DialogDescription>
              Choose a workflow to learn about the application features.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Card 
              className="cursor-pointer hover-elevate transition-all border-2 hover:border-primary"
              onClick={() => startTour('input')}
              data-testid="button-tour-input"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Input Workflow</h3>
                    <p className="text-sm text-muted-foreground">
                      Learn how to add leads, team members, projects, and submit weekly reports.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-not-allowed opacity-50 border-2"
              data-testid="button-tour-review"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Play className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground">Review Workflow</h3>
                    <p className="text-sm text-muted-foreground">
                      Coming soon: Learn how to review reports, use AI insights, and export data.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tour Overlay */}
      {isTouring && (
        <>
          {/* Highlight box */}
          {highlightStyle.width && (
            <div style={highlightStyle} data-testid="tour-highlight" />
          )}

          {/* Tooltip */}
          <div style={tooltipStyle} data-testid="tour-tooltip">
            <Card className="shadow-2xl border-2 border-primary/50 bg-background/95 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-lg">{step?.title}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={endTour}
                    data-testid="button-tour-close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground whitespace-pre-line mb-4">
                  {step?.description}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      data-testid="button-tour-prev"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={nextStep}
                      data-testid="button-tour-next"
                    >
                      {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                      {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
