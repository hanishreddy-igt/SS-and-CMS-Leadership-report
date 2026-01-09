import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, BarChart, Zap, Lock, TrendingUp, CheckCircle2 } from "lucide-react";
import logoImage from '@assets/IgniteTech__Khoros_Logos-removebg-preview_1767951034958.png';

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logoImage} 
              alt="IgniteTech + Khoros" 
              className="h-12 object-contain"
            />
            <h1 className="text-xl font-bold text-foreground">SS & CMA Dashboard</h1>
          </div>
          <Button onClick={handleLogin} data-testid="button-login" variant="default">
            Sign In
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="executive-header relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/3 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/2 rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10 container mx-auto px-6 py-24 max-w-6xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">SS & CMA Dashboard</span>
              </div>
              
              <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-foreground">
                Strategic Services
                <br />
                & Community Managed
                <br />
                Dashboard
              </h2>
              
              <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
                Comprehensive tracking system for Strategic Services & Community Managed Services.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" onClick={handleLogin} data-testid="button-login-hero" variant="default" className="text-lg px-8 py-6">
                  Get Started — Sign In with Google
                </Button>
              </div>
              
              <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span>Restricted to @ignitetech.com email addresses</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {[
                { label: 'Projects Tracked', value: '50+', icon: FolderIcon },
                { label: 'Team Members', value: '100+', icon: Users },
                { label: 'Weekly Reports', value: '200+', icon: FileText },
                { label: 'Health Metrics', value: '99%', icon: TrendingUp },
              ].map((stat, i) => (
                <div key={stat.label} className="metric-card text-center fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                  <stat.icon className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
                  <p className="text-3xl font-bold platinum-text">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <p className="section-label">Features</p>
              <h3 className="text-3xl font-bold mt-2">Everything you need for project oversight</h3>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="glass-card border-white/5" data-testid="feature-team-management">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-fit mb-4">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">Team Management</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Add and manage team members and project leads in one unified system
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="glass-card border-white/5" data-testid="feature-project-tracking">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-fit mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">Project Tracking</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Create projects with customer details, assign leads and team members
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="glass-card border-white/5" data-testid="feature-weekly-reports">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-fit mb-4">
                    <BarChart className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">Weekly Reports</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Submit progress reports with health status tracking and team feedback
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="glass-card border-white/5" data-testid="feature-jira-integration">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-fit mb-4">
                    <Zap className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">Jira Integration</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Import projects directly from Jira epics with automatic team assignment
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 border-t border-white/5">
          <div className="container mx-auto max-w-4xl">
            <Card className="glass-card border-white/5 overflow-hidden">
              <CardHeader className="text-center pb-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-fit mx-auto mb-4">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl">Secure Enterprise Access</CardTitle>
                <CardDescription className="text-muted-foreground">
                  This application contains confidential project data and is protected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-center">
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">@ignitetech.com</span>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Sign in with your corporate Google account to access the application.
                    Only authorized IgniteTech employees can view project data.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            SS & CMA Dashboard — IgniteTech
          </p>
        </div>
      </footer>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
