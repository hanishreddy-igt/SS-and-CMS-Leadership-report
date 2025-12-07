import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, ChevronRight, X, Play, MousePointer, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StepType = 'info' | 'click-action' | 'wait-for-close' | 'tab-change';

interface TourStep {
  id: string;
  type: StepType;
  title: string;
  description: string;
  targetSelector?: string;
  clickSelector?: string;
  tabValue?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const inputTourSteps: TourStep[] = [
  // PROJECT LEADS SECTION
  {
    id: 'intro-leads',
    type: 'info',
    title: 'Project Leads Section',
    description: 'This section shows all your **Project Leads** - the people who oversee project delivery and submit weekly reports. Each lead can manage one or multiple projects.\n\nClick **Next** to continue.',
    targetSelector: '[data-testid="section-project-leads"]',
    position: 'top'
  },
  {
    id: 'click-lead',
    type: 'click-action',
    title: 'Click on a Project Lead',
    description: 'Now **click on any project lead\'s name** in the list to see their details popup.\n\nThe popup will show their email and all projects they manage.',
    targetSelector: '[data-testid^="lead-item-"]',
    clickSelector: '[data-testid^="lead-item-"]',
    position: 'bottom'
  },
  {
    id: 'lead-popup-explain',
    type: 'wait-for-close',
    title: 'Project Lead Details',
    description: `You're viewing the lead's detail popup. Here you can see:

• **Email** - Click the mail icon to reveal their email address
• **Projects Managed** - All projects this lead oversees
• **Project Status** - Color indicators show project timeline status

When you're done exploring, **click the X button or outside the popup** to close it and continue.`,
    position: 'center'
  },
  {
    id: 'click-add-lead',
    type: 'click-action',
    title: 'Add New Project Lead',
    description: 'Now let\'s see how to add a new lead.\n\n**Click the "Add Project Lead" button** to open the form.',
    targetSelector: '[data-testid="button-add-lead"]',
    clickSelector: '[data-testid="button-add-lead"]',
    position: 'bottom'
  },
  {
    id: 'add-lead-form',
    type: 'wait-for-close',
    title: 'Add Project Lead Form',
    description: `This form lets you add a new project lead:

• **Project Lead Name** - Enter the person's full name (required)
• **Email** - Their email address for contact purposes (optional but recommended)

After filling in the details, click "Add Project Lead" to save, or Cancel to close.

**Close this dialog** to continue the tour.`,
    position: 'center'
  },
  // TEAM MEMBERS SECTION
  {
    id: 'intro-members',
    type: 'info',
    title: 'Team Members Section',
    description: 'Now let\'s look at the **Team Members** section. These are the people who work on projects with specific roles like Developer, QA, Designer, etc.\n\nClick **Next** to continue.',
    targetSelector: '[data-testid="section-team-members"]',
    position: 'top'
  },
  {
    id: 'click-member',
    type: 'click-action',
    title: 'Click on a Team Member',
    description: '**Click on any team member\'s name** to see their project assignments and roles.',
    targetSelector: '[data-testid^="member-item-"]',
    clickSelector: '[data-testid^="member-item-"]',
    position: 'bottom'
  },
  {
    id: 'member-popup-explain',
    type: 'wait-for-close',
    title: 'Team Member Details',
    description: `This popup shows the team member's assignments:

• **Email** - Click the mail icon to reveal their email
• **Project Assignments** - Only shows active/renewal projects (not ended ones)
• **Role Badge** - Each project shows their specific role (Developer, QA, etc.)

**Close this popup** to continue.`,
    position: 'center'
  },
  {
    id: 'click-filter-role',
    type: 'click-action',
    title: 'Filter by Role',
    description: 'Want to find all Developers or QA engineers?\n\n**Click the "Filter by Role" button** to see the filtering options.',
    targetSelector: '[data-testid="button-filter-member-role"]',
    clickSelector: '[data-testid="button-filter-member-role"]',
    position: 'bottom'
  },
  {
    id: 'filter-role-explain',
    type: 'wait-for-close',
    title: 'Role Filter Options',
    description: `This filter helps you find team members by role:

• **Search** - Type to quickly find a specific role
• **Role Checkboxes** - Select one or more roles to filter
• **Clear All** - Reset the filter to show everyone

The header count updates to show filtered results (e.g., "5 of 13").

**Click outside or press Escape** to close and continue.`,
    position: 'center'
  },
  {
    id: 'click-add-member',
    type: 'click-action',
    title: 'Add New Team Member',
    description: '**Click "Add Team Member"** to see the form for adding new team members.',
    targetSelector: '[data-testid="button-add-member"]',
    clickSelector: '[data-testid="button-add-member"]',
    position: 'bottom'
  },
  {
    id: 'add-member-form',
    type: 'wait-for-close',
    title: 'Add Team Member Form',
    description: `Add a new team member with:

• **Team Member Name** - Their full name (required)
• **Email** - Contact email (optional but recommended)

Once added, they can be assigned to projects with specific roles.

**Close this dialog** to continue.`,
    position: 'center'
  },
  // ALL PROJECTS SECTION
  {
    id: 'intro-projects',
    type: 'info',
    title: 'All Projects Section',
    description: `This is your complete **project portfolio**. 

• Projects are **sorted by end date** (soonest first) so you can focus on upcoming deadlines
• Projects with **no end date** appear at the bottom
• Color indicators on cards show status: Green (active), Amber (ending soon), Gray (ended)

Click **Next** to continue.`,
    targetSelector: '#all-projects-section',
    position: 'top'
  },
  {
    id: 'click-project',
    type: 'click-action',
    title: 'Click on a Project',
    description: '**Click on any project card** to see its full details.',
    targetSelector: '[data-testid^="project-card-"]',
    clickSelector: '[data-testid^="project-card-"]',
    position: 'bottom'
  },
  {
    id: 'project-popup-explain',
    type: 'wait-for-close',
    title: 'Project Details',
    description: `The project detail popup shows:

• **Contact Person Name** - The customer's contact person
• **Project Lead(s)** - Who manages this project (click to see email)
• **Team Members** - Everyone assigned with their roles
• **Timeline** - Start and end dates with status indicator
• **Project Type** - CMS (Community Managed) or SS (Strategic Services)

**Close this popup** to continue.`,
    position: 'center'
  },
  {
    id: 'click-project-filter',
    type: 'click-action',
    title: 'Project Filters',
    description: 'Let\'s explore filtering options.\n\n**Click the "Filter by Lead" button** to see how to filter projects.',
    targetSelector: '[data-testid="button-filter-lead"]',
    clickSelector: '[data-testid="button-filter-lead"]',
    position: 'bottom'
  },
  {
    id: 'project-filter-explain',
    type: 'wait-for-close',
    title: 'Filter Projects',
    description: `Filter projects by:

• **Project Lead** - See only a specific lead's projects
• **Team Member** - Find projects a person works on
• **Project Type** - Filter by CMS or SS

Multiple filters can be combined. The project count updates to show results.

**Close this** to continue.`,
    position: 'center'
  },
  {
    id: 'click-add-project',
    type: 'click-action',
    title: 'Add New Project',
    description: '**Click "Add New Project"** to see all the fields needed to create a project.',
    targetSelector: '[data-testid="button-add-project"]',
    clickSelector: '[data-testid="button-add-project"]',
    position: 'bottom'
  },
  {
    id: 'add-project-form',
    type: 'wait-for-close',
    title: 'Add Project Form - Fields Explained',
    description: `Each field in the project form:

• **Project Customer** - The customer/client name (required)
• **Contact Person Name** - Customer's contact (required)
• **Project Lead(s)** - Select 1 or 2 leads:
  - Selecting 2 makes them **Co-Leads** sharing responsibility
  - First selected becomes the **Primary Lead**
• **Team Members & Roles** - Assign people with their roles:
  - Select a member, then type their role (e.g., "Developer")
  - Leave role blank if TBD (shows caution warning)
• **Project Type** - CMS or SS (required)
• **Start Date** - When project begins
• **End Date** - When project ends (missing = caution warning)

**Close this dialog** to continue.`,
    position: 'center'
  },
  // SUBMIT REPORT TAB
  {
    id: 'submit-tab',
    type: 'tab-change',
    title: 'Submit Report Tab',
    description: 'Now let\'s go to the **Submit Report** tab where project leads submit their weekly status updates.\n\nClick **Next** to switch tabs.',
    tabValue: 'submit',
    position: 'center'
  },
  {
    id: 'progress-bars',
    type: 'click-action',
    title: 'Progress Overview',
    description: `These cards show weekly submission progress:

• **Reports Submitted** - How many reports are done
• **Reports Pending** - How many still need submission

**Click on either card** - it will filter the list below to show only those projects!`,
    targetSelector: '[data-testid="progress-submitted"]',
    clickSelector: '[data-testid="progress-submitted"]',
    position: 'bottom'
  },
  {
    id: 'progress-filtered',
    type: 'info',
    title: 'Automatic Filtering',
    description: `Notice how clicking the progress card filtered the list below! 

The cards are interactive - click again to clear the filter, or click the other card to see pending reports.

**Auto-Archiving Note:** Reports automatically archive every Wednesday at 00:00 UTC. The next week starts fresh.

Click **Next** to continue.`,
    position: 'center'
  },
  {
    id: 'click-lead-status',
    type: 'click-action',
    title: 'Find Your Projects',
    description: 'Projects are organized by lead below. Find your name (or any lead) and **click on a project tile** to submit or view a report.',
    targetSelector: '[data-testid^="status-"]',
    clickSelector: '[data-testid^="status-"]',
    position: 'bottom'
  },
  {
    id: 'report-form-explain',
    type: 'wait-for-close',
    title: 'Weekly Report Form',
    description: `This is where you submit the weekly report:

• **Health Status** - Choose one:
  - On Track (green) - Everything going well
  - Needs Attention (amber) - Some concerns
  - Critical (red) - Urgent issues

• **Progress This Week** - What was accomplished
• **Current Challenges** - Issues or blockers
• **Next Steps** - Plans for next week
• **Team Member Feedback** (optional) - Individual feedback

**Two options to save:**
• **Save as Draft** - Save and finish later
• **Submit Report** - Finalize the report

**Close this dialog** to continue.`,
    position: 'center'
  },
  {
    id: 'click-status-filter',
    type: 'click-action',
    title: 'Filter Options',
    description: '**Click the Filter button** to see filtering options for finding specific leads or statuses.',
    targetSelector: '[data-testid="button-status-filter"]',
    clickSelector: '[data-testid="button-status-filter"]',
    position: 'bottom'
  },
  {
    id: 'status-filter-explain',
    type: 'wait-for-close',
    title: 'Report Status Filters',
    description: `Filter the report list by:

• **By Lead** - Search and select specific leads
• **By Status** - Show only Submitted, Drafted, or Pending

These filters help you quickly find what you need.

**Close this** to continue.`,
    position: 'center'
  },
  // VIEW CURRENT REPORT TAB
  {
    id: 'view-tab',
    type: 'tab-change',
    title: 'View Current Report Tab',
    description: 'Finally, let\'s check the **View Current Report** tab.\n\nClick **Next** to switch tabs.',
    tabValue: 'view',
    position: 'center'
  },
  {
    id: 'view-reports-explain',
    type: 'info',
    title: 'View Submitted Reports',
    description: `This tab shows all **submitted weekly reports** for the current period.

After submitting your report in the Submit tab, **come here to verify it appears correctly**. You'll see:

• Your report with health status
• Progress, challenges, and next steps
• Team member feedback if provided

This is where leadership reviews all submissions.

Click **Next** to finish the tour.`,
    position: 'center'
  },
  {
    id: 'input-complete',
    type: 'info',
    title: 'Input Workflow Complete!',
    description: `Congratulations! You now know how to:

✓ Manage Project Leads and view their details
✓ Manage Team Members and filter by role
✓ Create Projects with team assignments and roles
✓ Understand co-lead projects
✓ Submit Weekly Reports with health status
✓ Save drafts and submit final reports
✓ Use filters to find what you need
✓ Verify your submissions

The **Review Workflow** (coming soon) will cover analyzing reports, AI insights, and exporting data.`,
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
  const [waitingForAction, setWaitingForAction] = useState(false);

  const steps = inputTourSteps;
  const step = steps[currentStep];

  const clearHighlight = useCallback(() => {
    setHighlightStyle({});
  }, []);

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
      
      setHighlightStyle({
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        border: '3px solid hsl(var(--primary))',
        borderRadius: '12px',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px hsl(var(--primary))',
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'all 0.3s ease'
      });

      // Position tooltip near the element
      const tooltipTop = rect.bottom + 20;
      const tooltipLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 450));
      
