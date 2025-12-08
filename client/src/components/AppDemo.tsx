import { useState } from 'react';
import { HelpCircle, Play, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

type WorkflowType = 'input' | 'review';

interface AppDemoProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
}

function AppDemo({ currentTab }: AppDemoProps) {
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleWorkflowSelect = (workflow: WorkflowType) => {
    setSelectedWorkflow(workflow);
    setShowModeSelect(false);
    setShowComingSoon(true);
  };

  const closeComingSoon = () => {
    setShowComingSoon(false);
    setSelectedWorkflow(null);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowModeSelect(true)}
        className="text-muted-foreground hover:text-foreground"
        data-testid="button-help"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Dialog open={showModeSelect} onOpenChange={setShowModeSelect}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-demo-mode-select">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Choose Help Topic
            </DialogTitle>
            <DialogDescription>
              Select which workflow you'd like to learn about.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <Card 
              className="cursor-pointer transition-all hover-elevate border-2 hover:border-primary/50"
              onClick={() => handleWorkflowSelect('input')}
              data-testid="card-input-workflow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Input Workflow</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Learn how to manage leads, team members, and create projects
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover-elevate border-2 hover:border-primary/50"
              onClick={() => handleWorkflowSelect('review')}
              data-testid="card-review-workflow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent/50">
                    <Video className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Review Workflow</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Learn how to submit reports, view analytics, and export data
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-coming-soon">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {selectedWorkflow === 'input' ? 'Input Workflow Guide' : 'Review Workflow Guide'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Play className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">
              Video tutorial with Loom walkthrough will be available here shortly.
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={closeComingSoon} data-testid="button-close-coming-soon">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AppDemo;
