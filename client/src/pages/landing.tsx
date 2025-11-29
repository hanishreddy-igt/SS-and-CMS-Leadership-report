import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, Users, BarChart } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Weekly Leadership Report Tool</h1>
          </div>
          <Button onClick={handleLogin} data-testid="button-login">
            Sign In
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center bg-muted/30">
        <div className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Comprehensive Project Management & Reporting
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Manage teams, track projects, and submit weekly progress reports with health status monitoring
            </p>
            <Button size="lg" onClick={handleLogin} data-testid="button-login-hero">
              Get Started - Sign In with Google
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              <Shield className="inline h-4 w-4 mr-1" />
              Restricted to @ignitetech.com and @khoros.com email addresses
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="feature-team-management">
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Team Management</CardTitle>
                <CardDescription>
                  Add and manage team members and project leads in one unified system
                </CardDescription>
              </CardHeader>
            </Card>

            <Card data-testid="feature-project-tracking">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Project Tracking</CardTitle>
                <CardDescription>
                  Create projects with customer details, assign leads and team members
                </CardDescription>
              </CardHeader>
            </Card>

            <Card data-testid="feature-weekly-reports">
              <CardHeader>
                <BarChart className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Weekly Reports</CardTitle>
                <CardDescription>
                  Submit progress reports with health status (On Track, Needs Attention, Critical)
                </CardDescription>
              </CardHeader>
            </Card>

            <Card data-testid="feature-jira-integration">
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Jira Integration</CardTitle>
                <CardDescription>
                  Import projects directly from Jira epics with automatic team assignment
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Card className="mt-12">
            <CardHeader>
              <CardTitle>Secure Access</CardTitle>
              <CardDescription>
                This application contains confidential project data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>Access is restricted to authorized email domains:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>@ignitetech.com</li>
                  <li>@khoros.com</li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  Sign in with your corporate Google account to access the application.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Weekly Leadership Report Tool - Secure Project Management & Reporting
        </div>
      </footer>
    </div>
  );
}