      setTooltipStyle({
        position: 'fixed',
        top: tooltipTop > window.innerHeight - 350 ? Math.max(16, rect.top - 320) : tooltipTop,
        left: tooltipLeft,
        zIndex: 9999,
        maxWidth: '420px'
      });

      return true;
    }
    return false;
  }, []);

  const positionTooltipCenter = useCallback(() => {
    clearHighlight();
    setTooltipStyle({
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
      maxWidth: '500px'
    });
  }, [clearHighlight]);

  const executeStep = useCallback(async () => {
    if (!step) return;

    // Handle tab changes first
    if (step.type === 'tab-change' && step.tabValue && onTabChange) {
      onTabChange(step.tabValue);
      await new Promise(resolve => setTimeout(resolve, 400));
      positionTooltipCenter();
      return;
    }

    // Info steps - just show tooltip
    if (step.type === 'info') {
      if (step.targetSelector) {
        scrollToElement(step.targetSelector);
        await new Promise(resolve => setTimeout(resolve, 500));
        highlightElement(step.targetSelector);
      } else {
        positionTooltipCenter();
      }
      return;
    }

    // Click action - highlight and wait for user to click
    if (step.type === 'click-action' && step.targetSelector) {
      scrollToElement(step.targetSelector);
      await new Promise(resolve => setTimeout(resolve, 500));
      highlightElement(step.targetSelector);
      setWaitingForAction(true);
      return;
    }

    // Wait for close - show center tooltip
    if (step.type === 'wait-for-close') {
      positionTooltipCenter();
      setWaitingForAction(true);
      return;
    }
  }, [step, onTabChange, scrollToElement, highlightElement, positionTooltipCenter]);

  // Listen for clicks on highlighted elements
  useEffect(() => {
    if (!isTouring || !step || step.type !== 'click-action' || !step.clickSelector) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickableElement = target.closest(step.clickSelector!);
      if (clickableElement) {
        // User clicked the right element, advance to next step after a delay
        setWaitingForAction(false);
        clearHighlight();
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 600);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isTouring, step, clearHighlight]);

  // Listen for dialog/popup closes
  useEffect(() => {
    if (!isTouring || !step || step.type !== 'wait-for-close') return;

    const checkForDialogClose = () => {
      // Check if any dialog is open
      const openDialogs = document.querySelectorAll('[role="dialog"]:not([data-testid="tour-tooltip"])');
      const openPopovers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      
      if (openDialogs.length === 0 && openPopovers.length === 0) {
        // All dialogs/popovers closed, advance
        setWaitingForAction(false);
        setCurrentStep(prev => prev + 1);
      }
    };

    // Check periodically
    const interval = setInterval(checkForDialogClose, 300);
    
    // Initial check after a short delay
    setTimeout(checkForDialogClose, 500);

    return () => clearInterval(interval);
  }, [isTouring, step, currentStep]);

  useEffect(() => {
    if (isTouring && step) {
      executeStep();
    }
  }, [isTouring, currentStep, executeStep, step]);

  const startTour = (mode: 'input' | 'review') => {
    setShowModeSelect(false);
    setCurrentStep(0);
    setIsTouring(true);
    setWaitingForAction(false);
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
    setWaitingForAction(false);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setWaitingForAction(false);
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  };

  const renderDescription = (text: string) => {
    // Simple markdown-like rendering for bold text
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const getActionText = () => {
    if (step?.type === 'click-action') {
      return 'Click the highlighted element to continue';
    }
    if (step?.type === 'wait-for-close') {
      return 'Close the popup/dialog to continue';
    }
    return null;
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
              Interactive App Tour
            </DialogTitle>
            <DialogDescription>
              Choose a workflow to learn the application hands-on.
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
                  <div className="flex-1">
                    <h3 className="font-semibold">Input Workflow</h3>
                    <p className="text-sm text-muted-foreground">
                      Learn to add leads, members, projects, and submit reports.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
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
                      Coming soon: Review reports, AI insights, and exports.
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
            <Card className="shadow-2xl border-2 border-primary/50 bg-background/98 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      {currentStep + 1} / {steps.length}
                    </Badge>
                    <h3 className="font-bold text-lg">{step?.title}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 -mt-1 -mr-1"
                    onClick={endTour}
                    data-testid="button-tour-close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground whitespace-pre-line mb-4 leading-relaxed">
                  {step && renderDescription(step.description)}
                </div>

                {/* Action indicator */}
                {waitingForAction && getActionText() && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                    <MousePointer className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium text-primary">{getActionText()}</span>
                  </div>
                )}

                {/* Navigation */}
                {!waitingForAction && (
                  <div className="flex justify-end pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={nextStep}
                      className="gap-1"
                      data-testid="button-tour-next"
                    >
                      {currentStep === steps.length - 1 ? 'Finish Tour' : 'Next'}
                      {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
