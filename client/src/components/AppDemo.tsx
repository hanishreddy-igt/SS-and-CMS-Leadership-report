import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, ChevronRight, X, Play, MousePointer, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StepType = 'info' | 'click-to-open' | 'explain-popup' | 'tab-change';

interface TourStep {
  id: string;
  type: StepType;
  title: string;
  description: string;
  targetSelector?: string;
  tabValue?: string;
}

const inputTourSteps: TourStep[] = [
  // PROJECT LEADS SECTION
  {
    id: 'intro-leads',
    type: 'info',
    title: 'Project Leads Section',
    description: 'This section shows all your **Project Leads** - the people who oversee project delivery and submit weekly reports.\n\nEach lead can manage one or multiple projects.',
    targetSelector: '[data-testid="section-project-leads"]',
  },
  {
    id: 'click-lead',
    type: 'click-to-open',
    title: 'View Lead Details',
    description: '**Click on any project lead tile** to see their details.',
    targetSelector: '[data-testid^="lead-item-"]',
  },
  {
    id: 'lead-popup-explain',
    type: 'explain-popup',
    title: 'Project Lead Details',
    description: `This popup shows:

• **Email** - Click the mail icon to reveal their email
• **Projects Managed** - All projects this lead oversees  
• **Status Colors** - Green (active), Amber (ending soon), Gray (ended)

**Click X or outside to close and continue.**`,
  },
  {
    id: 'click-add-lead',
    type: 'click-to-open',
    title: 'Add New Project Lead',
    description: '**Click the "Add Project Lead" button** to see the form.',
    targetSelector: '[data-testid="button-add-lead"]',
  },
  {
    id: 'add-lead-form',
    type: 'explain-popup',
    title: 'Add Project Lead Form',
    description: `Form fields:

• **Project Lead Name** - Full name (required)
• **Email** - Contact email (recommended)

**Close this dialog to continue.**`,
  },
  // TEAM MEMBERS SECTION
  {
    id: 'intro-members',
    type: 'info',
    title: 'Team Members Section',
    description: 'This section shows **Team Members** - people who work on projects with specific roles like Developer, QA, Designer, etc.',
    targetSelector: '[data-testid="section-team-members"]',
  },
  {
    id: 'click-member',
    type: 'click-to-open',
    title: 'View Member Details',
    description: '**Click on any team member tile** to see their assignments.',
    targetSelector: '[data-testid^="member-item-"]',
  },
  {
    id: 'member-popup-explain',
    type: 'explain-popup',
    title: 'Team Member Details',
    description: `This popup shows:

• **Email** - Click mail icon to reveal
• **Project Assignments** - Only active/renewal projects
• **Role Badge** - Their role on each project

**Close to continue.**`,
  },
  {
    id: 'click-filter-role',
    type: 'click-to-open',
    title: 'Filter by Role',
    description: '**Click "Filter by Role"** to see filtering options.',
    targetSelector: '[data-testid="button-filter-member-role"]',
  },
  {
    id: 'filter-role-explain',
    type: 'explain-popup',
    title: 'Role Filter',
    description: `Filter team members by role:

• **Search** - Type to find a role
• **Checkboxes** - Select roles to filter
• **Clear All** - Reset filters

**Click outside to close and continue.**`,
  },
  {
    id: 'click-add-member',
    type: 'click-to-open',
    title: 'Add Team Member',
    description: '**Click "Add Team Member"** to see the form.',
    targetSelector: '[data-testid="button-add-member"]',
  },
  {
    id: 'add-member-form',
    type: 'explain-popup',
    title: 'Add Team Member Form',
    description: `Form fields:

• **Name** - Full name (required)
• **Email** - Contact email (recommended)

Once added, they can be assigned to projects.

**Close to continue.**`,
  },
  // ALL PROJECTS SECTION
  {
    id: 'intro-projects',
    type: 'info',
    title: 'All Projects Section',
    description: `Your complete **project portfolio**.

• Sorted by **end date** (soonest first)
• Projects with **no end date** appear at bottom
• Color indicators: Green (active), Amber (ending soon), Gray (ended)`,
    targetSelector: '#all-projects-section',
  },
  {
    id: 'click-project',
    type: 'click-to-open',
    title: 'View Project Details',
    description: '**Click on any project card** to see full details.',
    targetSelector: '[data-testid^="project-card-"]',
  },
  {
    id: 'project-popup-explain',
    type: 'explain-popup',
    title: 'Project Details',
    description: `Project popup shows:

• **Contact Person** - Customer's contact
• **Project Lead(s)** - Click to see email
• **Team Members** - Everyone with their roles
• **Timeline** - Start and end dates
• **Type** - CMS or SS

**Close to continue.**`,
  },
  {
    id: 'click-project-filter',
    type: 'click-to-open',
    title: 'Filter Projects',
    description: '**Click "Filter by Lead"** to see filter options.',
    targetSelector: '[data-testid="button-filter-lead"]',
  },
  {
    id: 'project-filter-explain',
    type: 'explain-popup',
    title: 'Project Filters',
    description: `Filter by:

• **Project Lead** - See a lead's projects
• **Team Member** - Find projects they work on
• **Project Type** - CMS or SS

**Close to continue.**`,
  },
  {
    id: 'click-add-project',
    type: 'click-to-open',
    title: 'Add New Project',
    description: '**Click "Add New Project"** to see all fields.',
    targetSelector: '[data-testid="button-add-project"]',
  },
  {
    id: 'add-project-form',
    type: 'explain-popup',
    title: 'Project Form Fields',
    description: `Each field explained:

• **Project Customer** - Customer name (required)
• **Contact Person** - Customer's contact (required)
• **Project Lead(s)** - Select 1 or 2 leads
  - 2 leads = **Co-Leads** (first is primary)
• **Team Members** - Assign with roles
  - Empty role = caution warning
• **Type** - CMS or SS (required)
• **Dates** - Start and end dates
  - No end date = caution warning

**Close to continue.**`,
  },
  // SUBMIT REPORT TAB
  {
    id: 'submit-tab',
    type: 'tab-change',
    title: 'Submit Report Tab',
    description: 'Now let\'s go to the **Submit Report** tab where leads submit weekly status updates.',
    tabValue: 'submit',
  },
  {
    id: 'progress-bars-info',
    type: 'info',
    title: 'Progress Overview',
    description: `These cards show submission progress:

• **Reports Submitted** - Completed reports
• **Reports Pending** - Still need submission

**Click either card** to filter the list below!

Also note: Reports **auto-archive every Wednesday** at 00:00 UTC.`,
    targetSelector: '[data-testid="progress-submitted"]',
  },
  {
    id: 'click-report-tile',
    type: 'click-to-open',
    title: 'Submit a Report',
    description: 'Find a project tile and **click on it** to see the report form.',
    targetSelector: '[data-testid^="status-"]',
  },
  {
    id: 'report-form-explain',
    type: 'explain-popup',
    title: 'Weekly Report Form',
    description: `Report fields:

• **Health Status**:
  - On Track (green) - Going well
  - Needs Attention (amber) - Some concerns
  - Critical (red) - Urgent issues

• **Progress** - What was accomplished
• **Challenges** - Issues or blockers
• **Next Steps** - Plans for next week
• **Team Feedback** (optional)

**Save Options:**
• **Save as Draft** - Finish later
• **Submit Report** - Finalize

**Close to continue.**`,
  },
  {
    id: 'click-status-filter',
    type: 'click-to-open',
    title: 'Filter Reports',
    description: '**Click the Filter button** to see options.',
    targetSelector: '[data-testid="button-status-filter"]',
  },
  {
    id: 'status-filter-explain',
    type: 'explain-popup',
    title: 'Report Filters',
    description: `Filter by:

• **By Lead** - Find specific leads
• **By Status** - Submitted, Drafted, or Pending

**Close to continue.**`,
  },
  // VIEW CURRENT REPORT TAB
  {
    id: 'view-tab',
    type: 'tab-change',
    title: 'View Current Report Tab',
    description: 'Finally, let\'s check the **View Current Report** tab.',
    tabValue: 'view',
  },
  {
    id: 'view-reports-explain',
    type: 'info',
    title: 'View Submitted Reports',
    description: `This tab shows all **submitted reports** for the current week.

After submitting in the Submit tab, **verify your report appears here**.

Leadership uses this view to review all submissions.`,
  },
  {
    id: 'input-complete',
    type: 'info',
    title: 'Tour Complete!',
    description: `You now know how to:

✓ Manage Project Leads
✓ Manage Team Members & filter by role
✓ Create Projects with roles & co-leads
✓ Submit Weekly Reports
✓ Save drafts and submit
✓ Use all filters
✓ Verify submissions

**Review Workflow** coming soon!`,
  }
];

