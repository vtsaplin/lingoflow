import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TopicView from "@/pages/TopicView";
import { SidebarNav } from "@/components/SidebarNav";

function Router() {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <SidebarNav />
      <main className="flex-1 pt-16 md:pt-0 overflow-y-auto h-screen scroll-smooth">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/topic/:id" component={TopicView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
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