interface AppDemoProps {
  onTabChange?: (tab: string) => void;
}

export default function AppDemo({ onTabChange }: AppDemoProps) {
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [awaitingClick, setAwaitingClick] = useState(false);
  const [awaitingClose, setAwaitingClose] = useState(false);
  const [popupWasOpen, setPopupWasOpen] = useState(false);
  const [highlightFound, setHighlightFound] = useState(false);
  const stepProcessedRef = useRef(false);

  const steps = inputTourSteps;
  const step = steps[currentStep];

  // Clear highlights
  const clearHighlights = useCallback(() => {
    document.querySelectorAll('.tour-highlight-active').forEach(el => {
      el.classList.remove('tour-highlight-active');
    });
    setHighlightFound(false);
  }, []);

  // Find and highlight element with retry
  const findAndHighlight = useCallback((selector: string, maxRetries = 10): Promise<Element | null> => {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const tryFind = () => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            element.classList.add('tour-highlight-active');
            setHighlightFound(true);
          }, 300);
          resolve(element);
        } else if (attempts < maxRetries) {
          attempts++;
          setTimeout(tryFind, 200);
        } else {
          console.warn(`Tour: Could not find element with selector "${selector}"`);
          resolve(null);
        }
      };
      
      tryFind();
    });
  }, []);

  // Check if any popup is currently open
  const isPopupOpen = useCallback(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const popovers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
    
    // Filter out our mode select dialog
    const realDialogs = Array.from(dialogs).filter(d => 
      !d.closest('[data-testid="dialog-demo-mode-select"]')
    );
    
    return realDialogs.length > 0 || popovers.length > 0;
  }, []);

  // Execute current step
  useEffect(() => {
    if (!isTouring || !step || stepProcessedRef.current) return;
    
    stepProcessedRef.current = true;

    const runStep = async () => {
      // Reset states
      setAwaitingClick(false);
      setAwaitingClose(false);
      setPopupWasOpen(false);
      setHighlightFound(false);
      clearHighlights();

      // Handle tab changes
      if (step.type === 'tab-change' && step.tabValue && onTabChange) {
        onTabChange(step.tabValue);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Handle info steps - scroll and highlight
      if (step.type === 'info') {
        if (step.targetSelector) {
          await new Promise(resolve => setTimeout(resolve, 300));
          await findAndHighlight(step.targetSelector);
        }
      }

      // Handle click-to-open steps
      if (step.type === 'click-to-open' && step.targetSelector) {
        await new Promise(resolve => setTimeout(resolve, 300));
        await findAndHighlight(step.targetSelector);
        setAwaitingClick(true);
      }

      // Handle explain-popup steps - wait for popup to actually be open
      if (step.type === 'explain-popup') {
        setAwaitingClose(true);
      }
    };

    runStep();
  }, [isTouring, currentStep, step, onTabChange, findAndHighlight, clearHighlights]);

  // Reset step processed flag when step changes
  useEffect(() => {
    stepProcessedRef.current = false;
  }, [currentStep]);

  // Listen for clicks on target elements (for click-to-open steps)
  useEffect(() => {
    if (!isTouring || !awaitingClick || !step?.targetSelector) return;

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedElement = target.closest(step.targetSelector!);
      
      if (clickedElement) {
        clearHighlights();
        setAwaitingClick(false);
        
        // Wait for popup to open, then advance
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 600);
      }
    };

    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [isTouring, awaitingClick, step, clearHighlights]);

  // Listen for popup closes (for explain-popup steps)
  useEffect(() => {
    if (!isTouring || !awaitingClose) return;

    let checkInterval: ReturnType<typeof setInterval>;
    let waitForOpenInterval: ReturnType<typeof setInterval>;
    let waitForOpenTimeout: ReturnType<typeof setTimeout>;
    let initialDelayTimeout: ReturnType<typeof setTimeout>;
    let isCleanedUp = false;
    
    // Wait a bit before starting popup detection to let animations complete
    initialDelayTimeout = setTimeout(() => {
      if (isCleanedUp) return;
      
      // First, wait for popup to be detected as open
      waitForOpenInterval = setInterval(() => {
        if (isCleanedUp) {
          clearInterval(waitForOpenInterval);
          return;
        }
        
        if (isPopupOpen()) {
          setPopupWasOpen(true);
          clearInterval(waitForOpenInterval);
          
          // Wait a moment before starting to check for close
          setTimeout(() => {
            if (isCleanedUp) return;
            
            // Now start checking for close
            checkInterval = setInterval(() => {
              if (isCleanedUp) {
                clearInterval(checkInterval);
                return;
              }
              
              if (!isPopupOpen()) {
                clearInterval(checkInterval);
                setAwaitingClose(false);
                setPopupWasOpen(false);
                
                // Small delay before advancing
                setTimeout(() => {
                  if (!isCleanedUp) {
                    setCurrentStep(prev => prev + 1);
                  }
                }, 400);
              }
            }, 250);
          }, 500); // Wait 500ms after popup detected before checking for close
        }
      }, 150);

      // Timeout after 15 seconds if popup never opens
      waitForOpenTimeout = setTimeout(() => {
        if (!isCleanedUp && waitForOpenInterval) {
          clearInterval(waitForOpenInterval);
        }
      }, 15000);
    }, 300); // Initial delay before starting detection

    return () => {
      isCleanedUp = true;
      if (initialDelayTimeout) clearTimeout(initialDelayTimeout);
      if (waitForOpenInterval) clearInterval(waitForOpenInterval);
      if (waitForOpenTimeout) clearTimeout(waitForOpenTimeout);
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isTouring, awaitingClose, isPopupOpen]);

  const startTour = () => {
    setShowModeSelect(false);
    setCurrentStep(0);
    setIsTouring(true);
    stepProcessedRef.current = false;
    if (onTabChange) {
      onTabChange('teams-projects');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const endTour = () => {
    setIsTouring(false);
    setCurrentStep(0);
    setAwaitingClick(false);
    setAwaitingClose(false);
    setPopupWasOpen(false);
    setHighlightFound(false);
    clearHighlights();
  };

  const nextStep = () => {
    clearHighlights();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  };

  const renderDescription = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-primary font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Tour panel - positioned on the right side
  const tourPanel = (
    <div 
      className="fixed top-20 right-4 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto pointer-events-auto"
      style={{ zIndex: 2147483647 }}
      data-tour-panel="true"
    >
      <Card className="shadow-2xl border-2 border-primary bg-background">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <Badge variant="default" className="text-xs mb-1">
                Step {currentStep + 1} of {steps.length}
              </Badge>
              <h3 className="font-bold text-base leading-tight">{step?.title}</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={endTour}
              data-testid="button-tour-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Description */}
          <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed mb-3">
            {step && renderDescription(step.description)}
          </div>

          {/* Action indicator for click steps */}
          {awaitingClick && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30 mb-3">
              <MousePointer className="h-4 w-4 text-primary animate-bounce shrink-0" />
              <span className="text-xs font-medium text-primary">
                {highlightFound ? 'Click the highlighted element' : 'Looking for element...'}
              </span>
            </div>
          )}

          {/* Action indicator for close steps */}
          {awaitingClose && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-3">
              <X className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {popupWasOpen ? 'Close the popup to continue' : 'Waiting for popup...'}
              </span>
            </div>
          )}

          {/* Next button - only show when not waiting */}
          {!awaitingClick && !awaitingClose && (
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
  );

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
              Learn by clicking through the real app interface.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Card 
              className="cursor-pointer hover-elevate transition-all border-2 hover:border-primary"
              onClick={startTour}
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

            <Card className="cursor-not-allowed opacity-50 border-2">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Play className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground">Review Workflow</h3>
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tour Panel - rendered via Portal, positioned on the right */}
      {isTouring && step && createPortal(tourPanel, document.body)}

      {/* CSS for highlighting */}
      <style>{`
        .tour-highlight-active {
          position: relative;
          z-index: 50 !important;
          box-shadow: 0 0 0 4px hsl(var(--primary)), 0 0 20px 4px hsl(var(--primary) / 0.5) !important;
          border-radius: 8px;
          animation: tour-pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 4px hsl(var(--primary)), 0 0 20px 4px hsl(var(--primary) / 0.5); }
          50% { box-shadow: 0 0 0 6px hsl(var(--primary)), 0 0 30px 8px hsl(var(--primary) / 0.7); }
        }
      `}</style>
    </>
  );
}
